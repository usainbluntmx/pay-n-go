// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IPayNGoGateway
/// @notice Interface mínima del Gateway para que el Router pueda llamarlo
interface IPayNGoGateway {
    function executeGaslessPayment(
        address user,
        address recipient,
        uint256 amount,
        uint256 gasLimit
    ) external returns (bytes32 txId);

    function getEthBalance() external view returns (uint256);
}

/// @title PayNGoRouter
/// @notice Enruta pagos en stablecoins por la ruta óptima
/// @dev Si el gateway tiene ETH y el monto califica, usa gasless automáticamente
contract PayNGoRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constantes ───────────────────────────────────────────────
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant MAX_ROUTES = 10;

    // Monto máximo para gasless automático: 500 USDC (6 decimales)
    uint256 public gaslessThreshold = 500 * 10 ** 6;

    // ─── Estructuras ──────────────────────────────────────────────

    enum RouteType { Direct, MultiHop, PayLink }

    struct Route {
        uint256 id;
        address tokenIn;
        address tokenOut;
        RouteType routeType;
        uint256 feeBps;
        bool active;
        address handler;
    }

    struct PaymentOrder {
        address sender;
        address recipient;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 routeId;
        uint256 deadline;
        bytes32 orderId;
    }

    struct RouteQuote {
        uint256 routeId;
        uint256 amountOut;
        uint256 fee;
        uint256 estimatedGas;
        bool available;
    }

    // ─── Estado ───────────────────────────────────────────────────
    uint256 private _routeCounter;
    uint256 private _orderCounter;

    mapping(uint256 => Route) public routes;
    mapping(bytes32 => bool) public executedOrders;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256[]) public tokenRoutes;

    address public payNGoLinks;
    address public payNGoGateway;
    address public feeRecipient;

    // ─── Eventos ──────────────────────────────────────────────────
    event RouteAdded(
        uint256 indexed routeId,
        address tokenIn,
        address tokenOut,
        RouteType routeType
    );

    event RouteUpdated(uint256 indexed routeId, bool active);

    event PaymentRouted(
        bytes32 indexed orderId,
        address indexed sender,
        address indexed recipient,
        uint256 routeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event GaslessPaymentRouted(
        bytes32 indexed txId,
        address indexed sender,
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event TokenSupported(address indexed token, bool supported);
    event GatewayUpdated(address indexed gateway);
    event GaslessThresholdUpdated(uint256 threshold);

    // ─── Errores ──────────────────────────────────────────────────
    error TokenNotSupported(address token);
    error RouteNotFound();
    error RouteNotActive(uint256 routeId);
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);
    error DeadlineExpired(uint256 deadline);
    error OrderAlreadyExecuted(bytes32 orderId);
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidDeadline();

    // ─── Constructor ──────────────────────────────────────────────
    constructor(
        address _feeRecipient,
        address _payNGoLinks,
        address _usdc
    ) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        payNGoLinks = _payNGoLinks;
        supportedTokens[_usdc] = true;

        _addRoute(_usdc, _usdc, RouteType.Direct, 0, address(0));

        emit TokenSupported(_usdc, true);
    }

    // ─── Funciones principales ────────────────────────────────────

    /// @notice Obtiene cotizaciones de todas las rutas disponibles
    function getQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (RouteQuote[] memory quotes) {
        uint256[] memory routeIds = _getRoutesForPair(tokenIn, tokenOut);
        quotes = new RouteQuote[](routeIds.length);

        for (uint256 i = 0; i < routeIds.length; i++) {
            Route memory route = routes[routeIds[i]];
            uint256 totalFeeBps = FEE_BPS + route.feeBps;
            uint256 fee = (amountIn * totalFeeBps) / BPS_BASE;
            uint256 amountOut = amountIn - fee;

            quotes[i] = RouteQuote({
                routeId: routeIds[i],
                amountOut: amountOut,
                fee: fee,
                estimatedGas: _estimateGas(route.routeType),
                available: route.active
            });
        }
    }

    /// @notice Obtiene la mejor ruta para un par dado
    /// @return bestRouteId ID de la mejor ruta (0 si no hay rutas activas)
    /// @return bestAmountOut Monto de salida estimado (0 si no hay rutas activas)
    function getBestRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 bestRouteId, uint256 bestAmountOut) {
        uint256[] memory routeIds = _getRoutesForPair(tokenIn, tokenOut);

        bestAmountOut = 0;
        bestRouteId = 0;

        if (routeIds.length == 0) return (0, 0);

        for (uint256 i = 0; i < routeIds.length; i++) {
            Route memory route = routes[routeIds[i]];
            if (!route.active) continue;

            uint256 totalFeeBps = FEE_BPS + route.feeBps;
            uint256 fee = (amountIn * totalFeeBps) / BPS_BASE;
            uint256 amountOut = amountIn - fee;

            if (amountOut > bestAmountOut) {
                bestAmountOut = amountOut;
                bestRouteId = routeIds[i];
            }
        }
        // Si bestRouteId sigue en 0, no hay rutas activas
        // Devuelve (0, 0) sin revertir — el caller verifica
    }

    /// @notice Verifica si un pago califica para ser gasless automáticamente
    /// @param amountIn Monto del pago
    /// @return true si el gateway tiene ETH y el monto está bajo el threshold
    function isGaslessEligible(uint256 amountIn) public view returns (bool) {
        if (payNGoGateway == address(0)) return false;
        if (amountIn > gaslessThreshold) return false;
        return IPayNGoGateway(payNGoGateway).getEthBalance() > 0;
    }

    /// @notice Ejecuta un pago por la ruta óptima
    /// @dev Si califica para gasless, usa el Gateway automáticamente
    function executePayment(
        PaymentOrder calldata order
    ) external nonReentrant returns (bytes32 orderId) {
        // Validaciones
        if (order.amountIn == 0) revert InvalidAmount();
        if (order.recipient == address(0)) revert InvalidRecipient();
        if (order.deadline < block.timestamp) revert DeadlineExpired(order.deadline);
        if (!supportedTokens[order.tokenIn]) revert TokenNotSupported(order.tokenIn);
        if (!supportedTokens[order.tokenOut]) revert TokenNotSupported(order.tokenOut);

        // Calcular fee y monto final
        uint256 fee = (order.amountIn * FEE_BPS) / BPS_BASE;
        uint256 amountOut = order.amountIn - fee;

        // Slippage check
        if (amountOut < order.minAmountOut) {
            revert SlippageExceeded(amountOut, order.minAmountOut);
        }

        // Generar orderId único
        orderId = keccak256(abi.encodePacked(
            msg.sender,
            order.recipient,
            order.amountIn,
            block.timestamp,
            _orderCounter++
        ));

        if (executedOrders[orderId]) revert OrderAlreadyExecuted(orderId);
        executedOrders[orderId] = true;

        // ─── Decisión automática: gasless o directo ───────────────
        if (isGaslessEligible(order.amountIn)) {
            // Transferir USDC del sender al router primero
            IERC20(order.tokenIn).safeTransferFrom(
                msg.sender,
                address(this),
                order.amountIn
            );

            // Transferir fee al protocolo
            if (fee > 0) {
                IERC20(order.tokenIn).safeTransfer(feeRecipient, fee);
            }

            // Aprobar al gateway para que mueva el amountOut
            IERC20(order.tokenIn).approve(payNGoGateway, amountOut);

            // Gateway ejecuta la transferencia al recipient (paga el gas)
            bytes32 txId = IPayNGoGateway(payNGoGateway).executeGaslessPayment(
                address(this),
                order.recipient,
                amountOut,
                150_000
            );

            emit GaslessPaymentRouted(
                txId,
                msg.sender,
                order.recipient,
                order.amountIn,
                amountOut,
                fee
            );

            return orderId;
        }

        // ─── Flujo directo (usuario tiene ETH para gas) ───────────
        uint256 routeId = order.routeId;
        if (routeId == 0) {
            (routeId, ) = this.getBestRoute(order.tokenIn, order.tokenOut, order.amountIn);
            if (routeId == 0) revert RouteNotFound();
        }

        Route memory route = routes[routeId];
        if (!route.active) revert RouteNotActive(routeId);

        // Recalcular fee con el feeBps de la ruta específica
        uint256 routeFeeBps = FEE_BPS + route.feeBps;
        uint256 routeFee = (order.amountIn * routeFeeBps) / BPS_BASE;
        uint256 routeAmountOut = order.amountIn - routeFee;

        if (routeAmountOut < order.minAmountOut) {
            revert SlippageExceeded(routeAmountOut, order.minAmountOut);
        }

        IERC20(order.tokenIn).safeTransferFrom(
            msg.sender,
            order.recipient,
            routeAmountOut
        );

        if (routeFee > 0) {
            IERC20(order.tokenIn).safeTransferFrom(
                msg.sender,
                feeRecipient,
                routeFee
            );
        }

        emit PaymentRouted(
            orderId,
            msg.sender,
            order.recipient,
            routeId,
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            routeAmountOut,
            routeFee
        );
    }

    // ─── Vistas ───────────────────────────────────────────────────

    function getRoute(uint256 routeId) external view returns (Route memory) {
        return routes[routeId];
    }

    function getRoutesForPair(
        address tokenIn,
        address tokenOut
    ) external view returns (uint256[] memory) {
        return _getRoutesForPair(tokenIn, tokenOut);
    }

    function totalRoutes() external view returns (uint256) {
        return _routeCounter;
    }

    // ─── Admin ────────────────────────────────────────────────────

    function addRoute(
        address tokenIn,
        address tokenOut,
        RouteType routeType,
        uint256 feeBps,
        address handler
    ) external onlyOwner returns (uint256) {
        return _addRoute(tokenIn, tokenOut, routeType, feeBps, handler);
    }

    function setRouteActive(uint256 routeId, bool active) external onlyOwner {
        routes[routeId].active = active;
        emit RouteUpdated(routeId, active);
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    function setPayNGoLinks(address _payNGoLinks) external onlyOwner {
        payNGoLinks = _payNGoLinks;
    }

    /// @notice Configura el Gateway para pagos gasless automáticos
    function setPayNGoGateway(address _gateway) external onlyOwner {
        payNGoGateway = _gateway;
        emit GatewayUpdated(_gateway);
    }

    /// @notice Configura el monto máximo para gasless automático
    function setGaslessThreshold(uint256 _threshold) external onlyOwner {
        gaslessThreshold = _threshold;
        emit GaslessThresholdUpdated(_threshold);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    // ─── Internos ─────────────────────────────────────────────────

    function _addRoute(
        address tokenIn,
        address tokenOut,
        RouteType routeType,
        uint256 feeBps,
        address handler
    ) internal returns (uint256 id) {
        id = ++_routeCounter;

        routes[id] = Route({
            id: id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            routeType: routeType,
            feeBps: feeBps,
            active: true,
            handler: handler
        });

        tokenRoutes[tokenIn].push(id);
        emit RouteAdded(id, tokenIn, tokenOut, routeType);
    }

    function _getRoutesForPair(
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256[] memory) {
        uint256[] memory allRoutes = tokenRoutes[tokenIn];
        uint256 count = 0;

        for (uint256 i = 0; i < allRoutes.length; i++) {
            if (routes[allRoutes[i]].tokenOut == tokenOut) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allRoutes.length; i++) {
            if (routes[allRoutes[i]].tokenOut == tokenOut) {
                result[idx++] = allRoutes[i];
            }
        }

        return result;
    }

    function _estimateGas(RouteType routeType) internal pure returns (uint256) {
        if (routeType == RouteType.Direct) return 65_000;
        if (routeType == RouteType.MultiHop) return 150_000;
        if (routeType == RouteType.PayLink) return 120_000;
        return 65_000;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PayNGoRouter
/// @notice Enruta pagos en stablecoins por la ruta óptima
contract PayNGoRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constantes ───────────────────────────────────────────────
    uint256 public constant FEE_BPS = 30;       // 0.3% fee del router
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant MAX_ROUTES = 10;

    // ─── Estructuras ──────────────────────────────────────────────

    enum RouteType { Direct, MultiHop, PayLink }

    struct Route {
        uint256 id;
        address tokenIn;
        address tokenOut;
        RouteType routeType;
        uint256 feeBps;         // fee adicional de esta ruta
        bool active;
        address handler;        // contrato que ejecuta la ruta (0x0 = directo)
    }

    struct PaymentOrder {
        address sender;
        address recipient;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;   // slippage protection
        uint256 routeId;        // 0 = auto-seleccionar
        uint256 deadline;
        bytes32 orderId;        // ID único del pago
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
    mapping(address => uint256[]) public tokenRoutes; // token => routeIds

    address public payNGoLinks;     // dirección del contrato PayNGoLinks
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

    event TokenSupported(address indexed token, bool supported);

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

        // Ruta directa USDC → USDC por defecto
        _addRoute(_usdc, _usdc, RouteType.Direct, 0, address(0));

        emit TokenSupported(_usdc, true);
    }

    // ─── Funciones principales ────────────────────────────────────

    /// @notice Obtiene cotizaciones de todas las rutas disponibles para un par
    /// @param tokenIn Token de entrada
    /// @param tokenOut Token de salida
    /// @param amountIn Monto de entrada
    /// @return quotes Array de cotizaciones por ruta
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
    /// @param tokenIn Token de entrada
    /// @param tokenOut Token de salida
    /// @param amountIn Monto de entrada
    /// @return bestRouteId ID de la mejor ruta
    /// @return bestAmountOut Monto de salida estimado
    function getBestRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 bestRouteId, uint256 bestAmountOut) {
        uint256[] memory routeIds = _getRoutesForPair(tokenIn, tokenOut);
        if (routeIds.length == 0) revert RouteNotFound();

        bestAmountOut = 0;
        bestRouteId = 0;

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

        if (bestRouteId == 0) revert RouteNotFound();
    }

    /// @notice Ejecuta un pago por la ruta especificada o la óptima
    /// @param order Orden de pago con todos los parámetros
    function executePayment(
        PaymentOrder calldata order
    ) external nonReentrant returns (bytes32 orderId) {
        // Validaciones
        if (order.amountIn == 0) revert InvalidAmount();
        if (order.recipient == address(0)) revert InvalidRecipient();
        if (order.deadline < block.timestamp) revert DeadlineExpired(order.deadline);
        if (!supportedTokens[order.tokenIn]) revert TokenNotSupported(order.tokenIn);
        if (!supportedTokens[order.tokenOut]) revert TokenNotSupported(order.tokenOut);

        // Generar orderId único
        orderId = keccak256(abi.encodePacked(
            msg.sender,
            order.recipient,
            order.amountIn,
            block.timestamp,
            _orderCounter++
        ));

        if (executedOrders[orderId]) revert OrderAlreadyExecuted(orderId);

        // Seleccionar ruta
        uint256 routeId = order.routeId;
        if (routeId == 0) {
            (routeId, ) = this.getBestRoute(order.tokenIn, order.tokenOut, order.amountIn);
        }

        Route memory route = routes[routeId];
        if (!route.active) revert RouteNotActive(routeId);

        // Calcular fee y monto final
        uint256 totalFeeBps = FEE_BPS + route.feeBps;
        uint256 fee = (order.amountIn * totalFeeBps) / BPS_BASE;
        uint256 amountOut = order.amountIn - fee;

        // Slippage check
        if (amountOut < order.minAmountOut) {
            revert SlippageExceeded(amountOut, order.minAmountOut);
        }

        // Marcar como ejecutada
        executedOrders[orderId] = true;

        // Ejecutar transferencia
        IERC20(order.tokenIn).safeTransferFrom(
            msg.sender,
            order.recipient,
            amountOut
        );

        // Fee al protocolo
        if (fee > 0) {
            IERC20(order.tokenIn).safeTransferFrom(
                msg.sender,
                feeRecipient,
                fee
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
            amountOut,
            fee
        );
    }

    // ─── Vistas ───────────────────────────────────────────────────

    /// @notice Retorna una ruta por ID
    function getRoute(uint256 routeId) external view returns (Route memory) {
        return routes[routeId];
    }

    /// @notice Retorna todas las rutas para un par de tokens
    function getRoutesForPair(
        address tokenIn,
        address tokenOut
    ) external view returns (uint256[] memory) {
        return _getRoutesForPair(tokenIn, tokenOut);
    }

    /// @notice Total de rutas registradas
    function totalRoutes() external view returns (uint256) {
        return _routeCounter;
    }

    // ─── Admin ────────────────────────────────────────────────────

    /// @notice Agrega una nueva ruta
    function addRoute(
        address tokenIn,
        address tokenOut,
        RouteType routeType,
        uint256 feeBps,
        address handler
    ) external onlyOwner returns (uint256) {
        return _addRoute(tokenIn, tokenOut, routeType, feeBps, handler);
    }

    /// @notice Activa o desactiva una ruta
    function setRouteActive(uint256 routeId, bool active) external onlyOwner {
        routes[routeId].active = active;
        emit RouteUpdated(routeId, active);
    }

    /// @notice Agrega soporte para un token
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /// @notice Actualiza la dirección de PayNGoLinks
    function setPayNGoLinks(address _payNGoLinks) external onlyOwner {
        payNGoLinks = _payNGoLinks;
    }

    /// @notice Actualiza el receptor de fees
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

        // Contar rutas que coinciden con el par
        for (uint256 i = 0; i < allRoutes.length; i++) {
            if (routes[allRoutes[i]].tokenOut == tokenOut) {
                count++;
            }
        }

        // Construir array filtrado
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
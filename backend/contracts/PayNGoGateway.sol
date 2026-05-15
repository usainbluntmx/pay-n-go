// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PayNGoGateway
/// @notice Paymaster ERC-4337 — patrocina gas para pagos en USDC
/// @dev Implementación simplificada compatible con EntryPoint v0.6
contract PayNGoGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constantes ───────────────────────────────────────────────
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant MAX_GAS_PRICE = 500 gwei;
    uint256 public constant MIN_DEPOSIT = 0.01 ether;

        // ─── Estado ───────────────────────────────────────────────────
    address public usdcToken;
    address public payNGoRouter;

    // Precio de gas en USDC por wei (6 decimales)
    // Ej: 2000 = cobrar 0.002 USDC por cada 1000 wei de gas
    uint256 public gasPriceInUsdc;

    // Sponsorship modes
    enum SponsorMode {
        Full,       // Gas 100% gratis para el usuario
        Partial,    // Usuario paga X% en USDC
        Token       // Usuario paga todo en USDC
    }

    struct SponsorPolicy {
        SponsorMode mode;
        uint256 userShareBps;       // % que paga el usuario (solo en Partial)
        uint256 maxGasPerTx;        // gas máximo por tx sponsoreada
        bool active;
    }

    struct SponsoredTx {
        address user;
        uint256 gasUsed;
        uint256 usdcCharged;
        uint256 ethSponsored;
        uint256 timestamp;
        bool completed;
    }

    // Políticas por dirección (0x0 = política default)
    mapping(address => SponsorPolicy) public policies;
    mapping(bytes32 => SponsoredTx) public sponsoredTxs;
    mapping(address => uint256) public userGasSponsored;    // ETH total sponsoreado por usuario
    mapping(address => uint256) public userUsdcCharged;     // USDC total cobrado a usuario
    mapping(address => bool) public whitelistedUsers;
    mapping(address => bool) public blacklistedUsers;

    uint256 public totalEthSponsored;
    uint256 public totalUsdcCollected;
    uint256 private _txCounter;

    bool public whitelistOnly;  // si true, solo usuarios en whitelist

    // ─── Eventos ──────────────────────────────────────────────────
    event GasSponsored(
        bytes32 indexed txId,
        address indexed user,
        uint256 gasUsed,
        uint256 ethSponsored,
        uint256 usdcCharged
    );

    event DepositReceived(address indexed sender, uint256 amount);
    event WithdrawExecuted(address indexed recipient, uint256 amount);
    event PolicySet(address indexed target, SponsorMode mode, uint256 userShareBps);
    event UserWhitelisted(address indexed user, bool whitelisted);
    event GasPriceUpdated(uint256 newPrice);

    // ─── Errores ──────────────────────────────────────────────────
    error InsufficientDeposit();
    error UserBlacklisted(address user);
    error UserNotWhitelisted(address user);
    error GasPriceTooHigh(uint256 gasPrice);
    error GasLimitExceeded(uint256 gasUsed, uint256 maxGas);
    error InvalidPolicy();
    error TransferFailed();
    error TxAlreadyProcessed(bytes32 txId);

    // ─── Constructor ──────────────────────────────────────────────
    constructor(
        address _usdcToken,
        address _payNGoRouter
    ) Ownable(msg.sender) {
        usdcToken = _usdcToken;
        payNGoRouter = _payNGoRouter;
        gasPriceInUsdc = 2000; // 0.002 USDC por 1000 wei de gas (default)
        whitelistOnly = false;

        // Política default: Full sponsorship, max 300k gas
        policies[address(0)] = SponsorPolicy({
            mode: SponsorMode.Full,
            userShareBps: 0,
            maxGasPerTx: 300_000,
            active: true
        });
    }

    // ─── Función principal ────────────────────────────────────────

    /// @notice Patrocina el gas de una transacción
    /// @param user Dirección del usuario
    /// @param gasLimit Gas límite de la transacción
    /// @param gasPrice Precio del gas en wei
    /// @return txId ID único de la transacción sponsoreada
    function sponsorTransaction(
        address user,
        uint256 gasLimit,
        uint256 gasPrice
    ) external nonReentrant returns (bytes32 txId) {
        // Validaciones de usuario
        if (blacklistedUsers[user]) revert UserBlacklisted(user);
        if (whitelistOnly && !whitelistedUsers[user]) revert UserNotWhitelisted(user);
        if (gasPrice > MAX_GAS_PRICE) revert GasPriceTooHigh(gasPrice);

        // Obtener política aplicable
        SponsorPolicy memory policy = _getPolicyFor(user);
        if (!policy.active) revert InvalidPolicy();
        if (gasLimit > policy.maxGasPerTx) revert GasLimitExceeded(gasLimit, policy.maxGasPerTx);

        // Calcular costo de gas en ETH
        uint256 ethCost = gasLimit * gasPrice;

        // Verificar que el gateway tiene suficiente ETH
        if (address(this).balance < ethCost) revert InsufficientDeposit();

        // Calcular cuánto USDC cobrar al usuario según política
        uint256 usdcToCharge = 0;
        uint256 ethToSponsor = ethCost;

        if (policy.mode == SponsorMode.Partial) {
            // Usuario paga userShareBps% en USDC
            uint256 userEthShare = (ethCost * policy.userShareBps) / BPS_BASE;
            usdcToCharge = _ethToUsdc(userEthShare);
            ethToSponsor = ethCost - userEthShare;
        } else if (policy.mode == SponsorMode.Token) {
            // Usuario paga todo en USDC
            usdcToCharge = _ethToUsdc(ethCost);
            ethToSponsor = ethCost;
        }

        // Cobrar USDC al usuario si aplica
        if (usdcToCharge > 0) {
            IERC20(usdcToken).safeTransferFrom(user, address(this), usdcToCharge);
            userUsdcCharged[user] += usdcToCharge;
            totalUsdcCollected += usdcToCharge;
        }

        // Generar txId único
        txId = keccak256(abi.encodePacked(
            user,
            gasLimit,
            gasPrice,
            block.timestamp,
            _txCounter++
        ));

        if (sponsoredTxs[txId].timestamp != 0) revert TxAlreadyProcessed(txId);

        // Registrar la transacción sponsoreada
        sponsoredTxs[txId] = SponsoredTx({
            user: user,
            gasUsed: gasLimit,
            usdcCharged: usdcToCharge,
            ethSponsored: ethToSponsor,
            timestamp: block.timestamp,
            completed: true
        });

        userGasSponsored[user] += ethToSponsor;
        totalEthSponsored += ethToSponsor;

        emit GasSponsored(txId, user, gasLimit, ethToSponsor, usdcToCharge);
    }

    /// @notice Ejecuta un pago gasless
/// @dev Puede ser llamado por el usuario directamente o por el Router
/// @param user Dirección lógica del usuario (para registro y políticas)
/// @param recipient Receptor del pago
/// @param amount Monto en USDC
/// @param gasLimit Gas estimado para la tx
function executeGaslessPayment(
    address user,
    address recipient,
    uint256 amount,
    uint256 gasLimit
) external nonReentrant returns (bytes32 txId) {
    if (blacklistedUsers[user]) revert UserBlacklisted(user);
    if (whitelistOnly && !whitelistedUsers[user] && !whitelistedUsers[msg.sender]) {
        revert UserNotWhitelisted(user);
    }

    SponsorPolicy memory policy = _getPolicyFor(user);
    if (!policy.active) revert InvalidPolicy();
    if (gasLimit > policy.maxGasPerTx) revert GasLimitExceeded(gasLimit, policy.maxGasPerTx);

    // Siempre transferir desde msg.sender:
    // - Si lo llama el usuario directamente: msg.sender = usuario (debe aprobar antes)
    // - Si lo llama el Router: msg.sender = Router (ya tiene el USDC aprobado)
    IERC20(usdcToken).safeTransferFrom(msg.sender, recipient, amount);

    txId = keccak256(abi.encodePacked(
        user,
        recipient,
        amount,
        block.timestamp,
        _txCounter++
    ));

    sponsoredTxs[txId] = SponsoredTx({
        user: user,
        gasUsed: gasLimit,
        usdcCharged: 0,
        ethSponsored: 0,
        timestamp: block.timestamp,
        completed: true
    });

    emit GasSponsored(txId, user, gasLimit, 0, 0);
}

    // ─── Vistas ───────────────────────────────────────────────────

    /// @notice Retorna el balance de ETH del gateway
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Retorna el balance de USDC del gateway
    function getUsdcBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
    }

    /// @notice Retorna la política aplicable a un usuario
    function getPolicyFor(address user) external view returns (SponsorPolicy memory) {
        return _getPolicyFor(user);
    }

    /// @notice Retorna stats de un usuario
    function getUserStats(address user) external view returns (
        uint256 ethSponsored,
        uint256 usdcCharged,
        bool isWhitelisted,
        bool isBlacklisted
    ) {
        return (
            userGasSponsored[user],
            userUsdcCharged[user],
            whitelistedUsers[user],
            blacklistedUsers[user]
        );
    }

    /// @notice Retorna una transacción sponsoreada por ID
    function getSponsoredTx(bytes32 txId) external view returns (SponsoredTx memory) {
        return sponsoredTxs[txId];
    }

    /// @notice Estima el costo en USDC de patrocinar una tx
    function estimateUsdcCost(
        address user,
        uint256 gasLimit,
        uint256 gasPrice
    ) external view returns (uint256 usdcCost, uint256 ethCost) {
        SponsorPolicy memory policy = _getPolicyFor(user);
        ethCost = gasLimit * gasPrice;

        if (policy.mode == SponsorMode.Full) {
            usdcCost = 0;
        } else if (policy.mode == SponsorMode.Partial) {
            uint256 userEthShare = (ethCost * policy.userShareBps) / BPS_BASE;
            usdcCost = _ethToUsdc(userEthShare);
        } else {
            usdcCost = _ethToUsdc(ethCost);
        }
    }

    // ─── Admin ────────────────────────────────────────────────────

    /// @notice Deposita ETH para pagar gas de usuarios
    function deposit() external payable onlyOwner {
        if (msg.value == 0) revert InsufficientDeposit();
        emit DepositReceived(msg.sender, msg.value);
    }

    /// @notice Retira ETH del gateway
    function withdraw(uint256 amount, address payable recipient) external onlyOwner {
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit WithdrawExecuted(recipient, amount);
    }

    /// @notice Retira USDC cobrado a usuarios
    function withdrawUsdc(uint256 amount, address recipient) external onlyOwner {
        IERC20(usdcToken).safeTransfer(recipient, amount);
    }

    /// @notice Establece política de sponsorship para una dirección
    /// @param target Dirección objetivo (address(0) = política default)
    function setPolicy(
        address target,
        SponsorMode mode,
        uint256 userShareBps,
        uint256 maxGasPerTx
    ) external onlyOwner {
        if (mode == SponsorMode.Partial && userShareBps == 0) revert InvalidPolicy();
        if (userShareBps > BPS_BASE) revert InvalidPolicy();

        policies[target] = SponsorPolicy({
            mode: mode,
            userShareBps: userShareBps,
            maxGasPerTx: maxGasPerTx,
            active: true
        });

        emit PolicySet(target, mode, userShareBps);
    }

    /// @notice Agrega o remueve usuario de whitelist
    function setWhitelisted(address user, bool whitelisted) external onlyOwner {
        whitelistedUsers[user] = whitelisted;
        emit UserWhitelisted(user, whitelisted);
    }

    /// @notice Agrega o remueve usuario de blacklist
    function setBlacklisted(address user, bool blacklisted) external onlyOwner {
        blacklistedUsers[user] = blacklisted;
    }

    /// @notice Activa o desactiva modo whitelist-only
    function setWhitelistOnly(bool enabled) external onlyOwner {
        whitelistOnly = enabled;
    }

    /// @notice Actualiza precio de gas en USDC
    function setGasPriceInUsdc(uint256 newPrice) external onlyOwner {
        gasPriceInUsdc = newPrice;
        emit GasPriceUpdated(newPrice);
    }

    /// @notice Actualiza dirección del router
    function setPayNGoRouter(address _router) external onlyOwner {
        payNGoRouter = _router;
    }

    // ─── Internos ─────────────────────────────────────────────────

    function _getPolicyFor(address user) internal view returns (SponsorPolicy memory) {
        SponsorPolicy memory userPolicy = policies[user];
        if (userPolicy.maxGasPerTx > 0) return userPolicy;
        return policies[address(0)]; // fallback a default
    }

    function _ethToUsdc(uint256 ethAmount) internal view returns (uint256) {
        // gasPriceInUsdc = USDC (6 dec) por cada 1000 wei de gas
        return (ethAmount * gasPriceInUsdc) / 1000;
    }

    // ─── Receive ──────────────────────────────────────────────────
    receive() external payable {
        emit DepositReceived(msg.sender, msg.value);
    }
}
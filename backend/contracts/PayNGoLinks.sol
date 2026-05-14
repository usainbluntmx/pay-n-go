// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PayNGoLinks
/// @notice Crea y gestiona payment links en stablecoins sobre Ethereum
contract PayNGoLinks is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constantes ───────────────────────────────────────────────
    uint256 public constant FEE_BPS = 50; // 0.5% fee de protocolo
    uint256 public constant BPS_BASE = 10_000;

    // ─── Estado ───────────────────────────────────────────────────
    uint256 private _linkCounter;
    address public feeRecipient;
    mapping(address => bool) public supportedTokens;

    enum LinkStatus { Active, Paid, Cancelled, Expired }

    struct PaymentLink {
        uint256 id;
        address creator;
        address recipient;
        address token;
        uint256 amount;
        uint256 expiresAt;    // 0 = sin expiración
        LinkStatus status;
        string memo;          // descripción opcional
        uint256 createdAt;
        uint256 paidAt;
        address paidBy;
    }

    mapping(uint256 => PaymentLink) public links;
    mapping(address => uint256[]) public linksByCreator;
    mapping(address => uint256[]) public linksByRecipient;

    // ─── Eventos ──────────────────────────────────────────────────
    event LinkCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 expiresAt,
        string memo
    );

    event LinkPaid(
        uint256 indexed id,
        address indexed paidBy,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 fee
    );

    event LinkCancelled(uint256 indexed id, address indexed creator);
    event TokenSupported(address indexed token, bool supported);

    // ─── Errores ──────────────────────────────────────────────────
    error TokenNotSupported(address token);
    error LinkNotActive(uint256 id);
    error LinkExpired(uint256 id);
    error NotLinkCreator(uint256 id);
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidExpiry();

    // ─── Constructor ──────────────────────────────────────────────
    constructor(address _feeRecipient, address _usdc) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        supportedTokens[_usdc] = true;
        emit TokenSupported(_usdc, true);
    }

    // ─── Funciones principales ────────────────────────────────────

    /// @notice Crea un nuevo payment link
    /// @param recipient Dirección que recibirá el pago
    /// @param token Dirección del token (USDC)
    /// @param amount Monto en unidades del token (6 decimales para USDC)
    /// @param expiresIn Segundos hasta expiración. 0 = sin expiración
    /// @param memo Descripción opcional del pago
    /// @return id ID único del link creado
    function createLink(
        address recipient,
        address token,
        uint256 amount,
        uint256 expiresIn,
        string calldata memo
    ) external returns (uint256 id) {
        if (!supportedTokens[token]) revert TokenNotSupported(token);
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 expiresAt = 0;
        if (expiresIn > 0) {
            if (expiresIn < 60) revert InvalidExpiry(); // mínimo 1 minuto
            expiresAt = block.timestamp + expiresIn;
        }

        id = ++_linkCounter;

        links[id] = PaymentLink({
            id: id,
            creator: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            expiresAt: expiresAt,
            status: LinkStatus.Active,
            memo: memo,
            createdAt: block.timestamp,
            paidAt: 0,
            paidBy: address(0)
        });

        linksByCreator[msg.sender].push(id);
        linksByRecipient[recipient].push(id);

        emit LinkCreated(id, msg.sender, recipient, token, amount, expiresAt, memo);
    }

    /// @notice Paga un link existente
    /// @param id ID del link a pagar
    function payLink(uint256 id) external nonReentrant {
        PaymentLink storage link = links[id];

        if (link.status != LinkStatus.Active) revert LinkNotActive(id);

        // Verificar expiración
        if (link.expiresAt != 0 && block.timestamp > link.expiresAt) {
            link.status = LinkStatus.Expired;
            revert LinkExpired(id);
        }

        // Calcular fee
        uint256 fee = (link.amount * FEE_BPS) / BPS_BASE;
        uint256 amountToRecipient = link.amount - fee;

        // Marcar como pagado antes de transferir (reentrancy guard)
        link.status = LinkStatus.Paid;
        link.paidAt = block.timestamp;
        link.paidBy = msg.sender;

        // Transferir al receptor
        IERC20(link.token).safeTransferFrom(
            msg.sender,
            link.recipient,
            amountToRecipient
        );

        // Transferir fee al protocolo
        if (fee > 0) {
            IERC20(link.token).safeTransferFrom(
                msg.sender,
                feeRecipient,
                fee
            );
        }

        emit LinkPaid(id, msg.sender, link.recipient, link.token, link.amount, fee);
    }

    /// @notice Cancela un link activo (solo el creador)
    /// @param id ID del link a cancelar
    function cancelLink(uint256 id) external {
        PaymentLink storage link = links[id];

        if (link.creator != msg.sender) revert NotLinkCreator(id);
        if (link.status != LinkStatus.Active) revert LinkNotActive(id);

        link.status = LinkStatus.Cancelled;

        emit LinkCancelled(id, msg.sender);
    }

    // ─── Vistas ───────────────────────────────────────────────────

    /// @notice Retorna un link por ID
    function getLink(uint256 id) external view returns (PaymentLink memory) {
        return links[id];
    }

    /// @notice Retorna todos los IDs de links creados por una dirección
    function getLinksByCreator(address creator) external view returns (uint256[] memory) {
        return linksByCreator[creator];
    }

    /// @notice Retorna todos los IDs de links donde alguien es receptor
    function getLinksByRecipient(address recipient) external view returns (uint256[] memory) {
        return linksByRecipient[recipient];
    }

    /// @notice Verifica si un link está activo y no expirado
    function isLinkPayable(uint256 id) external view returns (bool) {
        PaymentLink memory link = links[id];
        if (link.status != LinkStatus.Active) return false;
        if (link.expiresAt != 0 && block.timestamp > link.expiresAt) return false;
        return true;
    }

    /// @notice Retorna el total de links creados
    function totalLinks() external view returns (uint256) {
        return _linkCounter;
    }

    // ─── Admin ────────────────────────────────────────────────────

    /// @notice Agrega o remueve soporte para un token
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /// @notice Actualiza el receptor de fees
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }
}
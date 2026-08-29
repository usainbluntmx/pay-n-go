import { Address } from "viem";
import { ContractAddresses } from "./types";

// ─── Chain IDs ────────────────────────────────────────────────────
export const CHAIN_IDS = {
    ETHEREUM_MAINNET: 1,
    ETHEREUM_SEPOLIA: 11155111,
    ARBITRUM_SEPOLIA: 421614,
    HARDHAT: 31337,
} as const;

// ─── Contract Addresses ───────────────────────────────────────────
// Solo chains con el stack PayNGo completo desplegado (Links + Router +
// Gateway + token). Para chains donde solo existe el token — ej. MXNB en
// Arbitrum Sepolia, que se mueve por transfer directo + Pimlico paymaster
// ERC-4337, sin pasar por ningún contrato PayNGo — ver TOKEN_ADDRESSES abajo.
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
    [CHAIN_IDS.ETHEREUM_SEPOLIA]: {
        payNGoLinks: "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29",
        payNGoRouter: "0x52e5d621290F9941254d42F8AB905E3fAB32f6F1",
        // Redeployado tras el fix de seguridad en sponsorTransaction/
        // executeGaslessPayment — ver PayNGoGateway.sol. La address vieja
        // (0x4a0D7CfF...) quedó huérfana, no la uses.
        payNGoGateway: "0x27Ff5c9F7F09b0bEC212F1dB21eCab6abDbaed80",
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
};

// ─── Token Addresses (sin stack PayNGo desplegado) ────────────────
// Para chains/tokens que Pay'n Go soporta en producto pero donde no hay
// PayNGoLinks/Router/Gateway — el frontend mueve estos tokens con
// transfer() directo + Pimlico paymaster (ERC-4337), no vía estos
// contratos. Útil para construir integraciones que solo necesitan
// conocer la dirección del token, no el stack de pagos completo.
export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
    [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
        mxnb: "0x82B9e52b26A2954E113F94Ff26647754d5a4247D",
    },
};

// ─── ABIs ─────────────────────────────────────────────────────────
export const PAYNGO_LINKS_ABI = [
    {
        type: "constructor",
        inputs: [
            { name: "_feeRecipient", type: "address" },
            { name: "_usdc", type: "address" },
        ],
    },
    {
        type: "function",
        name: "createLink",
        stateMutability: "nonpayable",
        inputs: [
            { name: "recipient", type: "address" },
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "expiresIn", type: "uint256" },
            { name: "memo", type: "string" },
        ],
        outputs: [{ name: "id", type: "uint256" }],
    },
    {
        type: "function",
        name: "payLink",
        stateMutability: "nonpayable",
        inputs: [{ name: "id", type: "uint256" }],
        outputs: [],
    },
    {
        type: "function",
        name: "cancelLink",
        stateMutability: "nonpayable",
        inputs: [{ name: "id", type: "uint256" }],
        outputs: [],
    },
    {
        type: "function",
        name: "getLink",
        stateMutability: "view",
        inputs: [{ name: "id", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "creator", type: "address" },
                    { name: "recipient", type: "address" },
                    { name: "token", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "expiresAt", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "memo", type: "string" },
                    { name: "createdAt", type: "uint256" },
                    { name: "paidAt", type: "uint256" },
                    { name: "paidBy", type: "address" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "getLinksByCreator",
        stateMutability: "view",
        inputs: [{ name: "creator", type: "address" }],
        outputs: [{ name: "", type: "uint256[]" }],
    },
    {
        type: "function",
        name: "getLinksByRecipient",
        stateMutability: "view",
        inputs: [{ name: "recipient", type: "address" }],
        outputs: [{ name: "", type: "uint256[]" }],
    },
    {
        type: "function",
        name: "isLinkPayable",
        stateMutability: "view",
        inputs: [{ name: "id", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "totalLinks",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "event",
        name: "LinkCreated",
        inputs: [
            { name: "id", type: "uint256", indexed: true },
            { name: "creator", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "token", type: "address", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "expiresAt", type: "uint256", indexed: false },
            { name: "memo", type: "string", indexed: false },
        ],
    },
    {
        type: "event",
        name: "LinkPaid",
        inputs: [
            { name: "id", type: "uint256", indexed: true },
            { name: "paidBy", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "token", type: "address", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "fee", type: "uint256", indexed: false },
        ],
    },
    // Custom errors de PayNGoLinks.sol — sin estas declaraciones, viem no
    // puede decodificar los reverts del contrato (queda como un selector
    // hex sin resolver, ej. "0x946a237a") y rethrowAsPayNGoError() nunca
    // encuentra el ContractFunctionRevertedError que necesita. Fix: v0.4.0.
    {
        type: "error",
        name: "TokenNotSupported",
        inputs: [{ name: "token", type: "address" }],
    },
    {
        type: "error",
        name: "LinkNotActive",
        inputs: [{ name: "id", type: "uint256" }],
    },
    {
        type: "error",
        name: "LinkExpired",
        inputs: [{ name: "id", type: "uint256" }],
    },
    {
        type: "error",
        name: "NotLinkCreator",
        inputs: [{ name: "id", type: "uint256" }],
    },
    {
        type: "error",
        name: "InvalidAmount",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidRecipient",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidExpiry",
        inputs: [],
    },
] as const;

export const PAYNGO_ROUTER_ABI = [
    {
        type: "constructor",
        inputs: [
            { name: "_feeRecipient", type: "address" },
            { name: "_payNGoLinks", type: "address" },
            { name: "_usdc", type: "address" },
        ],
    },
    {
        type: "function",
        name: "executePayment",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "order",
                type: "tuple",
                components: [
                    { name: "sender", type: "address" },
                    { name: "recipient", type: "address" },
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "minAmountOut", type: "uint256" },
                    { name: "routeId", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                    { name: "orderId", type: "bytes32" },
                ],
            },
        ],
        outputs: [{ name: "orderId", type: "bytes32" }],
    },
    {
        type: "function",
        name: "getQuotes",
        stateMutability: "view",
        inputs: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
        ],
        outputs: [
            {
                name: "quotes",
                type: "tuple[]",
                components: [
                    { name: "routeId", type: "uint256" },
                    { name: "amountOut", type: "uint256" },
                    { name: "fee", type: "uint256" },
                    { name: "estimatedGas", type: "uint256" },
                    { name: "available", type: "bool" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "getBestRoute",
        stateMutability: "view",
        inputs: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
        ],
        outputs: [
            { name: "bestRouteId", type: "uint256" },
            { name: "bestAmountOut", type: "uint256" },
        ],
    },
    {
        type: "event",
        name: "PaymentRouted",
        inputs: [
            { name: "orderId", type: "bytes32", indexed: true },
            { name: "sender", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "routeId", type: "uint256", indexed: false },
            { name: "tokenIn", type: "address", indexed: false },
            { name: "tokenOut", type: "address", indexed: false },
            { name: "amountIn", type: "uint256", indexed: false },
            { name: "amountOut", type: "uint256", indexed: false },
            { name: "fee", type: "uint256", indexed: false },
        ],
    },
    // Emitido en vez de PaymentRouted cuando executePayment() decide
    // enrutar vía el Gateway (gasless) en vez del Router directo — ver
    // PayNGoRouter.sol. Antes de v0.4.3, executePayment() solo parseaba
    // PaymentRouted, así que un pago elegible para gasless (gateway con
    // ETH + monto < gaslessThreshold) fallaba con "PaymentRouted event
    // not found" pese a que la transacción sí se ejecutó correctamente.
    {
        type: "event",
        name: "GaslessPaymentRouted",
        inputs: [
            { name: "txId", type: "bytes32", indexed: true },
            { name: "sender", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "amountIn", type: "uint256", indexed: false },
            { name: "amountOut", type: "uint256", indexed: false },
            { name: "fee", type: "uint256", indexed: false },
        ],
    },

    {
        type: "function",
        name: "gaslessThreshold",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "setGaslessThreshold",
        stateMutability: "nonpayable",
        inputs: [{ name: "_threshold", type: "uint256" }],
        outputs: [],
    },
    {
        type: "function",
        name: "isGaslessEligible",
        stateMutability: "view",
        inputs: [{ name: "amountIn", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
    },

    // Custom errors de PayNGoRouter.sol. Fix: v0.4.0.
    {
        type: "error",
        name: "TokenNotSupported",
        inputs: [{ name: "token", type: "address" }],
    },
    {
        type: "error",
        name: "RouteNotFound",
        inputs: [],
    },
    {
        type: "error",
        name: "RouteNotActive",
        inputs: [{ name: "routeId", type: "uint256" }],
    },
    {
        type: "error",
        name: "SlippageExceeded",
        inputs: [
            { name: "amountOut", type: "uint256" },
            { name: "minAmountOut", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "DeadlineExpired",
        inputs: [{ name: "deadline", type: "uint256" }],
    },
    {
        type: "error",
        name: "OrderAlreadyExecuted",
        inputs: [{ name: "orderId", type: "bytes32" }],
    },
    {
        type: "error",
        name: "InvalidAmount",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidRecipient",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidDeadline",
        inputs: [],
    },
] as const;

export const PAYNGO_GATEWAY_ABI = [
    {
        type: "constructor",
        inputs: [
            { name: "_usdcToken", type: "address" },
            { name: "_payNGoRouter", type: "address" },
        ],
    },
    {
        type: "function",
        name: "executeGaslessPayment",
        stateMutability: "nonpayable",
        inputs: [
            { name: "user", type: "address" },
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "gasLimit", type: "uint256" },
        ],
        outputs: [{ name: "txId", type: "bytes32" }],
    },
    {
        type: "function",
        name: "estimateUsdcCost",
        stateMutability: "view",
        inputs: [
            { name: "user", type: "address" },
            { name: "gasLimit", type: "uint256" },
            { name: "gasPrice", type: "uint256" },
        ],
        outputs: [
            { name: "usdcCost", type: "uint256" },
            { name: "ethCost", type: "uint256" },
        ],
    },
    {
        type: "function",
        name: "getPolicyFor",
        stateMutability: "view",
        inputs: [{ name: "user", type: "address" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "mode", type: "uint8" },
                    { name: "userShareBps", type: "uint256" },
                    { name: "maxGasPerTx", type: "uint256" },
                    { name: "active", type: "bool" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "getEthBalance",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "getUsdcBalance",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // Getters generados automáticamente por Solidity para las variables
    // públicas whitelistOnly/whitelistedUsers/blacklistedUsers — antes no
    // estaban en el ABI, así que un dev que llamara executeGaslessPayment()
    // sin saber que whitelistOnly=true y su address no está en la
    // whitelist recibía un revert "misterioso" (UserNotWhitelisted) sin
    // ninguna forma de verificar la causa de antemano. Fix: v0.4.3.
    {
        type: "function",
        name: "whitelistOnly",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "whitelistedUsers",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "blacklistedUsers",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "event",
        name: "GasSponsored",
        inputs: [
            { name: "txId", type: "bytes32", indexed: true },
            { name: "user", type: "address", indexed: true },
            { name: "gasUsed", type: "uint256", indexed: false },
            { name: "ethSponsored", type: "uint256", indexed: false },
            { name: "usdcCharged", type: "uint256", indexed: false },
        ],
    },
    // Custom errors de PayNGoGateway.sol. Fix: v0.4.0.
    {
        type: "error",
        name: "InsufficientDeposit",
        inputs: [],
    },
    {
        type: "error",
        name: "UserBlacklisted",
        inputs: [{ name: "user", type: "address" }],
    },
    {
        type: "error",
        name: "UserNotWhitelisted",
        inputs: [{ name: "user", type: "address" }],
    },
    {
        type: "error",
        name: "GasPriceTooHigh",
        inputs: [{ name: "gasPrice", type: "uint256" }],
    },
    {
        type: "error",
        name: "GasLimitExceeded",
        inputs: [
            { name: "gasUsed", type: "uint256" },
            { name: "maxGas", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "InvalidPolicy",
        inputs: [],
    },
    {
        type: "error",
        name: "TransferFailed",
        inputs: [],
    },
    {
        type: "error",
        name: "TxAlreadyProcessed",
        inputs: [{ name: "txId", type: "bytes32" }],
    },
    {
        type: "error",
        name: "UnauthorizedCaller",
        inputs: [
            { name: "caller", type: "address" },
            { name: "user", type: "address" },
        ],
    },
] as const;

export const ERC20_ABI = [
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;
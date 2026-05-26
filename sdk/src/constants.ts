import { Address } from "viem";
import { ContractAddresses } from "./types";

// ─── Chain IDs ────────────────────────────────────────────────────
export const CHAIN_IDS = {
    ETHEREUM_MAINNET: 1,
    ETHEREUM_SEPOLIA: 11155111,
    HARDHAT: 31337,
} as const;

// ─── Contract Addresses ───────────────────────────────────────────
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
    [CHAIN_IDS.ETHEREUM_SEPOLIA]: {
        payNGoLinks: "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29",
        payNGoRouter: "0x52e5d621290F9941254d42F8AB905E3fAB32f6F1",
        payNGoGateway: "0x4a0D7CfF4C09f656c352aa190645a96Bca25410D",
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
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
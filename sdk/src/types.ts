import { Address, Chain, Hash, PublicClient, WalletClient } from "viem";

// ─── Config ───────────────────────────────────────────────────────

export interface PayNGoConfig {
    publicClient: PublicClient;
    walletClient?: WalletClient;
    chainId: number;
    contracts?: Partial<ContractAddresses>;
    // Objeto Chain de viem para chains no incluidas en el mapa interno del
    // SDK (hoy: Ethereum mainnet/Sepolia, Arbitrum Sepolia, Hardhat local).
    // Si tu chainId no es una de esas, pásalo aquí junto con `contracts` —
    // sin esto, chains custom lanzan PayNGoError aunque hayas pasado
    // `contracts` manualmente. Ver README § Redes soportadas.
    chain?: Chain;
}

export interface ContractAddresses {
    payNGoLinks: Address;
    payNGoRouter: Address;
    payNGoGateway: Address;
    usdc: Address;
}

// ─── Links ────────────────────────────────────────────────────────

export enum LinkStatus {
    Active = 0,
    Paid = 1,
    Cancelled = 2,
    Expired = 3,
}

export interface PaymentLink {
    id: bigint;
    creator: Address;
    recipient: Address;
    token: Address;
    amount: bigint;
    expiresAt: bigint;
    status: LinkStatus;
    memo: string;
    createdAt: bigint;
    paidAt: bigint;
    paidBy: Address;
}

export interface CreateLinkParams {
    recipient: Address;
    amount: bigint;
    expiresIn?: number;   // segundos, 0 = sin expiración
    memo?: string;
    token?: Address;      // default USDC
}

export interface CreateLinkResult {
    linkId: bigint;
    txHash: Hash;
}

export interface PayLinkResult {
    txHash: Hash;
    amountPaid: bigint;
    fee: bigint;
}

// ─── Router ───────────────────────────────────────────────────────

export enum RouteType {
    Direct = 0,
    MultiHop = 1,
    PayLink = 2,
}

export interface Route {
    id: bigint;
    tokenIn: Address;
    tokenOut: Address;
    routeType: RouteType;
    feeBps: bigint;
    active: boolean;
    handler: Address;
}

export interface RouteQuote {
    routeId: bigint;
    amountOut: bigint;
    fee: bigint;
    estimatedGas: bigint;
    available: boolean;
}

export interface ExecutePaymentParams {
    recipient: Address;
    amount: bigint;
    tokenIn?: Address;
    tokenOut?: Address;
    slippageBps?: number;   // default 100 = 1%
    routeId?: bigint;       // 0 = auto
    deadlineSeconds?: number; // default 3600
}

export interface ExecutePaymentResult {
    orderId: Hash;
    txHash: Hash;
    amountOut: bigint;
    fee: bigint;
    routeId: bigint;
}

// ─── Gateway ──────────────────────────────────────────────────────

export enum SponsorMode {
    Full = 0,
    Partial = 1,
    Token = 2,
}

export interface SponsorPolicy {
    mode: SponsorMode;
    userShareBps: bigint;
    maxGasPerTx: bigint;
    active: boolean;
}

export interface GaslessPaymentParams {
    recipient: Address;
    amount: bigint;
    gasLimit?: number;    // default 150_000
}

export interface GaslessPaymentResult {
    txId: Hash;
    txHash: Hash;
}

export interface GasCostEstimate {
    usdcCost: bigint;
    ethCost: bigint;
    isFree: boolean;
}

// ─── AI Agent ─────────────────────────────────────────────────────

export interface AgentPaymentSuggestion {
    action: "pay_link" | "execute_payment" | "gasless_payment";
    params: Record<string, unknown>;
    reasoning: string;
    estimatedCost: string;
    riskLevel: "low" | "medium" | "high";
}

// PayNGoClientConfig fue removido en v0.3.9 — declaraba pimlicoApiKey/rpcUrl
// pero ningún módulo del SDK lo consumía; era un tipo exportado sin uso
// real. Si necesitas configurar un flujo gasless real vía Pimlico, hazlo
// directo con permissionless.js (ver README § GatewayModule) — el SDK no
// envuelve ese flujo hoy.
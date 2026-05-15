import { PayNGoClient, CHAIN_IDS } from "@payngo-labs/sdk";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

// Cliente público singleton (solo lectura, sin wallet)
export const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""),
});

// Factory — crea un PayNGoClient con o sin walletClient
export function createPayNGoClient(walletClient?: unknown) {
    return new PayNGoClient({
        publicClient,
        walletClient: walletClient as never,
        chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
    });
}

// Constantes útiles para el frontend
export const USDC_DECIMALS = 6;
export const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
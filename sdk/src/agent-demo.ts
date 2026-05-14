import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PayNGoClient } from "./client";
import { PayNGoAgent } from "./agent";
import { CHAIN_IDS } from "./constants";

// ─── Setup ────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY as string;
const SEPOLIA_RPC = process.env.ETHEREUM_SEPOLIA_RPC_URL as string;

async function main() {
    console.log("🤖 PayNGo Agent Demo\n");

    // Crear clientes viem
    const account = privateKeyToAccount(PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });

    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });

    // Inicializar PayNGoClient
    const payNGoClient = new PayNGoClient({
        publicClient,
        walletClient,
        chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
    });

    // Inicializar agente
    const agent = new PayNGoAgent({
        client: payNGoClient,
        anthropicApiKey: ANTHROPIC_API_KEY,
        verbose: true,
    });

    // Contexto del usuario
    const context = {
        userAddress: account.address,
    };

    // ─── Demo 1: Instrucción directa ──────────────────────────────
    console.log("─── Demo 1: Pago directo ───────────────────────────");
    const result1 = await agent.processInstruction(
        "Send 5 USDC to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for design work",
        context,
        false // no auto-ejecutar, solo analizar
    );

    console.log("\n📋 Suggestion:");
    console.log(`  Action:    ${result1.suggestion.action}`);
    console.log(`  Params:    ${JSON.stringify(result1.suggestion.params)}`);
    console.log(`  Reasoning: ${result1.suggestion.reasoning}`);
    console.log(`  Cost:      ${result1.suggestion.estimatedCost}`);
    console.log(`  Risk:      ${result1.suggestion.riskLevel}`);

    // ─── Demo 2: Pago gasless ─────────────────────────────────────
    console.log("\n─── Demo 2: Pago gasless ───────────────────────────");
    const result2 = await agent.processInstruction(
        "Pay 10 USDC gasless to 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        context,
        false
    );

    console.log("\n📋 Suggestion:");
    console.log(`  Action:    ${result2.suggestion.action}`);
    console.log(`  Params:    ${JSON.stringify(result2.suggestion.params)}`);
    console.log(`  Reasoning: ${result2.suggestion.reasoning}`);
    console.log(`  Risk:      ${result2.suggestion.riskLevel}`);

    // ─── Demo 3: Pagar un link ────────────────────────────────────
    console.log("\n─── Demo 3: Pagar link existente ───────────────────");
    const result3 = await agent.processInstruction(
        "Pay link number 1",
        context,
        false
    );

    console.log("\n📋 Suggestion:");
    console.log(`  Action:    ${result3.suggestion.action}`);
    console.log(`  Params:    ${JSON.stringify(result3.suggestion.params)}`);
    console.log(`  Reasoning: ${result3.suggestion.reasoning}`);
    console.log(`  Risk:      ${result3.suggestion.riskLevel}`);

    // ─── Demo 4: Batch analysis ───────────────────────────────────
    console.log("\n─── Demo 4: Batch analysis ─────────────────────────");
    const batch = await agent.analyzeBatch([
        "Send 25 USDC to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "Pay link 2",
        "Gasless transfer of 3 USDC to 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    ], context);

    console.log("\n📋 Batch Suggestions:");
    batch.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.action} — ${s.reasoning} [${s.riskLevel}]`);
    });

    console.log("\n✅ Agent demo completed.");
}

main().catch(console.error);
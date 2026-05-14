import { Address, formatUnits, parseUnits } from "viem";
import { PayNGoClient } from "./client";
import { AgentPaymentSuggestion } from "./types";
import { PayNGoError, ERRORS } from "./errors";

// ─── Tipos del agente ─────────────────────────────────────────────

export interface AgentConfig {
    client: PayNGoClient;
    anthropicApiKey: string;
    apiUrl?: string;
    defaultToken?: Address;
    verbose?: boolean;
}

export interface AgentContext {
    userAddress: Address;
    usdcBalance?: bigint;
    recentLinks?: bigint[];
}

export interface AgentResult {
    suggestion: AgentPaymentSuggestion;
    txHash?: string;
    executed: boolean;
    error?: string;
}

// ─── Clase principal ──────────────────────────────────────────────

export class PayNGoAgent {
    private client: PayNGoClient;
    private apiKey: string;
    private apiUrl: string;
    private verbose: boolean;

    constructor(config: AgentConfig) {
        this.client = config.client;
        this.apiKey = config.anthropicApiKey;
        this.apiUrl = config.apiUrl ?? "https://api.anthropic.com/v1/messages";
        this.verbose = config.verbose ?? false;
    }

    // ─── Función principal ────────────────────────────────────────

    async processInstruction(
        instruction: string,
        context: AgentContext,
        autoExecute = false
    ): Promise<AgentResult> {
        this._log(`Processing: "${instruction}"`);

        const onchainContext = await this._buildOnchainContext(context);
        const suggestion = await this._analyzeWithClaude(instruction, onchainContext);

        this._log(`Action: ${suggestion.action}`);
        this._log(`Reasoning: ${suggestion.reasoning}`);

        if (autoExecute && suggestion.riskLevel === "low") {
            return await this._execute(suggestion, context.userAddress);
        }

        return { suggestion, executed: false };
    }

    async executeSuggestion(
        suggestion: AgentPaymentSuggestion,
        userAddress: Address
    ): Promise<AgentResult> {
        return this._execute(suggestion, userAddress);
    }

    async analyzeBatch(
        instructions: string[],
        context: AgentContext
    ): Promise<AgentPaymentSuggestion[]> {
        const prompt = this._buildBatchPrompt(instructions, context);
        const response = await this._callClaude(prompt);
        return this._parseBatchResponse(response);
    }

    // ─── Contexto onchain ─────────────────────────────────────────

    private async _buildOnchainContext(context: AgentContext): Promise<string> {
        const addresses = this.client.getAddresses();
        let onchainInfo = "";

        if (context.usdcBalance !== undefined) {
            const formatted = formatUnits(context.usdcBalance, 6);
            onchainInfo += `User USDC balance: ${formatted} USDC\n`;
        }

        if (context.recentLinks && context.recentLinks.length > 0) {
            onchainInfo += `Recent payment link IDs: ${context.recentLinks.join(", ")}\n`;
            try {
                const link = await this.client.links.getLink(context.recentLinks[0]);
                onchainInfo += `Latest link: ID=${link.id}, amount=${formatUnits(link.amount, 6)} USDC, status=${link.status}\n`;
            } catch {
                // ignorar si falla
            }
        }

        try {
            const ethBalance = await this.client.gateway.getEthBalance();
            const isFunded = ethBalance > 0n;
            onchainInfo += `Gasless payments available: ${isFunded}\n`;
        } catch {
            onchainInfo += `Gasless payments available: unknown\n`;
        }

        onchainInfo += `Contract addresses:\n`;
        onchainInfo += `  PayNGoLinks:   ${addresses.payNGoLinks}\n`;
        onchainInfo += `  PayNGoRouter:  ${addresses.payNGoRouter}\n`;
        onchainInfo += `  PayNGoGateway: ${addresses.payNGoGateway}\n`;
        onchainInfo += `  USDC:          ${addresses.usdc}\n`;

        return onchainInfo;
    }

    // ─── Claude API ───────────────────────────────────────────────

    private async _analyzeWithClaude(
        instruction: string,
        onchainContext: string
    ): Promise<AgentPaymentSuggestion> {
        const prompt = this._buildPrompt(instruction, onchainContext);
        const response = await this._callClaude(prompt);
        return this._parseResponse(response);
    }

    private async _callClaude(prompt: string): Promise<string> {
        const isProxy = this.apiUrl.startsWith("/");

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Solo incluir credenciales si llamamos directo a Anthropic
        if (!isProxy) {
            headers["x-api-key"] = this.apiKey;
            headers["anthropic-version"] = "2023-06-01";
        }

        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new PayNGoError(`Claude API error: ${error}`, ERRORS.TX_FAILED);
        }

        const data = await response.json() as {
            content: Array<{ type: string; text: string }>;
        };

        return data.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
    }

    // ─── Prompts ──────────────────────────────────────────────────

    private _buildPrompt(instruction: string, onchainContext: string): string {
        return `You are PayNGo Agent — an autonomous AI that executes stablecoin payments on Ethereum using the PayNGo protocol.

## Available Actions
1. **pay_link** — Pay an existing payment link by ID
   - Use when: user mentions a link ID or wants to pay a specific invoice
   - Required params: linkId (number)

2. **execute_payment** — Route a payment via PayNGoRouter (optimal path)
   - Use when: user wants to send USDC to an address directly
   - Required params: recipient (0x address), amount (in USDC, e.g. "50")
   - Optional params: slippageBps (default 100), memo

3. **gasless_payment** — Execute a gasless payment via PayNGoGateway
   - Use when: user wants to pay without ETH for gas, or mentions "gasless"
   - Required params: recipient (0x address), amount (in USDC)

## Current Onchain Context
${onchainContext}

## User Instruction
"${instruction}"

## Rules
- Always prefer gasless_payment if the gateway is funded and amount < 500 USDC
- For amounts > 500 USDC, use execute_payment for better security
- Risk is "low" for amounts < 100 USDC, "medium" for 100-500, "high" for > 500
- If the instruction is ambiguous, pick the safest action
- NEVER invent addresses — only use addresses explicitly mentioned in the instruction
- All amounts must be in USDC with 6 decimal precision internally

## Response Format
Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "action": "pay_link" | "execute_payment" | "gasless_payment",
  "params": {
    // for pay_link: { "linkId": 1 }
    // for execute_payment: { "recipient": "0x...", "amount": "50.00", "memo": "..." }
    // for gasless_payment: { "recipient": "0x...", "amount": "50.00" }
  },
  "reasoning": "one sentence explanation",
  "estimatedCost": "0.5% fee = ~0.25 USDC",
  "riskLevel": "low" | "medium" | "high"
}`;
    }

    private _buildBatchPrompt(
        instructions: string[],
        context: AgentContext
    ): string {
        const list = instructions.map((i, idx) => `${idx + 1}. "${i}"`).join("\n");
        return `You are PayNGo Agent. Analyze these ${instructions.length} payment instructions and return a JSON array of suggestions.

User address: ${context.userAddress}

Instructions:
${list}

Respond ONLY with a valid JSON array of objects, each with: action, params, reasoning, estimatedCost, riskLevel.`;
    }

    // ─── Parsers ──────────────────────────────────────────────────

    private _parseResponse(raw: string): AgentPaymentSuggestion {
        try {
            const clean = raw.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(clean) as AgentPaymentSuggestion;

            if (!parsed.action || !parsed.params || !parsed.reasoning) {
                throw new Error("Missing required fields");
            }

            return parsed;
        } catch (e) {
            throw new PayNGoError(
                `Failed to parse Claude response: ${raw}`,
                ERRORS.TX_FAILED,
                e
            );
        }
    }

    private _parseBatchResponse(raw: string): AgentPaymentSuggestion[] {
        try {
            const clean = raw.replace(/```json|```/g, "").trim();
            return JSON.parse(clean) as AgentPaymentSuggestion[];
        } catch (e) {
            throw new PayNGoError(
                `Failed to parse batch response: ${raw}`,
                ERRORS.TX_FAILED,
                e
            );
        }
    }

    // ─── Ejecutor ─────────────────────────────────────────────────

    private async _execute(
        suggestion: AgentPaymentSuggestion,
        userAddress: Address
    ): Promise<AgentResult> {
        try {
            let txHash: string | undefined;

            switch (suggestion.action) {
                case "pay_link": {
                    const { linkId } = suggestion.params as { linkId: number };
                    const result = await this.client.links.payLink(BigInt(linkId));
                    txHash = result.txHash;
                    break;
                }

                case "execute_payment": {
                    const { recipient, amount } = suggestion.params as {
                        recipient: Address;
                        amount: string;
                    };
                    const amountBigInt = parseUnits(amount, 6);
                    const result = await this.client.router.executePayment({
                        recipient,
                        amount: amountBigInt,
                    });
                    txHash = result.txHash;
                    break;
                }

                case "gasless_payment": {
                    const { recipient, amount } = suggestion.params as {
                        recipient: Address;
                        amount: string;
                    };
                    const amountBigInt = parseUnits(amount, 6);
                    const result = await this.client.gateway.executeGaslessPayment({
                        recipient,
                        amount: amountBigInt,
                    });
                    txHash = result.txHash;
                    break;
                }

                default:
                    throw new PayNGoError(
                        `Unknown action: ${suggestion.action}`,
                        ERRORS.TX_FAILED
                    );
            }

            this._log(`✅ Executed: ${txHash}`);
            return { suggestion, txHash, executed: true };
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            this._log(`❌ Execution failed: ${error}`);
            return { suggestion, executed: false, error };
        }
    }

    // ─── Utils ────────────────────────────────────────────────────

    private _log(msg: string): void {
        if (this.verbose) console.log(`[PayNGoAgent] ${msg}`);
    }
}

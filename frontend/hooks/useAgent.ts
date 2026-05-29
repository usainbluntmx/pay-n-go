"use client";

import { useState, useCallback } from "react";
import { parseUnits, formatUnits, type Address, type Hash } from "viem";
import { useIdentity } from "./useIdentity";
import { useHandle } from "./useHandle";

// ─── Tipos ────────────────────────────────────────────────────

export type AgentAction =
  | "send_usdc"
  | "create_link"
  | "check_balance"
  | "unknown";

export interface AgentSuggestion {
  action: AgentAction;
  params: {
    recipient?: string;           // handle @richi o address 0x...
    recipientAddress?: string;    // address resuelta
    amount?: string;              // USDC que recibirá el receptor
    amountWithFee?: string;       // USDC total que pagará el usuario
    fee?: string;                 // comisión del protocolo
    feePercent?: string;          // porcentaje de comisión
    memo?: string;
    linkId?: number;
  };
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

export interface AgentMessage {
  role: "user" | "agent";
  content: string;
  suggestion?: AgentSuggestion;
  txHash?: string;
  error?: string;
  timestamp: number;
}

export interface AgentState {
  messages: AgentMessage[];
  loading: boolean;
  error: string | null;
  pendingSuggestion: AgentSuggestion | null;
  executingTx: boolean;
}

// ─── Constante de comisión ────────────────────────────────────

const FEE_BPS = 30; // 0.3%
const BPS_BASE = 10_000;

function calculateFee(amount: string): { amountWithFee: string; fee: string } {
  const amountFloat = parseFloat(amount);
  const fee = (amountFloat * FEE_BPS) / BPS_BASE;
  const amountWithFee = amountFloat + fee;
  return {
    fee: fee.toFixed(4),
    amountWithFee: amountWithFee.toFixed(4),
  };
}

// ─── Hook principal ───────────────────────────────────────────

export function useAgent() {
  const { identity, balance, getSmartAccountClient, refreshBalance, sendPushNotification } = useIdentity();
  const { resolveHandle } = useHandle();

  const [state, setState] = useState<AgentState>({
    messages: [],
    loading: false,
    error: null,
    pendingSuggestion: null,
    executingTx: false,
  });

  // ─── Agregar mensaje ──────────────────────────────────────────

  const addMessage = useCallback((msg: Omit<AgentMessage, "timestamp">) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { ...msg, timestamp: Date.now() }],
    }));
  }, []);

  // ─── Llamar al agente (Claude) ────────────────────────────────

  const processInstruction = useCallback(async (instruction: string) => {
    if (!identity) {
      addMessage({
        role: "agent",
        content: "No tienes una cuenta activa. Por favor crea o recupera tu cuenta primero.",
      });
      return;
    }

    // Agregar mensaje del usuario
    addMessage({ role: "user", content: instruction });

    setState(prev => ({ ...prev, loading: true, error: null, pendingSuggestion: null }));

    try {
      const systemPrompt = `Eres el AI Payment Agent de Pay'n Go — una app de pagos en USDC para usuarios no técnicos.

Tu trabajo es interpretar instrucciones de pago en lenguaje natural y devolver una acción estructurada.

Usuario actual:
- Handle: ${identity.handle ? "@" + identity.handle : "sin handle"}
- Smart Account: ${identity.smartAccountAddress}

Acciones disponibles:
1. send_usdc — Enviar USDC a otro usuario (por handle @nombre o address 0x...)
2. create_link — Crear un link de pago que otros pueden pagar
3. check_balance — Consultar el balance actual
4. unknown — Si la instrucción no es clara

REGLAS IMPORTANTES:
- Si el usuario menciona un @handle como destinatario, ponlo en recipient como "@handle"
- Si el usuario menciona una address 0x..., ponla en recipient como la address
- El campo amount es EXACTAMENTE lo que recibirá el destinatario
- NUNCA inventes addresses ni handles
- Si falta información (destinatario o monto), action debe ser "unknown" y en reasoning explica qué falta
- riskLevel: "low" si amount < 100, "medium" si 100-500, "high" si > 500
- requiresConfirmation: true SOLO para send_usdc y create_link, false para check_balance y unknown
- Para check_balance y unknown: "requiresConfirmation": false

Responde ÚNICAMENTE con JSON válido, sin markdown:
{
  "action": "send_usdc" | "create_link" | "check_balance" | "unknown",
  "params": {
    "recipient": "@handle o 0x...",
    "amount": "10.00",
    "memo": "razón del pago"
  },
  "reasoning": "explicación breve en español",
  "riskLevel": "low" | "medium" | "high",
  "requiresConfirmation": true
}`;

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: instruction }],
        }),
      });

      const data = await response.json();
      const raw = data.content
        ?.filter((b: { type: string }) => b.type === "text")
        ?.map((b: { text: string }) => b.text)
        ?.join("") || "";

      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as AgentSuggestion;

      // Resolver handle → address si aplica
      if (parsed.params.recipient) {
        const resolved = await resolveHandle(parsed.params.recipient);
        parsed.params.recipientAddress = resolved || undefined;

        if (parsed.action === "send_usdc" && !resolved) {
          // Handle no encontrado
          addMessage({
            role: "agent",
            content: `No encontré el usuario "${parsed.params.recipient}". Verifica que el handle o address sea correcto.`,
          });
          setState(prev => ({ ...prev, loading: false }));
          return;
        }
      }

      // Calcular comisión de forma transparente
      if (parsed.action === "send_usdc" && parsed.params.amount) {
        const { fee, amountWithFee } = calculateFee(parsed.params.amount);
        parsed.params.fee = fee;
        parsed.params.amountWithFee = amountWithFee;
        parsed.params.feePercent = "0.3";
      }

      // Forzar requiresConfirmation en el código — no depender de Claude
      if (parsed.action === "check_balance" || parsed.action === "unknown") {
        parsed.requiresConfirmation = false;
      }
      if (parsed.action === "send_usdc" || parsed.action === "create_link") {
        parsed.requiresConfirmation = true;
      }

      // Construir mensaje de respuesta
      let agentMessage = parsed.reasoning;

      if (parsed.action === "send_usdc" && parsed.params.amount) {
        const recipient = parsed.params.recipient || "";
        agentMessage = `Entendido. Quieres enviar **${parsed.params.amount} USDC** a **${recipient}**`;
        if (parsed.params.memo) agentMessage += ` por "${parsed.params.memo}"`;
        agentMessage += `.\n\n`;
        agentMessage += `📋 **Resumen:**\n`;
        agentMessage += `• El receptor recibirá: **${parsed.params.amount} USDC**\n`;
        agentMessage += `• Comisión del servicio (0.3%): **${parsed.params.fee} USDC**\n`;
        agentMessage += `• **Total que saldrá de tu cuenta: ${parsed.params.amountWithFee} USDC**\n\n`;
        agentMessage += `¿Confirmas el envío?`;
      } else if (parsed.action === "create_link" && parsed.params.amount) {
        agentMessage = `Voy a crear un link de pago de **${parsed.params.amount} USDC**`;
        if (parsed.params.memo) agentMessage += ` para "${parsed.params.memo}"`;
        agentMessage += `. ¿Confirmas?`;
      } else if (parsed.action === "check_balance") {
        // Obtener balance fresco directo de la chain
        let currentBalance = balance;
        try {
          const { createPublicClient, http, formatUnits } = await import("viem");
          const { sepolia } = await import("viem/chains");
          const USDC_ADDR = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
          const BALANCE_ABI = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;
          const pc = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "") });
          const raw = await pc.readContract({ address: USDC_ADDR as `0x${string}`, abi: BALANCE_ABI, functionName: "balanceOf", args: [identity.smartAccountAddress as `0x${string}`] }) as bigint;
          currentBalance = formatUnits(raw, 6);
          // Actualizar el estado del hook de identidad también
          refreshBalance();
        } catch {
          currentBalance = balance;
        }

        const balanceDisplay = currentBalance !== null ? currentBalance : "desconocido";
        agentMessage = `Tu balance actual es **${balanceDisplay} USDC**.`;
        if (!currentBalance || parseFloat(currentBalance) === 0) {
          agentMessage += `\n\nAún no tienes fondos. Para recibir USDC comparte tu dirección:\n**${identity.smartAccountAddress}**`;
        }
        parsed.requiresConfirmation = false;
      } else if (parsed.action === "unknown") {
        const lc = instruction.toLowerCase();
        if (lc.includes("a quien") || lc.includes("a quién") || lc.includes("quien puedo")) {
          agentMessage = `Puedes enviarle USDC a cualquier persona que tenga un @handle en Pay'n Go.\n\nSolo dime algo como:\n**"Envía 10 USDC a @carlos por el diseño"**\n\ny yo me encargo del resto. ✦`;
        } else if (lc.includes("cómo") || lc.includes("como") || lc.includes("qué puedo") || lc.includes("que puedo") || lc.includes("ayuda")) {
          agentMessage = `Puedo ayudarte a:\n\n• **Enviar USDC** — "Envía 10 USDC a @carlos"\n• **Crear un link de pago** — "Crea un link de 50 USDC para la renta"\n\n¿Qué quieres hacer?`;
        } else {
          agentMessage = `No entendí bien esa instrucción. Intenta algo como:\n\n**"Envía 10 USDC a @carlos por el diseño"**\n\n¿Te puedo ayudar con algo más?`;
        }
        parsed.requiresConfirmation = false;
      }

      addMessage({
        role: "agent",
        content: agentMessage,
        suggestion: parsed,
      });

      if (parsed.requiresConfirmation) {
        setState(prev => ({
          ...prev,
          loading: false,
          pendingSuggestion: parsed,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addMessage({
        role: "agent",
        content: "Tuve un problema procesando tu instrucción. ¿Puedes reformularla?",
      });
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, [identity, balance, resolveHandle, addMessage]);

  // ─── Ejecutar sugerencia confirmada ──────────────────────────

  const executeSuggestion = useCallback(async (suggestion: AgentSuggestion) => {
    if (!identity) return;

    setState(prev => ({ ...prev, executingTx: true, pendingSuggestion: null }));

    addMessage({
      role: "agent",
      content: "Ejecutando el pago...",
    });

    try {
      const { smartAccountClient, safeAccount } = await getSmartAccountClient();

      if (suggestion.action === "send_usdc") {
        const { recipientAddress, amountWithFee } = suggestion.params;
        if (!recipientAddress || !amountWithFee) throw new Error("Faltan datos del pago");

        const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
        const FEE_RECIPIENT = "0x9dabBF114698bd9bFBF6222b9FD6Cd967ECD3850" as Address;

        const ERC20_ABI = [
          { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
        ] as const;

        // Calcular montos exactos
        const amountToRecipient = parseUnits(suggestion.params.amount!, 6);
        const totalAmount = parseUnits(amountWithFee, 6);
        const feeAmount = totalAmount - amountToRecipient;

        // Batch: transfer al receptor + transfer fee al protocolo
        const calls = feeAmount > 0n
          ? [
              { to: USDC, abi: ERC20_ABI, functionName: "transfer", args: [recipientAddress as Address, amountToRecipient] },
              { to: USDC, abi: ERC20_ABI, functionName: "transfer", args: [FEE_RECIPIENT, feeAmount] },
            ]
          : [
              { to: USDC, abi: ERC20_ABI, functionName: "transfer", args: [recipientAddress as Address, amountToRecipient] },
            ];

        const userOpHash = await (smartAccountClient as never as {
          sendUserOperation: (params: { calls: unknown[] }) => Promise<Hash>;
        }).sendUserOperation({ calls });

        const receipt = await (smartAccountClient as never as {
          waitForUserOperationReceipt: (params: { hash: Hash }) => Promise<{ receipt: { transactionHash: Hash } }>;
        }).waitForUserOperationReceipt({ hash: userOpHash });

        const txHash = receipt.receipt.transactionHash;

        // Actualizar balance
        await refreshBalance();

        // Notificar al emisor que el pago fue enviado
        sendPushNotification(
          "✅ Pago enviado",
          `Enviaste ${suggestion.params.amount} USDC a ${suggestion.params.recipient}`,
          identity.smartAccountAddress
        );

        // Notificar al receptor que recibió un pago
        // Buscar la suscripción del receptor por su address
        if (suggestion.params.recipientAddress) {
          sendPushNotification(
            "💸 Pago recibido",
            `Recibiste ${suggestion.params.amount} USDC${identity.handle ? ` de @${identity.handle}` : ""}`,
            suggestion.params.recipientAddress
          );
        }

        addMessage({
          role: "agent",
          content: `✅ Pago enviado exitosamente. **${suggestion.params.amount} USDC** llegaron a **${suggestion.params.recipient}**. Gas pagado por Pimlico — sin costo para ti.`,
          txHash,
        });

      } else if (suggestion.action === "create_link") {
        // Por ahora placeholder — implementar en Día 5
        addMessage({
          role: "agent",
          content: "La creación de links via agente estará disponible pronto.",
        });
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addMessage({
        role: "agent",
        content: `❌ No pude ejecutar el pago: ${msg}`,
        error: msg,
      });
    } finally {
      setState(prev => ({ ...prev, executingTx: false }));
    }
  }, [identity, getSmartAccountClient, refreshBalance, sendPushNotification, addMessage]);

  // ─── Cancelar sugerencia pendiente ───────────────────────────

  const cancelSuggestion = useCallback(() => {
    setState(prev => ({ ...prev, pendingSuggestion: null }));
    addMessage({
      role: "agent",
      content: "Entendido, cancelé el pago. ¿En qué más puedo ayudarte?",
    });
  }, [addMessage]);

  // ─── Limpiar historial ────────────────────────────────────────

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [], pendingSuggestion: null }));
  }, []);

  return {
    ...state,
    processInstruction,
    executeSuggestion,
    cancelSuggestion,
    clearMessages,
    isReady: !!identity,
  };
}

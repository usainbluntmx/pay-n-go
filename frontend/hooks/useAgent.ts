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
    recipient?: string;
    recipientAddress?: string;
    amount?: string;
    amountWithFee?: string;
    fee?: string;
    feePercent?: string;
    memo?: string;
    linkId?: number;
    token?: "USDC" | "MXNB";
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

export function useAgent(saveTx?: (tx: {
  type: "sent" | "received";
  counterpartAddress: string;
  counterpartHandle: string | null;
  amount: string;
  memo: string | null;
}) => Promise<unknown>) {
  const { identity, balance, mxnbBalance, getSmartAccountClient, getArbSmartAccountClient, refreshBalance, sendPushNotification } = useIdentity();
  const { resolveHandle } = useHandle();

  // ─── Cargar contactos del localStorage ───────────────────────
  const getContacts = useCallback((): Array<{ alias: string; handle: string }> => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("payngo_contacts") || "[]");
    } catch { return []; }
  }, []);

  // ─── Resolver alias de contacto → handle ─────────────────────
  // ─── Normalización fonética ──────────────────────────────────

  const normalizePhonetic = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
      .replace(/\bk/g, "c")        // karol → carol, karlos → carlos
      .replace(/ph/g, "f")         // philippe → filipe
      .replace(/ck/g, "c")         // nick → nic
      .replace(/qu/g, "cu")        // enrique → encurique (aproximación)
      .replace(/\bw/g, "v")        // walter → valter
      .replace(/z/g, "s")          // gonzalez → gonsales
      .replace(/x/g, "s")          // ximena → simena
      .replace(/\by/g, "i")        // yolanda → iolanda
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const resolveContactAlias = useCallback((input: string): string | null => {
    const contacts = getContacts();
    const normalizedInput = normalizePhonetic(input);

    const found = contacts.find(c => {
      const normalizedAlias = normalizePhonetic(c.alias);
      const normalizedHandle = normalizePhonetic(c.handle);
      return (
        normalizedAlias === normalizedInput ||
        normalizedAlias.includes(normalizedInput) ||
        normalizedInput.includes(normalizedAlias) ||
        normalizedHandle === normalizedInput
      );
    });

    return found ? found.handle : null;
  }, [getContacts, normalizePhonetic]);

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
      const contacts = getContacts();
      const contactsContext = contacts.length > 0
        ? `\nContactos guardados del usuario:\n${contacts.map(c => `- "${c.alias}" → @${c.handle}`).join("\n")}\n`
        : "";

      const systemPrompt = `Eres el AI Payment Agent de Pay'n Go — una app de pagos en stablecoins para usuarios no técnicos.

Tu trabajo es interpretar instrucciones de pago en lenguaje natural y devolver una acción estructurada.

Usuario actual:
- Handle: ${identity.handle ? "@" + identity.handle : "sin handle"}
- Smart Account: ${identity.smartAccountAddress}
- Balance USDC: ${balance || "0"} USDC (Dólares Digitales)
- Balance MXNB: ${mxnbBalance || "0"} MXNB (Pesos Digitales)
${contactsContext}
Tokens disponibles:
- USDC: dólares digitales. Usa cuando el usuario diga "dólares", "dolares", "USDC", "dollars"
- MXNB: pesos mexicanos digitales. Usa cuando el usuario diga "pesos", "MXNB", "pesos mexicanos"

Acciones disponibles:
1. send_usdc — Enviar USDC o MXNB a otro usuario
2. create_link — Crear un link de pago
3. check_balance — Consultar el balance actual
4. unknown — Si la instrucción no es clara

REGLAS IMPORTANTES:
- Si el usuario menciona un @handle como destinatario, ponlo en recipient como "@handle"
- Si el usuario menciona una address 0x..., ponla en recipient como la address
- Si el usuario menciona un nombre o alias que coincide con un contacto guardado, usa el handle de ese contacto
- El campo amount es EXACTAMENTE lo que recibirá el destinatario
- El campo token debe ser "USDC" si habla de dólares, "MXNB" si habla de pesos. Default: "USDC"
- NUNCA inventes addresses ni handles
- Si falta información (destinatario o monto), action debe ser "unknown" y en reasoning explica qué falta
- riskLevel: "low" si amount < 100, "medium" si 100-500, "high" si > 500
- requiresConfirmation: true SOLO para send_usdc y create_link, false para check_balance y unknown
- Los números pueden venir en texto: "dos" → 2, "diez" → 10, "cincuenta" → 50
- Los nombres pueden tener variantes fonéticas (carol/karol, carlos/karlos, ximena/jimena) — intenta resolverlas antes de declararlos no encontrados
- El handle puede venir sin @ — normaliza a minúsculas: "carlos" → "@carlos", "True Dillon" → "@truedillon"
- Si el usuario dice "arroba carlos" trátalo como "@carlos"

Responde ÚNICAMENTE con JSON válido, sin markdown:
{
  "action": "send_usdc" | "create_link" | "check_balance" | "unknown",
  "params": {
    "recipient": "@handle o 0x...",
    "amount": "10.00",
    "memo": "razón del pago",
    "token": "USDC" | "MXNB"
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

      // Resolver recipient: primero contactos, luego handle/address
      if (parsed.params.recipient) {
        const recipientInput = parsed.params.recipient;

        // 1. Si es una address 0x, usarla directamente
        if (recipientInput.startsWith("0x") && recipientInput.length === 42) {
          parsed.params.recipientAddress = recipientInput;
        } else {
          // 2. Buscar en contactos por alias (por si Claude devolvió el alias en lugar del handle)
          const contactHandle = resolveContactAlias(recipientInput.replace(/^@/, ""));
          const handleToResolve = contactHandle
            ? contactHandle
            : recipientInput.replace(/^@/, "");

          const resolved = await resolveHandle(handleToResolve);
          parsed.params.recipientAddress = resolved || undefined;

          // Actualizar el recipient con el handle correcto para mostrar en UI
          if (contactHandle) {
            parsed.params.recipient = "@" + contactHandle;
          }

          if (parsed.action === "send_usdc" && !resolved) {
            addMessage({
              role: "agent",
              content: `No encontré el usuario "${recipientInput}". Verifica que el handle o alias sea correcto.`,
            });
            setState(prev => ({ ...prev, loading: false }));
            return;
          }
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
        const tokenName = parsed.params.token || "USDC";
        const recipient = parsed.params.recipient || "";
        agentMessage = `Entendido. Quieres enviar **${parsed.params.amount} ${tokenName}** a **${recipient}**`;
        if (parsed.params.memo) agentMessage += ` por "${parsed.params.memo}"`;
        agentMessage += `.\n\n`;
        agentMessage += `📋 **Resumen:**\n`;
        agentMessage += `• El receptor recibirá: **${parsed.params.amount} ${tokenName}**\n`;
        agentMessage += `• Comisión del servicio (0.3%): **${parsed.params.fee} ${tokenName}**\n`;
        agentMessage += `• **Total que saldrá de tu cuenta: ${parsed.params.amountWithFee} ${tokenName}**\n\n`;
        agentMessage += `¿Confirmas el envío?`;
      } else if (parsed.action === "create_link" && parsed.params.amount) {
        agentMessage = `Voy a crear un link de pago de **${parsed.params.amount} USDC**`;
        if (parsed.params.memo) agentMessage += ` para "${parsed.params.memo}"`;
        agentMessage += `. ¿Confirmas?`;
      } else if (parsed.action === "check_balance") {
        agentMessage = `Tus balances actuales:\n\n• **${balance || "0"} USDC** (Dólares Digitales)\n• **${mxnbBalance || "0"} MXNB** (Pesos Digitales)`;
        refreshBalance();
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
  }, [identity, balance, mxnbBalance, resolveHandle, resolveContactAlias, normalizePhonetic, getContacts, addMessage]);

  // ─── Ejecutar sugerencia confirmada ──────────────────────────

  const executeSuggestion = useCallback(async (suggestion: AgentSuggestion) => {
    if (!identity) return;

    setState(prev => ({ ...prev, executingTx: true, pendingSuggestion: null }));

    addMessage({
      role: "agent",
      content: "Ejecutando el pago...",
    });

    try {
      const token = suggestion.params.token || "USDC";
      const isMxnb = token === "MXNB";

      const { smartAccountClient } = isMxnb
        ? await getArbSmartAccountClient()
        : await getSmartAccountClient();

      if (suggestion.action === "send_usdc") {
        const { recipientAddress, amountWithFee } = suggestion.params;
        if (!recipientAddress || !amountWithFee) throw new Error("Faltan datos del pago");

        const TOKEN_ADDR = isMxnb
          ? "0x82B9e52b26A2954E113F94Ff26647754d5a4247D" as Address
          : "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
        const FEE_RECIPIENT = "0x9dabBF114698bd9bFBF6222b9FD6Cd967ECD3850" as Address;

        const ERC20_ABI = [
          { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
        ] as const;

        const amountToRecipient = parseUnits(suggestion.params.amount!, 6);
        const totalAmount = parseUnits(amountWithFee, 6);
        const feeAmount = totalAmount - amountToRecipient;

        const calls = feeAmount > 0n
          ? [
            { to: TOKEN_ADDR, abi: ERC20_ABI, functionName: "transfer", args: [recipientAddress as Address, amountToRecipient] },
            { to: TOKEN_ADDR, abi: ERC20_ABI, functionName: "transfer", args: [FEE_RECIPIENT, feeAmount] },
          ]
          : [
            { to: TOKEN_ADDR, abi: ERC20_ABI, functionName: "transfer", args: [recipientAddress as Address, amountToRecipient] },
          ];

        const userOpHash = await (smartAccountClient as never as {
          sendUserOperation: (params: { calls: unknown[] }) => Promise<Hash>;
        }).sendUserOperation({ calls });

        const receipt = await (smartAccountClient as never as {
          waitForUserOperationReceipt: (params: { hash: Hash }) => Promise<{ receipt: { transactionHash: Hash } }>;
        }).waitForUserOperationReceipt({ hash: userOpHash });

        const txHash = receipt.receipt.transactionHash;

        await refreshBalance();

        if (saveTx) {
          await saveTx({
            type: "sent",
            counterpartAddress: suggestion.params.recipientAddress!,
            counterpartHandle: suggestion.params.recipient?.startsWith("@")
              ? suggestion.params.recipient.slice(1)
              : null,
            amount: `${suggestion.params.amount} ${token}`,
            memo: suggestion.params.memo || null,
          });
        }

        // Notificar al emisor
        sendPushNotification(
          "✅ Pago enviado",
          `Enviaste ${suggestion.params.amount} ${token} a ${suggestion.params.recipient}`,
          identity.smartAccountAddress
        );

        // Notificar y registrar tx para el receptor
        if (suggestion.params.recipientAddress) {
          sendPushNotification(
            "💸 Pago recibido",
            `Recibiste ${suggestion.params.amount} ${token}${identity.handle ? ` de @${identity.handle}` : ""}`,
            suggestion.params.recipientAddress
          );

          try {
            await fetch("/api/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address: suggestion.params.recipientAddress,
                tx: {
                  id: crypto.randomUUID(),
                  type: "received",
                  counterpartAddress: identity.smartAccountAddress,
                  counterpartHandle: identity.handle || null,
                  amount: `${suggestion.params.amount} ${token}`,
                  memo: suggestion.params.memo || null,
                  timestamp: Date.now(),
                },
              }),
            });
          } catch { /* silencioso */ }
        }

        addMessage({
          role: "agent",
          content: `✅ Pago enviado exitosamente. **${suggestion.params.amount} ${token}** llegaron a **${suggestion.params.recipient}**. Gas pagado por Pimlico — sin costo para ti.`,
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
  }, [identity, getSmartAccountClient, getArbSmartAccountClient, refreshBalance, sendPushNotification, addMessage]);

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

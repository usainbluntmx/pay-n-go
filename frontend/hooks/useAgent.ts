"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { usePayNGoClient } from "./usePayNGoClient";
import { PayNGoAgent, AgentResult, AgentPaymentSuggestion } from "@payngo-labs/sdk";

export function useAgent() {
    const client = usePayNGoClient();
    const { address } = useAccount();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSuggestion, setLastSuggestion] = useState<AgentPaymentSuggestion | null>(null);

    // ─── Analizar instrucción ────────────────────────────────────

    const analyze = useCallback(async (
        instruction: string
    ): Promise<AgentResult | null> => {
        if (!client || !address) return null;
        setLoading(true);
        setError(null);

        try {
            const agent = new PayNGoAgent({
                client,
                anthropicApiKey: "",
                apiUrl: "/api/agent",
                verbose: false,
            });

            const result = await agent.processInstruction(
                instruction,
                { userAddress: address },
                false
            );

            setLastSuggestion(result.suggestion);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [client, address]);

    // ─── Ejecutar sugerencia ─────────────────────────────────────

    const execute = useCallback(async (
        suggestion: AgentPaymentSuggestion
    ): Promise<AgentResult | null> => {
        if (!client || !address) return null;
        setLoading(true);
        setError(null);

        try {
            const agent = new PayNGoAgent({
                client,
                anthropicApiKey: "",
                apiUrl: "/api/agent",
                verbose: false,
            });

            const result = await agent.executeSuggestion(suggestion, address);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [client, address]);

    return {
        analyze,
        execute,
        lastSuggestion,
        loading,
        error,
    };
}

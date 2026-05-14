"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { usePayNGoClient } from "./usePayNGoClient";
import { RouteQuote } from "@payngo/sdk";

export function useRouter() {
    const client = usePayNGoClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─── Obtener cotizaciones ────────────────────────────────────

    const getQuotes = useCallback(async (
        amount: string
    ): Promise<RouteQuote[]> => {
        if (!client) return [];
        const addresses = client.getAddresses();

        try {
            return await client.router.getQuotes(
                addresses.usdc,
                addresses.usdc,
                parseUnits(amount, 6)
            );
        } catch {
            return [];
        }
    }, [client]);

    // ─── Ejecutar pago ───────────────────────────────────────────

    const executePayment = useCallback(async (
        recipient: string,
        amount: string,
        slippageBps = 100
    ) => {
        if (!client) throw new Error("Client not initialized");
        setLoading(true);
        setError(null);

        try {
            const result = await client.router.executePayment({
                recipient: recipient as `0x${string}`,
                amount: parseUnits(amount, 6),
                slippageBps,
            });
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [client]);

    return {
        getQuotes,
        executePayment,
        loading,
        error,
    };
}
"use client";

import { useState, useCallback } from "react";
import { parseUnits, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { usePayNGoClient } from "./usePayNGoClient";

export function useGateway() {
    const client = usePayNGoClient();
    const publicClient = usePublicClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─── Verificar si gasless está disponible ────────────────────

    const isGaslessAvailable = useCallback(async (): Promise<boolean> => {
        if (!client) return false;
        try {
            const balance = await client.gateway.getEthBalance();
            return balance > 0n;
        } catch {
            return false;
        }
    }, [client]);

    // ─── Estimar costo gasless ───────────────────────────────────

    const estimateCost = useCallback(async (
        userAddress: string,
        gasLimit = 150_000
    ) => {
        if (!client || !publicClient) return null;

        try {
            const gasPrice = await publicClient.getGasPrice();
            const estimate = await client.gateway.estimateGasCost(
                userAddress as `0x${string}`,
                gasLimit,
                gasPrice
            );

            return {
                ...estimate,
                usdcFormatted: formatUnits(estimate.usdcCost, 6),
                ethFormatted: formatUnits(estimate.ethCost, 18),
            };
        } catch {
            return null;
        }
    }, [client, publicClient]);

    // ─── Ejecutar pago gasless ───────────────────────────────────

    const executeGaslessPayment = useCallback(async (
        recipient: string,
        amount: string
    ) => {
        if (!client) throw new Error("Client not initialized");
        setLoading(true);
        setError(null);

        try {
            const result = await client.gateway.executeGaslessPayment({
                recipient: recipient as `0x${string}`,
                amount: parseUnits(amount, 6),
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
        isGaslessAvailable,
        estimateCost,
        executeGaslessPayment,
        loading,
        error,
    };
}
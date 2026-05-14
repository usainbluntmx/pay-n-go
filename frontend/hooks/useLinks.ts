"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { usePayNGoClient } from "./usePayNGoClient";
import { PaymentLink, CreateLinkParams, LinkStatus } from "@payngo/sdk";

export interface CreateLinkInput {
    recipient: string;
    amount: string;         // en USDC legible, ej: "10.50"
    expiresIn?: number;     // segundos
    memo?: string;
}

export function useLinks() {
    const client = usePayNGoClient();
    const { address } = useAccount();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─── Crear link ──────────────────────────────────────────────

    const createLink = useCallback(async (input: CreateLinkInput) => {
        if (!client) throw new Error("Client not initialized");
        setLoading(true);
        setError(null);

        try {
            const params: CreateLinkParams = {
                recipient: input.recipient as `0x${string}`,
                amount: parseUnits(input.amount, 6),
                expiresIn: input.expiresIn,
                memo: input.memo,
            };

            const result = await client.links.createLink(params);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [client]);

    // ─── Pagar link ──────────────────────────────────────────────

    const payLink = useCallback(async (linkId: bigint) => {
        if (!client) throw new Error("Client not initialized");
        setLoading(true);
        setError(null);

        try {
            const result = await client.links.payLink(linkId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [client]);

    // ─── Cancelar link ───────────────────────────────────────────

    const cancelLink = useCallback(async (linkId: bigint) => {
        if (!client) throw new Error("Client not initialized");
        setLoading(true);
        setError(null);

        try {
            const txHash = await client.links.cancelLink(linkId);
            return txHash;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [client]);

    // ─── Leer link ───────────────────────────────────────────────

    const getLink = useCallback(async (linkId: bigint): Promise<PaymentLink | null> => {
        if (!client) return null;
        try {
            return await client.links.getLink(linkId);
        } catch {
            return null;
        }
    }, [client]);

    // ─── Links del usuario ───────────────────────────────────────

    const getMyLinks = useCallback(async (): Promise<PaymentLink[]> => {
        if (!client || !address) return [];

        try {
            const ids = await client.links.getLinksByCreator(address);
            const links = await Promise.all(ids.map((id) => client.links.getLink(id)));
            return links;
        } catch {
            return [];
        }
    }, [client, address]);

    // ─── Helpers ─────────────────────────────────────────────────

    const formatLink = (link: PaymentLink) => ({
        ...link,
        amountFormatted: formatUnits(link.amount, 6),
        isActive: link.status === LinkStatus.Active,
        isPaid: link.status === LinkStatus.Paid,
        isCancelled: link.status === LinkStatus.Cancelled,
        isExpired: link.status === LinkStatus.Expired,
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${link.id}`,
    });

    return {
        createLink,
        payLink,
        cancelLink,
        getLink,
        getMyLinks,
        formatLink,
        loading,
        error,
    };
}
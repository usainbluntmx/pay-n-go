"use client";

import { useMemo } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { PayNGoClient, CHAIN_IDS } from "@payngo/sdk";

export function usePayNGoClient() {
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const client = useMemo(() => {
        if (!publicClient) return null;

        return new PayNGoClient({
            publicClient: publicClient as never,
            walletClient: walletClient as never,
            chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
        });
    }, [publicClient, walletClient]);

    return client;
}
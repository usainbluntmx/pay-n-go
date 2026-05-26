"use client";

import { useState, useCallback } from "react";
import { parseUnits, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { usePayNGoClient } from "./usePayNGoClient";
import { RouteQuote } from "@payngo-labs/sdk";
import { useAccount } from "wagmi";

const ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const GASLESS_ABI = [
  {
    type: "function",
    name: "isGaslessEligible",
    stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function useRouter() {
  const client = usePayNGoClient();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();

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

  // ─── Gasless threshold ───────────────────────────────────────

  const getGaslessThreshold = useCallback(async (): Promise<string> => {
    if (!publicClient || !client) return "500";
    try {
      const addresses = client.getAddresses();
      const threshold = await publicClient.readContract({
        address: addresses.payNGoRouter,
        abi: [{
          type: "function",
          name: "gaslessThreshold",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
        }] as const,
        functionName: "gaslessThreshold",
      }) as bigint;
      return formatUnits(threshold, 6);
    } catch {
      return "500";
    }
  }, [client, publicClient]);

  const isGaslessEligible = useCallback(async (amount: string): Promise<boolean> => {
    if (!client || !amount || !publicClient) return false;
    try {
      const addresses = client.getAddresses();
      const result = await publicClient.readContract({
        address: addresses.payNGoRouter,
        abi: GASLESS_ABI,
        functionName: "isGaslessEligible",
        args: [parseUnits(amount, 6)],
      });
      return (result as boolean) ?? false;
    } catch {
      return false;
    }
  }, [client, publicClient]);

  // ─── Ejecutar pago ───────────────────────────────────────────

  const executePayment = useCallback(async (
    recipient: string,
    amount: string,
    slippageBps = 100,
  ) => {
    if (!client) throw new Error("Client not initialized");
    setError(null);

    try {
      const addresses = client.getAddresses();
      const amountBigInt = parseUnits(amount, 6);

      // Verificar allowance actual para saber si necesita approve
      // Esto permite mostrar el estado correcto ANTES del popup de firma
      if (publicClient) {
        const walletAddress = address;

        if (walletAddress) {
          const allowance = await publicClient.readContract({
            address: addresses.usdc,
            abi: ALLOWANCE_ABI,
            functionName: "allowance",
            args: [walletAddress, addresses.payNGoRouter],
          }) as bigint;

          if (allowance < amountBigInt) {
            // Necesita approve primero — mostrar "Step 1/2"
            setApproving(true);
            setLoading(true);
          } else {
            // Ya tiene allowance — ir directo al envío
            setApproving(false);
            setLoading(true);
          }
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // El SDK maneja approve + executePayment internamente.
      // Después del approve, el botón ya muestra "Step 2/2: Sending..."
      // porque loading=true y approving=false al finalizar el try.
      const result = await client.router.executePayment({
        recipient: recipient as `0x${string}`,
        amount: amountBigInt,
        slippageBps,
      });

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
      setApproving(false);
    }
  }, [client, publicClient]);

  return {
    getQuotes,
    getGaslessThreshold,
    isGaslessEligible,
    executePayment,
    loading,
    approving,
    error,
  };
}

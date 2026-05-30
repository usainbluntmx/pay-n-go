"use client";

import { useState, useCallback } from "react";

export interface Transaction {
  id: string;
  type: "sent" | "received";
  counterpartAddress: string;
  counterpartHandle: string | null;
  amount: string;
  memo: string | null;
  timestamp: number;
}

export function useTransactions(smartAccountAddress: string | undefined) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── Cargar historial ────────────────────────────────────────

  const loadTxs = useCallback(async () => {
    if (!smartAccountAddress) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/transactions?address=${encodeURIComponent(smartAccountAddress)}`
      );
      const data = await res.json();
      setTxs(data.txs || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [smartAccountAddress]);

  // ─── Guardar transacción ─────────────────────────────────────

  const saveTx = useCallback(async (tx: Omit<Transaction, "id" | "timestamp">) => {
    if (!smartAccountAddress) return;

    const fullTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Actualizar UI inmediatamente
    setTxs(prev => [fullTx, ...prev]);

    // Persistir en Redis
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: smartAccountAddress, tx: fullTx }),
      });
    } catch {
      // silencioso
    }

    return fullTx;
  }, [smartAccountAddress]);

  return { txs, loading, loadTxs, saveTx };
}

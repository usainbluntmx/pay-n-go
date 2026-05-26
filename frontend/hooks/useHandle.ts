"use client";

import { useState, useCallback } from "react";

export interface HandleState {
  loading: boolean;
  error: string | null;
  available: boolean | null;
}

export function useHandle() {
  const [state, setState] = useState<HandleState>({
    loading: false,
    error: null,
    available: null,
  });

  // ─── Verificar disponibilidad ────────────────────────────────

  const checkAvailability = useCallback(async (handle: string): Promise<boolean> => {
    if (!handle || handle.length < 3) return false;
    setState(prev => ({ ...prev, loading: true, error: null, available: null }));
    try {
      const res = await fetch(`/api/handles?handle=${encodeURIComponent(handle.toLowerCase())}`);
      const data = await res.json();
      setState(prev => ({ ...prev, loading: false, available: data.available }));
      return data.available;
    } catch {
      setState(prev => ({ ...prev, loading: false, error: "Error verificando disponibilidad" }));
      return false;
    }
  }, []);

  // ─── Registrar handle ────────────────────────────────────────

  const registerHandle = useCallback(async (
    handle: string,
    address: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/handles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.toLowerCase().trim(), address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState(prev => ({ ...prev, loading: false, error: data.error }));
        return false;
      }
      setState(prev => ({ ...prev, loading: false, error: null }));
      return true;
    } catch {
      setState(prev => ({ ...prev, loading: false, error: "Error registrando handle" }));
      return false;
    }
  }, []);

  // ─── Resolver handle → address ───────────────────────────────

  const resolveHandle = useCallback(async (
    handleOrAddress: string
  ): Promise<string | null> => {
    // Si ya es una address (0x...) devolverla directamente
    if (handleOrAddress.startsWith("0x") && handleOrAddress.length === 42) {
      return handleOrAddress;
    }

    // Limpiar @ si viene con prefijo
    const clean = handleOrAddress.replace(/^@/, "").toLowerCase().trim();

    try {
      const res = await fetch(`/api/handles?handle=${encodeURIComponent(clean)}`);
      const data = await res.json();
      return data.address || null;
    } catch {
      return null;
    }
  }, []);

  // ─── Buscar handle de una address ────────────────────────────

  const getHandleForAddress = useCallback(async (
    address: string
  ): Promise<string | null> => {
    try {
      const res = await fetch(`/api/handles?address=${encodeURIComponent(address.toLowerCase())}`);
      const data = await res.json();
      return data.handle || null;
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    checkAvailability,
    registerHandle,
    resolveHandle,
    getHandleForAddress,
  };
}

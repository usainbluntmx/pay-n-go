"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import { HDKey } from "@scure/bip32";
import {
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { sepolia, arbitrumSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createSmartAccountClient } from "permissionless";

// ─── Constantes ───────────────────────────────────────────────

const STORAGE_KEY = "payngo_identity";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const MXNB = "0x82B9e52b26A2954E113F94Ff26647754d5a4247D" as Address;
const BALANCE_POLL_INTERVAL = 15_000; // 15 segundos

const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Tipos ────────────────────────────────────────────────────

export interface Identity {
  mnemonic: string;
  privateKey: Hex;
  ownerAddress: Address;
  smartAccountAddress: Address;
  handle: string | null;
  createdAt: number;
}

export interface IdentityState {
  identity: Identity | null;
  balance: string | null;
  mxnbBalance: string | null;
  loading: boolean;
  error: string | null;
  step:
  | "idle"
  | "generating"
  | "creating_account"
  | "ready"
  | "recovering";
}

// ─── Helpers ──────────────────────────────────────────────────

function derivePrivateKey(mnemonic: string): Hex {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/44'/60'/0'/0/0");
  if (!child.privateKey) throw new Error("Failed to derive private key");
  return ("0x" + Buffer.from(child.privateKey).toString("hex")) as Hex;
}

function saveIdentity(identity: Identity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Hook principal ───────────────────────────────────────────

export function useIdentity() {
  const [state, setState] = useState<IdentityState>({
    identity: null,
    balance: null,
    mxnbBalance: null,
    loading: true,
    error: null,
    step: "idle",
  });

  // Ref para detectar cambios de balance y disparar notificaciones
  const prevBalanceRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "";
  const arbRpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "";
  const bundlerUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${pimlicoApiKey}`;
  const arbBundlerUrl = `https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=${pimlicoApiKey}`;

  // ─── Crear Safe Smart Account desde un owner ────────────────

  const createSafeAccount = useCallback(async (
    owner: PrivateKeyAccount
  ): Promise<Address> => {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const safeAccount = await toSafeSmartAccount({
      client: publicClient as never,
      owners: [owner as never],
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
      version: "1.4.1",
    });

    return safeAccount.address;
  }, [rpcUrl]);

  // ─── Cargar balance USDC ─────────────────────────────────────

  const loadBalance = useCallback(async (address: Address): Promise<string> => {
    try {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl),
      });

      const balance = await publicClient.readContract({
        address: USDC,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      return formatUnits(balance, 6);
    } catch {
      return "0";
    }
  }, [rpcUrl]);

  // ─── Cargar balance MXNB (Arbitrum Sepolia) ──────────────────

  const loadMxnbBalance = useCallback(async (address: Address): Promise<string> => {
    try {
      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(arbRpcUrl),
      });
      const balance = await publicClient.readContract({
        address: MXNB,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;
      return formatUnits(balance, 6);
    } catch {
      return "0";
    }
  }, [arbRpcUrl]);

  const sendPushNotification = useCallback(async (
    title: string,
    body: string,
    address?: string
  ) => {
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, address }),
      });
    } catch {
      // Silencioso — notificaciones no son críticas
    }
  }, []);

  // ─── Polling automático del balance ──────────────────────────

  const startPolling = useCallback((address: Address, initialBalance: string) => {
    prevBalanceRef.current = initialBalance;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      const newBalance = await loadBalance(address);
      const newMxnbBalance = await loadMxnbBalance(address);
      const prev = prevBalanceRef.current;

      setState(s => {
        if (s.identity?.smartAccountAddress !== address) return s;
        return { ...s, balance: newBalance, mxnbBalance: newMxnbBalance };
      });

      prevBalanceRef.current = newBalance;
    }, BALANCE_POLL_INTERVAL);
  }, [loadBalance, loadMxnbBalance, sendPushNotification]);

  // ─── Cargar identidad al montar ──────────────────────────────

  useEffect(() => {
    const stored = loadIdentity();
    if (!stored) {
      setState(prev => ({ ...prev, loading: false, step: "idle" }));
      return;
    }

    Promise.all([
      loadBalance(stored.smartAccountAddress),
      loadMxnbBalance(stored.smartAccountAddress),
    ]).then(([balance, mxnbBalance]) => {
      setState({
        identity: stored,
        balance,
        mxnbBalance,
        loading: false,
        error: null,
        step: "ready",
      });
      startPolling(stored.smartAccountAddress, balance);
    });

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [loadBalance, loadMxnbBalance, startPolling]);

  // ─── Crear nueva identidad ───────────────────────────────────

  const createIdentity = useCallback(async (): Promise<Identity> => {
    setState(prev => ({ ...prev, loading: true, error: null, step: "generating" }));

    try {
      const mnemonic = generateMnemonic(128);
      const privateKey = derivePrivateKey(mnemonic);
      const owner = privateKeyToAccount(privateKey);

      setState(prev => ({ ...prev, step: "creating_account" }));

      const smartAccountAddress = await createSafeAccount(owner);

      const identity: Identity = {
        mnemonic, privateKey,
        ownerAddress: owner.address,
        smartAccountAddress,
        handle: null,
        createdAt: Date.now(),
      };

      saveIdentity(identity);

      const [balance, mxnbBalance] = await Promise.all([
        loadBalance(smartAccountAddress),
        loadMxnbBalance(smartAccountAddress),
      ]);

      setState({ identity, balance, mxnbBalance, loading: false, error: null, step: "ready" });
      startPolling(smartAccountAddress, balance);

      return identity;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState(prev => ({ ...prev, loading: false, error: msg, step: "idle" }));
      throw e;
    }
  }, [createSafeAccount, loadBalance, loadMxnbBalance, startPolling]);

  // ─── Recuperar identidad con mnemónico ──────────────────────

  const recoverIdentity = useCallback(async (mnemonic: string): Promise<Identity> => {
    if (!validateMnemonic(mnemonic)) {
      throw new Error("Mnemónico inválido. Verifica las 12 palabras.");
    }

    setState(prev => ({ ...prev, loading: true, error: null, step: "recovering" }));

    try {
      const privateKey = derivePrivateKey(mnemonic);
      const owner = privateKeyToAccount(privateKey);

      setState(prev => ({ ...prev, step: "creating_account" }));

      const smartAccountAddress = await createSafeAccount(owner);

      let existingHandle: string | null = null;
      try {
        const res = await fetch(`/api/handles?address=${smartAccountAddress.toLowerCase()}`);
        const data = await res.json();
        existingHandle = data.handle || null;
      } catch { /* silencioso */ }

      const identity: Identity = {
        mnemonic, privateKey,
        ownerAddress: owner.address,
        smartAccountAddress,
        handle: existingHandle,
        createdAt: Date.now(),
      };

      saveIdentity(identity);

      const [balance, mxnbBalance] = await Promise.all([
        loadBalance(smartAccountAddress),
        loadMxnbBalance(smartAccountAddress),
      ]);

      setState({ identity, balance, mxnbBalance, loading: false, error: null, step: "ready" });
      startPolling(smartAccountAddress, balance);

      return identity;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState(prev => ({ ...prev, loading: false, error: msg, step: "idle" }));
      throw e;
    }
  }, [createSafeAccount, loadBalance, loadMxnbBalance, startPolling]);

  // ─── Actualizar handle ───────────────────────────────────────

  const setHandle = useCallback((handle: string) => {
    setState(prev => {
      if (!prev.identity) return prev;
      const updated = { ...prev.identity, handle };
      saveIdentity(updated);
      return { ...prev, identity: updated };
    });
  }, []);

  // ─── Refrescar balance manualmente ───────────────────────────

  const refreshBalance = useCallback(async () => {
    const { identity } = state;
    if (!identity) return;
    const [balance, mxnbBalance] = await Promise.all([
      loadBalance(identity.smartAccountAddress),
      loadMxnbBalance(identity.smartAccountAddress),
    ]);
    setState(prev => ({ ...prev, balance, mxnbBalance }));
    prevBalanceRef.current = balance;
  }, [state, loadBalance, loadMxnbBalance]);

  // ─── Cerrar sesión ───────────────────────────────────────────

  const logout = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    clearIdentity();
    setState({ identity: null, balance: null, mxnbBalance: null, loading: false, error: null, step: "idle" });
    window.location.href = "/";
  }, []);

  // ─── Obtener Smart Account Client ────────────────────────────

  const getSmartAccountClient = useCallback(async () => {
    const { identity } = state;
    if (!identity) throw new Error("No identity found");

    const owner = privateKeyToAccount(identity.privateKey);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const pimlicoClient = createPimlicoClient({
      transport: http(bundlerUrl),
      entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const safeAccount = await toSafeSmartAccount({
      client: publicClient as never,
      owners: [owner as never],
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      version: "1.4.1",
    });

    const smartAccountClient = createSmartAccountClient({
      account: safeAccount as never,
      chain: sepolia,
      bundlerTransport: http(bundlerUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    } as never);

    return { smartAccountClient, safeAccount };
  }, [state, rpcUrl, bundlerUrl]);

  // ─── Smart Account Client para Arbitrum Sepolia (MXNB) ───────

  const getArbSmartAccountClient = useCallback(async () => {
    const { identity } = state;
    if (!identity) throw new Error("No identity found");

    const owner = privateKeyToAccount(identity.privateKey);

    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(arbRpcUrl),
    });

    const pimlicoClient = createPimlicoClient({
      transport: http(arbBundlerUrl),
      entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const safeAccount = await toSafeSmartAccount({
      client: publicClient as never,
      owners: [owner as never],
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      version: "1.4.1",
    });

    const smartAccountClient = createSmartAccountClient({
      account: safeAccount as never,
      chain: arbitrumSepolia,
      bundlerTransport: http(arbBundlerUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    } as never);

    return { smartAccountClient, safeAccount };
  }, [state, arbRpcUrl, arbBundlerUrl]);

  return {
    ...state,
    createIdentity,
    recoverIdentity,
    setHandle,
    refreshBalance,
    logout,
    getSmartAccountClient,
    getArbSmartAccountClient,
    sendPushNotification,
    isReady: state.step === "ready",
    hasIdentity: !!state.identity,
  };
}

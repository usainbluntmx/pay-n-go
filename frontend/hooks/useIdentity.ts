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
import {
  encryptWithPassword,
  decryptWithPassword,
  validatePasswordStrength,
  type EncryptedPayload,
} from "@/lib/identityCrypto";

// ─── Constantes ───────────────────────────────────────────────

const STORAGE_KEY = "payngo_identity_v2"; // v2: cifrado. La v1 (texto plano) queda huérfana y se ignora.
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
  | "idle"        // sin identidad — pantalla de bienvenida
  | "locked"      // hay identidad cifrada en localStorage, falta password
  | "generating"
  | "creating_account"
  | "ready"
  | "recovering";
}

// ─── Storage — ahora guarda SOLO el payload cifrado ────────────

function saveEncrypted(payload: EncryptedPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadEncrypted(): EncryptedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EncryptedPayload;
  } catch {
    return null;
  }
}

function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  // Limpia también cualquier resto de la v1 en texto plano de instalaciones viejas
  localStorage.removeItem("payngo_identity");
}

function derivePrivateKey(mnemonic: string): Hex {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/44'/60'/0'/0/0");
  if (!child.privateKey) throw new Error("Failed to derive private key");
  return ("0x" + Buffer.from(child.privateKey).toString("hex")) as Hex;
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

  // La contraseña de esta sesión — SOLO en memoria, nunca en localStorage.
  // Se usa para re-cifrar cuando algo cambia (ej. setHandle) sin volver a pedirla.
  const sessionPasswordRef = useRef<string | null>(null);

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

      setState(s => {
        if (s.identity?.smartAccountAddress !== address) return s;
        return { ...s, balance: newBalance, mxnbBalance: newMxnbBalance };
      });

      prevBalanceRef.current = newBalance;
    }, BALANCE_POLL_INTERVAL);
  }, [loadBalance, loadMxnbBalance]);

  // ─── Guardar identidad re-cifrando con la password de sesión ──
  // Usado por setHandle: la identidad cambió, hay que persistir el
  // nuevo ciphertext, pero no queremos volver a pedir la contraseña.

  const persistIdentity = useCallback(async (identity: Identity) => {
    const password = sessionPasswordRef.current;
    if (!password) return; // no debería pasar si step === "ready", pero por seguridad no truena
    const payload = await encryptWithPassword(JSON.stringify(identity), password);
    saveEncrypted(payload);
  }, []);

  // ─── Detectar identidad cifrada al montar (sin descifrar aún) ─

  useEffect(() => {
    const encrypted = loadEncrypted();
    if (!encrypted) {
      setState(prev => ({ ...prev, loading: false, step: "idle" }));
      return;
    }
    // Hay una identidad guardada, pero está cifrada — el usuario debe
    // desbloquearla con su contraseña antes de que exista `identity` en memoria.
    setState(prev => ({ ...prev, loading: false, step: "locked" }));

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ─── Desbloquear sesión existente con contraseña ──────────────

  const unlock = useCallback(async (password: string): Promise<void> => {
    const encrypted = loadEncrypted();
    if (!encrypted) throw new Error("No hay ninguna cuenta guardada en este dispositivo.");

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const plaintext = await decryptWithPassword(encrypted, password);
      const identity = JSON.parse(plaintext) as Identity;

      sessionPasswordRef.current = password;

      const [balance, mxnbBalance] = await Promise.all([
        loadBalance(identity.smartAccountAddress),
        loadMxnbBalance(identity.smartAccountAddress),
      ]);

      setState({ identity, balance, mxnbBalance, loading: false, error: null, step: "ready" });
      startPolling(identity.smartAccountAddress, balance);
    } catch {
      // AES-GCM falla la verificación de integridad si la password es incorrecta
      setState(prev => ({ ...prev, loading: false, error: "Contraseña incorrecta" }));
      throw new Error("Contraseña incorrecta");
    }
  }, [loadBalance, loadMxnbBalance, startPolling]);

  // ─── Crear nueva identidad ───────────────────────────────────

  const createIdentity = useCallback(async (password: string): Promise<Identity> => {
    const pwError = validatePasswordStrength(password);
    if (pwError) throw new Error(pwError);

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

      const payload = await encryptWithPassword(JSON.stringify(identity), password);
      saveEncrypted(payload);
      sessionPasswordRef.current = password;

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
  // También pide una contraseña nueva — es el candado local de ESTE dispositivo,
  // separado del mnemónico (que es el respaldo real, portable entre dispositivos).

  const recoverIdentity = useCallback(async (mnemonic: string, password: string): Promise<Identity> => {
    if (!validateMnemonic(mnemonic)) {
      throw new Error("Mnemónico inválido. Verifica las 12 palabras.");
    }
    const pwError = validatePasswordStrength(password);
    if (pwError) throw new Error(pwError);

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

      const payload = await encryptWithPassword(JSON.stringify(identity), password);
      saveEncrypted(payload);
      sessionPasswordRef.current = password;

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
      persistIdentity(updated); // fire-and-forget — re-cifra con la password de sesión
      return { ...prev, identity: updated };
    });
  }, [persistIdentity]);

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
  // Nota: logout ahora tiene dos sentidos posibles — "olvidar esta cuenta en
  // este dispositivo" (borra el ciphertext) vs "bloquear la sesión" (solo
  // limpia la memoria). Mantenemos el comportamiento original: logout = borrar
  // todo, ya que así funcionaba antes y el usuario siempre puede recuperar
  // con sus 12 palabras.

  const logout = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    sessionPasswordRef.current = null;
    clearIdentity();
    setState({ identity: null, balance: null, mxnbBalance: null, loading: false, error: null, step: "idle" });
    window.location.href = "/";
  }, []);

  // ─── Bloquear sesión sin borrar la cuenta ─────────────────────
  // Limpia la identidad de memoria y pide contraseña de nuevo, pero
  // conserva el ciphertext en localStorage — a diferencia de logout.

  const lock = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    sessionPasswordRef.current = null;
    setState(prev => ({
      ...prev,
      identity: null,
      balance: null,
      mxnbBalance: null,
      step: loadEncrypted() ? "locked" : "idle",
    }));
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
    unlock,
    lock,
    setHandle,
    refreshBalance,
    logout,
    getSmartAccountClient,
    getArbSmartAccountClient,
    sendPushNotification,
    isReady: state.step === "ready",
    isLocked: state.step === "locked",
    hasIdentity: !!state.identity,
  };
}
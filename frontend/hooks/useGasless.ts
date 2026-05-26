"use client";

import { useState, useCallback, useEffect } from "react";
import { parseUnits, formatUnits, Address, http, createPublicClient, encodeFunctionData, maxUint256, Hash } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";

const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const ROUTER = "0x52e5d621290F9941254d42F8AB905E3fAB32f6F1" as Address;

const ERC20_ABI = [
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;

const ROUTER_ABI = [
    {
        type: "function",
        name: "executePayment",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "order",
                type: "tuple",
                components: [
                    { name: "sender", type: "address" },
                    { name: "recipient", type: "address" },
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "minAmountOut", type: "uint256" },
                    { name: "routeId", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                    { name: "orderId", type: "bytes32" },
                ],
            },
        ],
        outputs: [{ name: "orderId", type: "bytes32" }],
    },
] as const;

export type GaslessStep =
    | "idle"
    | "creating_account"
    | "checking_balance"
    | "sending"
    | "confirming"
    | "done";

export interface GaslessState {
    smartAccountAddress: string | null;
    smartAccountBalance: string | null;
    loading: boolean;
    error: string | null;
    step: GaslessStep;
}

export function useGasless() {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const [state, setState] = useState<GaslessState>({
        smartAccountAddress: null,
        smartAccountBalance: null,
        loading: false,
        error: null,
        step: "idle",
    });

    const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "";
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "";
    const bundlerUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${pimlicoApiKey}`;

    // ─── Obtener Smart Account address ──────────────────────────

    const getSmartAccountAddress = useCallback(async (): Promise<string | null> => {
        if (!walletClient || !publicClient) {
            console.log("getSmartAccountAddress: missing walletClient or publicClient");
            return null;
        }
        try {
            console.log("getSmartAccountAddress: creating Safe account...");
            const viemPublicClient = createPublicClient({
                chain: sepolia,
                transport: http(rpcUrl),
            });

            const safeAccount = await toSafeSmartAccount({
                client: viemPublicClient as never,
                owners: [walletClient as never],
                entryPoint: {
                    address: entryPoint07Address,
                    version: "0.7",
                },
                version: "1.4.1",
            });

            console.log("getSmartAccountAddress: address =", safeAccount.address);
            setState(prev => ({ ...prev, smartAccountAddress: safeAccount.address }));
            return safeAccount.address;
        } catch (e) {
            console.error("getSmartAccountAddress error:", e);
            return null;
        }
    }, [walletClient, publicClient, rpcUrl]);

    // ─── Verificar balance USDC de la Smart Account ─────────────

    const getSmartAccountBalance = useCallback(async (): Promise<string> => {
        if (!walletClient || !publicClient) return "0";
        try {
            // Obtener la address primero
            const smartAddress = await getSmartAccountAddress();
            if (!smartAddress) return "0";

            const balance = await publicClient.readContract({
                address: USDC,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [smartAddress as Address],
            }) as bigint;

            const formatted = formatUnits(balance, 6);

            // Actualizar el estado con el balance
            setState(prev => ({ ...prev, smartAccountBalance: formatted }));

            return formatted;
        } catch {
            return "0";
        }
    }, [walletClient, publicClient, getSmartAccountAddress]);

    // ─── Envío gasless real con ERC-4337 ────────────────────────

    const sendGasless = useCallback(async (
        recipient: string,
        amount: string,
    ) => {
        if (!address || !walletClient) throw new Error("Wallet not connected");

        setState(prev => ({
            ...prev,
            loading: true,
            error: null,
            step: "creating_account",
        }));

        try {
            const amountBigInt = parseUnits(amount, 6);

            // Crear cliente público dedicado
            const viemPublicClient = createPublicClient({
                chain: sepolia,
                transport: http(rpcUrl),
            });

            // Crear Pimlico client
            const pimlicoClient = createPimlicoClient({
                transport: http(bundlerUrl),
                entryPoint: {
                    address: entryPoint07Address,
                    version: "0.7",
                },
            });

            // Crear Safe Smart Account del usuario
            const safeAccount = await toSafeSmartAccount({
                client: viemPublicClient as never,
                owners: [walletClient as never],
                entryPoint: {
                    address: entryPoint07Address,
                    version: "0.7",
                },
                version: "1.4.1",
            });

            setState(prev => ({
                ...prev,
                smartAccountAddress: safeAccount.address,
                step: "checking_balance",
            }));

            // Verificar balance USDC de la Smart Account
            const balance = await viemPublicClient.readContract({
                address: USDC,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [safeAccount.address],
            }) as bigint;

            setState(prev => ({
                ...prev,
                smartAccountBalance: formatUnits(balance, 6),
                step: "sending",
            }));

            if (balance < amountBigInt) {
                throw new Error(
                    `Insufficient USDC in Smart Account. Have: ${formatUnits(balance, 6)}, Need: ${amount}. Please fund your Smart Account first.`
                );
            }

            // Crear Smart Account Client con Pimlico como Paymaster
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

            // Calcular deadline
            const block = await viemPublicClient.getBlock();
            const deadline = block.timestamp + 3600n;

            // Enviar UserOperation — approve + executePayment en batch
            // El usuario firma UNA vez, Pimlico paga el gas
            const userOpHash = await (smartAccountClient as never as {
                sendUserOperation: (params: {
                    calls: Array<{
                        to: Address;
                        abi: unknown;
                        functionName: string;
                        args: unknown[];
                    }>;
                }) => Promise<Hash>;
            }).sendUserOperation({
                calls: [
                    {
                        to: USDC,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [ROUTER, maxUint256],
                    },
                    {
                        to: ROUTER,
                        abi: ROUTER_ABI,
                        functionName: "executePayment",
                        args: [{
                            sender: safeAccount.address,
                            recipient: recipient as Address,
                            tokenIn: USDC,
                            tokenOut: USDC,
                            amountIn: amountBigInt,
                            minAmountOut: (amountBigInt * 99n) / 100n,
                            routeId: 0n,
                            deadline,
                            orderId: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash,
                        }],
                    },
                ],
            });

            setState(prev => ({ ...prev, step: "confirming" }));

            // Esperar confirmación
            const receipt = await (smartAccountClient as never as {
                waitForUserOperationReceipt: (params: { hash: Hash }) => Promise<{
                    receipt: { transactionHash: Hash };
                }>;
            }).waitForUserOperationReceipt({ hash: userOpHash });

            setState(prev => ({
                ...prev,
                loading: false,
                step: "done",
            }));

            return {
                userOpHash,
                txHash: receipt.receipt.transactionHash,
                smartAccountAddress: safeAccount.address,
            };

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setState(prev => ({
                ...prev,
                loading: false,
                error: msg,
                step: "idle",
            }));
            throw e;
        }
    }, [address, walletClient, rpcUrl, bundlerUrl]);

    const reset = useCallback(() => {
        // Solo limpiar estado de transacción — preservar smartAccount address y balance
        setState(prev => ({
            ...prev,
            loading: false,
            error: null,
            step: "idle",
        }));
    }, []);

    // ─── Auto-cargar Smart Account cuando walletClient esté listo ─

    useEffect(() => {
        if (!walletClient) return;

        const load = async () => {
            try {
                const viemPublicClient = createPublicClient({
                    chain: sepolia,
                    transport: http(rpcUrl),
                });

                const safeAccount = await toSafeSmartAccount({
                    client: viemPublicClient as never,
                    owners: [walletClient as never],
                    entryPoint: {
                        address: entryPoint07Address,
                        version: "0.7",
                    },
                    version: "1.4.1",
                });

                const balance = await viemPublicClient.readContract({
                    address: USDC,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [safeAccount.address],
                }) as bigint;

                const formatted = formatUnits(balance, 6);

                setState(prev => ({
                    ...prev,
                    smartAccountAddress: safeAccount.address,
                    smartAccountBalance: formatted,
                }));
            } catch (e) {
                console.error("[useGasless] auto-load error:", e);
            }
        };

        load();
    }, [walletClient, rpcUrl]);

    return {
        ...state,
        getSmartAccountAddress,
        getSmartAccountBalance,
        sendGasless,
        reset,
    };
}

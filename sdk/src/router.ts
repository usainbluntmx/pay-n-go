import { PublicClient, WalletClient, Address, Account, Chain, zeroHash, maxUint256, parseEventLogs } from "viem";
import { PAYNGO_ROUTER_ABI, ERC20_ABI } from "./constants";
import {
    RouteQuote,
    ExecutePaymentParams,
    ExecutePaymentResult,
} from "./types";
import { PayNGoError, ERRORS } from "./errors";
import { rethrowAsPayNGoError } from "./contractErrors";

export class RouterModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private routerAddress: Address,
        private usdcAddress: Address,
        private chain: Chain
    ) { }

    // ─── Read ──────────────────────────────────────────────────────

    async getQuotes(
        tokenIn: Address,
        tokenOut: Address,
        amountIn: bigint
    ): Promise<RouteQuote[]> {
        const quotes = await this.publicClient.readContract({
            address: this.routerAddress,
            abi: PAYNGO_ROUTER_ABI,
            functionName: "getQuotes",
            args: [tokenIn, tokenOut, amountIn],
        }) as Array<{
            routeId: bigint;
            amountOut: bigint;
            fee: bigint;
            estimatedGas: bigint;
            available: boolean;
        }>;

        return quotes.map((q) => ({
            routeId: q.routeId,
            amountOut: q.amountOut,
            fee: q.fee,
            estimatedGas: q.estimatedGas,
            available: q.available,
        }));
    }

    async getBestRoute(
        tokenIn: Address,
        tokenOut: Address,
        amountIn: bigint
    ): Promise<{ routeId: bigint; amountOut: bigint }> {
        const result = await this.publicClient.readContract({
            address: this.routerAddress,
            abi: PAYNGO_ROUTER_ABI,
            functionName: "getBestRoute",
            args: [tokenIn, tokenOut, amountIn],
        }) as [bigint, bigint];

        return { routeId: result[0], amountOut: result[1] };
    }

    // ─── Write ─────────────────────────────────────────────────────

    async executePayment(params: ExecutePaymentParams): Promise<ExecutePaymentResult> {
        this._requireWallet();
        const account = this._getAccount();

        const tokenIn = params.tokenIn ?? this.usdcAddress;
        const tokenOut = params.tokenOut ?? this.usdcAddress;
        const slippageBps = BigInt(params.slippageBps ?? 100);
        const deadlineSeconds = params.deadlineSeconds ?? 3600;
        const requestedRouteId = params.routeId ?? 0n;

        // Si el caller pidió una ruta específica (routeId !== 0), el
        // amountOut esperado para calcular minAmountOut debe venir de ESA
        // ruta — antes siempre se usaba getBestRoute(), así que si la ruta
        // elegida tenía peor amountOut/fee que la mejor, el contrato
        // revertía SlippageExceeded aunque el usuario la haya elegido a
        // propósito. Fix: v0.3.8.
        let expectedOut: bigint;
        if (requestedRouteId !== 0n) {
            const quotes = await this.getQuotes(tokenIn, tokenOut, params.amount);
            const chosenQuote = quotes.find((q) => q.routeId === requestedRouteId);
            if (!chosenQuote) {
                throw new PayNGoError(
                    `Route ${requestedRouteId} not found among available quotes for this pair/amount`,
                    ERRORS.ROUTE_NOT_FOUND
                );
            }
            if (!chosenQuote.available) {
                throw new PayNGoError(
                    `Route ${requestedRouteId} exists but is not available`,
                    ERRORS.ROUTE_NOT_FOUND
                );
            }
            expectedOut = chosenQuote.amountOut;
        } else {
            const best = await this.getBestRoute(tokenIn, tokenOut, params.amount);
            expectedOut = best.amountOut;
        }

        const minAmountOut = (expectedOut * (10_000n - slippageBps)) / 10_000n;

        const block = await this.publicClient.getBlock();
        const deadline = block.timestamp + BigInt(deadlineSeconds);

        await this._ensureAllowance(account, tokenIn, this.routerAddress, params.amount);

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.routerAddress,
                abi: PAYNGO_ROUTER_ABI,
                functionName: "executePayment",
                args: [{
                    sender: account.address,
                    recipient: params.recipient,
                    tokenIn,
                    tokenOut,
                    amountIn: params.amount,
                    minAmountOut,
                    routeId: requestedRouteId,
                    deadline,
                    orderId: zeroHash,
                }],
                account,
                chain: this.chain,
            });

            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

            // Leer el orderId, amountOut y fee REALES del evento PaymentRouted —
            // antes se devolvía receipt.transactionHash como "orderId" (no es
            // el ID que genera el contrato) y fee/amountOut se recalculaban
            // localmente con FEE_BPS=30 hardcodeado, ignorando cualquier
            // feeBps adicional de la ruta usada. Fix: v0.3.5.
            const logs = parseEventLogs({
                abi: PAYNGO_ROUTER_ABI,
                logs: receipt.logs,
                eventName: "PaymentRouted",
            });

            if (logs.length === 0) {
                throw new PayNGoError("PaymentRouted event not found", ERRORS.TX_FAILED);
            }

            const log = logs[0] as unknown as {
                args: { orderId: `0x${string}`; routeId: bigint; amountOut: bigint; fee: bigint };
            };

            return {
                orderId: log.args.orderId,
                txHash: hash,
                amountOut: log.args.amountOut,
                fee: log.args.fee,
                routeId: log.args.routeId,
            };
        } catch (e) {
            if (e instanceof PayNGoError) throw e;
            // ej. SlippageExceeded, DeadlineExpired, RouteNotActive,
            // OrderAlreadyExecuted. Fix: v0.3.9.
            rethrowAsPayNGoError(e);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private _requireWallet(): void {
        if (!this.walletClient) {
            throw new PayNGoError("WalletClient required", ERRORS.NO_WALLET_CLIENT);
        }
    }

    // Ver comentario detallado en links.ts — devolver el Account completo
    // (no solo la address) es lo que hace que viem firme localmente en vez
    // de pedirle al RPC que firme con eth_sendTransaction. Fix: v0.3.2.
    private _getAccount(): Account {
        const account = this.walletClient?.account;
        if (!account) throw new PayNGoError("No account connected", ERRORS.NO_ACCOUNT);
        return account;
    }

    private async _ensureAllowance(
        owner: Account,
        token: Address,
        spender: Address,
        amount: bigint
    ): Promise<void> {
        const allowance = await this.publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner.address, spender],
        }) as bigint;

        if (allowance < amount) {
            const hash = await this.walletClient!.writeContract({
                address: token,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [spender, maxUint256],
                account: owner,
                chain: this.chain,
            });
            await this.publicClient.waitForTransactionReceipt({ hash });
        }
    }

    // ─── Gasless threshold ────────────────────────────────────

    async getGaslessThreshold(): Promise<bigint> {
        return this.publicClient.readContract({
            address: this.routerAddress,
            abi: PAYNGO_ROUTER_ABI,
            functionName: "gaslessThreshold",
        }) as Promise<bigint>;
    }

    async setGaslessThreshold(threshold: bigint): Promise<string> {
        this._requireWallet();
        const account = this._getAccount();

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.routerAddress,
                abi: PAYNGO_ROUTER_ABI,
                functionName: "setGaslessThreshold",
                args: [threshold],
                account,
                chain: this.chain,
            });

            await this.publicClient.waitForTransactionReceipt({ hash });
            return hash;
        } catch (e) {
            rethrowAsPayNGoError(e);
        }
    }

}
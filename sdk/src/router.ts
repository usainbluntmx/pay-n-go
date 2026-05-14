import { PublicClient, WalletClient, Address, zeroHash, maxUint256 } from "viem";
import { PAYNGO_ROUTER_ABI, ERC20_ABI } from "./constants";
import {
    RouteQuote,
    ExecutePaymentParams,
    ExecutePaymentResult,
} from "./types";
import { PayNGoError, ERRORS } from "./errors";

export class RouterModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private routerAddress: Address,
        private usdcAddress: Address
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

        const { amountOut: expectedOut } = await this.getBestRoute(
            tokenIn,
            tokenOut,
            params.amount
        );

        const minAmountOut = (expectedOut * (10_000n - slippageBps)) / 10_000n;

        const block = await this.publicClient.getBlock();
        const deadline = block.timestamp + BigInt(deadlineSeconds);

        await this._ensureAllowance(account, tokenIn, this.routerAddress, params.amount);

        const hash = await this.walletClient!.writeContract({
            address: this.routerAddress,
            abi: PAYNGO_ROUTER_ABI,
            functionName: "executePayment",
            args: [{
                sender: account,
                recipient: params.recipient,
                tokenIn,
                tokenOut,
                amountIn: params.amount,
                minAmountOut,
                routeId: params.routeId ?? 0n,
                deadline,
                orderId: zeroHash,
            }],
            account,
            chain: null,
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

        const fee = (params.amount * 30n) / 10_000n;
        const amountOut = params.amount - fee;

        return {
            orderId: receipt.transactionHash as `0x${string}`,
            txHash: hash,
            amountOut,
            fee,
            routeId: params.routeId ?? 0n,
        };
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private _requireWallet(): void {
        if (!this.walletClient) {
            throw new PayNGoError("WalletClient required", ERRORS.NO_WALLET_CLIENT);
        }
    }

    private _getAccount(): Address {
        const account = this.walletClient?.account?.address;
        if (!account) throw new PayNGoError("No account connected", ERRORS.NO_ACCOUNT);
        return account;
    }

    private async _ensureAllowance(
        owner: Address,
        token: Address,
        spender: Address,
        amount: bigint
    ): Promise<void> {
        const allowance = await this.publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner, spender],
        }) as bigint;

        if (allowance < amount) {
            const hash = await this.walletClient!.writeContract({
                address: token,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [spender, maxUint256],
                account: owner,
                chain: null,
            });
            await this.publicClient.waitForTransactionReceipt({ hash });
        }
    }
}
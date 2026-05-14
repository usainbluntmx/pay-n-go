import { PublicClient, WalletClient, Address, maxUint256 } from "viem";
import { PAYNGO_GATEWAY_ABI, ERC20_ABI } from "./constants";
import {
    SponsorPolicy,
    GaslessPaymentParams,
    GaslessPaymentResult,
    GasCostEstimate,
    SponsorMode,
} from "./types";
import { PayNGoError, ERRORS } from "./errors";

export class GatewayModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private gatewayAddress: Address,
        private usdcAddress: Address
    ) { }

    // ─── Read ──────────────────────────────────────────────────────

    async getPolicyFor(user: Address): Promise<SponsorPolicy> {
        const result = await this.publicClient.readContract({
            address: this.gatewayAddress,
            abi: PAYNGO_GATEWAY_ABI,
            functionName: "getPolicyFor",
            args: [user],
        }) as {
            mode: number;
            userShareBps: bigint;
            maxGasPerTx: bigint;
            active: boolean;
        };

        return {
            mode: result.mode as SponsorMode,
            userShareBps: result.userShareBps,
            maxGasPerTx: result.maxGasPerTx,
            active: result.active,
        };
    }

    async estimateGasCost(
        user: Address,
        gasLimit: number,
        gasPrice: bigint
    ): Promise<GasCostEstimate> {
        const result = await this.publicClient.readContract({
            address: this.gatewayAddress,
            abi: PAYNGO_GATEWAY_ABI,
            functionName: "estimateUsdcCost",
            args: [user, BigInt(gasLimit), gasPrice],
        }) as [bigint, bigint];

        return {
            usdcCost: result[0],
            ethCost: result[1],
            isFree: result[0] === 0n,
        };
    }

    async getEthBalance(): Promise<bigint> {
        return this.publicClient.readContract({
            address: this.gatewayAddress,
            abi: PAYNGO_GATEWAY_ABI,
            functionName: "getEthBalance",
        }) as Promise<bigint>;
    }

    async getUsdcBalance(): Promise<bigint> {
        return this.publicClient.readContract({
            address: this.gatewayAddress,
            abi: PAYNGO_GATEWAY_ABI,
            functionName: "getUsdcBalance",
        }) as Promise<bigint>;
    }

    // ─── Write ─────────────────────────────────────────────────────

    async executeGaslessPayment(
        params: GaslessPaymentParams
    ): Promise<GaslessPaymentResult> {
        this._requireWallet();
        const account = this._getAccount();
        const gasLimit = params.gasLimit ?? 150_000;

        await this._ensureAllowance(account, this.gatewayAddress, params.amount);

        const hash = await this.walletClient!.writeContract({
            address: this.gatewayAddress,
            abi: PAYNGO_GATEWAY_ABI,
            functionName: "executeGaslessPayment",
            args: [account, params.recipient, params.amount, BigInt(gasLimit)],
            account,
            chain: null,
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

        return {
            txId: receipt.transactionHash as `0x${string}`,
            txHash: hash,
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
        spender: Address,
        amount: bigint
    ): Promise<void> {
        const allowance = await this.publicClient.readContract({
            address: this.usdcAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner, spender],
        }) as bigint;

        if (allowance < amount) {
            const hash = await this.walletClient!.writeContract({
                address: this.usdcAddress,
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
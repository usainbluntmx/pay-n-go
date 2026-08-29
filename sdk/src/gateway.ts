import { PublicClient, WalletClient, Address, Account, Chain, maxUint256, parseEventLogs } from "viem";
import { PAYNGO_GATEWAY_ABI, ERC20_ABI } from "./constants";
import {
    SponsorPolicy,
    GaslessPaymentParams,
    GaslessPaymentResult,
    GasCostEstimate,
    GaslessEligibility,
    SponsorMode,
} from "./types";
import { PayNGoError, ERRORS } from "./errors";
import { rethrowAsPayNGoError } from "./contractErrors";

export class GatewayModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private gatewayAddress: Address,
        private usdcAddress: Address,
        private chain: Chain
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

    // Verifica de antemano si executeGaslessPayment() va a revertir por
    // UserNotWhitelisted o UserBlacklisted — antes de v0.4.3 no había forma
    // de saberlo sin intentar la transacción y recibir un revert "misterioso".
    // Nota: whitelistOnly es un flag GLOBAL del contrato — la whitelist
    // individual solo importa mientras ese flag esté activo.
    async getGaslessEligibility(user: Address): Promise<GaslessEligibility> {
        const [whitelistOnly, isWhitelisted, isBlacklisted] = await Promise.all([
            this.publicClient.readContract({
                address: this.gatewayAddress,
                abi: PAYNGO_GATEWAY_ABI,
                functionName: "whitelistOnly",
            }) as Promise<boolean>,
            this.publicClient.readContract({
                address: this.gatewayAddress,
                abi: PAYNGO_GATEWAY_ABI,
                functionName: "whitelistedUsers",
                args: [user],
            }) as Promise<boolean>,
            this.publicClient.readContract({
                address: this.gatewayAddress,
                abi: PAYNGO_GATEWAY_ABI,
                functionName: "blacklistedUsers",
                args: [user],
            }) as Promise<boolean>,
        ]);

        const eligible = !isBlacklisted && (!whitelistOnly || isWhitelisted);

        return { eligible, whitelistOnly, isWhitelisted, isBlacklisted };
    }

    // ─── Write ─────────────────────────────────────────────────────

    async executeGaslessPayment(
        params: GaslessPaymentParams
    ): Promise<GaslessPaymentResult> {
        this._requireWallet();
        const account = this._getAccount();
        const gasLimit = params.gasLimit ?? 150_000;

        await this._ensureAllowance(account, this.gatewayAddress, params.amount);

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.gatewayAddress,
                abi: PAYNGO_GATEWAY_ABI,
                functionName: "executeGaslessPayment",
                args: [account.address, params.recipient, params.amount, BigInt(gasLimit)],
                account,
                chain: this.chain,
            });

            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

            // Leer el txId real del evento GasSponsored — antes se devolvía
            // receipt.transactionHash como "txId", que no es el identificador
            // que el contrato genera y emite. Fix: v0.3.5.
            const logs = parseEventLogs({
                abi: PAYNGO_GATEWAY_ABI,
                logs: receipt.logs,
                eventName: "GasSponsored",
            });

            if (logs.length === 0) {
                throw new PayNGoError("GasSponsored event not found", ERRORS.TX_FAILED);
            }

            const log = logs[0] as unknown as { args: { txId: `0x${string}` } };

            return {
                txId: log.args.txId,
                txHash: hash,
            };
        } catch (e) {
            if (e instanceof PayNGoError) throw e;
            // ej. UserBlacklisted, UserNotWhitelisted, GasPriceTooHigh,
            // GasLimitExceeded, TxAlreadyProcessed. Fix: v0.3.9.
            rethrowAsPayNGoError(e);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private _requireWallet(): void {
        if (!this.walletClient) {
            throw new PayNGoError("WalletClient required", ERRORS.NO_WALLET_CLIENT);
        }
    }

    // Ver comentario detallado en links.ts. Fix: v0.3.2.
    private _getAccount(): Account {
        const account = this.walletClient?.account;
        if (!account) throw new PayNGoError("No account connected", ERRORS.NO_ACCOUNT);
        return account;
    }

    private async _ensureAllowance(
        owner: Account,
        spender: Address,
        amount: bigint
    ): Promise<void> {
        const allowance = await this.publicClient.readContract({
            address: this.usdcAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner.address, spender],
        }) as bigint;

        if (allowance < amount) {
            const hash = await this.walletClient!.writeContract({
                address: this.usdcAddress,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [spender, maxUint256],
                account: owner,
                chain: this.chain,
            });
            await this.publicClient.waitForTransactionReceipt({ hash });
        }
    }
}
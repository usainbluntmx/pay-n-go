import {
    PublicClient,
    WalletClient,
    Address,
    parseEventLogs,
    maxUint256,
} from "viem";
import { PAYNGO_LINKS_ABI, ERC20_ABI } from "./constants";
import {
    PaymentLink,
    CreateLinkParams,
    CreateLinkResult,
    PayLinkResult,
    LinkStatus,
} from "./types";
import { PayNGoError, ERRORS } from "./errors";

export class LinksModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private linksAddress: Address,
        private usdcAddress: Address
    ) { }

    // ─── Read ──────────────────────────────────────────────────────

    async getLink(linkId: bigint): Promise<PaymentLink> {
        const result = await this.publicClient.readContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "getLink",
            args: [linkId],
        }) as {
            id: bigint;
            creator: Address;
            recipient: Address;
            token: Address;
            amount: bigint;
            expiresAt: bigint;
            status: number;
            memo: string;
            createdAt: bigint;
            paidAt: bigint;
            paidBy: Address;
        };

        return {
            id: result.id,
            creator: result.creator,
            recipient: result.recipient,
            token: result.token,
            amount: result.amount,
            expiresAt: result.expiresAt,
            status: result.status as LinkStatus,
            memo: result.memo,
            createdAt: result.createdAt,
            paidAt: result.paidAt,
            paidBy: result.paidBy,
        };
    }

    async getLinksByCreator(creator: Address): Promise<bigint[]> {
        const ids = await this.publicClient.readContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "getLinksByCreator",
            args: [creator],
        }) as bigint[];
        return [...ids];
    }

    async getLinksByRecipient(recipient: Address): Promise<bigint[]> {
        const ids = await this.publicClient.readContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "getLinksByRecipient",
            args: [recipient],
        }) as bigint[];
        return [...ids];
    }

    async isLinkPayable(linkId: bigint): Promise<boolean> {
        return this.publicClient.readContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "isLinkPayable",
            args: [linkId],
        }) as Promise<boolean>;
    }

    async totalLinks(): Promise<bigint> {
        return this.publicClient.readContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "totalLinks",
        }) as Promise<bigint>;
    }

    // ─── Write ─────────────────────────────────────────────────────

    async createLink(params: CreateLinkParams): Promise<CreateLinkResult> {
        this._requireWallet();
        const account = this._getAccount();

        const token = params.token ?? this.usdcAddress;
        const expiresIn = BigInt(params.expiresIn ?? 0);
        const memo = params.memo ?? "";

        const hash = await this.walletClient!.writeContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "createLink",
            args: [params.recipient, token, params.amount, expiresIn, memo],
            account,
            chain: null,
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

        const logs = parseEventLogs({
            abi: PAYNGO_LINKS_ABI,
            logs: receipt.logs,
            eventName: "LinkCreated",
        });

        if (logs.length === 0) {
            throw new PayNGoError("LinkCreated event not found", ERRORS.TX_FAILED);
        }

        const log = logs[0] as unknown as { args: { id: bigint } };

        return {
            linkId: log.args.id,
            txHash: hash,
        };
    }

    async payLink(linkId: bigint): Promise<PayLinkResult> {
        this._requireWallet();
        const account = this._getAccount();

        const link = await this.getLink(linkId);

        const payable = await this.isLinkPayable(linkId);
        if (!payable) {
            throw new PayNGoError(`Link ${linkId} is not payable`, ERRORS.LINK_NOT_PAYABLE);
        }

        await this._ensureAllowance(account, this.linksAddress, link.amount);

        const hash = await this.walletClient!.writeContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "payLink",
            args: [linkId],
            account,
            chain: null,
        });

        await this.publicClient.waitForTransactionReceipt({ hash });

        const fee = (link.amount * 50n) / 10_000n;
        return {
            txHash: hash,
            amountPaid: link.amount,
            fee,
        };
    }

    async cancelLink(linkId: bigint): Promise<string> {
        this._requireWallet();
        const account = this._getAccount();

        const hash = await this.walletClient!.writeContract({
            address: this.linksAddress,
            abi: PAYNGO_LINKS_ABI,
            functionName: "cancelLink",
            args: [linkId],
            account,
            chain: null,
        });

        await this.publicClient.waitForTransactionReceipt({ hash });
        return hash;
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private _requireWallet(): void {
        if (!this.walletClient) {
            throw new PayNGoError("WalletClient required for write operations", ERRORS.NO_WALLET_CLIENT);
        }
    }

    private _getAccount(): Address {
        const account = this.walletClient?.account?.address;
        if (!account) {
            throw new PayNGoError("No account connected", ERRORS.NO_ACCOUNT);
        }
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
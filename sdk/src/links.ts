import {
    PublicClient,
    WalletClient,
    Address,
    Account,
    Chain,
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
import { rethrowAsPayNGoError } from "./contractErrors";

export class LinksModule {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient | undefined,
        private linksAddress: Address,
        private usdcAddress: Address,
        // Ver comentario equivalente en links.ts — chain:null rompía
        // writeContract contra Alchemy y providers estrictos. Fix: v0.3.1.
        private chain: Chain
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

        // El contrato no revierte para un linkId inexistente — devuelve un
        // struct vacío (id=0, creator=address(0), status=Active/0). Sin
        // esta validación, un id inexistente se ve como un link Active
        // legítimo: isLinkPayable() reportaría true, y payLink() intentaría
        // la transacción y fallaría con un error crudo de viem en vez de
        // un PayNGoError claro. Fix: v0.3.8.
        if (result.id === 0n && result.creator === "0x0000000000000000000000000000000000000000") {
            throw new PayNGoError(`Link ${linkId} not found`, ERRORS.LINK_NOT_FOUND);
        }

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

    // NOTA: al igual que getLink(), el contrato no revierte para un linkId
    // inexistente — isLinkPayable(idInexistente) devuelve `true` porque un
    // struct vacío tiene status=Active(0) y expiresAt=0 (sin expiración).
    // A diferencia de getLink(), esta función no tiene suficiente
    // información (no trae `creator`) para distinguir "vacío" de "real" sin
    // una llamada adicional — así que el comportamiento fantasma persiste
    // si se llama aislado. Usa getLink() primero para validar existencia;
    // payLink() ya lo hace internamente y por eso está protegido.
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

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.linksAddress,
                abi: PAYNGO_LINKS_ABI,
                functionName: "createLink",
                args: [params.recipient, token, params.amount, expiresIn, memo],
                account,
                chain: this.chain,
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
        } catch (e) {
            if (e instanceof PayNGoError) throw e;
            // Intenta decodificar el revert contra los custom errors del
            // contrato (ej. InvalidAmount, InvalidRecipient, InvalidExpiry,
            // TokenNotSupported) — si no lo reconoce, relanza tal cual.
            // Fix: v0.3.9.
            rethrowAsPayNGoError(e);
        }
    }

    async payLink(linkId: bigint): Promise<PayLinkResult> {
        this._requireWallet();
        const account = this._getAccount();

        // getLink() ahora lanza PayNGoError(LINK_NOT_FOUND) si linkId no
        // existe — antes de este fix, isLinkPayable() reportaba `true`
        // para un id inexistente y la transacción fallaba con un error
        // crudo de viem en vez de un error claro. Fix: v0.3.8.
        const link = await this.getLink(linkId);

        const payable = await this.isLinkPayable(linkId);
        if (!payable) {
            throw new PayNGoError(`Link ${linkId} is not payable`, ERRORS.LINK_NOT_PAYABLE);
        }

        await this._ensureAllowance(account, this.linksAddress, link.amount);

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.linksAddress,
                abi: PAYNGO_LINKS_ABI,
                functionName: "payLink",
                args: [linkId],
                account,
                chain: this.chain,
            });

            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

            // Leer el fee real del evento LinkPaid en vez de recalcularlo con
            // FEE_BPS=50 hardcodeado — mismo patrón aplicado a Router/Gateway
            // en v0.3.5. Fix: v0.3.8.
            const logs = parseEventLogs({
                abi: PAYNGO_LINKS_ABI,
                logs: receipt.logs,
                eventName: "LinkPaid",
            });

            if (logs.length === 0) {
                throw new PayNGoError("LinkPaid event not found", ERRORS.TX_FAILED);
            }

            const log = logs[0] as unknown as { args: { amount: bigint; fee: bigint } };

            return {
                txHash: hash,
                amountPaid: log.args.amount,
                fee: log.args.fee,
            };
        } catch (e) {
            if (e instanceof PayNGoError) throw e;
            // ej. LinkNotActive, LinkExpired — puede ocurrir por una
            // condición de carrera (el link cambió de estado entre
            // isLinkPayable() y el envío de la tx). Fix: v0.3.9.
            rethrowAsPayNGoError(e);
        }
    }

    async cancelLink(linkId: bigint): Promise<string> {
        this._requireWallet();
        const account = this._getAccount();

        try {
            const hash = await this.walletClient!.writeContract({
                address: this.linksAddress,
                abi: PAYNGO_LINKS_ABI,
                functionName: "cancelLink",
                args: [linkId],
                account,
                chain: this.chain,
            });

            await this.publicClient.waitForTransactionReceipt({ hash });
            return hash;
        } catch (e) {
            // ej. NotLinkCreator — si alguien que no creó el link intenta
            // cancelarlo. Fix: v0.3.9.
            rethrowAsPayNGoError(e);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private _requireWallet(): void {
        if (!this.walletClient) {
            throw new PayNGoError("WalletClient required for write operations", ERRORS.NO_WALLET_CLIENT);
        }
    }

    // Devuelve el objeto Account COMPLETO (no solo la address como string).
    // Bug crítico corregido en v0.3.2: pasar solo el string de la address a
    // writeContract({ account }) hace que viem trate la cuenta como una
    // "JSON-RPC account" remota — sin la private key adjunta, viem le pide
    // al propio nodo RPC que firme la transacción (eth_sendTransaction) en
    // vez de firmar localmente y mandar eth_sendRawTransaction. Providers
    // estrictos como Alchemy rechazan eth_sendTransaction con
    // "Unsupported method", incluso teniendo saldo y calldata válidos.
    private _getAccount(): Account {
        const account = this.walletClient?.account;
        if (!account) {
            throw new PayNGoError("No account connected", ERRORS.NO_ACCOUNT);
        }
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
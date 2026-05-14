import { PublicClient, WalletClient } from "viem";
import { PayNGoConfig, ContractAddresses } from "./types";
import { CONTRACT_ADDRESSES } from "./constants";
import { LinksModule } from "./links";
import { RouterModule } from "./router";
import { GatewayModule } from "./gateway";
import { PayNGoError, ERRORS } from "./errors";

export class PayNGoClient {
    public readonly links: LinksModule;
    public readonly router: RouterModule;
    public readonly gateway: GatewayModule;

    private readonly addresses: ContractAddresses;

    constructor(config: PayNGoConfig) {
        // Resolver addresses por chainId o usar las pasadas en config
        const defaultAddresses = CONTRACT_ADDRESSES[config.chainId];
        if (!defaultAddresses && !config.contracts) {
            throw new PayNGoError(
                `Unsupported chainId: ${config.chainId}. Pass contracts manually.`,
                ERRORS.UNSUPPORTED_CHAIN
            );
        }

        this.addresses = {
            ...defaultAddresses,
            ...config.contracts,
        };

        const publicClient = config.publicClient;
        const walletClient = config.walletClient;

        this.links = new LinksModule(
            publicClient,
            walletClient,
            this.addresses.payNGoLinks,
            this.addresses.usdc
        );

        this.router = new RouterModule(
            publicClient,
            walletClient,
            this.addresses.payNGoRouter,
            this.addresses.usdc
        );

        this.gateway = new GatewayModule(
            publicClient,
            walletClient,
            this.addresses.payNGoGateway,
            this.addresses.usdc
        );
    }

    getAddresses(): ContractAddresses {
        return this.addresses;
    }
}
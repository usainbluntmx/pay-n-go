import { PublicClient, WalletClient, Chain } from "viem";
import { sepolia, arbitrumSepolia, mainnet, hardhat } from "viem/chains";
import { PayNGoConfig, ContractAddresses } from "./types";
import { CONTRACT_ADDRESSES, CHAIN_IDS } from "./constants";
import { LinksModule } from "./links";
import { RouterModule } from "./router";
import { GatewayModule } from "./gateway";
import { PayNGoError, ERRORS } from "./errors";

// Mapea chainId → objeto Chain de viem. Necesario para que writeContract
// funcione correctamente contra providers estrictos como Alchemy (ver
// links.ts/router.ts/gateway.ts) — antes se pasaba chain:null en cada
// escritura, lo cual estos providers rechazan. Fix: v0.3.1.
const VIEM_CHAINS: Record<number, Chain> = {
    [CHAIN_IDS.ETHEREUM_MAINNET]: mainnet,
    [CHAIN_IDS.ETHEREUM_SEPOLIA]: sepolia,
    [CHAIN_IDS.ARBITRUM_SEPOLIA]: arbitrumSepolia,
    [CHAIN_IDS.HARDHAT]: hardhat,
};

function resolveChain(chainId: number): Chain {
    const chain = VIEM_CHAINS[chainId];
    if (!chain) {
        throw new PayNGoError(
            `No se pudo resolver el objeto Chain de viem para chainId: ${chainId}. ` +
            `Si usas una red custom, instancia los módulos manualmente pasando tu propio objeto Chain.`,
            ERRORS.UNSUPPORTED_CHAIN
        );
    }
    return chain;
}

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
        const chain = resolveChain(config.chainId);

        this.links = new LinksModule(
            publicClient,
            walletClient,
            this.addresses.payNGoLinks,
            this.addresses.usdc,
            chain
        );

        this.router = new RouterModule(
            publicClient,
            walletClient,
            this.addresses.payNGoRouter,
            this.addresses.usdc,
            chain
        );

        this.gateway = new GatewayModule(
            publicClient,
            walletClient,
            this.addresses.payNGoGateway,
            this.addresses.usdc,
            chain
        );
    }

    getAddresses(): ContractAddresses {
        return this.addresses;
    }
}
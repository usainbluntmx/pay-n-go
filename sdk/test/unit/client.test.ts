import { createPublicClient, http } from "viem";
import { sepolia, arbitrumSepolia, hardhat } from "viem/chains";
import { PayNGoClient } from "../../src/client";
import { CHAIN_IDS } from "../../src/constants";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

describe("PayNGoClient — resolución de chain y direcciones", () => {
  it("se instancia con los defaults de Ethereum Sepolia", () => {
    const client = new PayNGoClient({
      publicClient: publicClient as never,
      chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
    });
    const addresses = client.getAddresses();
    expect(addresses.payNGoLinks).toBeTruthy();
    expect(addresses.payNGoRouter).toBeTruthy();
    expect(addresses.payNGoGateway).toBeTruthy();
    expect(addresses.usdc).toBeTruthy();
  });

  it("lanza PayNGoError para un chainId no soportado sin contracts ni chain", () => {
    expect(() => new PayNGoClient({
      publicClient: publicClient as never,
      chainId: 999999,
    })).toThrow();
  });

  it("acepta un chainId no soportado si se pasan contracts Y chain explícitos (fix v0.3.4)", () => {
    const client = new PayNGoClient({
      publicClient: publicClient as never,
      chainId: 84532, // Base Sepolia — no está en el mapa interno del SDK
      chain: { ...sepolia, id: 84532, name: "Base Sepolia" },
      contracts: {
        payNGoLinks: "0x1111111111111111111111111111111111111111",
        payNGoRouter: "0x2222222222222222222222222222222222222222",
        payNGoGateway: "0x3333333333333333333333333333333333333333",
        usdc: "0x4444444444444444444444444444444444444444",
      },
    });
    const addresses = client.getAddresses();
    expect(addresses.payNGoLinks).toBe("0x1111111111111111111111111111111111111111");
  });

  it("lanza PayNGoError si se pasan contracts pero no chain para un chainId no mapeado", () => {
    expect(() => new PayNGoClient({
      publicClient: publicClient as never,
      chainId: 84532,
      contracts: {
        payNGoLinks: "0x1111111111111111111111111111111111111111",
        payNGoRouter: "0x2222222222222222222222222222222222222222",
        payNGoGateway: "0x3333333333333333333333333333333333333333",
        usdc: "0x4444444444444444444444444444444444444444",
      },
      // sin `chain` — debe fallar al resolver el objeto Chain de viem
    })).toThrow();
  });

  it("mezcla contracts parciales sobre los defaults conocidos", () => {
    const client = new PayNGoClient({
      publicClient: publicClient as never,
      chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
      contracts: {
        payNGoGateway: "0x9999999999999999999999999999999999999999",
      },
    });
    const addresses = client.getAddresses();
    expect(addresses.payNGoGateway).toBe("0x9999999999999999999999999999999999999999");
    // el resto debe seguir siendo el default de Sepolia, no vacío
    expect(addresses.payNGoLinks).not.toBe("0x9999999999999999999999999999999999999999");
    expect(addresses.payNGoLinks).toBeTruthy();
  });

  it("los tres módulos (links, router, gateway) están presentes tras instanciar", () => {
    const client = new PayNGoClient({
      publicClient: publicClient as never,
      chainId: CHAIN_IDS.ARBITRUM_SEPOLIA,
      contracts: {
        payNGoLinks: "0x1111111111111111111111111111111111111111",
        payNGoRouter: "0x2222222222222222222222222222222222222222",
        payNGoGateway: "0x3333333333333333333333333333333333333333",
        usdc: "0x4444444444444444444444444444444444444444",
      },
    });
    expect(client.links).toBeDefined();
    expect(client.router).toBeDefined();
    expect(client.gateway).toBeDefined();
  });
});

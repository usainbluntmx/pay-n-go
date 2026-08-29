import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { LinksModule } from "../../src/links";
import { PayNGoError } from "../../src/errors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const LINKS_ADDRESS = "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

function makeLinksModule(mockReadContract: jest.Mock) {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
  });
  // Sobrescribimos readContract con el mock — no llamamos a la red real.
  (publicClient as unknown as { readContract: jest.Mock }).readContract = mockReadContract;

  return new LinksModule(
    publicClient as never,
    undefined,
    LINKS_ADDRESS,
    USDC_ADDRESS,
    sepolia
  );
}

describe("LinksModule.getLink — detección de link inexistente", () => {
  it("lanza PayNGoError(LINK_NOT_FOUND) cuando el contrato devuelve un struct vacío", async () => {
    const mockReadContract = jest.fn().mockResolvedValue({
      id: 0n,
      creator: ZERO_ADDRESS,
      recipient: ZERO_ADDRESS,
      token: ZERO_ADDRESS,
      amount: 0n,
      expiresAt: 0n,
      status: 0, // Active — así es como se ve un struct vacío, el bug reportado
      memo: "",
      createdAt: 0n,
      paidAt: 0n,
      paidBy: ZERO_ADDRESS,
    });
    const links = makeLinksModule(mockReadContract);

    await expect(links.getLink(999999n)).rejects.toThrow(PayNGoError);
    await expect(links.getLink(999999n)).rejects.toMatchObject({ code: "LINK_NOT_FOUND" });
  });

  it("devuelve el link normalmente cuando sí existe (id !== 0 o creator !== address(0))", async () => {
    const mockReadContract = jest.fn().mockResolvedValue({
      id: 1n,
      creator: "0x9dabBF114698bd9bFBF6222b9FD6Cd967ECD3850",
      recipient: "0x9dabBF114698bd9bFBF6222b9FD6Cd967ECD3850",
      token: USDC_ADDRESS,
      amount: 1_000_000n,
      expiresAt: 0n,
      status: 0,
      memo: "test",
      createdAt: 123n,
      paidAt: 0n,
      paidBy: ZERO_ADDRESS,
    });
    const links = makeLinksModule(mockReadContract);

    const link = await links.getLink(1n);
    expect(link.id).toBe(1n);
    expect(link.memo).toBe("test");
  });
});

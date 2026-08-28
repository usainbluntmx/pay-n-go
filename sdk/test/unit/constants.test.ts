import { CHAIN_IDS, CONTRACT_ADDRESSES } from "../../src/constants";
import { TOKEN_ADDRESSES } from "../../src/index";
import { LinkStatus, RouteType, SponsorMode } from "../../src/types";

describe("Constantes exportadas", () => {
  it("CHAIN_IDS tiene los valores correctos", () => {
    expect(CHAIN_IDS.ETHEREUM_SEPOLIA).toBe(11155111);
    expect(CHAIN_IDS.ARBITRUM_SEPOLIA).toBe(421614);
  });

  it("CONTRACT_ADDRESSES tiene entrada completa para Ethereum Sepolia", () => {
    const addrs = CONTRACT_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA];
    expect(addrs).toBeDefined();
    expect(addrs.payNGoLinks).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(addrs.payNGoRouter).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(addrs.payNGoGateway).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(addrs.usdc).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("TOKEN_ADDRESSES tiene MXNB en Arbitrum Sepolia", () => {
    const mxnb = TOKEN_ADDRESSES[CHAIN_IDS.ARBITRUM_SEPOLIA]?.mxnb;
    expect(mxnb?.toLowerCase()).toBe("0x82b9e52b26a2954e113f94ff26647754d5a4247d");
  });
});

describe("Enums exportados", () => {
  it("LinkStatus mantiene el orden esperado por el contrato", () => {
    expect(LinkStatus.Active).toBe(0);
    expect(LinkStatus.Paid).toBe(1);
    expect(LinkStatus.Cancelled).toBe(2);
    expect(LinkStatus.Expired).toBe(3);
  });

  it("RouteType y SponsorMode empiezan en 0", () => {
    expect(RouteType.Direct).toBe(0);
    expect(SponsorMode.Full).toBe(0);
  });
});

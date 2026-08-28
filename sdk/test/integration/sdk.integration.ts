/**
 * Test de integración end-to-end contra Ethereum Sepolia REAL.
 *
 * A diferencia de test/unit/, este script:
 *   - Requiere una wallet con ETH y USDC de Sepolia testnet
 *   - Ejecuta transacciones reales (createLink, payLink) que gastan gas
 *   - NO corre en `npm test` — es opt-in vía `npm run test:integration`
 *   - NO corre en CI por default (requiere secrets de una wallet fondeada)
 *
 * Uso:
 *   cp .env.integration.example .env
 *   # completa SEPOLIA_RPC_URL y TEST_PRIVATE_KEY con una wallet de testnet
 *   npm run test:integration
 *
 * Este es el mismo script usado para verificar manualmente los fixes de
 * v0.3.2 (bug de firma con Alchemy) y v0.3.5 (orderId/txId reales) antes
 * de publicarlos — ver CHANGELOG en README.md.
 */
import { createPublicClient, createWalletClient, http, formatUnits, formatEther, parseUnits, decodeEventLog } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import {
  PayNGoClient,
  CHAIN_IDS,
  CONTRACT_ADDRESSES,
  TOKEN_ADDRESSES,
  LinkStatus,
  RouteType,
  SponsorMode,
  PayNGoError,
  PAYNGO_ROUTER_ABI,
} from "../../src/index";

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY as `0x${string}` | undefined;

if (!RPC_URL || !PRIVATE_KEY) {
  console.log("⏭️  Saltando test de integración: faltan SEPOLIA_RPC_URL y/o TEST_PRIVATE_KEY en .env");
  console.log("    Ver test/integration/.env.integration.example");
  process.exit(0);
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${name}`);
    console.log(`   ${msg.slice(0, 200)}`);
    failed++;
    failures.push(name);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Test de integración — @zero-two-labs/payngo (Sepolia)");
  console.log("═══════════════════════════════════════════════════\n");

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Wallet de prueba:", account.address, "\n");

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance: ${formatEther(ethBalance)} ETH`);

  const USDC_ABI = [{
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }],
  }] as const;

  const usdcBalance = await publicClient.readContract({
    address: CONTRACT_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA].usdc,
    abi: USDC_ABI, functionName: "balanceOf", args: [account.address],
  }) as bigint;
  console.log(`USDC balance: ${formatUnits(usdcBalance, 6)} USDC\n`);

  const canWrite = ethBalance > 0n;
  const canPayLink = usdcBalance >= parseUnits("1", 6);

  if (!canWrite) {
    console.log("⏭️  Sin ETH — saltando todos los tests de escritura.\n");
  }

  console.log("─── Constantes y tipos ───\n");
  await check("CHAIN_IDS y CONTRACT_ADDRESSES correctos", async () => {
    if (CHAIN_IDS.ETHEREUM_SEPOLIA !== 11155111) throw new Error("chainId incorrecto");
    if (!CONTRACT_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA]?.payNGoLinks) throw new Error("faltan direcciones");
  });
  await check("TOKEN_ADDRESSES tiene MXNB", async () => {
    if (!TOKEN_ADDRESSES[CHAIN_IDS.ARBITRUM_SEPOLIA]?.mxnb) throw new Error("falta MXNB");
  });
  await check("LinkStatus, RouteType, SponsorMode definidos", async () => {
    if (LinkStatus.Active !== 0 || RouteType.Direct !== 0 || SponsorMode.Full !== 0) throw new Error("enum shift");
  });

  console.log("\n─── Cliente e instanciación ───\n");
  const client = new PayNGoClient({
    publicClient: publicClient as never,
    walletClient: walletClient as never,
    chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
  });
  await check("PayNGoClient.getAddresses() devuelve las 4 direcciones", async () => {
    const addrs = client.getAddresses();
    if (!addrs.payNGoLinks || !addrs.payNGoRouter || !addrs.payNGoGateway || !addrs.usdc) throw new Error("faltan");
  });
  await check("chainId no soportado sin contracts lanza PayNGoError", async () => {
    try {
      new PayNGoClient({ publicClient: publicClient as never, chainId: 999999 });
      throw new Error("no lanzó");
    } catch (e) {
      if (!(e instanceof PayNGoError)) throw new Error("no fue PayNGoError");
    }
  });

  console.log("\n─── LinksModule — lecturas ───\n");
  await check("totalLinks() devuelve bigint", async () => {
    const total = await client.links.totalLinks();
    if (typeof total !== "bigint") throw new Error("no es bigint");
  });
  await check("getLinksByCreator() devuelve array", async () => {
    const ids = await client.links.getLinksByCreator(account.address);
    if (!Array.isArray(ids)) throw new Error("no es array");
  });

  console.log("\n─── RouterModule — lecturas ───\n");
  const usdcAddr = CONTRACT_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA].usdc;
  await check("getQuotes() devuelve al menos 1 ruta", async () => {
    const quotes = await client.router.getQuotes(usdcAddr, usdcAddr, parseUnits("10", 6));
    if (quotes.length === 0) throw new Error("sin rutas");
  });
  await check("getBestRoute() devuelve routeId > 0", async () => {
    const best = await client.router.getBestRoute(usdcAddr, usdcAddr, parseUnits("10", 6));
    if (best.routeId === 0n) throw new Error("routeId 0");
  });

  console.log("\n─── GatewayModule — lecturas ───\n");
  await check("getPolicyFor() devuelve una política válida", async () => {
    const policy = await client.gateway.getPolicyFor(account.address);
    if (![SponsorMode.Full, SponsorMode.Partial, SponsorMode.Token].includes(policy.mode)) throw new Error("mode inválido");
  });
  await check("estimateGasCost() devuelve usdcCost/ethCost/isFree", async () => {
    const est = await client.gateway.estimateGasCost(account.address, 100_000, 1_000_000_000n);
    if (typeof est.isFree !== "boolean") throw new Error("isFree no boolean");
  });

  if (canWrite) {
    console.log("\n─── LinksModule — escritura real ───\n");
    let linkId: bigint | null = null;

    await check("createLink() crea un link real y devuelve linkId + txHash", async () => {
      const result = await client.links.createLink({
        recipient: account.address,
        amount: parseUnits("1", 6),
        memo: "integration test " + new Date().toISOString(),
      });
      linkId = result.linkId;
      if (typeof result.linkId !== "bigint") throw new Error("linkId no bigint");
    });

    if (linkId !== null) {
      await check("getLink() refleja los datos correctos", async () => {
        const link = await client.links.getLink(linkId!);
        if (link.status !== LinkStatus.Active) throw new Error("status incorrecto");
      });
      await check("isLinkPayable() es true antes de pagar", async () => {
        if (!(await client.links.isLinkPayable(linkId!))) throw new Error("debería ser pagable");
      });

      if (canPayLink) {
        await check("payLink() paga el link (self-pay) y status pasa a Paid", async () => {
          const result = await client.links.payLink(linkId!);
          if (!result.txHash) throw new Error("sin txHash");
          const link = await client.links.getLink(linkId!);
          if (link.status !== LinkStatus.Paid) throw new Error("status no cambió a Paid");
        });
      } else {
        await check("cancelLink() limpia el link de prueba (sin USDC para pagar)", async () => {
          await client.links.cancelLink(linkId!);
        });
      }
    }

    console.log("\n─── RouterModule — escritura real, orderId verificado ───\n");
    if (canPayLink) {
      await check("executePayment() devuelve orderId real (no txHash) y fee/amountOut del evento", async () => {
        const result = await client.router.executePayment({
          recipient: account.address,
          amount: parseUnits("1", 6),
        });

        if (result.orderId.toLowerCase() === result.txHash.toLowerCase()) {
          throw new Error("orderId es igual a txHash — regresión del bug pre-0.3.5");
        }

        // Verificación independiente: decodificar el evento nosotros mismos
        const receipt = await publicClient.getTransactionReceipt({ hash: result.txHash });
        let realOrderId: string | null = null;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: PAYNGO_ROUTER_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "PaymentRouted") {
              realOrderId = (decoded.args as { orderId: string }).orderId;
              break;
            }
          } catch { /* no era este evento */ }
        }
        if (result.orderId.toLowerCase() !== realOrderId?.toLowerCase()) {
          throw new Error(`orderId (${result.orderId}) no coincide con el evento real (${realOrderId})`);
        }
      });
    } else {
      console.log("⏭️  Sin USDC suficiente — saltando executePayment()");
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  RESULTADO: ${passed} pasaron, ${failed} fallaron`);
  console.log("═══════════════════════════════════════════════════");
  if (failures.length > 0) {
    console.log("\nFallos:");
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n💥 Error fatal no capturado:", e);
  process.exit(1);
});

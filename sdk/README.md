# @zero-two-labs/payngo

SDK de TypeScript para [Pay'n Go](https://pay-n-go-weld.vercel.app) — pagos en stablecoins con links de pago, ruteo óptimo, sponsorship de gas y un agente de IA que interpreta instrucciones en lenguaje natural.

Construido sobre [viem](https://viem.sh). Funciona en Node.js y en el navegador.

**Versión mínima recomendada: `^0.3.2`** — versiones anteriores tienen un bug crítico donde toda operación de escritura (`createLink`, `payLink`, `executePayment`, `executeGaslessPayment`, etc.) falla contra providers RPC estrictos como Alchemy. Ver [Changelog](#changelog).

---

## Changelog

### 0.3.2
- **Fix crítico:** las operaciones de escritura (`createLink`, `payLink`, `cancelLink`, `executePayment`, `executeGaslessPayment`, `setGaslessThreshold`, y el `approve` interno de USDC) fallaban con `"Unsupported method: eth_sendTransaction"` contra Alchemy y otros providers RPC estrictos. La causa: los tres módulos extraían solo la `address` (string) del `walletClient.account` en vez de pasar el objeto `Account` completo a `writeContract`. Sin el objeto completo, viem no puede firmar localmente y en su lugar le pide al RPC que firme — algo que Alchemy rechaza. Verificado end-to-end contra Ethereum Sepolia real (23/23 tests, incluyendo `createLink`→`payLink` con fondos reales).

### 0.3.1
- Fix: `chain: null` en todos los `writeContract` causaba comportamiento inconsistente entre providers RPC. Ahora cada módulo recibe y usa la `Chain` real de viem, resuelta automáticamente por `PayNGoClient` a partir de `chainId`.

### 0.3.0
- Renombrado de scope: `@payngo-labs/sdk` → `@zero-two-labs/payngo`.
- Fix: el export de `GaslessModule` en `index.ts` apuntaba a un archivo (`./gasless`) que no existía — rompía el build de cualquiera que clonara el repo. Eliminado; el sponsorship gasless vive en `GatewayModule` (`client.gateway.*`).
- Fix: `agent-demo.ts` se filtraba al tarball publicado en npm. Excluido del build de `tsc`.
- Agregado `TOKEN_ADDRESSES` — dirección de MXNB en Arbitrum Sepolia, para chains sin el stack completo de contratos PayNGo desplegado.
- Actualizada la dirección de `PayNGoGateway` en `CONTRACT_ADDRESSES` tras el redeploy que corrige una vulnerabilidad de `sponsorTransaction`/`executeGaslessPayment` (cualquiera podía drenar el allowance de USDC de otro usuario).

---

## Instalación

```bash
npm install @zero-two-labs/payngo viem
```

`viem` es una peer dependency implícita — el SDK construye sus clientes a partir de un `PublicClient`/`WalletClient` que tú le pasas, no los crea internamente.

---

## Quickstart

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PayNGoClient, CHAIN_IDS } from "@zero-two-labs/payngo";

const account = privateKeyToAccount("0x...");

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

const client = new PayNGoClient({
  publicClient,
  walletClient,
  chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
});

// Crear un link de pago por 50 USDC
const { linkId, txHash } = await client.links.createLink({
  recipient: "0xRecipientAddress",
  amount: 50_000_000n, // USDC tiene 6 decimales
  memo: "Diseño del logo",
});

console.log(`Link ${linkId} creado — tx: ${txHash}`);
```

Para operaciones de solo lectura, `walletClient` es opcional:

```typescript
const client = new PayNGoClient({
  publicClient,
  chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
});

const link = await client.links.getLink(1n);
```

---

## Redes soportadas

| Red | Chain ID | Stack disponible |
|---|---|---|
| Ethereum Sepolia | `11155111` | `PayNGoLinks`, `PayNGoRouter`, `PayNGoGateway`, USDC |
| Arbitrum Sepolia | `421614` | Solo token MXNB — ver [Tokens sin stack completo](#tokens-sin-stack-completo) |

`CONTRACT_ADDRESSES` (importable del paquete) trae las direcciones por defecto para las redes con stack completo. Para pasar direcciones propias — por ejemplo si despliegas tus propios contratos, o trabajas contra un fork local — usa `config.contracts`:

```typescript
const client = new PayNGoClient({
  publicClient,
  walletClient,
  chainId: 31337, // hardhat local
  contracts: {
    payNGoLinks: "0x...",
    payNGoRouter: "0x...",
    payNGoGateway: "0x...",
    usdc: "0x...",
  },
});
```

`contracts` es `Partial<ContractAddresses>` — se mezcla sobre los defaults de `CONTRACT_ADDRESSES[chainId]` si existen, sobrescribiendo solo lo que pases.

### Tokens sin stack completo

MXNB (peso mexicano digital) vive en Arbitrum Sepolia, pero **no tiene** `PayNGoLinks`/`Router`/`Gateway` desplegados ahí — en producción, Pay'n Go mueve MXNB con `transfer()` directo más un paymaster ERC-4337 (Pimlico), sin pasar por estos contratos. Por eso Arbitrum Sepolia no aparece en `CONTRACT_ADDRESSES`.

Si solo necesitas la dirección del token para construir tu propia integración (lecturas de balance, `transfer` directo, etc.), usa `TOKEN_ADDRESSES`:

```typescript
import { TOKEN_ADDRESSES, CHAIN_IDS } from "@zero-two-labs/payngo";

const mxnb = TOKEN_ADDRESSES[CHAIN_IDS.ARBITRUM_SEPOLIA].mxnb;
```

`PayNGoClient` no instancia módulos para chains sin stack PayNGo — para MXNB/Arbitrum, usa `viem` directamente con la dirección de `TOKEN_ADDRESSES`.

---

## Módulos

`PayNGoClient` expone tres módulos, cada uno envolviendo un contrato:

### `client.links` — `LinksModule`

Links de pago: crear, pagar, cancelar, consultar.

```typescript
// Crear un link con expiración de 24 horas
const { linkId } = await client.links.createLink({
  recipient: "0x...",
  amount: 10_000_000n, // 10 USDC
  expiresIn: 86_400,   // segundos, 0 = sin expiración
  memo: "Renta de agosto",
});

// Pagar un link existente (requiere allowance — el SDK lo gestiona solo)
const { txHash, amountPaid, fee } = await client.links.payLink(linkId);

// Consultar
const link = await client.links.getLink(linkId);
const myLinks = await client.links.getLinksByCreator(myAddress);
const payable = await client.links.isLinkPayable(linkId);

// Cancelar (solo el creador puede)
await client.links.cancelLink(linkId);
```

`payLink()` gestiona el `approve` de USDC automáticamente si el allowance actual es insuficiente — no necesitas llamar `approve` tú mismo.

> **Nota sobre `fee`:** el valor que retorna `payLink()` se calcula en el SDK como 0.5% (`amount * 50n / 10_000n`), no se lee del evento `LinkPaid` emitido por el contrato. En la práctica coincide con la fee real de `PayNGoLinks.sol`, pero si el contrato cambia su fee sin que el SDK se actualice, este valor puede desincronizarse. Si necesitas el monto exacto cobrado, lee el evento `LinkPaid` del receipt de la transacción.

### `client.router` — `RouterModule`

Ruteo óptimo entre tokens, con cálculo de slippage.

```typescript
// Cotizar antes de ejecutar
const quotes = await client.router.getQuotes(usdcAddress, usdcAddress, 100_000_000n);
const best = await client.router.getBestRoute(usdcAddress, usdcAddress, 100_000_000n);

// Ejecutar un pago ruteado
const result = await client.router.executePayment({
  recipient: "0x...",
  amount: 100_000_000n, // 100 USDC
  slippageBps: 100,      // 1% — default
  deadlineSeconds: 3600, // 1 hora — default
});
```

> **Nota sobre `fee`/`amountOut`:** igual que en `LinksModule`, `executePayment()` calcula la fee localmente (0.3% — `amount * 30n / 10_000n`), no la lee del evento `PaymentRouted`. Si la ruta usada tiene un `feeBps` adicional propio (el contrato suma `FEE_BPS + route.feeBps`), el valor real cobrado on-chain puede ser mayor al que retorna el SDK. Para el monto exacto, lee `PaymentRouted` del receipt.

### `client.gateway` — `GatewayModule`

Sponsorship de gas pagado en USDC — el patrón `Full` / `Partial` / `Token` de `PayNGoGateway.sol`.

```typescript
// Ver qué política aplica a un usuario
const policy = await client.gateway.getPolicyFor(userAddress);
// { mode: SponsorMode.Full, userShareBps: 0n, maxGasPerTx: 300000n, active: true }

// Estimar costo en USDC de una tx sponsoreada
const estimate = await client.gateway.estimateGasCost(userAddress, 100_000, 1_000_000_000n);
// { usdcCost: 0n, ethCost: 100000000000000n, isFree: true }

// Ejecutar un pago gasless (el usuario paga en USDC si su política no es Full)
const result = await client.gateway.executeGaslessPayment({
  recipient: "0x...",
  amount: 10_000_000n,
  gasLimit: 150_000, // default
});
```

`executeGaslessPayment` gestiona el `approve` de USDC hacia el Gateway automáticamente, igual que `LinksModule.payLink`.

> Esto es distinto del gasless "real" vía ERC-4337 (Pimlico paymaster) que usa el frontend de Pay'n Go para USDC/MXNB en producción. `GatewayModule` habla con `PayNGoGateway.sol`, un contrato propio de sponsorship en USDC — no es un paymaster ERC-4337. Si necesitas Account Abstraction real, usa [permissionless.js](https://docs.pimlico.io/permissionless) directamente, como hace el frontend.

---

## El Agente de IA — `PayNGoAgent`

`PayNGoAgent` interpreta instrucciones en lenguaje natural con Claude y las traduce a una de tres acciones: `pay_link`, `execute_payment`, o `gasless_payment`.

```typescript
import { PayNGoAgent } from "@zero-two-labs/payngo";

const agent = new PayNGoAgent({
  client,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!, // ver advertencia abajo
  verbose: true,
});

const { suggestion, executed, txHash } = await agent.processInstruction(
  "Envía 50 USDC a 0xAbC... por el diseño",
  { userAddress: myAddress, usdcBalance: currentBalance },
  /* autoExecute */ false
);

console.log(suggestion.reasoning);
// "El usuario quiere enviar 50 USDC a una dirección específica — uso execute_payment."

if (!executed) {
  // Revisa `suggestion` y confirma con el usuario antes de ejecutar
  const result = await agent.executeSuggestion(suggestion, myAddress);
}
```

`autoExecute: true` ejecuta automáticamente si `riskLevel === "low"` (montos bajo 100 USDC) — úsalo con cuidado, sin confirmación humana de por medio.

### ⚠️ Nunca expongas tu Anthropic API key en el navegador

`anthropicApiKey` se manda en el header `x-api-key` cuando `apiUrl` es una URL absoluta a `api.anthropic.com`. Si tu app corre en el navegador, **no hagas esto** — cualquiera puede leer la key del bundle y agotar tu cuota. Pay'n Go resuelve esto con un proxy server-side (`/api/agent` en el frontend) que agrega su propia autenticación, rate limiting, y valida el payload antes de reenviarlo a Anthropic.

Para usar el mismo patrón, pasa una ruta relativa como `apiUrl` — el SDK detecta que es un proxy propio (`apiUrl.startsWith("/")`) y omite el header `x-api-key`, porque asume que tu backend ya la inyecta:

```typescript
const agent = new PayNGoAgent({
  client,
  anthropicApiKey: "", // no se usa si apiUrl es un proxy
  apiUrl: "/api/agent", // tu propio endpoint, con auth y rate limit
});
```

`anthropicApiKey` con valor real solo debería usarse en un entorno server-side (Node.js, un backend), nunca en código que se ejecute en el navegador de un usuario.

---

## Manejo de errores

Todos los errores del SDK son instancias de `PayNGoError`:

```typescript
import { PayNGoError, ERRORS } from "@zero-two-labs/payngo";

try {
  await client.links.payLink(999n);
} catch (e) {
  if (e instanceof PayNGoError) {
    console.log(e.code);    // ej. ERRORS.LINK_NOT_PAYABLE
    console.log(e.message);
    console.log(e.cause);   // error original, si aplica
  }
}
```

---

## Tipos principales

```typescript
import type {
  PayNGoConfig,
  ContractAddresses,
  PaymentLink,
  CreateLinkParams,
  Route,
  RouteQuote,
  SponsorPolicy,
  AgentPaymentSuggestion,
} from "@zero-two-labs/payngo";

import { LinkStatus, RouteType, SponsorMode } from "@zero-two-labs/payngo";
```

Todos los montos son `bigint` en la unidad mínima del token (USDC/MXNB usan 6 decimales — usa `parseUnits("10", 6)` / `formatUnits(amount, 6)` de `viem` para convertir).

---

## Desarrollo local

```bash
git clone https://github.com/usainbluntmx/pay-n-go.git
cd pay-n-go/sdk
npm install
npm run build   # compila src/ → dist/
npm run dev     # watch mode
npm run demo    # corre src/agent-demo.ts con ts-node (no se publica en el paquete)
```

No hay tests todavía (`npm test` corre `jest --passWithNoTests`) — si quieres contribuir, un buen primer PR es agregar cobertura para `LinksModule` y `RouterModule` contra una chain local de Hardhat.

---

## Estado y limitaciones conocidas

- **Verificado end-to-end** contra Ethereum Sepolia real en `v0.3.2`: instanciación, lecturas de los 3 módulos, y el flujo completo de escritura `createLink → getLink → isLinkPayable → payLink → getLink (Paid)`, con una wallet real y fondos reales. 23/23 tests.
- Las fees mostradas por `LinksModule.payLink()` (0.5%) y `RouterModule.executePayment()` (0.3%) están hardcodeadas en el SDK, no se leen on-chain — pueden desincronizarse si los contratos cambian. Lee los eventos `LinkPaid`/`PaymentRouted` del receipt si necesitas el monto exacto cobrado.
- `GatewayModule` implementa el sponsorship en USDC de `PayNGoGateway.sol`, distinto del gasless ERC-4337 real (Pimlico) que usa el frontend de Pay'n Go en producción.
- Solo Ethereum Sepolia tiene el stack completo de contratos desplegado. Arbitrum Sepolia (MXNB) solo expone la dirección del token vía `TOKEN_ADDRESSES`.

---

## Licencia

MIT — construido por [Zero Two Labs](https://github.com/usainbluntmx) para el ETH Mexico Hackathon 2026.
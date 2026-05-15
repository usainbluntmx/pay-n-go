# Pay 'n Go

Universal stablecoin payment infrastructure on Ethereum. Payment links, optimal routing, gasless flows, and AI-powered payment execution — all exposed as an open-source SDK any app can integrate.

Built for **ETH Mexico Hackathon 2026** on **Ethereum Sepolia**.

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Architecture](#architecture)
- [Deployed Contracts](#deployed-contracts)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Backend Guide](#backend-guide)
- [SDK Guide](#sdk-guide)
- [Frontend Guide](#frontend-guide)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Deploying Contracts](#deploying-contracts)
- [Running Tests](#running-tests)
- [Deploying the Frontend to Vercel](#deploying-the-frontend-to-vercel)

---

## What Is This?

Pay 'n Go is a stablecoin payment protocol built on Ethereum Sepolia. It combines three complementary layers:

- **PayNGoLinks** — Create shareable onchain payment requests. Anyone with the link can pay in USDC — no wallet setup required on their end.
- **PayNGoRouter** — Intelligent payment routing with slippage protection. Automatically detects if gasless payments are available and uses them when the payer qualifies.
- **PayNGoGateway** — Gas sponsorship infrastructure (Paymaster pattern). Users pay in USDC, the gateway covers gas. Ethereum becomes invisible.

The entire stack is exposed as `@payngo-labs/sdk` — an open-source TypeScript SDK any fintech, dApp, or wallet can integrate in minutes.

Additionally, **PayNGoAgent** is an autonomous AI layer powered by Claude that interprets natural language payment instructions in any language, queries onchain state, and executes the optimal action.

---

## Architecture

```
User / External App
        ↓
@payngo-labs/sdk
  ├── LinksModule    → PayNGoLinks.sol
  ├── RouterModule   → PayNGoRouter.sol  ──→  PayNGoGateway.sol
  ├── GatewayModule  → PayNGoGateway.sol
  └── PayNGoAgent    → Claude API (via proxy)
        ↓
Ethereum Sepolia
```

### Router → Gateway Integration

When `executePayment` is called, the Router automatically checks:

```
amountIn ≤ 500 USDC AND gateway has ETH?
  ├── YES → gasless flow (Gateway pays gas, user only signs USDC transfer)
  └── NO  → direct flow (user pays gas normally)
```

This makes gasless payments transparent — the user never has to think about it.

---

## Deployed Contracts

All contracts are deployed and verified on **Ethereum Sepolia**.

| Contract | Address | Etherscan |
|---|---|---|
| PayNGoLinks | `0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29` | [View](https://sepolia.etherscan.io/address/0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29#code) |
| PayNGoRouter | `0x52e5d621290F9941254d42F8AB905E3fAB32f6F1` | [View](https://sepolia.etherscan.io/address/0x52e5d621290F9941254d42F8AB905E3fAB32f6F1#code) |
| PayNGoGateway | `0x4a0D7CfF4C09f656c352aa190645a96Bca25410D` | [View](https://sepolia.etherscan.io/address/0x4a0D7CfF4C09f656c352aa190645a96Bca25410D#code) |
| USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [View](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |

---

## Tech Stack

### Smart Contracts

| Tool | Purpose |
|---|---|
| [Hardhat v2](https://hardhat.org/) | Ethereum development environment |
| [Solidity ^0.8.28](https://soliditylang.org/) | Smart contract language |
| [OpenZeppelin Contracts v5](https://www.openzeppelin.com/contracts) | ReentrancyGuard, Ownable, SafeERC20 |
| [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) | Deterministic deployment system |
| [TypeChain](https://github.com/dethcrypto/TypeChain) | TypeScript bindings for contracts |
| [Mocha](https://mochajs.org/) + [Chai](https://www.chaijs.com/) | Testing framework |
| [ethers v6](https://docs.ethers.org/v6/) | Ethereum library |

### SDK

| Tool | Purpose |
|---|---|
| [viem v2](https://viem.sh/) | TypeScript Ethereum client |
| [TypeScript](https://www.typescriptlang.org/) | Typed JavaScript |
| [Anthropic SDK](https://docs.anthropic.com/) | Claude API for AI agent |

### Frontend

| Tool | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework |
| [Wagmi](https://wagmi.sh/) | React hooks for Ethereum |
| [Reown AppKit](https://reown.com/appkit) | Wallet connection modal |
| [TanStack Query](https://tanstack.com/query) | Async state management |

---

## Project Structure

```
pay-n-go/
├── .gitignore
├── README.md
├── backend/                        # Smart contracts
│   ├── contracts/
│   │   ├── PayNGoLinks.sol         # Payment links protocol
│   │   ├── PayNGoRouter.sol        # Optimal routing + gasless detection
│   │   ├── PayNGoGateway.sol       # Gas sponsorship (Paymaster)
│   │   └── MockERC20.sol           # Test-only mock token
│   ├── deploy/
│   │   ├── 01_deploy_payngo_links.ts
│   │   ├── 02_deploy_payngo_router.ts
│   │   └── 03_deploy_payngo_gateway.ts
│   ├── test/
│   │   ├── PayNGoLinks.test.ts
│   │   ├── PayNGoRouter.test.ts
│   │   └── PayNGoGateway.test.ts
│   ├── hardhat.config.ts
│   └── package.json
├── sdk/                            # @payngo-labs/sdk
│   ├── src/
│   │   ├── index.ts                # Public exports
│   │   ├── client.ts               # PayNGoClient (main entry point)
│   │   ├── links.ts                # LinksModule
│   │   ├── router.ts               # RouterModule
│   │   ├── gateway.ts              # GatewayModule
│   │   ├── agent.ts                # PayNGoAgent (AI layer)
│   │   ├── constants.ts            # Contract addresses + ABIs
│   │   ├── types.ts                # Shared TypeScript types
│   │   └── errors.ts               # PayNGoError class
│   ├── package.json
│   └── tsconfig.json
└── frontend/                       # Next.js app
    ├── app/
    │   ├── page.tsx                # Landing page
    │   ├── dashboard/page.tsx      # Dashboard (links, send, agent)
    │   ├── pay/[id]/page.tsx       # Public payment page
    │   ├── docs/page.tsx           # SDK documentation
    │   └── api/agent/route.ts      # Claude API proxy
    ├── hooks/
    │   ├── usePayNGoClient.ts
    │   ├── useLinks.ts
    │   ├── useRouter.ts
    │   ├── useGateway.ts
    │   └── useAgent.ts
    ├── config/
    │   ├── appkit.ts
    │   └── chains.ts
    └── package.json
```

---

## Prerequisites

| Requirement | Minimum Version | Check |
|---|---|---|
| [Node.js](https://nodejs.org/) | v22 or higher | `node --version` |
| [npm](https://www.npmjs.com/) | v10 or higher | `npm --version` |
| [Git](https://git-scm.com/) | Any recent version | `git --version` |

You will also need:

- A crypto wallet (e.g., [MetaMask](https://metamask.io/))
- A **Reown Project ID** (free) from [cloud.reown.com](https://cloud.reown.com)
- An **Alchemy** RPC URL for Ethereum Sepolia from [alchemy.com](https://alchemy.com)
- An **Etherscan API key** from [etherscan.io](https://etherscan.io) for contract verification
- An **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com) for the AI agent

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/usainbluntmx/pay-n-go.git
cd pay-n-go
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install SDK dependencies

```bash
cd ../sdk
npm install
npm run build
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5. Configure environment variables

See the [Environment Variables](#environment-variables) section below.

---

## Backend Guide

### Compile contracts

```bash
cd backend
npm run compile
```

Compiles all `.sol` files and auto-generates TypeScript typings in `typechain-types/`.

### Run tests

```bash
npm run test
```

Expected output: **49 passing**.

### Run with gas reporting

```bash
REPORT_GAS=true npm run test
```

### Check code coverage

```bash
npm run coverage
```

### Start a local node

```bash
npm run node
```

---

## SDK Guide

### Install

```bash
npm install @payngo-labs/sdk
```

### Initialize

```typescript
import { PayNGoClient, CHAIN_IDS } from "@payngo-labs/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("YOUR_RPC_URL"),
});

const client = new PayNGoClient({
  publicClient,
  walletClient,       // optional — required for write operations
  chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
});
```

### Create a payment link

```typescript
import { parseUnits } from "viem";

const { linkId } = await client.links.createLink({
  recipient: "0xRecipientAddress",
  amount: parseUnits("25", 6),   // 25 USDC
  memo: "Invoice #001",
  expiresIn: 86400,              // 24 hours (optional)
});

console.log("Share: https://yourapp.com/pay/" + linkId);
```

### Send USDC via router

```typescript
const result = await client.router.executePayment({
  recipient: "0xRecipientAddress",
  amount: parseUnits("10", 6),
  slippageBps: 100,              // 1% slippage tolerance
});
// Router automatically uses gasless if Gateway has ETH and amount ≤ 500 USDC
```

### Use the AI agent

```typescript
import { PayNGoAgent } from "@payngo-labs/sdk";

const agent = new PayNGoAgent({
  client,
  anthropicApiKey: "",
  apiUrl: "/api/agent",          // your proxy route
});

const result = await agent.processInstruction(
  "Send 5 USDC to 0xABC... for design work",
  { userAddress: "0xYourAddress" },
  false  // analyze only, don't auto-execute
);

console.log(result.suggestion.action);    // "execute_payment"
console.log(result.suggestion.riskLevel); // "low"
```

Full SDK documentation available at `/docs` on the live app.

---

## Frontend Guide

### Start development server

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Create links, send USDC, use AI agent |
| `/pay/[id]` | Public payment page — share with payers |
| `/docs` | Full SDK documentation |

### Build for production

```bash
npm run build
```

---

## Environment Variables

### Backend — `backend/.env`

```bash
# Your wallet private key (deployer)
PRIVATE_KEY=

# RPC URL for Ethereum Sepolia
ETHEREUM_SEPOLIA_RPC_URL=

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=

# Set to "true" to enable gas reporting during tests
REPORT_GAS=false
```

### SDK — `sdk/.env`

```bash
# For running the agent demo locally
PRIVATE_KEY=
ANTHROPIC_API_KEY=
ETHEREUM_SEPOLIA_RPC_URL=
```

### Frontend — `frontend/.env.local`

```bash
# Reown AppKit project ID
NEXT_PUBLIC_REOWN_PROJECT_ID=

# RPC URL (public, used client-side)
NEXT_PUBLIC_SEPOLIA_RPC_URL=

# Anthropic API key (server-side only — NO NEXT_PUBLIC_ prefix)
ANTHROPIC_API_KEY=
```

> ⚠️ Never commit `.env` or `.env.local` files. They are protected by `.gitignore`.

---

## Available Scripts

### Backend (`cd backend`)

| Command | Description |
|---|---|
| `npm run compile` | Compile all Solidity contracts |
| `npm run test` | Run all tests (49 passing) |
| `npm run coverage` | Run tests with coverage report |
| `npm run node` | Start local Hardhat node |
| `npm run clean` | Remove build artifacts |
| `npm run deploy:local` | Deploy to local Hardhat node |
| `npm run deploy:ethereumSepolia` | Deploy to Ethereum Sepolia |
| `npm run verify:ethereumSepolia` | Verify contracts on Etherscan |

### SDK (`cd sdk`)

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Watch mode |
| `npm run demo` | Run the AI agent demo |

### Frontend (`cd frontend`)

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Deploying Contracts

### To Ethereum Sepolia

Make sure `backend/.env` has `PRIVATE_KEY`, `ETHEREUM_SEPOLIA_RPC_URL`, and `ETHERSCAN_API_KEY`, then:

```bash
cd backend
npm run deploy:ethereumSepolia
```

The deploy scripts run in order and automatically:
1. Deploy `PayNGoLinks`
2. Deploy `PayNGoRouter` and connect it to the existing Gateway
3. Deploy `PayNGoGateway` and call `setPayNGoGateway` on the Router

### To a local node

**Terminal 1:**
```bash
cd backend
npm run node
```

**Terminal 2:**
```bash
npm run deploy:local
```

---

## Running Tests

```bash
cd backend
npm run test
```

**49 tests across 3 files:**

| File | Tests | Coverage |
|---|---|---|
| `PayNGoLinks.test.ts` | 13 | createLink, payLink, cancelLink, views |
| `PayNGoRouter.test.ts` | 17 | routes, quotes, executePayment, Router→Gateway |
| `PayNGoGateway.test.ts` | 19 | deposit, policies, whitelist, sponsorTx, gaslessPayment |

To run a specific file:

```bash
npx hardhat test test/PayNGoRouter.test.ts
```

---

## Deploying the Frontend to Vercel

1. Push your repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variables:
   - `NEXT_PUBLIC_REOWN_PROJECT_ID`
   - `NEXT_PUBLIC_SEPOLIA_RPC_URL`
   - `ANTHROPIC_API_KEY`
5. Click **Deploy**.

Vercel redeploys automatically on every push to `main`.

---

## License

MIT — built by [Zero Two Labs](https://github.com/usainbluntmx) for ETH Mexico Hackathon 2026.

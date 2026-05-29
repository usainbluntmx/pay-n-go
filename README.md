# Pay 'n Go

Send USDC as easily as sending a message.

Pay 'n Go is a stablecoin payment app built for the **ETH Mexico Hackathon 2026** on Ethereum Sepolia. No wallet required, no crypto knowledge needed — just a @handle and an AI agent that executes payments from natural language instructions.

**Live:** [pay-n-go-weld.vercel.app](https://pay-n-go-weld.vercel.app)

---

## What it does

- **No external wallet** — the app generates a local keypair and a Safe Smart Account on first visit. The user never sees a private key or a wallet address.
- **@handle identity** — users register a human-readable handle (e.g. `@richi`) instead of sharing a `0x` address.
- **AI Payment Agent** — powered by Claude. Users describe what they want in plain language: _"Send 10 USDC to @carlos for the design"_ — the agent resolves the handle, shows a fee breakdown, and executes the transaction.
- **Gasless payments** — gas is sponsored by Pimlico via ERC-4337. Users never need ETH.
- **Transparent fees** — if the user wants to send 10 USDC, the agent shows exactly what the recipient receives and what the service fee is before confirming.
- **Push notifications** — users receive notifications when a payment arrives, even with the app closed. Powered by Web Push + a GitHub Actions cron that monitors balances every minute.
- **PWA** — installable on iOS and Android directly from the browser, no App Store required.

---

## Stack

| Layer | Tools |
|---|---|
| Smart Contracts | Solidity ^0.8.28, Hardhat v2, OpenZeppelin v5 |
| Account Abstraction | Safe Smart Accounts, Pimlico, ERC-4337, permissionless.js |
| Frontend | Next.js 16, viem v2, bip39, @scure/bip32 |
| AI Agent | Claude (claude-sonnet-4-20250514) via Anthropic API |
| Identity | BIP39 keypair + localStorage, @handle registry on Upstash Redis |
| Push Notifications | Web Push API, VAPID, GitHub Actions cron |
| Deployment | Vercel (frontend), Ethereum Sepolia (contracts) |

---

## Deployed Contracts (Ethereum Sepolia)

| Contract | Address |
|---|---|
| PayNGoLinks | [`0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29`](https://sepolia.etherscan.io/address/0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29#code) |
| PayNGoRouter | [`0x52e5d621290F9941254d42F8AB905E3fAB32f6F1`](https://sepolia.etherscan.io/address/0x52e5d621290F9941254d42F8AB905E3fAB32f6F1#code) |
| PayNGoGateway | [`0x4a0D7CfF4C09f656c352aa190645a96Bca25410D`](https://sepolia.etherscan.io/address/0x4a0D7CfF4C09f656c352aa190645a96Bca25410D#code) |
| USDC (Sepolia) | [`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |

---

## Getting Started

```bash
git clone https://github.com/usainbluntmx/pay-n-go.git
cd pay-n-go/frontend
npm install
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_PIMLICO_API_KEY=
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
CRON_SECRET=
```

```bash
npm run dev
```

---

## Project Structure

```
pay-n-go/
├── backend/          # Hardhat contracts (PayNGoLinks, Router, Gateway)
├── sdk/              # @payngo-labs/sdk — TypeScript SDK
├── frontend/         # Next.js 16 app
│   ├── app/
│   │   ├── api/agent/         # Claude API proxy
│   │   ├── api/handles/       # Handle registry (Upstash Redis)
│   │   ├── api/push/          # Push notification endpoints
│   │   ├── api/cron/          # Balance monitoring cron
│   │   └── dashboard/         # Main app UI
│   ├── hooks/
│   │   ├── useIdentity.ts     # Keypair, Safe Account, balance polling
│   │   ├── useAgent.ts        # AI Payment Agent
│   │   ├── useHandle.ts       # Handle resolution
│   │   └── usePush.ts         # Push notification subscription
│   └── public/
│       └── sw.js              # Service worker (cache + push)
└── .github/
    └── workflows/
        └── balance-check.yml  # Cron: monitors balances every minute
```

---

## License

MIT — built by [Zero Two Labs](https://github.com/usainbluntmx) for ETH Mexico Hackathon 2026.

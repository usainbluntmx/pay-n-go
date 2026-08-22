# Pay'n Go

Envía y recibe dinero tan fácil y rápido como enviar un mensaje.

Pay'n Go es una app de pagos en stablecoins construida para el **ETH Mexico Hackathon 2026** sobre Ethereum Sepolia y Arbitrum Sepolia. Sin wallet, sin conocimiento de crypto — solo un @handle y un agente de IA que ejecuta pagos a partir de instrucciones en lenguaje natural.

**Live:** [pay-n-go-weld.vercel.app](https://pay-n-go-weld.vercel.app)  
**GitHub:** [github.com/usainbluntmx/pay-n-go](https://github.com/usainbluntmx/pay-n-go)

---

## ¿Qué hace?

- **Sin wallet externa** — la app genera un keypair BIP39 local y una Safe Smart Account en el primer uso. El usuario nunca ve una llave privada ni una dirección `0x`.
- **Identidad por @handle** — los usuarios registran un handle legible (ej. `@richi`) en lugar de compartir una dirección `0x`.
- **AI Payment Agent** — impulsado por Claude. Los usuarios describen lo que quieren en lenguaje natural: _"Envía 10 dólares a @carlos por el diseño"_ — el agente resuelve el handle, muestra el desglose de comisión y ejecuta la transacción.
- **Entrada de voz** — el usuario puede hablar en lugar de escribir. El agente entiende español, incluyendo variantes fonéticas de nombres (karol/carol, ximena/jimena).
- **Dos tokens** — USDC (dólares digitales, Ethereum Sepolia) y MXNB (pesos mexicanos digitales, Arbitrum Sepolia). El agente detecta automáticamente cuál usar según el contexto.
- **Pagos gasless** — el gas es patrocinado por Pimlico vía ERC-4337. El usuario nunca necesita ETH.
- **Comisión transparente** — el agente muestra exactamente cuánto recibirá el receptor y cuánto es la comisión del servicio (0.3%) antes de confirmar.
- **Contactos con resolución fonética** — guarda @handles con alias. Puedes decir "Envía 50 pesos a Carlos Trabajo" y el agente resuelve a `@carlos` automáticamente.
- **Historial de transacciones** — cada pago enviado y recibido se guarda en Redis (90 días TTL) y es accesible desde cualquier dispositivo.
- **Notificaciones push** — el usuario recibe notificaciones cuando llega un pago, incluso con la app cerrada. Funciona para USDC y MXNB.
- **Product tour interactivo** — guía paso a paso al usuario la primera vez que entra al dashboard, con overlay y tooltips para cada función.
- **PWA** — instalable en iOS y Android directamente desde el navegador, sin App Store.
- **Recuperación por mnemónico** — 12 palabras para restaurar la cuenta en cualquier dispositivo, con handle y contactos que se restauran automáticamente.

---

## Stack

| Capa | Herramientas |
|---|---|
| Smart Contracts | Solidity ^0.8.28, Hardhat v2, OpenZeppelin v5 |
| Account Abstraction | Safe Smart Accounts v1.4.1, Pimlico, ERC-4337, permissionless.js |
| Frontend | Next.js 16, TypeScript, viem v2, bip39, @scure/bip32 |
| AI Agent | Claude (`claude-sonnet-4-20250514`) via Anthropic API |
| Identidad | BIP39 keypair + localStorage, @handle registry en Upstash Redis |
| Historial | Transacciones en Upstash Redis (TTL 90 días) |
| Contactos | Sincronizados en Upstash Redis (TTL 1 año) |
| Notificaciones | Web Push API, VAPID, GitHub Actions cron |
| UI | Comic Neue, sketch/wireframe aesthetic, driver.js product tour |
| Despliegue | Vercel (frontend), Ethereum Sepolia + Arbitrum Sepolia |

---

## Contratos Desplegados

### Ethereum Sepolia (USDC)

| Contrato | Dirección |
|---|---|
| PayNGoLinks | [`0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29`](https://sepolia.etherscan.io/address/0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29#code) |
| PayNGoRouter | [`0x52e5d621290F9941254d42F8AB905E3fAB32f6F1`](https://sepolia.etherscan.io/address/0x52e5d621290F9941254d42F8AB905E3fAB32f6F1#code) |
| PayNGoGateway | [`0x27Ff5c9F7F09b0bEC212F1dB21eCab6abDbaed80`](https://sepolia.etherscan.io/address/0x27Ff5c9F7F09b0bEC212F1dB21eCab6abDbaed80#code) |
| USDC Sepolia | [`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |

### Arbitrum Sepolia (MXNB)

| Contrato | Dirección |
|---|---|
| MXNB Arbitrum Sepolia | [`0x82B9e52b26A2954E113F94Ff26647754d5a4247D`](https://sepolia.arbiscan.io/address/0x82B9e52b26A2954E113F94Ff26647754d5a4247D) |

---

## Variables de Entorno

Crea `frontend/.env.local`:

```bash
# RPCs
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Pimlico (ERC-4337 bundler + paymaster)
NEXT_PUBLIC_PIMLICO_API_KEY=

# Anthropic (AI Payment Agent)
ANTHROPIC_API_KEY=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=

# Cron
CRON_SECRET=
```

---

## Instalación

```bash
git clone https://github.com/usainbluntmx/pay-n-go.git
cd pay-n-go/frontend
npm install
npm run dev
```

---

## Estructura del Proyecto

```
pay-n-go/
├── backend/                        # Contratos Solidity (Hardhat)
│   └── contracts/
│       ├── PayNGoLinks.sol
│       ├── PayNGoRouter.sol
│       └── PayNGoGateway.sol
├── frontend/                       # Next.js 16 app
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── app/page.tsx            # Onboarding → /dashboard
│   │   ├── dashboard/page.tsx      # App principal (sketch UI + tour)
│   │   └── api/
│   │       ├── agent/              # Claude API proxy
│   │       ├── handles/            # Registro de @handles (Redis)
│   │       ├── contacts/           # Contactos sincronizados (Redis)
│   │       ├── transactions/       # Historial de transacciones (Redis)
│   │       ├── push/               # Push notification endpoints
│   │       └── cron/balance-check/ # Monitoreo de balances (USDC + MXNB)
│   ├── hooks/
│   │   ├── useIdentity.ts          # Keypair, Safe Account, balance polling
│   │   ├── useAgent.ts             # AI Agent, contactos, normalización fonética
│   │   ├── useHandle.ts            # Resolución de handles
│   │   ├── usePush.ts              # Notificaciones push
│   │   └── useTransactions.ts      # Historial de transacciones
│   ├── components/
│   │   └── Onboarding.tsx          # Creación y recuperación de cuenta
│   └── public/
│       ├── sw.js                   # Service worker (cache + push)
│       ├── manifest.json           # PWA manifest
│       ├── icon-192.png
│       └── icon-512.png
└── .github/
    └── workflows/
        └── balance-check.yml       # Cron: monitorea USDC + MXNB cada minuto
```

---

## Flujo de un pago

```
Usuario: "Envía 100 pesos a @alicia por la cena"
         ↓
Claude interpreta → token: MXNB, recipient: @alicia, amount: 100
         ↓
Frontend resuelve @alicia → address en Redis
         ↓
Agente muestra resumen + fee breakdown → usuario confirma
         ↓
Safe Account firma UserOperation → Pimlico (Arbitrum Sepolia)
├── Transfer 100 MXNB → @alicia
└── Transfer 0.30 MXNB → protocolo (0.3% fee)
         ↓
Gas patrocinado por Pimlico (ERC-4337) — usuario no paga gas
         ↓
Confirmado en ~2 segundos
         ↓
Redis: historial actualizado para ambos usuarios
Push: "Recibiste 100 MXNB" → @alicia
```

---

## Arquitectura de identidad

```
12 palabras BIP39
        ↓
Keypair (m/44'/60'/0'/0/0)
        ↓
Safe Smart Account v1.4.1
├── Ethereum Sepolia  → USDC
└── Arbitrum Sepolia  → MXNB

@handle → Redis
├── handle:{nombre} → address
└── address:{addr}  → handle
```

---

## Licencia

MIT — construido por [Zero Two Labs](https://zerotwolabs.xyz/) para el ETH Mexico Hackathon 2026.
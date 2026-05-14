"use client";

import { useState } from "react";
import Link from "next/link";

type Section = "quickstart" | "links" | "router" | "gateway" | "agent" | "contracts";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "quickstart", label: "Quickstart",       icon: "▶" },
  { id: "links",      label: "PayNGoLinks",       icon: "⬡" },
  { id: "router",     label: "PayNGoRouter",      icon: "⟳" },
  { id: "gateway",    label: "PayNGoGateway",     icon: "◈" },
  { id: "agent",      label: "AI Agent",          icon: "◎" },
  { id: "contracts",  label: "Contracts",         icon: "⬢" },
];

const CONTRACTS = [
  { name: "PayNGoLinks",   address: "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29", explorer: "https://sepolia.etherscan.io/address/0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29" },
  { name: "PayNGoRouter",  address: "0x43246220b9e7C3d4500c0f2B778C1C916a63a2FF", explorer: "https://sepolia.etherscan.io/address/0x43246220b9e7C3d4500c0f2B778C1C916a63a2FF" },
  { name: "PayNGoGateway", address: "0xEa3D3FeB0619f281cA69b2884cE00585c7Be1710", explorer: "https://sepolia.etherscan.io/address/0xEa3D3FeB0619f281cA69b2884cE00585c7Be1710" },
];

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-block">
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? "✓ copied" : "copy"}
      </button>
      <pre><code>{children}</code></pre>
    </div>
  );
}

function Badge({ text, color = "#00ffaa" }: { text: string; color?: string }) {
  return (
    <span className="badge" style={{ color, borderColor: color + "40", background: color + "10" }}>
      {text}
    </span>
  );
}

function Method({ method, path, description, params, returns, example }: {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
  returns?: string;
  example: string;
}) {
  const [open, setOpen] = useState(false);
  const methodColors: Record<string, string> = {
    async: "#00ffaa",
    read: "#3b82f6",
    write: "#f59e0b",
  };

  return (
    <div className={"method-card" + (open ? " open" : "")}>
      <button className="method-header" onClick={() => setOpen(!open)}>
        <div className="method-left">
          <Badge text={method} color={methodColors[method] ?? "#00ffaa"} />
          <span className="method-path">{path}</span>
        </div>
        <div className="method-right">
          <span className="method-desc">{description}</span>
          <span className="method-chevron">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="method-body">
          {params && params.length > 0 && (
            <div className="method-section">
              <p className="method-section-title">Parameters</p>
              <div className="params-table">
                {params.map((p) => (
                  <div key={p.name} className="param-row">
                    <span className="param-name">{p.name}</span>
                    <span className="param-type">{p.type}</span>
                    <span className="param-desc">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {returns && (
            <div className="method-section">
              <p className="method-section-title">Returns</p>
              <span className="param-type">{returns}</span>
            </div>
          )}
          <div className="method-section">
            <p className="method-section-title">Example</p>
            <Code>{example}</Code>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [section, setSection] = useState<Section>("quickstart");

  return (
    <main className="docs-page">
      <div className="grid-bg" />

      {/* Top nav */}
      <nav className="docs-nav">
        <Link href="/" className="nav-logo">PAY<span className="accent">&apos;N</span>GO</Link>
        <span className="nav-badge">SDK v0.1.0</span>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <a href="https://github.com/usainbluntmx/paykit" target="_blank" rel="noopener noreferrer">GitHub →</a>
        </div>
      </nav>

      <div className="docs-layout">

        {/* Sidebar */}
        <aside className="docs-sidebar">
          <p className="sidebar-label">// navigation</p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={"sidebar-item" + (section === s.id ? " active" : "")}
              onClick={() => setSection(s.id)}
            >
              <span className="sidebar-icon">{s.icon}</span>
              {s.label}
            </button>
          ))}

          <div className="sidebar-divider" />
          <p className="sidebar-label">// network</p>
          <div className="sidebar-info">
            <span className="info-dot" />
            Ethereum Sepolia
          </div>
          <div className="sidebar-info">
            <span className="info-label">Chain ID</span>
            <span>11155111</span>
          </div>
          <div className="sidebar-info">
            <span className="info-label">USDC</span>
            <span className="mono-small">0x1c7D...8</span>
          </div>
        </aside>

        {/* Content */}
        <div className="docs-content">

          {/* ─── QUICKSTART ─── */}
          {section === "quickstart" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">Quickstart</h1>
                <p className="section-sub">
                  Integrate stablecoin payments in your app in under 5 minutes.
                </p>
              </div>

              <div className="step-list">
                <div className="step">
                  <span className="step-num">01</span>
                  <div className="step-body">
                    <h3>Install the SDK</h3>
                    <Code>{"npm install @payngo/sdk viem"}</Code>
                  </div>
                </div>

                <div className="step">
                  <span className="step-num">02</span>
                  <div className="step-body">
                    <h3>Initialize the client</h3>
                    <Code>{`import { PayNGoClient } from "@payngo/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("YOUR_RPC_URL"),
});

const walletClient = createWalletClient({
  account: yourAccount,
  chain: sepolia,
  transport: http("YOUR_RPC_URL"),
});

const client = new PayNGoClient({
  publicClient,
  walletClient,
  chainId: 11155111,
});`}</Code>
                  </div>
                </div>

                <div className="step">
                  <span className="step-num">03</span>
                  <div className="step-body">
                    <h3>Create a payment link</h3>
                    <Code>{`import { parseUnits } from "viem";

const { linkId, txHash } = await client.links.createLink({
  recipient: "0xRecipientAddress",
  amount: parseUnits("25", 6),   // 25 USDC
  memo: "Invoice #001",
  expiresIn: 86400,              // 24 hours (optional)
});

console.log("Share: https://yourapp.com/pay/" + linkId);`}</Code>
                  </div>
                </div>

                <div className="step">
                  <span className="step-num">04</span>
                  <div className="step-body">
                    <h3>Send USDC via router</h3>
                    <Code>{`const result = await client.router.executePayment({
  recipient: "0xRecipientAddress",
  amount: parseUnits("10", 6),   // 10 USDC
  slippageBps: 100,              // 1% slippage tolerance
});

console.log("Tx hash:", result.txHash);`}</Code>
                  </div>
                </div>

                <div className="step">
                  <span className="step-num">05</span>
                  <div className="step-body">
                    <h3>Use the AI agent</h3>
                    <Code>{`import { PayNGoAgent } from "@payngo/sdk";

const agent = new PayNGoAgent({
  client,
  anthropicApiKey: "",
  apiUrl: "/api/agent",   // your proxy route
});

const result = await agent.processInstruction(
  "Send 5 USDC to 0xABC... for design work",
  { userAddress: "0xYourAddress" },
  false  // analyze only, don't auto-execute
);

console.log(result.suggestion.action);    // "execute_payment"
console.log(result.suggestion.reasoning); // "Amount under 100 USDC..."
console.log(result.suggestion.riskLevel); // "low"`}</Code>
                  </div>
                </div>
              </div>

              <div className="quickstart-modules">
                <p className="section-label">// available modules</p>
                <div className="module-grid">
                  {[
                    { icon: "⬡", name: "client.links",   desc: "Create, pay and manage payment links" },
                    { icon: "⟳", name: "client.router",  desc: "Optimal route selection for USDC payments" },
                    { icon: "◈", name: "client.gateway", desc: "Gasless payments via Paymaster" },
                    { icon: "◎", name: "PayNGoAgent",    desc: "Natural language payment execution" },
                  ].map((m) => (
                    <div key={m.name} className="module-card">
                      <span className="module-icon">{m.icon}</span>
                      <span className="module-name">{m.name}</span>
                      <span className="module-desc">{m.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── LINKS ─── */}
          {section === "links" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">⬡ PayNGoLinks</h1>
                <p className="section-sub">
                  Create shareable payment links onchain. Recipients pay via URL — no wallet setup required on their end.
                </p>
                <div className="section-badges">
                  <Badge text="0.5% protocol fee" />
                  <Badge text="USDC" color="#3b82f6" />
                  <Badge text="Ethereum Sepolia" color="#f59e0b" />
                </div>
              </div>

              <Method
                method="write"
                path="client.links.createLink(params)"
                description="Create a new onchain payment link"
                params={[
                  { name: "recipient", type: "Address", desc: "Wallet address that will receive the payment" },
                  { name: "amount", type: "bigint", desc: "Amount in USDC (6 decimals). Use parseUnits('10', 6) for 10 USDC" },
                  { name: "memo", type: "string?", desc: "Optional description shown to the payer" },
                  { name: "expiresIn", type: "number?", desc: "Seconds until expiry. Omit for permanent links" },
                  { name: "token", type: "Address?", desc: "Token address. Defaults to USDC" },
                ]}
                returns="Promise<{ linkId: bigint, txHash: Hash }>"
                example={`const { linkId, txHash } = await client.links.createLink({
  recipient: "0xRecipientAddress",
  amount: parseUnits("25", 6),
  memo: "Invoice #001",
  expiresIn: 86400,
});`}
              />

              <Method
                method="write"
                path="client.links.payLink(linkId)"
                description="Pay an existing active payment link"
                params={[
                  { name: "linkId", type: "bigint", desc: "ID of the payment link to pay" },
                ]}
                returns="Promise<{ txHash: Hash, amountPaid: bigint, fee: bigint }>"
                example={`const { txHash, amountPaid, fee } = await client.links.payLink(1n);
console.log("Paid:", formatUnits(amountPaid, 6), "USDC");
console.log("Fee:",  formatUnits(fee, 6), "USDC");`}
              />

              <Method
                method="write"
                path="client.links.cancelLink(linkId)"
                description="Cancel an active link (creator only)"
                params={[
                  { name: "linkId", type: "bigint", desc: "ID of the link to cancel" },
                ]}
                returns="Promise<Hash>"
                example={`const txHash = await client.links.cancelLink(1n);`}
              />

              <Method
                method="read"
                path="client.links.getLink(linkId)"
                description="Fetch a payment link by ID"
                params={[
                  { name: "linkId", type: "bigint", desc: "ID of the link to fetch" },
                ]}
                returns="Promise<PaymentLink>"
                example={`const link = await client.links.getLink(1n);
console.log(link.amount);    // bigint
console.log(link.status);    // 0=Active 1=Paid 2=Cancelled 3=Expired
console.log(link.memo);      // string
console.log(link.expiresAt); // bigint (unix timestamp)`}
              />

              <Method
                method="read"
                path="client.links.getLinksByCreator(address)"
                description="Get all link IDs created by an address"
                params={[
                  { name: "creator", type: "Address", desc: "Wallet address of the creator" },
                ]}
                returns="Promise<bigint[]>"
                example={`const ids = await client.links.getLinksByCreator("0xYourAddress");
const links = await Promise.all(ids.map(id => client.links.getLink(id)));`}
              />

              <Method
                method="read"
                path="client.links.isLinkPayable(linkId)"
                description="Check if a link can currently be paid"
                params={[
                  { name: "linkId", type: "bigint", desc: "ID of the link to check" },
                ]}
                returns="Promise<boolean>"
                example={`const payable = await client.links.isLinkPayable(1n);
if (payable) {
  await client.links.payLink(1n);
}`}
              />
            </div>
          )}

          {/* ─── ROUTER ─── */}
          {section === "router" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">⟳ PayNGoRouter</h1>
                <p className="section-sub">
                  Intelligent payment routing — automatically selects the optimal path for every USDC transfer.
                </p>
                <div className="section-badges">
                  <Badge text="0.3% protocol fee" />
                  <Badge text="Slippage protection" color="#3b82f6" />
                  <Badge text="Deadline enforcement" color="#f59e0b" />
                </div>
              </div>

              <Method
                method="write"
                path="client.router.executePayment(params)"
                description="Route and execute a USDC payment"
                params={[
                  { name: "recipient", type: "Address", desc: "Destination wallet address" },
                  { name: "amount", type: "bigint", desc: "Amount in USDC (6 decimals)" },
                  { name: "tokenIn", type: "Address?", desc: "Input token. Defaults to USDC" },
                  { name: "tokenOut", type: "Address?", desc: "Output token. Defaults to USDC" },
                  { name: "slippageBps", type: "number?", desc: "Max slippage in basis points. Default: 100 (1%)" },
                  { name: "routeId", type: "bigint?", desc: "Force a specific route. Default: 0 (auto)" },
                  { name: "deadlineSeconds", type: "number?", desc: "Seconds until tx expires. Default: 3600" },
                ]}
                returns="Promise<{ orderId: Hash, txHash: Hash, amountOut: bigint, fee: bigint, routeId: bigint }>"
                example={`const result = await client.router.executePayment({
  recipient: "0xRecipientAddress",
  amount: parseUnits("50", 6),
  slippageBps: 100,       // 1% slippage
  deadlineSeconds: 1800,  // 30 minutes
});

console.log("Route used:", result.routeId);
console.log("Amount out:", formatUnits(result.amountOut, 6), "USDC");
console.log("Fee paid:",   formatUnits(result.fee, 6), "USDC");`}
              />

              <Method
                method="read"
                path="client.router.getQuotes(tokenIn, tokenOut, amountIn)"
                description="Get quotes from all available routes"
                params={[
                  { name: "tokenIn", type: "Address", desc: "Input token address" },
                  { name: "tokenOut", type: "Address", desc: "Output token address" },
                  { name: "amountIn", type: "bigint", desc: "Amount to route" },
                ]}
                returns="Promise<RouteQuote[]>"
                example={`const quotes = await client.router.getQuotes(
  usdcAddress,
  usdcAddress,
  parseUnits("100", 6)
);

quotes.forEach(q => {
  console.log("Route:", q.routeId);
  console.log("Out:",   formatUnits(q.amountOut, 6), "USDC");
  console.log("Fee:",   formatUnits(q.fee, 6), "USDC");
  console.log("Gas:",   q.estimatedGas.toString());
});`}
              />

              <Method
                method="read"
                path="client.router.getBestRoute(tokenIn, tokenOut, amountIn)"
                description="Returns the route with the highest output amount"
                params={[
                  { name: "tokenIn", type: "Address", desc: "Input token address" },
                  { name: "tokenOut", type: "Address", desc: "Output token address" },
                  { name: "amountIn", type: "bigint", desc: "Amount to route" },
                ]}
                returns="Promise<{ routeId: bigint, amountOut: bigint }>"
                example={`const { routeId, amountOut } = await client.router.getBestRoute(
  usdcAddress,
  usdcAddress,
  parseUnits("100", 6)
);`}
              />
            </div>
          )}

          {/* ─── GATEWAY ─── */}
          {section === "gateway" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">◈ PayNGoGateway</h1>
                <p className="section-sub">
                  Gasless payment infrastructure. Users sign, the gateway pays gas. Ethereum becomes invisible.
                </p>
                <div className="section-badges">
                  <Badge text="ERC-4337 compatible" />
                  <Badge text="Paymaster pattern" color="#3b82f6" />
                  <Badge text="Zero gas for users" color="#00ffaa" />
                </div>
              </div>

              <Method
                method="write"
                path="client.gateway.executeGaslessPayment(params)"
                description="Send USDC without the recipient needing ETH for gas"
                params={[
                  { name: "recipient", type: "Address", desc: "Destination wallet address" },
                  { name: "amount", type: "bigint", desc: "Amount in USDC (6 decimals)" },
                  { name: "gasLimit", type: "number?", desc: "Gas limit for the tx. Default: 150,000" },
                ]}
                returns="Promise<{ txId: Hash, txHash: Hash }>"
                example={`const { txHash } = await client.gateway.executeGaslessPayment({
  recipient: "0xRecipientAddress",
  amount: parseUnits("10", 6),
});

console.log("Gasless tx:", txHash);`}
              />

              <Method
                method="read"
                path="client.gateway.estimateGasCost(user, gasLimit, gasPrice)"
                description="Estimate how much USDC a gasless tx will cost the user"
                params={[
                  { name: "user", type: "Address", desc: "User address to check policy for" },
                  { name: "gasLimit", type: "number", desc: "Expected gas usage" },
                  { name: "gasPrice", type: "bigint", desc: "Current gas price in wei" },
                ]}
                returns="Promise<{ usdcCost: bigint, ethCost: bigint, isFree: boolean }>"
                example={`const gasPrice = await publicClient.getGasPrice();
const estimate = await client.gateway.estimateGasCost(
  userAddress,
  150_000,
  gasPrice
);

if (estimate.isFree) {
  console.log("This payment is fully sponsored!");
} else {
  console.log("Cost:", formatUnits(estimate.usdcCost, 6), "USDC");
}`}
              />

              <Method
                method="read"
                path="client.gateway.getPolicyFor(user)"
                description="Get the sponsorship policy for a user address"
                params={[
                  { name: "user", type: "Address", desc: "User address to check" },
                ]}
                returns="Promise<SponsorPolicy>"
                example={`const policy = await client.gateway.getPolicyFor(userAddress);
// policy.mode: 0=Full 1=Partial 2=Token
// policy.maxGasPerTx: bigint
// policy.active: boolean`}
              />

              <Method
                method="read"
                path="client.gateway.getEthBalance()"
                description="Check how much ETH the gateway has to sponsor gas"
                params={[]}
                returns="Promise<bigint>"
                example={`const balance = await client.gateway.getEthBalance();
const isAvailable = balance > 0n;
console.log("Gasless available:", isAvailable);`}
              />
            </div>
          )}

          {/* ─── AGENT ─── */}
          {section === "agent" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">◎ AI Agent</h1>
                <p className="section-sub">
                  Natural language payment execution. The agent analyzes instructions, queries onchain state, and selects the optimal action.
                </p>
                <div className="section-badges">
                  <Badge text="Claude API" />
                  <Badge text="Onchain context" color="#3b82f6" />
                  <Badge text="Risk scoring" color="#f59e0b" />
                </div>
              </div>

              <div className="info-box">
                <span className="info-icon">◎</span>
                <div>
                  <p className="info-title">Proxy required</p>
                  <p className="info-text">
                    The agent calls Claude API server-side. Create an API route that proxies requests to avoid CORS issues in browser environments.
                  </p>
                </div>
              </div>

              <Method
                method="async"
                path="agent.processInstruction(instruction, context, autoExecute?)"
                description="Analyze a natural language payment instruction"
                params={[
                  { name: "instruction", type: "string", desc: "Natural language payment instruction" },
                  { name: "context.userAddress", type: "Address", desc: "The user's wallet address" },
                  { name: "context.usdcBalance", type: "bigint?", desc: "Optional: user's current USDC balance" },
                  { name: "autoExecute", type: "boolean?", desc: "Auto-execute if risk is low. Default: false" },
                ]}
                returns="Promise<AgentResult>"
                example={`import { PayNGoAgent } from "@payngo/sdk";

const agent = new PayNGoAgent({
  client,
  anthropicApiKey: "",
  apiUrl: "/api/agent",  // your proxy route
});

const result = await agent.processInstruction(
  "Send 5 USDC to 0xABC... for design work",
  { userAddress: "0xYourAddress" },
  false  // don't auto-execute
);

console.log(result.suggestion.action);
// "execute_payment" | "gasless_payment" | "pay_link"

console.log(result.suggestion.params);
// { recipient: "0xABC...", amount: "5.00", memo: "design work" }

console.log(result.suggestion.riskLevel);
// "low" | "medium" | "high"`}
              />

              <Method
                method="async"
                path="agent.executeSuggestion(suggestion, userAddress)"
                description="Execute a previously analyzed suggestion"
                params={[
                  { name: "suggestion", type: "AgentPaymentSuggestion", desc: "Suggestion returned by processInstruction" },
                  { name: "userAddress", type: "Address", desc: "The user's wallet address" },
                ]}
                returns="Promise<AgentResult>"
                example={`// After user approves the suggestion:
const result = await agent.executeSuggestion(
  suggestion,
  userAddress
);

if (result.executed) {
  console.log("Tx hash:", result.txHash);
} else {
  console.log("Error:", result.error);
}`}
              />

              <div className="note-box">
                <p className="note-title">Proxy setup (Next.js)</p>
                <Code>{`// app/api/agent/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}`}</Code>
              </div>
            </div>
          )}

          {/* ─── CONTRACTS ─── */}
          {section === "contracts" && (
            <div className="doc-section">
              <div className="section-header">
                <h1 className="section-title">⬢ Contracts</h1>
                <p className="section-sub">
                  All contracts are deployed and verified on Ethereum Sepolia testnet.
                </p>
              </div>

              <div className="contracts-list">
                {CONTRACTS.map((c) => (
                  <div key={c.name} className="contract-card">
                    <div className="contract-header">
                      <span className="contract-name">{c.name}</span>
                      <a
                        href={c.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contract-link"
                      >
                        Etherscan →
                      </a>
                    </div>
                    <div className="contract-address">{c.address}</div>
                  </div>
                ))}
              </div>

              <div className="note-box" style={{ marginTop: "2rem" }}>
                <p className="note-title">Using contract addresses in the SDK</p>
                <Code>{`import { CONTRACT_ADDRESSES, CHAIN_IDS } from "@payngo/sdk";

const addresses = CONTRACT_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA];

console.log(addresses.payNGoLinks);
// "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29"

console.log(addresses.payNGoRouter);
// "0x43246220b9e7C3d4500c0f2B778C1C916a63a2FF"

console.log(addresses.payNGoGateway);
// "0xEa3D3FeB0619f281cA69b2884cE00585c7Be1710"

console.log(addresses.usdc);
// "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"`}</Code>
              </div>

              <div className="note-box">
                <p className="note-title">Using ABIs directly</p>
                <Code>{`import {
  PAYNGO_LINKS_ABI,
  PAYNGO_ROUTER_ABI,
  PAYNGO_GATEWAY_ABI,
} from "@payngo/sdk";

// Use with viem directly
const result = await publicClient.readContract({
  address: addresses.payNGoLinks,
  abi: PAYNGO_LINKS_ABI,
  functionName: "getLink",
  args: [1n],
});`}</Code>
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        :global(body) {
          background: #080b0f;
          color: #e2e8f0;
          font-family: 'IBM Plex Mono', 'Fira Code', monospace;
          margin: 0;
        }

        .docs-page { min-height: 100vh; position: relative; }

        .grid-bg {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(0,255,170,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,170,0.02) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }

        .docs-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; gap: 1.5rem;
          padding: 1rem 2rem;
          border-bottom: 1px solid rgba(0,255,170,0.1);
          background: rgba(8,11,15,0.9); backdrop-filter: blur(12px);
        }

        .nav-logo {
          font-size: 1rem; font-weight: 700;
          letter-spacing: 0.1em; color: #e2e8f0;
          text-decoration: none;
        }

        .accent { color: #00ffaa; }

        .nav-badge {
          font-size: 0.65rem; color: #00ffaa;
          border: 1px solid rgba(0,255,170,0.3);
          padding: 0.2rem 0.6rem; border-radius: 2px;
        }

        .nav-links {
          margin-left: auto;
          display: flex; gap: 1.5rem;
          font-size: 0.8rem;
        }

        .nav-links a {
          color: #64748b; text-decoration: none;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: #00ffaa; }

        .docs-layout {
          position: relative; z-index: 1;
          display: flex; min-height: 100vh;
          padding-top: 57px;
        }

        .docs-sidebar {
          width: 220px; flex-shrink: 0;
          position: fixed; top: 57px; left: 0; bottom: 0;
          border-right: 1px solid rgba(0,255,170,0.08);
          padding: 1.5rem 1rem;
          overflow-y: auto;
          background: rgba(8,11,15,0.6);
          display: flex; flex-direction: column; gap: 0.25rem;
        }

        .sidebar-label {
          font-size: 0.65rem; color: #334155;
          letter-spacing: 0.1em; margin: 0.75rem 0 0.5rem;
        }

        .sidebar-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.6rem 0.75rem; border-radius: 2px;
          background: none; border: none;
          color: #475569; font-family: inherit;
          font-size: 0.8rem; cursor: pointer;
          text-align: left; transition: all 0.15s;
          letter-spacing: 0.03em;
        }

        .sidebar-item:hover { color: #94a3b8; background: rgba(255,255,255,0.02); }
        .sidebar-item.active { color: #00ffaa; background: rgba(0,255,170,0.05); }

        .sidebar-icon { font-size: 0.75rem; width: 14px; text-align: center; }

        .sidebar-divider {
          height: 1px; background: rgba(0,255,170,0.08);
          margin: 0.75rem 0;
        }

        .sidebar-info {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.7rem; color: #334155;
          padding: 0.3rem 0.75rem;
        }

        .info-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #00ffaa; flex-shrink: 0;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .info-label { color: #1e293b; }
        .mono-small { font-size: 0.65rem; color: #475569; }

        .docs-content {
          margin-left: 220px; flex: 1;
          padding: 3rem 3rem 6rem;
          max-width: 860px;
        }

        .doc-section { display: flex; flex-direction: column; gap: 1.5rem; }

        .section-header { margin-bottom: 0.5rem; }

        .section-title {
          font-size: 1.75rem; font-weight: 700;
          color: #f8fafc; letter-spacing: -0.01em;
          margin: 0 0 0.75rem;
        }

        .section-sub {
          font-size: 0.88rem; color: #64748b;
          line-height: 1.7; margin: 0 0 1rem;
          max-width: 580px;
        }

        .section-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }

        .badge {
          font-size: 0.65rem; letter-spacing: 0.08em;
          padding: 0.25rem 0.65rem; border-radius: 2px;
          border: 1px solid;
        }

        .section-label {
          font-size: 0.7rem; color: #334155;
          letter-spacing: 0.1em; margin: 0 0 1rem;
        }

        .step-list { display: flex; flex-direction: column; gap: 0; }

        .step {
          display: flex; gap: 1.5rem;
          padding: 1.75rem 0;
          border-bottom: 1px solid rgba(0,255,170,0.06);
        }

        .step:last-child { border-bottom: none; }

        .step-num {
          font-size: 0.7rem; color: #00ffaa;
          letter-spacing: 0.1em; padding-top: 0.15rem;
          flex-shrink: 0; width: 24px;
        }

        .step-body { flex: 1; }

        .step-body h3 {
          font-size: 0.88rem; font-weight: 600;
          color: #e2e8f0; margin: 0 0 0.85rem;
          letter-spacing: 0.03em;
        }

        .module-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1px; background: rgba(0,255,170,0.06);
          border: 1px solid rgba(0,255,170,0.06);
          border-radius: 2px; overflow: hidden;
        }

        .module-card {
          display: flex; flex-direction: column; gap: 0.4rem;
          padding: 1.25rem 1.25rem;
          background: #080b0f;
          transition: background 0.15s;
        }

        .module-card:hover { background: rgba(0,255,170,0.02); }

        .module-icon { font-size: 1.1rem; color: #00ffaa; }

        .module-name {
          font-size: 0.82rem; font-weight: 600;
          color: #e2e8f0; letter-spacing: 0.03em;
        }

        .module-desc { font-size: 0.75rem; color: #475569; line-height: 1.5; }

        .method-card {
          border: 1px solid rgba(0,255,170,0.08);
          border-radius: 2px; overflow: hidden;
          transition: border-color 0.15s;
        }

        .method-card.open { border-color: rgba(0,255,170,0.2); }

        .method-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: none; border: none;
          width: 100%; cursor: pointer;
          transition: background 0.15s;
          gap: 1rem;
        }

        .method-header:hover { background: rgba(0,255,170,0.02); }

        .method-left { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

        .method-path {
          font-size: 0.82rem; color: #e2e8f0;
          letter-spacing: 0.02em;
        }

        .method-right {
          display: flex; align-items: center; gap: 1rem;
          flex: 1; justify-content: flex-end;
        }

        .method-desc { font-size: 0.75rem; color: #475569; text-align: right; }
        .method-chevron { font-size: 0.6rem; color: #334155; flex-shrink: 0; }

        .method-body { padding: 0 1.25rem 1.25rem; }

        .method-section { margin-bottom: 1rem; }
        .method-section:last-child { margin-bottom: 0; }

        .method-section-title {
          font-size: 0.65rem; color: #334155;
          letter-spacing: 0.1em; margin: 0 0 0.6rem;
        }

        .params-table { display: flex; flex-direction: column; gap: 0.4rem; }

        .param-row {
          display: grid; grid-template-columns: 140px 120px 1fr;
          gap: 1rem; align-items: start;
          font-size: 0.78rem; padding: 0.5rem 0;
          border-bottom: 1px solid rgba(0,255,170,0.04);
        }

        .param-row:last-child { border-bottom: none; }

        .param-name { color: #e2e8f0; }
        .param-type { color: #00ffaa; font-size: 0.72rem; }
        .param-desc { color: #64748b; line-height: 1.5; }

        .code-block {
          position: relative;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(0,255,170,0.08);
          border-radius: 2px; overflow: hidden;
        }

        .copy-btn {
          position: absolute; top: 0.6rem; right: 0.6rem;
          background: rgba(0,255,170,0.08);
          border: 1px solid rgba(0,255,170,0.15);
          color: #00ffaa; font-family: inherit;
          font-size: 0.65rem; padding: 0.2rem 0.6rem;
          border-radius: 2px; cursor: pointer;
          letter-spacing: 0.05em; transition: all 0.15s;
        }

        .copy-btn:hover { background: rgba(0,255,170,0.15); }

        .code-block pre {
          margin: 0; padding: 1.25rem;
          font-size: 0.78rem; line-height: 1.75;
          color: #94a3b8; overflow-x: auto;
          font-family: inherit;
        }

        .code-block code { font-family: inherit; }

        .contracts-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .contract-card {
          border: 1px solid rgba(0,255,170,0.1);
          border-radius: 2px; padding: 1.25rem;
          transition: border-color 0.15s;
        }

        .contract-card:hover { border-color: rgba(0,255,170,0.25); }

        .contract-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 0.6rem;
        }

        .contract-name {
          font-size: 0.88rem; font-weight: 600;
          color: #e2e8f0; letter-spacing: 0.03em;
        }

        .contract-link {
          font-size: 0.75rem; color: #00ffaa;
          text-decoration: none; transition: opacity 0.15s;
        }

        .contract-link:hover { opacity: 0.7; }

        .contract-address {
          font-size: 0.72rem; color: #475569;
          letter-spacing: 0.03em; word-break: break-all;
        }

        .info-box {
          display: flex; gap: 1rem;
          padding: 1rem 1.25rem;
          border: 1px solid rgba(0,255,170,0.15);
          border-radius: 2px;
          background: rgba(0,255,170,0.03);
        }

        .info-icon { font-size: 1.1rem; color: #00ffaa; flex-shrink: 0; }

        .info-title {
          font-size: 0.82rem; font-weight: 600;
          color: #e2e8f0; margin: 0 0 0.3rem;
        }

        .info-text {
          font-size: 0.78rem; color: #64748b;
          line-height: 1.6; margin: 0;
        }

        .note-box {
          border: 1px solid rgba(0,255,170,0.08);
          border-radius: 2px; overflow: hidden;
        }

        .note-title {
          font-size: 0.72rem; color: #475569;
          letter-spacing: 0.08em;
          padding: 0.65rem 1.25rem;
          border-bottom: 1px solid rgba(0,255,170,0.06);
          margin: 0;
          background: rgba(0,0,0,0.2);
        }

        .note-box .code-block {
          border: none; border-radius: 0;
        }

        @media (max-width: 768px) {
          .docs-sidebar { display: none; }
          .docs-content { margin-left: 0; padding: 2rem 1.25rem; }
          .module-grid { grid-template-columns: 1fr; }
          .param-row { grid-template-columns: 1fr; gap: 0.25rem; }
        }
      `}</style>
    </main>
  );
}

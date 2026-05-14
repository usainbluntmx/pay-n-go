"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TAGLINE_WORDS = ["borderless", "gasless", "instant", "trustless", "permissionless"];

export default function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const word = TAGLINE_WORDS[wordIndex];
    let timeout: NodeJS.Timeout;

    if (typing) {
      if (displayed.length < word.length) {
        timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80);
      } else {
        timeout = setTimeout(() => setTyping(false), 1800);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40);
      } else {
        setWordIndex((i) => (i + 1) % TAGLINE_WORDS.length);
        setTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, typing, wordIndex]);

  return (
    <main className="landing">
      {/* Grid background */}
      <div className="grid-bg" />

      {/* Nav */}
      <nav className="nav">
        <span className="nav-logo">PAY<span className="accent">'N</span>GO</span>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/docs">Docs</Link>
          <w3m-button />
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge-dot" />
          LIVE ON ETHEREUM SEPOLIA
        </div>

        <h1 className="hero-title">
          Stablecoin payments<br />
          <span className="hero-accent">{displayed}</span>
          <span className="cursor">_</span>
        </h1>

        <p className="hero-sub">
          Universal payment links. Optimal routing. Gasless flows.<br />
          One SDK. Any app. Any chain.
        </p>

        <div className="hero-cta">
          <Link href="/dashboard" className="btn-primary">
            Open Dashboard →
          </Link>
          <Link href="/docs" className="btn-ghost">
            View SDK Docs
          </Link>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="stat">
            <span className="stat-value">0.3%</span>
            <span className="stat-label">Protocol fee</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">&lt;12s</span>
            <span className="stat-label">Settlement</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">$0</span>
            <span className="stat-label">Gas for users</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        {[
          {
            icon: "⬡",
            title: "PayLink",
            desc: "Generate a payment URL. Anyone pays you in USDC — no wallet setup required on their end.",
          },
          {
            icon: "⟳",
            title: "StableRouter",
            desc: "Automatically finds the optimal route for every payment. Best price, lowest fee, every time.",
          },
          {
            icon: "◈",
            title: "GaslessGateway",
            desc: "Users sign, we pay the gas. Ethereum becomes invisible — just send USDC.",
          },
          {
            icon: "◎",
            title: "AI Agent",
            desc: 'Natural language payments. Tell the agent "pay 10 USDC to Alice" and it handles the rest.',
          },
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* SDK snippet */}
      <section className="sdk-section">
        <p className="sdk-label">// integrate in minutes</p>
        <pre className="sdk-code">{`import { PayNGoClient } from "@payngo/sdk";

const client = new PayNGoClient({ publicClient, walletClient, chainId: 11155111 });

// Create a payment link
const { linkId } = await client.links.createLink({
  recipient: "0xYourAddress",
  amount: parseUnits("25", 6),
  memo: "Invoice #001",
});

// Share: payngo.xyz/pay/${"{linkId}"}`}
        </pre>
        <Link href="/docs" className="btn-ghost">
          Full SDK docs →
        </Link>
      </section>

      {/* Footer */}
      <footer className="footer">
        <span>Pay&apos;n Go — Zero Two Labs © 2026</span>
        <span className="footer-chain">Ethereum Sepolia Testnet</span>
      </footer>

      <style jsx>{`
        :global(body) {
          background: #080b0f;
          color: #e2e8f0;
          font-family: 'IBM Plex Mono', 'Fira Code', monospace;
          margin: 0;
        }

        .landing { min-height: 100vh; position: relative; overflow: hidden; }

        .grid-bg {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(0, 255, 170, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 170, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 3rem;
          border-bottom: 1px solid rgba(0, 255, 170, 0.1);
          background: rgba(8, 11, 15, 0.85);
          backdrop-filter: blur(12px);
        }

        .nav-logo {
          font-size: 1.25rem; font-weight: 700; letter-spacing: 0.1em;
          color: #e2e8f0;
        }

        .accent { color: #00ffaa; }

        .nav-links {
          display: flex; align-items: center; gap: 2rem;
          font-size: 0.85rem; letter-spacing: 0.05em;
        }

        .nav-links a {
          color: #94a3b8; text-decoration: none;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: #00ffaa; }

        .hero {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
          padding: 12rem 2rem 6rem;
        }

        .hero-badge {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.7rem; letter-spacing: 0.15em;
          color: #00ffaa; border: 1px solid rgba(0, 255, 170, 0.3);
          padding: 0.35rem 0.85rem; border-radius: 2px;
          margin-bottom: 2.5rem;
        }

        .badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #00ffaa;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .hero-title {
          font-size: clamp(2.5rem, 6vw, 5rem);
          font-weight: 700; line-height: 1.1;
          letter-spacing: -0.02em;
          color: #f8fafc;
          margin: 0 0 1.5rem;
        }

        .hero-accent { color: #00ffaa; }

        .cursor {
          animation: blink 1s step-end infinite;
          color: #00ffaa;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .hero-sub {
          font-size: 1.05rem; color: #64748b;
          line-height: 1.7; max-width: 520px;
          margin: 0 0 3rem;
        }

        .hero-cta {
          display: flex; gap: 1rem; margin-bottom: 4rem;
          flex-wrap: wrap; justify-content: center;
        }

        .btn-primary {
          background: #00ffaa; color: #080b0f;
          padding: 0.8rem 2rem; border-radius: 2px;
          font-family: inherit; font-size: 0.9rem;
          font-weight: 700; letter-spacing: 0.05em;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 0 20px rgba(0, 255, 170, 0.3);
        }

        .btn-primary:hover {
          background: #00cc88;
          box-shadow: 0 0 30px rgba(0, 255, 170, 0.5);
        }

        .btn-ghost {
          border: 1px solid rgba(0, 255, 170, 0.3);
          color: #00ffaa; padding: 0.8rem 2rem;
          border-radius: 2px; font-family: inherit;
          font-size: 0.9rem; letter-spacing: 0.05em;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-ghost:hover {
          background: rgba(0, 255, 170, 0.05);
          border-color: #00ffaa;
        }

        .stats {
          display: flex; align-items: center; gap: 2.5rem;
          border: 1px solid rgba(0, 255, 170, 0.1);
          padding: 1.5rem 3rem; border-radius: 2px;
          background: rgba(0, 255, 170, 0.02);
        }

        .stat { text-align: center; }

        .stat-value {
          display: block; font-size: 1.5rem;
          font-weight: 700; color: #00ffaa;
        }

        .stat-label {
          display: block; font-size: 0.7rem;
          color: #475569; letter-spacing: 0.1em;
          margin-top: 0.25rem;
        }

        .stat-divider {
          width: 1px; height: 40px;
          background: rgba(0, 255, 170, 0.15);
        }

        .features {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 1px; padding: 0 3rem;
          border-top: 1px solid rgba(0, 255, 170, 0.1);
          border-bottom: 1px solid rgba(0, 255, 170, 0.1);
          background: rgba(0, 255, 170, 0.05);
          margin: 0 0 6rem;
        }

        .feature-card {
          padding: 2.5rem 2rem;
          background: #080b0f;
          transition: background 0.2s;
        }

        .feature-card:hover {
          background: rgba(0, 255, 170, 0.03);
        }

        .feature-icon {
          display: block; font-size: 1.5rem;
          color: #00ffaa; margin-bottom: 1rem;
        }

        .feature-title {
          font-size: 1rem; font-weight: 700;
          color: #f8fafc; margin: 0 0 0.75rem;
          letter-spacing: 0.05em;
        }

        .feature-desc {
          font-size: 0.82rem; color: #64748b;
          line-height: 1.6; margin: 0;
        }

        .sdk-section {
          position: relative; z-index: 1;
          max-width: 700px; margin: 0 auto 6rem;
          padding: 0 2rem; text-align: center;
        }

        .sdk-label {
          font-size: 0.75rem; color: #475569;
          letter-spacing: 0.1em; margin-bottom: 1rem;
        }

        .sdk-code {
          background: rgba(0, 255, 170, 0.03);
          border: 1px solid rgba(0, 255, 170, 0.1);
          border-radius: 2px; padding: 2rem;
          font-family: inherit; font-size: 0.78rem;
          color: #94a3b8; line-height: 1.8;
          text-align: left; overflow-x: auto;
          margin-bottom: 1.5rem;
        }

        .footer {
          position: relative; z-index: 1;
          display: flex; justify-content: space-between;
          padding: 1.5rem 3rem;
          border-top: 1px solid rgba(0, 255, 170, 0.1);
          font-size: 0.75rem; color: #334155;
          letter-spacing: 0.05em;
        }

        .footer-chain { color: #00ffaa; opacity: 0.5; }

        @media (max-width: 768px) {
          .nav { padding: 1rem 1.5rem; }
          .hero { padding: 8rem 1.5rem 4rem; }
          .features { grid-template-columns: 1fr 1fr; padding: 0 1.5rem; }
          .stats { gap: 1.5rem; padding: 1.25rem 1.5rem; }
          .footer { padding: 1.25rem 1.5rem; flex-direction: column; gap: 0.5rem; }
        }
      `}</style>
    </main>
  );
}
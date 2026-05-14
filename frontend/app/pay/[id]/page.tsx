"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useLinks } from "@/hooks/useLinks";
import { PaymentLink, LinkStatus } from "@payngo/sdk";

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  [LinkStatus.Active]:    { label: "AWAITING PAYMENT", color: "#00ffaa" },
  [LinkStatus.Paid]:      { label: "PAID",             color: "#3b82f6" },
  [LinkStatus.Cancelled]: { label: "CANCELLED",        color: "#ef4444" },
  [LinkStatus.Expired]:   { label: "EXPIRED",          color: "#f59e0b" },
};

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useAccount();
  const { getLink, formatLink, payLink, loading, error } = useLinks();

  const [link, setLink] = useState<PaymentLink | null>(null);
  const [fetching, setFetching] = useState(true);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!id) return;
    setFetching(true);
    getLink(BigInt(id))
      .then(setLink)
      .finally(() => setFetching(false));
  }, [id]);

  const handlePay = async () => {
    if (!link) return;
    try {
      const result = await payLink(link.id);
      setTxHash(result.txHash);
      setPaid(true);
    } catch {}
  };

  const formatted = link ? formatLink(link) : null;
  const status = link ? STATUS_LABELS[link.status] : null;
  const fee = link ? (link.amount * 50n) / 10_000n : 0n;
  const youPay = link ? link.amount + fee : 0n;

  return (
    <main className="pay-page">
      <div className="grid-bg" />

      <div className="pay-container">
        <div className="pay-header">
          <span className="pay-logo">
            PAY<span className="accent">&apos;N</span>GO
          </span>
          <w3m-button />
        </div>

        <div className="pay-card">
          {fetching ? (
            <div className="state-loading">
              <span className="spinner" />
              <p>Loading payment...</p>
            </div>
          ) : !link ? (
            <div className="state-error">
              <span className="state-icon">✕</span>
              <h2>Link not found</h2>
              <p>This payment link does not exist or has been removed.</p>
            </div>
          ) : paid ? (
            <div className="state-success">
              <span className="state-icon success">✓</span>
              <h2>Payment sent!</h2>
              <p>The payment was processed successfully.</p>
              {txHash && (
                <a
                  href={"https://sepolia.etherscan.io/tx/" + txHash}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on Etherscan →
                </a>
              )}
            </div>
          ) : (
            <>
              <div
                className="status-badge"
                style={{
                  color: status?.color,
                  borderColor: (status?.color ?? "#00ffaa") + "40",
                }}
              >
                <span
                  className="badge-dot"
                  style={{ background: status?.color }}
                />
                {status?.label}
              </div>

              <div className="amount-display">
                <span className="amount-value">{formatted?.amountFormatted}</span>
                <span className="amount-currency">USDC</span>
              </div>

              {link.memo && (
                <p className="memo">&quot;{link.memo}&quot;</p>
              )}

              <div className="pay-details">
                <div className="detail-row">
                  <span>From</span>
                  <span className="mono">
                    {link.creator.slice(0, 6)}...{link.creator.slice(-4)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>To</span>
                  <span className="mono">
                    {link.recipient.slice(0, 6)}...{link.recipient.slice(-4)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Protocol fee (0.5%)</span>
                  <span className="mono">{formatUnits(fee, 6)} USDC</span>
                </div>
                {link.expiresAt > 0n && (
                  <div className="detail-row">
                    <span>Expires</span>
                    <span className="mono">
                      {new Date(Number(link.expiresAt) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="detail-row total">
                  <span>You pay</span>
                  <span className="mono accent">
                    {formatUnits(youPay, 6)} USDC
                  </span>
                </div>
              </div>

              {error && <div className="pay-error">{error}</div>}

              {formatted?.isActive ? (
                isConnected ? (
                  <button
                    className="pay-btn"
                    onClick={handlePay}
                    disabled={loading}
                  >
                    {loading
                      ? "Processing..."
                      : "Pay " + formatUnits(youPay, 6) + " USDC"}
                  </button>
                ) : (
                  <div className="connect-prompt">
                    <p>Connect your wallet to pay</p>
                    <w3m-button />
                  </div>
                )
              ) : (
                <div className="inactive-notice">
                  This link is{" "}
                  {formatted?.isPaid
                    ? "already paid"
                    : formatted?.isCancelled
                    ? "cancelled"
                    : "expired"}
                  .
                </div>
              )}
            </>
          )}
        </div>

        <p className="pay-footer">
          Secured by Pay&apos;n Go Protocol · Ethereum Sepolia
        </p>
      </div>

      <style jsx>{`
        :global(body) {
          background: #080b0f;
          color: #e2e8f0;
          font-family: 'IBM Plex Mono', 'Fira Code', monospace;
          margin: 0;
        }

        .pay-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .grid-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background-image:
            linear-gradient(rgba(0,255,170,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,170,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .pay-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .pay-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pay-logo {
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .accent { color: #00ffaa; }

        .pay-card {
          width: 100%;
          border: 1px solid rgba(0,255,170,0.15);
          background: rgba(8,11,15,0.95);
          border-radius: 4px;
          padding: 2rem;
          box-shadow: 0 0 40px rgba(0,255,170,0.05);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          border: 1px solid;
          padding: 0.3rem 0.75rem;
          border-radius: 2px;
          margin-bottom: 2rem;
        }

        .badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .amount-display {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .amount-value {
          font-size: 3.5rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1;
        }

        .amount-currency { font-size: 1.25rem; color: #475569; }

        .memo {
          font-size: 0.85rem;
          color: #64748b;
          font-style: italic;
          margin: 0 0 2rem;
        }

        .pay-details {
          border: 1px solid rgba(0,255,170,0.08);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 1.5rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          font-size: 0.78rem;
          color: #64748b;
          border-bottom: 1px solid rgba(0,255,170,0.05);
        }

        .detail-row:last-child { border-bottom: none; }

        .detail-row.total {
          color: #e2e8f0;
          font-weight: 600;
          background: rgba(0,255,170,0.03);
        }

        .mono { font-family: inherit; }

        .pay-btn {
          width: 100%;
          background: #00ffaa;
          color: #080b0f;
          border: none;
          border-radius: 2px;
          padding: 1rem;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 20px rgba(0,255,170,0.2);
        }

        .pay-btn:hover:not(:disabled) {
          background: #00cc88;
          box-shadow: 0 0 30px rgba(0,255,170,0.4);
        }

        .pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .connect-prompt { text-align: center; }

        .connect-prompt p {
          font-size: 0.8rem;
          color: #475569;
          margin-bottom: 1rem;
        }

        .inactive-notice {
          text-align: center;
          font-size: 0.85rem;
          color: #475569;
          padding: 1rem;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 2px;
        }

        .pay-error {
          font-size: 0.78rem;
          color: #ef4444;
          padding: 0.75rem;
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 2px;
          margin-bottom: 1rem;
        }

        .state-loading,
        .state-error,
        .state-success {
          text-align: center;
          padding: 2rem 0;
        }

        .spinner {
          display: inline-block;
          width: 24px;
          height: 24px;
          border: 2px solid rgba(0,255,170,0.2);
          border-top-color: #00ffaa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .state-icon {
          display: block;
          font-size: 2rem;
          color: #ef4444;
          margin-bottom: 1rem;
        }

        .state-icon.success { color: #00ffaa; }

        .state-error h2,
        .state-success h2 {
          color: #f8fafc;
          margin: 0 0 0.5rem;
        }

        .state-error p,
        .state-success p {
          color: #64748b;
          font-size: 0.85rem;
          margin: 0;
        }

        .tx-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.8rem;
          color: #00ffaa;
          text-decoration: none;
        }

        .tx-link:hover { text-decoration: underline; }

        .pay-footer {
          font-size: 0.7rem;
          color: #1e293b;
          letter-spacing: 0.08em;
          text-align: center;
        }
      `}</style>
    </main>
  );
}

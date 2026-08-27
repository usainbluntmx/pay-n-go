"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useLinks } from "@/hooks/useLinks";
import { PaymentLink, LinkStatus } from "@zero-two-labs/payngo";

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  [LinkStatus.Active]: { label: "ESPERANDO PAGO", color: "#1a7a1a" },
  [LinkStatus.Paid]: { label: "PAGADO", color: "#2563eb" },
  [LinkStatus.Cancelled]: { label: "CANCELADO", color: "#c0392b" },
  [LinkStatus.Expired]: { label: "EXPIRADO", color: "#c8860a" },
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
    } catch { }
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
              <p>Cargando pago...</p>
            </div>
          ) : !link ? (
            <div className="state-error">
              <span className="state-icon">✕</span>
              <h2>Link no encontrado</h2>
              <p>Este link de pago no existe o fue eliminado.</p>
            </div>
          ) : paid ? (
            <div className="state-success">
              <span className="state-icon success">✓</span>
              <h2>¡Pago enviado!</h2>
              <p>El pago se procesó exitosamente.</p>
              {txHash && (
                <a
                  href={"https://sepolia.etherscan.io/tx/" + txHash}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  Ver en Etherscan →
                </a>
              )}
            </div>
          ) : (
            <>
              <div
                className="status-badge"
                style={{
                  color: status?.color,
                  borderColor: status?.color,
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
                  <span>De</span>
                  <span className="mono">
                    {link.creator.slice(0, 6)}...{link.creator.slice(-4)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Para</span>
                  <span className="mono">
                    {link.recipient.slice(0, 6)}...{link.recipient.slice(-4)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Comisión del protocolo (0.5%)</span>
                  <span className="mono">{formatUnits(fee, 6)} USDC</span>
                </div>
                {link.expiresAt > 0n && (
                  <div className="detail-row">
                    <span>Expira</span>
                    <span className="mono">
                      {new Date(Number(link.expiresAt) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="detail-row total">
                  <span>Tú pagas</span>
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
                      ? "Procesando..."
                      : "Pagar " + formatUnits(youPay, 6) + " USDC"}
                  </button>
                ) : (
                  <div className="connect-prompt">
                    <p>Conecta tu wallet para pagar</p>
                    <w3m-button />
                  </div>
                )
              ) : (
                <div className="inactive-notice">
                  Este link está{" "}
                  {formatted?.isPaid
                    ? "ya pagado"
                    : formatted?.isCancelled
                      ? "cancelado"
                      : "expirado"}
                  .
                </div>
              )}
            </>
          )}
        </div>

        <p className="pay-footer">
          Protegido por Pay&apos;n Go Protocol · Ethereum Sepolia
        </p>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400&display=swap');

        :global(body) {
          background: #f5f0e8;
          color: #1a1a1a;
          font-family: 'Comic Neue', 'Comic Sans MS', cursive;
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
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
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
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-family: 'Comic Neue', cursive;
        }

        .accent { text-decoration: underline; text-underline-offset: 3px; }

        .pay-card {
          width: 100%;
          border: 2px solid #1a1a1a;
          background: #fff;
          border-radius: 5px 12px 6px 10px / 10px 6px 12px 5px;
          padding: 2rem;
          box-shadow: 6px 6px 0 #1a1a1a;
          animation: card-appear 0.4s ease;
        }

        @keyframes card-appear {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          border: 2px solid;
          padding: 0.35rem 0.85rem;
          border-radius: 99px;
          margin-bottom: 2rem;
          font-family: 'Comic Neue', cursive;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
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
          color: #1a1a1a;
          line-height: 1;
          font-family: 'Comic Neue', cursive;
        }

        .amount-currency { font-size: 1.25rem; color: #666; }

        .memo {
          font-size: 0.88rem;
          color: #555;
          font-style: italic;
          margin: 0 0 2rem;
          font-family: 'Comic Neue', cursive;
        }

        .pay-details {
          border: 2px solid #1a1a1a;
          border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
          overflow: hidden;
          margin-bottom: 1.5rem;
          background: #f5f0e8;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          font-size: 0.82rem;
          color: #555;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          font-family: 'Comic Neue', cursive;
        }

        .detail-row:last-child { border-bottom: none; }

        .detail-row.total {
          color: #1a1a1a;
          font-weight: 700;
          background: #fff;
        }

        .mono { font-family: 'Comic Neue', cursive; }

        .pay-btn {
          width: 100%;
          background: #1a1a1a;
          color: #f5f0e8;
          border: 2px solid #1a1a1a;
          border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
          padding: 1rem;
          font-family: 'Comic Neue', cursive;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.25);
        }

        .pay-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 rgba(0,0,0,0.25);
        }

        .pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .connect-prompt { text-align: center; }

        .connect-prompt p {
          font-size: 0.84rem;
          color: #666;
          margin-bottom: 1rem;
          font-family: 'Comic Neue', cursive;
        }

        .inactive-notice {
          text-align: center;
          font-size: 0.88rem;
          color: #555;
          padding: 1rem;
          border: 2px solid #1a1a1a;
          border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
          background: #f5f0e8;
          font-family: 'Comic Neue', cursive;
        }

        .pay-error {
          font-size: 0.8rem;
          color: #c0392b;
          padding: 0.75rem;
          border: 2px solid #c0392b;
          border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
          background: #fff5f5;
          margin-bottom: 1rem;
          font-family: 'Comic Neue', cursive;
        }

        .state-loading,
        .state-error,
        .state-success {
          text-align: center;
          padding: 2rem 0;
        }

        .spinner {
          display: inline-block;
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0,0,0,0.1);
          border-top-color: #1a1a1a;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .state-icon {
          display: block;
          font-size: 2.2rem;
          color: #c0392b;
          margin-bottom: 1rem;
        }

        .state-icon.success { color: #1a7a1a; }

        .state-error h2,
        .state-success h2 {
          color: #1a1a1a;
          margin: 0 0 0.5rem;
          font-family: 'Comic Neue', cursive;
        }

        .state-error p,
        .state-success p {
          color: #666;
          font-size: 0.88rem;
          margin: 0;
          font-family: 'Comic Neue', cursive;
        }

        .tx-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.82rem;
          color: #2563eb;
          text-decoration: underline;
          font-family: 'Comic Neue', cursive;
        }

        .pay-footer {
          font-size: 0.72rem;
          color: #888;
          letter-spacing: 0.04em;
          text-align: center;
          font-family: 'Comic Neue', cursive;
        }
      `}</style>
    </main>
  );
}
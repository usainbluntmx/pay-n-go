"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useLinks } from "@/hooks/useLinks";
import { useRouter } from "@/hooks/useRouter";
import { useAgent } from "@/hooks/useAgent";
import { useGasless } from "@/hooks/useGasless";
import { PaymentLink, LinkStatus, AgentPaymentSuggestion } from "@payngo-labs/sdk";

type Tab = "links" | "send" | "agent";

const RISK_COLORS: Record<string, string> = {
  low: "#00ffaa",
  medium: "#f59e0b",
  high: "#ef4444",
};

const STATUS_COLORS: Record<number, string> = {
  [LinkStatus.Active]: "#00ffaa",
  [LinkStatus.Paid]: "#3b82f6",
  [LinkStatus.Cancelled]: "#ef4444",
  [LinkStatus.Expired]: "#f59e0b",
};

const STATUS_LABELS: Record<number, string> = {
  [LinkStatus.Active]: "active",
  [LinkStatus.Paid]: "paid",
  [LinkStatus.Cancelled]: "cancelled",
  [LinkStatus.Expired]: "expired",
};

const STEP_LABELS: Record<string, string> = {
  creating_account: "Creating Smart Account...",
  checking_balance: "Checking USDC balance...",
  sending: "Sign the UserOperation...",
  confirming: "Confirming onchain...",
  done: "Done!",
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { createLink, getMyLinks, formatLink, cancelLink, loading: linksLoading, error: linksError } = useLinks();
  const { executePayment, getGaslessThreshold, isGaslessEligible, loading: routerLoading, approving: routerApproving } = useRouter();
  const { analyze, execute, loading: agentLoading, error: agentError } = useAgent();
  const {
    sendGasless,
    loading: gaslessLoading,
    error: gaslessError,
    step: gaslessStep,
    smartAccountAddress,
    smartAccountBalance,
    reset: resetGasless,
  } = useGasless();

  const [tab, setTab] = useState<Tab>("links");
  const [myLinks, setMyLinks] = useState<PaymentLink[]>([]);
  const [fetching, setFetching] = useState(false);

  const [newLink, setNewLink] = useState({ recipient: "", amount: "", memo: "", expiresIn: "" });
  const [createdLinkId, setCreatedLinkId] = useState<bigint | null>(null);

  const [sendForm, setSendForm] = useState({ recipient: "", amount: "" });
  const [sendTx, setSendTx] = useState<string | null>(null);
  const [gaslessThreshold, setGaslessThreshold] = useState<string>("500");
  const [gaslessEligible, setGaslessEligible] = useState<boolean>(false);

  // Toggle gasless mode
  const [useGaslessMode, setUseGaslessMode] = useState(false);
  const [gaslessTx, setGaslessTx] = useState<string | null>(null);

  const [agentInput, setAgentInput] = useState("");
  const [suggestion, setSuggestion] = useState<AgentPaymentSuggestion | null>(null);
  const [agentTx, setAgentTx] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    if (!isConnected) return;
    setFetching(true);
    const links = await getMyLinks();
    setMyLinks(links);
    setFetching(false);
  }, [isConnected, getMyLinks]);

  useEffect(() => {
    if (isConnected) loadLinks();
  }, [isConnected, loadLinks]);

  useEffect(() => {
    if (isConnected) {
      getGaslessThreshold().then(setGaslessThreshold);
    }
  }, [isConnected, getGaslessThreshold]);

  useEffect(() => {
    if (sendForm.amount && parseFloat(sendForm.amount) > 0) {
      isGaslessEligible(sendForm.amount).then(setGaslessEligible);
    } else {
      setGaslessEligible(false);
    }
  }, [sendForm.amount, isGaslessEligible]);

  // useGasless hook carga la Smart Account automáticamente cuando walletClient está listo

  const handleCreateLink = async () => {
    if (!newLink.recipient || !newLink.amount) return;
    try {
      const result = await createLink({
        recipient: newLink.recipient as `0x${string}`,
        amount: newLink.amount,
        memo: newLink.memo,
        expiresIn: newLink.expiresIn ? parseInt(newLink.expiresIn) * 3600 : undefined,
      });
      setCreatedLinkId(result.linkId);
      setNewLink({ recipient: "", amount: "", memo: "", expiresIn: "" });
      await loadLinks();
    } catch { }
  };

  const handleSend = async () => {
    if (!sendForm.recipient || !sendForm.amount) return;
    try {
      const result = await executePayment(sendForm.recipient, sendForm.amount);
      setSendTx(result.txHash);
      setSendForm({ recipient: "", amount: "" });
    } catch { }
  };

  const handleSendGasless = async () => {
    if (!sendForm.recipient || !sendForm.amount) return;
    setGaslessTx(null);
    try {
      const result = await sendGasless(sendForm.recipient, sendForm.amount);
      setGaslessTx(result.txHash);
      setSendForm({ recipient: "", amount: "" });
    } catch { }
  };

  const handleAnalyze = async () => {
    if (!agentInput.trim()) return;
    setSuggestion(null);
    setAgentTx(null);
    const result = await analyze(agentInput);
    if (result) setSuggestion(result.suggestion);
  };

  const handleExecuteSuggestion = async () => {
    if (!suggestion) return;
    const result = await execute(suggestion);
    if (result?.txHash) setAgentTx(result.txHash);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const isSending = routerLoading || gaslessLoading;
  console.log("[Dashboard] smartAccountAddress:", smartAccountAddress, "smartAccountBalance:", smartAccountBalance);
  const sendButtonLabel = () => {
    if (useGaslessMode) {
      if (gaslessLoading) return STEP_LABELS[gaslessStep] || "Processing...";
      return "⚡ Send Gasless →";
    }
    if (routerApproving) return "Step 1/2: Approving USDC...";
    if (routerLoading) return "Step 2/2: Sending...";
    return "Send via Router →";
  };

  if (!mounted || !isConnected) {
    return (
      <main className="dashboard">
        <div className="grid-bg" />
        <div className="connect-wall">
          <h1>PAY<span className="accent">&apos;N</span>GO</h1>
          <p>Connect your wallet to access the dashboard</p>
          <w3m-button />
        </div>
        <Styles />
      </main>
    );
  }

  return (
    <main className="dashboard">
      <div className="grid-bg" />

      <header className="dash-header">
        <span className="dash-logo">PAY<span className="accent">&apos;N</span>GO</span>
        <span className="dash-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        <w3m-button />
      </header>

      <div className="tabs">
        {(["links", "send", "agent"] as Tab[]).map((t) => (
          <button
            key={t}
            className={"tab" + (tab === t ? " active" : "")}
            onClick={() => setTab(t)}
          >
            {t === "links" && "⬡ Payment Links"}
            {t === "send" && "→ Send USDC"}
            {t === "agent" && "◎ AI Agent"}
          </button>
        ))}
      </div>

      <div className="dash-content">

        {/* ─── LINKS TAB ─── */}
        {tab === "links" && (
          <div className="tab-content">
            <div className="card">
              <h2 className="card-title">Create Payment Link</h2>
              <div className="form-grid">
                <div className="field">
                  <label>Recipient address</label>
                  <input
                    value={newLink.recipient}
                    onChange={(e) => setNewLink({ ...newLink, recipient: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div className="field">
                  <label>Amount (USDC)</label>
                  <input
                    value={newLink.amount}
                    onChange={(e) => setNewLink({ ...newLink, amount: e.target.value })}
                    placeholder="10.00"
                    type="number"
                    min="0"
                  />
                </div>
                <div className="field">
                  <label>Memo (optional)</label>
                  <input
                    value={newLink.memo}
                    onChange={(e) => setNewLink({ ...newLink, memo: e.target.value })}
                    placeholder="Invoice #001"
                  />
                </div>
                <div className="field">
                  <label>Expires in (hours, optional)</label>
                  <input
                    value={newLink.expiresIn}
                    onChange={(e) => setNewLink({ ...newLink, expiresIn: e.target.value })}
                    placeholder="24"
                    type="number"
                    min="0"
                  />
                </div>
              </div>
              <button
                className="action-btn"
                onClick={handleCreateLink}
                disabled={linksLoading || !newLink.recipient || !newLink.amount}
              >
                {linksLoading ? "Creating..." : "Generate Link →"}
              </button>
              {linksError && <p className="error-msg">{linksError}</p>}
              {createdLinkId !== null && (
                <div className="success-box">
                  <p>Link created! ID: <strong>{"#" + createdLinkId.toString()}</strong></p>
                  <a
                    href={"/pay/" + createdLinkId.toString()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-url"
                  >
                    {origin + "/pay/" + createdLinkId.toString() + " →"}
                  </a>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header-row">
                <h2 className="card-title">My Links</h2>
                <button className="refresh-btn" onClick={loadLinks} disabled={fetching}>
                  {fetching ? "Loading..." : "↻ Refresh"}
                </button>
              </div>
              {myLinks.length === 0 ? (
                <p className="empty-msg">No links yet. Create your first payment link above.</p>
              ) : (
                <div className="links-list">
                  {myLinks.map((link) => {
                    const f = formatLink(link);
                    return (
                      <div key={link.id.toString()} className="link-row">
                        <div className="link-info">
                          <span className="link-id">{"#" + link.id.toString()}</span>
                          <span className="link-status" style={{ color: STATUS_COLORS[link.status] }}>
                            {STATUS_LABELS[link.status]}
                          </span>
                        </div>
                        <div className="link-meta">
                          <span className="link-amount">{f.amountFormatted + " USDC"}</span>
                          {link.memo && <span className="link-memo">{link.memo}</span>}
                        </div>
                        <div className="link-actions">
                          <a
                            href={"/pay/" + link.id.toString()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-action"
                          >
                            View →
                          </a>
                          {f.isActive && (
                            <button
                              className="link-action danger"
                              onClick={() => cancelLink(link.id).then(loadLinks)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SEND TAB ─── */}
        {tab === "send" && (
          <div className="tab-content">
            <div className="card">

              {/* Header con toggle */}
              <div className="send-header">
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>Send USDC</h2>
                  <p className="card-desc" style={{ margin: "0.25rem 0 0" }}>
                    {useGaslessMode
                      ? "ERC-4337 gasless — you sign once, Pimlico pays gas"
                      : "Route via PayNGoRouter — optimal path, automatic gasless detection"}
                  </p>
                </div>
                <div className="gasless-toggle-wrap">
                  <span className="toggle-label">
                    {useGaslessMode ? "⚡ Gasless" : "⛽ Normal"}
                  </span>
                  <button
                    className={"toggle-btn" + (useGaslessMode ? " active" : "")}
                    onClick={() => {
                      setUseGaslessMode(!useGaslessMode);
                      setSendTx(null);
                      setGaslessTx(null);
                      resetGasless();
                    }}
                  >
                    <span className="toggle-dot" />
                  </button>
                </div>
              </div>

              {/* Smart Account info (solo en modo gasless) */}
              {useGaslessMode && (
                <div className="smart-account-box">
                  <div className="sa-row">
                    <span className="sa-label">Smart Account</span>
                    <span className="sa-value">
                      {smartAccountAddress
                        ? smartAccountAddress.slice(0, 10) + "..." + smartAccountAddress.slice(-6)
                        : "Calculating..."}
                    </span>
                  </div>
                  <div className="sa-row">
                    <span className="sa-label">USDC Balance</span>
                    <span className="sa-value" style={{
                      color: parseFloat(smartAccountBalance || "0") > 0 ? "#00ffaa" : "#ef4444"
                    }}>
                      {smartAccountBalance !== null ? smartAccountBalance + " USDC" : "Loading..."}
                    </span>
                  </div>
                  {parseFloat(smartAccountBalance || "0") === 0 && (
                    <div className="sa-warning">
                      ⚠ Fund your Smart Account with USDC to use gasless payments.
                      Send USDC to the address above from your wallet.
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              <div className="form-grid" style={{ marginTop: "1.25rem" }}>
                <div className="field">
                  <label>Recipient address</label>
                  <input
                    value={sendForm.recipient}
                    onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div className="field">
                  <label>Amount (USDC)</label>
                  <input
                    value={sendForm.amount}
                    onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                    placeholder="10.00"
                    type="number"
                    min="0"
                  />
                </div>
              </div>

              {/* Fee + eligibility info */}
              {sendForm.amount && !useGaslessMode && (
                <div className="send-info">
                  <div className="fee-preview">
                    <span>Protocol fee (0.3%)</span>
                    <span>{"~" + (parseFloat(sendForm.amount || "0") * 0.003).toFixed(4) + " USDC"}</span>
                  </div>
                  <div
                    className="gasless-preview"
                    style={{
                      borderColor: gaslessEligible ? "rgba(0,255,170,0.3)" : "rgba(100,116,139,0.2)",
                      color: gaslessEligible ? "#00ffaa" : "#475569",
                    }}
                  >
                    <span>{gaslessEligible ? "⚡ Gasless eligible" : "⛽ Gas required"}</span>
                    <span className="gasless-sub">
                      {gaslessEligible
                        ? "Gateway will pay gas"
                        : "Threshold: " + gaslessThreshold + " USDC max"}
                    </span>
                  </div>
                </div>
              )}

              {sendForm.amount && useGaslessMode && (
                <div className="send-info">
                  <div className="fee-preview">
                    <span>Protocol fee (0.3%)</span>
                    <span>{"~" + (parseFloat(sendForm.amount || "0") * 0.003).toFixed(4) + " USDC"}</span>
                  </div>
                  <div className="gasless-preview" style={{
                    borderColor: "rgba(0,255,170,0.3)",
                    color: "#00ffaa",
                  }}>
                    <span>⚡ ERC-4337 gasless</span>
                    <span className="gasless-sub">Pimlico sponsors gas — 0 ETH needed</span>
                  </div>
                </div>
              )}

              {/* Progress steps (solo en modo gasless activo) */}
              {useGaslessMode && gaslessLoading && (
                <div className="gasless-progress">
                  {["creating_account", "checking_balance", "sending", "confirming"].map((s) => {
                    const steps = ["creating_account", "checking_balance", "sending", "confirming"];
                    const currentIdx = steps.indexOf(gaslessStep);
                    const stepIdx = steps.indexOf(s);
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = s === gaslessStep;
                    return (
                      <div key={s} className={"progress-step" + (isCurrent ? " current" : "") + (isDone ? " done" : "")}>
                        <span className="step-dot">
                          {isDone ? "✓" : isCurrent ? "●" : "○"}
                        </span>
                        <span className="step-text">{STEP_LABELS[s]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Errors */}
              {!useGaslessMode && routerLoading === false && sendTx === null && (
                null
              )}
              {useGaslessMode && gaslessError && (
                <div className="pay-error" style={{ marginTop: "1rem" }}>
                  {gaslessError}
                </div>
              )}

              {/* Send button */}
              <button
                className={"action-btn" + (useGaslessMode ? " gasless-btn" : "")}
                onClick={useGaslessMode ? handleSendGasless : handleSend}
                disabled={isSending || !sendForm.recipient || !sendForm.amount}
                style={{ marginTop: "1rem" }}
              >
                {sendButtonLabel()}
              </button>

              {/* Success — normal */}
              {!useGaslessMode && sendTx && (
                <div className="success-box">
                  <p>Payment sent!</p>
                  <a
                    href={"https://sepolia.etherscan.io/tx/" + sendTx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-url"
                  >
                    View on Etherscan →
                  </a>
                </div>
              )}

              {/* Success — gasless */}
              {useGaslessMode && gaslessTx && (
                <div className="success-box">
                  <p>⚡ Gasless payment confirmed!</p>
                  <p style={{ fontSize: "0.75rem", color: "#475569", margin: "0 0 0.5rem" }}>
                    Gas was paid by Pimlico Paymaster — you paid 0 ETH
                  </p>
                  <a
                    href={"https://sepolia.etherscan.io/tx/" + gaslessTx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-url"
                  >
                    View on Etherscan →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AGENT TAB ─── */}
        {tab === "agent" && (
          <div className="tab-content">
            <div className="card">
              <h2 className="card-title">AI Payment Agent</h2>
              <p className="card-desc">
                Describe your payment in plain language. The agent will analyze and suggest the optimal action.
              </p>
              <div className="field">
                <label>Instruction</label>
                <textarea
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  placeholder={'e.g. "Send 10 USDC to 0xABC... for design work" or "Pay link number 3"'}
                  rows={3}
                />
              </div>
              <button
                className="action-btn"
                onClick={handleAnalyze}
                disabled={agentLoading || !agentInput.trim()}
              >
                {agentLoading ? "Analyzing..." : "◎ Analyze →"}
              </button>

              {agentError && (
                <div className="pay-error" style={{ marginTop: "1rem" }}>
                  {agentError}
                </div>
              )}

              {suggestion && !agentTx && (
                <div className="suggestion-box">
                  <div className="suggestion-header">
                    <span className="suggestion-action">{suggestion.action}</span>
                    <span className="suggestion-risk" style={{ color: RISK_COLORS[suggestion.riskLevel] }}>
                      {suggestion.riskLevel + " risk"}
                    </span>
                  </div>
                  <p className="suggestion-reasoning">{suggestion.reasoning}</p>
                  <p className="suggestion-cost">{"Est. cost: " + suggestion.estimatedCost}</p>
                  <div className="suggestion-params">
                    <pre>{JSON.stringify(suggestion.params, null, 2)}</pre>
                  </div>
                  <button
                    className="action-btn"
                    onClick={handleExecuteSuggestion}
                    disabled={agentLoading}
                  >
                    {agentLoading ? "Executing..." : "Execute Payment →"}
                  </button>
                </div>
              )}

              {agentTx && (
                <div className="success-box">
                  <p>Payment executed by agent!</p>
                  <a
                    href={"https://sepolia.etherscan.io/tx/" + agentTx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-url"
                  >
                    View on Etherscan →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <Styles />
    </main>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      body {
        background: #080b0f;
        color: #e2e8f0;
        font-family: 'IBM Plex Mono', 'Fira Code', monospace;
        margin: 0;
      }

      .dashboard { min-height: 100vh; position: relative; }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,255,170,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,170,0.03) 1px, transparent 1px);
        background-size: 40px 40px; pointer-events: none;
      }

      .connect-wall {
        position: relative; z-index: 1;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; min-height: 100vh;
        text-align: center; gap: 1.5rem;
      }

      .connect-wall h1 {
        font-size: 2.5rem; font-weight: 700;
        letter-spacing: 0.1em; margin: 0;
      }

      .connect-wall p { color: #64748b; margin: 0; }

      .accent { color: #00ffaa; }

      .dash-header {
        position: relative; z-index: 1;
        display: flex; align-items: center; gap: 1rem;
        padding: 1.25rem 3rem;
        border-bottom: 1px solid rgba(0,255,170,0.1);
        background: rgba(8,11,15,0.9); backdrop-filter: blur(12px);
      }

      .dash-logo {
        font-size: 1.1rem; font-weight: 700;
        letter-spacing: 0.1em; flex: 1;
      }

      .dash-address {
        font-size: 0.75rem; color: #475569; letter-spacing: 0.05em;
      }

      .tabs {
        position: relative; z-index: 1;
        display: flex; border-bottom: 1px solid rgba(0,255,170,0.1);
        padding: 0 3rem;
        background: rgba(8,11,15,0.5);
      }

      .tab {
        padding: 1rem 1.5rem;
        background: none; border: none;
        color: #475569; font-family: inherit;
        font-size: 0.8rem; letter-spacing: 0.05em;
        cursor: pointer; border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: all 0.2s;
      }

      .tab:hover { color: #94a3b8; }
      .tab.active { color: #00ffaa; border-bottom-color: #00ffaa; }

      .dash-content {
        position: relative; z-index: 1;
        max-width: 800px; margin: 0 auto;
        padding: 2rem 1.5rem;
      }

      .tab-content { display: flex; flex-direction: column; gap: 1.5rem; }

      .card {
        border: 1px solid rgba(0,255,170,0.1);
        background: rgba(8,11,15,0.8);
        border-radius: 4px; padding: 1.75rem;
      }

      .card-title {
        font-size: 0.9rem; font-weight: 700;
        color: #f8fafc; letter-spacing: 0.05em;
        margin: 0 0 1.25rem;
      }

      .card-desc {
        font-size: 0.8rem; color: #64748b;
        margin: -0.75rem 0 1.25rem; line-height: 1.6;
      }

      .card-header-row {
        display: flex; align-items: center;
        justify-content: space-between; margin-bottom: 1.25rem;
      }

      .card-header-row .card-title { margin: 0; }

      /* ─── Send header with toggle ─── */
      .send-header {
        display: flex; align-items: flex-start;
        justify-content: space-between; gap: 1rem;
        margin-bottom: 0;
      }

      .gasless-toggle-wrap {
        display: flex; align-items: center; gap: 0.6rem;
        flex-shrink: 0; padding-top: 0.1rem;
      }

      .toggle-label {
        font-size: 0.72rem; letter-spacing: 0.08em;
        color: #475569; transition: color 0.2s;
      }

      .toggle-btn {
        width: 40px; height: 22px;
        background: rgba(0,255,170,0.1);
        border: 1px solid rgba(0,255,170,0.2);
        border-radius: 11px;
        cursor: pointer; position: relative;
        transition: all 0.3s; padding: 0;
      }

      .toggle-btn.active {
        background: rgba(0,255,170,0.2);
        border-color: #00ffaa;
        box-shadow: 0 0 12px rgba(0,255,170,0.3);
      }

      .toggle-dot {
        position: absolute; top: 3px; left: 3px;
        width: 14px; height: 14px; border-radius: 50%;
        background: #475569;
        transition: all 0.3s;
      }

      .toggle-btn.active .toggle-dot {
        left: 21px;
        background: #00ffaa;
      }

      /* ─── Smart Account box ─── */
      .smart-account-box {
        margin-top: 1.25rem;
        border: 1px solid rgba(0,255,170,0.15);
        border-radius: 2px;
        padding: 1rem;
        background: rgba(0,255,170,0.02);
      }

      .sa-row {
        display: flex; justify-content: space-between;
        align-items: center; padding: 0.4rem 0;
        font-size: 0.78rem;
        border-bottom: 1px solid rgba(0,255,170,0.06);
      }

      .sa-row:last-of-type { border-bottom: none; }

      .sa-label { color: #475569; }
      .sa-value { color: #e2e8f0; font-family: inherit; }

      .sa-warning {
        margin-top: 0.75rem;
        font-size: 0.72rem; color: #f59e0b;
        padding: 0.6rem 0.85rem;
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 2px;
        background: rgba(245,158,11,0.05);
      }

      /* ─── Progress steps ─── */
      .gasless-progress {
        margin: 1rem 0;
        display: flex; flex-direction: column; gap: 0.5rem;
        padding: 1rem;
        border: 1px solid rgba(0,255,170,0.1);
        border-radius: 2px;
        background: rgba(0,0,0,0.2);
      }

      .progress-step {
        display: flex; align-items: center; gap: 0.75rem;
        font-size: 0.78rem; color: #334155;
        transition: color 0.2s;
      }

      .progress-step.done { color: #00ffaa; }
      .progress-step.current { color: #e2e8f0; }

      .step-dot {
        font-size: 0.7rem; width: 16px; text-align: center;
        flex-shrink: 0;
      }

      .progress-step.current .step-dot {
        animation: pulse-dot 1s infinite;
        color: #00ffaa;
      }

      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .step-text { letter-spacing: 0.03em; }

      /* ─── Form ─── */
      .form-grid {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 1rem; margin-bottom: 1.25rem;
      }

      .field { display: flex; flex-direction: column; gap: 0.5rem; }

      .field label {
        font-size: 0.7rem; color: #475569; letter-spacing: 0.08em;
      }

      .field input, .field textarea {
        background: rgba(0,255,170,0.03);
        border: 1px solid rgba(0,255,170,0.1);
        border-radius: 2px; padding: 0.65rem 0.85rem;
        font-family: inherit; font-size: 0.82rem;
        color: #e2e8f0; outline: none;
        transition: border-color 0.2s; resize: vertical;
      }

      .field input:focus, .field textarea:focus {
        border-color: rgba(0,255,170,0.4);
      }

      .field input::placeholder, .field textarea::placeholder {
        color: #334155;
      }

      /* ─── Buttons ─── */
      .action-btn {
        background: #00ffaa; color: #080b0f;
        border: none; border-radius: 2px;
        padding: 0.75rem 1.5rem; font-family: inherit;
        font-size: 0.85rem; font-weight: 700;
        letter-spacing: 0.05em; cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 0 16px rgba(0,255,170,0.2);
      }

      .action-btn:hover:not(:disabled) {
        background: #00cc88;
        box-shadow: 0 0 24px rgba(0,255,170,0.4);
      }

      .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .gasless-btn {
        background: linear-gradient(90deg, #00ffaa, #00cc88);
        box-shadow: 0 0 20px rgba(0,255,170,0.35);
      }

      .refresh-btn {
        background: none; border: 1px solid rgba(0,255,170,0.2);
        color: #00ffaa; font-family: inherit; font-size: 0.75rem;
        padding: 0.4rem 0.85rem; border-radius: 2px;
        cursor: pointer; transition: all 0.2s;
      }

      .refresh-btn:hover:not(:disabled) { background: rgba(0,255,170,0.05); }

      /* ─── Info boxes ─── */
      .send-info { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0; }

      .fee-preview {
        display: flex; justify-content: space-between;
        font-size: 0.75rem; color: #475569;
        padding: 0.65rem 0.85rem;
        border: 1px solid rgba(0,255,170,0.05);
        border-radius: 2px;
      }

      .gasless-preview {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 0.75rem; font-weight: 600;
        padding: 0.65rem 0.85rem;
        border: 1px solid;
        border-radius: 2px;
        transition: all 0.3s;
      }

      .gasless-sub {
        font-size: 0.7rem; font-weight: 400; opacity: 0.7;
      }

      .success-box {
        margin-top: 1rem; padding: 1rem;
        border: 1px solid rgba(0,255,170,0.2);
        border-radius: 2px; background: rgba(0,255,170,0.03);
      }

      .success-box p {
        font-size: 0.82rem; color: #00ffaa; margin: 0 0 0.5rem;
      }

      .link-url {
        font-size: 0.75rem; color: #64748b;
        text-decoration: none; word-break: break-all;
      }

      .link-url:hover { color: #00ffaa; }

      .error-msg { font-size: 0.78rem; color: #ef4444; margin-top: 0.75rem; }

      .pay-error {
        font-size: 0.78rem; color: #ef4444;
        padding: 0.75rem; border: 1px solid rgba(239,68,68,0.2);
        border-radius: 2px;
      }

      .empty-msg {
        font-size: 0.82rem; color: #334155;
        text-align: center; padding: 2rem 0; margin: 0;
      }

      /* ─── Links list ─── */
      .links-list { display: flex; flex-direction: column; gap: 0.5rem; }

      .link-row {
        display: flex; align-items: center;
        justify-content: space-between; gap: 1rem;
        padding: 0.85rem 1rem;
        border: 1px solid rgba(0,255,170,0.07);
        border-radius: 2px; font-size: 0.8rem;
        transition: background 0.2s;
      }

      .link-row:hover { background: rgba(0,255,170,0.02); }

      .link-info { display: flex; align-items: center; gap: 0.75rem; }
      .link-id { color: #475569; font-size: 0.72rem; }
      .link-status { font-size: 0.68rem; letter-spacing: 0.1em; }
      .link-meta { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
      .link-amount { color: #e2e8f0; font-weight: 600; }
      .link-memo { font-size: 0.72rem; color: #475569; font-style: italic; }
      .link-actions { display: flex; align-items: center; gap: 0.5rem; }

      .link-action {
        font-size: 0.72rem; color: #00ffaa;
        text-decoration: none; background: none; border: none;
        font-family: inherit; cursor: pointer;
        padding: 0.3rem 0.5rem; border-radius: 2px; transition: background 0.2s;
      }

      .link-action:hover { background: rgba(0,255,170,0.08); }
      .link-action.danger { color: #ef4444; }
      .link-action.danger:hover { background: rgba(239,68,68,0.08); }

      /* ─── Agent ─── */
      .suggestion-box {
        margin-top: 1.25rem; padding: 1.25rem;
        border: 1px solid rgba(0,255,170,0.15);
        border-radius: 2px; background: rgba(0,255,170,0.02);
      }

      .suggestion-header {
        display: flex; align-items: center;
        justify-content: space-between; margin-bottom: 0.75rem;
      }

      .suggestion-action {
        font-size: 0.85rem; font-weight: 700;
        color: #f8fafc; letter-spacing: 0.05em;
      }

      .suggestion-risk { font-size: 0.72rem; letter-spacing: 0.08em; }

      .suggestion-reasoning {
        font-size: 0.8rem; color: #64748b;
        margin: 0 0 0.5rem; line-height: 1.5;
      }

      .suggestion-cost { font-size: 0.75rem; color: #475569; margin: 0 0 0.75rem; }

      .suggestion-params {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(0,255,170,0.07);
        border-radius: 2px; padding: 0.75rem; margin-bottom: 1rem;
      }

      .suggestion-params pre {
        margin: 0; font-size: 0.75rem;
        color: #64748b; line-height: 1.6; font-family: inherit;
      }

      @media (max-width: 640px) {
        .dash-header { padding: 1rem 1.5rem; }
        .tabs { padding: 0 1rem; }
        .form-grid { grid-template-columns: 1fr; }
        .link-row { flex-wrap: wrap; }
        .send-header { flex-direction: column; gap: 0.75rem; }
      }
    `}</style>
  );
}

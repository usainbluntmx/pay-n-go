"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useAgent, AgentMessage } from "@/hooks/useAgent";

export default function DashboardPage() {
  const { identity, balance, refreshBalance, logout, isReady } = useIdentity();
  const {
    messages,
    loading,
    executingTx,
    pendingSuggestion,
    processInstruction,
    executeSuggestion,
    cancelSuggestion,
    clearMessages,
  } = useAgent();

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mensaje de bienvenida al cargar
  useEffect(() => {
    if (mounted && isReady && messages.length === 0) {
      const name = identity?.handle ? `@${identity.handle}` : "👋";
      // No llamamos al agente — solo mostramos el placeholder en el input
    }
  }, [mounted, isReady, messages.length, identity]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || executingTx) return;
    setInput("");
    await processInstruction(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!mounted) return null;

  if (!isReady || !identity) {
    return (
      <main className="dash">
        <div className="grid-bg" />
        <div className="loading-center">
          <div className="spinner" />
        </div>
        <Styles />
      </main>
    );
  }

  const shortAddress = identity.smartAccountAddress.slice(0, 6) + "..." + identity.smartAccountAddress.slice(-4);

  return (
    <main className="dash">
      <div className="grid-bg" />

      {/* ─── HEADER ─── */}
      <header className="dash-header">
        <span className="dash-logo">PAY<span className="accent">&apos;N</span>GO</span>
        <div className="header-right">
          <div className="balance-chip">
            <span className="balance-label">Balance</span>
            <span className="balance-value">
              {balance !== null ? balance + " USDC" : "—"}
            </span>
            <button className="refresh-btn" onClick={refreshBalance} title="Actualizar balance">↻</button>
          </div>
          <div className="identity-chip">
            {identity.handle
              ? <span className="handle-display">@{identity.handle}</span>
              : <span className="address-display">{shortAddress}</span>
            }
          </div>
          <button className="logout-btn" onClick={logout} title="Cerrar sesión">⏻</button>
        </div>
      </header>

      {/* ─── CHAT ─── */}
      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome-msg">
              <div className="welcome-icon">◎</div>
              <p className="welcome-title">
                Hola{identity.handle ? `, @${identity.handle}` : ""}
              </p>
              <p className="welcome-sub">
                Dime qué quieres hacer. Puedo enviarte dinero, crear links de pago o consultar tu balance.
              </p>
              <div className="suggestions-row">
                {[
                  "Envía 10 USDC a @carlos por el diseño",
                  "Crea un link de 50 USDC para la renta",
                  "¿Cuánto tengo en mi cuenta?",
                ].map((s) => (
                  <button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {/* Indicador de typing */}
          {(loading || executingTx) && (
            <div className="msg agent">
              <div className="bubble bubble-agent typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {/* Botones de confirmación */}
          {pendingSuggestion && !loading && !executingTx && (
            <div className="confirm-bar">
              <button
                className="confirm-btn confirm-yes"
                onClick={() => executeSuggestion(pendingSuggestion)}
              >
                ✓ Confirmar
              </button>
              <button
                className="confirm-btn confirm-no"
                onClick={cancelSuggestion}
              >
                ✗ Cancelar
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ─── INPUT ─── */}
        <div className="input-area">
          {messages.length > 0 && (
            <button className="clear-btn" onClick={clearMessages} title="Limpiar chat">
              ⊗
            </button>
          )}
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              identity.handle
                ? `Dile algo al agente, @${identity.handle}...`
                : "Dile algo al agente..."
            }
            rows={1}
            disabled={loading || executingTx}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || loading || executingTx}
          >
            →
          </button>
        </div>
      </div>

      <Styles />
    </main>
  );
}

// ─── Componente de mensaje ────────────────────────────────────

function MessageBubble({ message }: { message: AgentMessage }) {
  const isAgent = message.role === "agent";

  // Renderizar markdown básico (bold con **)
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Convertir saltos de línea en <br>
      return part.split("\n").map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ));
    });
  };

  return (
    <div className={`msg ${isAgent ? "agent" : "user"}`}>
      <div className={`bubble ${isAgent ? "bubble-agent" : "bubble-user"}`}>
        <p className="bubble-text">{renderContent(message.content)}</p>
        {message.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${message.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-link"
          >
            Ver transacción →
          </a>
        )}
        {message.error && (
          <p className="bubble-error">{message.error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

function Styles() {
  return (
    <style jsx global>{`
      *, *::before, *::after { box-sizing: border-box; }

      body {
        background: #080b0f;
        color: #e2e8f0;
        font-family: 'IBM Plex Mono', 'Fira Code', monospace;
        margin: 0; overflow: hidden;
      }

      .dash {
        height: 100dvh;
        display: flex; flex-direction: column;
        position: relative;
      }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,255,170,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,170,0.025) 1px, transparent 1px);
        background-size: 40px 40px; pointer-events: none;
      }

      /* ─── Header ─── */
      .dash-header {
        position: relative; z-index: 10;
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(0,255,170,0.1);
        background: rgba(8,11,15,0.95);
        backdrop-filter: blur(12px);
        flex-shrink: 0;
      }

      .dash-logo {
        font-size: 1rem; font-weight: 700; letter-spacing: 0.1em;
      }

      .accent { color: #00ffaa; }

      .header-right {
        display: flex; align-items: center; gap: 0.75rem;
      }

      .balance-chip {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.35rem 0.75rem;
        border: 1px solid rgba(0,255,170,0.15); border-radius: 2px;
        background: rgba(0,255,170,0.04);
      }

      .balance-label { font-size: 0.65rem; color: #475569; }
      .balance-value { font-size: 0.78rem; color: #00ffaa; font-weight: 600; }

      .refresh-btn {
        background: none; border: none; color: #334155;
        font-size: 0.8rem; cursor: pointer; padding: 0;
        transition: color 0.2s;
      }

      .refresh-btn:hover { color: #00ffaa; }

      .identity-chip {
        padding: 0.35rem 0.75rem;
        border: 1px solid rgba(0,255,170,0.1); border-radius: 2px;
        font-size: 0.75rem;
      }

      .handle-display { color: #00ffaa; }
      .address-display { color: #475569; }

      .logout-btn {
        background: none; border: none; color: #334155;
        font-size: 0.9rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s;
      }

      .logout-btn:hover { color: #ef4444; }

      /* ─── Chat container ─── */
      .chat-container {
        position: relative; z-index: 1;
        flex: 1; display: flex; flex-direction: column;
        overflow: hidden; max-width: 700px;
        width: 100%; margin: 0 auto;
        padding: 0 1rem;
      }

      .messages {
        flex: 1; overflow-y: auto;
        padding: 1.5rem 0 1rem;
        display: flex; flex-direction: column; gap: 0.75rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(0,255,170,0.1) transparent;
      }

      /* ─── Welcome ─── */
      .welcome-msg {
        display: flex; flex-direction: column;
        align-items: center; text-align: center;
        gap: 0.75rem; padding: 2rem 1rem;
        margin: auto;
      }

      .welcome-icon {
        font-size: 2rem; color: #00ffaa;
        animation: pulse-icon 2s ease-in-out infinite;
      }

      @keyframes pulse-icon {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .welcome-title {
        font-size: 1.1rem; font-weight: 700; color: #f8fafc; margin: 0;
      }

      .welcome-sub {
        font-size: 0.82rem; color: #475569; margin: 0;
        max-width: 360px; line-height: 1.7;
      }

      .suggestions-row {
        display: flex; flex-direction: column; gap: 0.5rem;
        width: 100%; max-width: 400px; margin-top: 0.5rem;
      }

      .suggestion-chip {
        background: rgba(0,255,170,0.04);
        border: 1px solid rgba(0,255,170,0.12); border-radius: 2px;
        color: #64748b; font-family: inherit; font-size: 0.78rem;
        padding: 0.6rem 0.85rem; cursor: pointer;
        text-align: left; transition: all 0.2s;
      }

      .suggestion-chip:hover {
        border-color: rgba(0,255,170,0.3); color: #e2e8f0;
        background: rgba(0,255,170,0.07);
      }

      /* ─── Mensajes ─── */
      .msg {
        display: flex;
        max-width: 85%;
      }

      .msg.user { align-self: flex-end; }
      .msg.agent { align-self: flex-start; }

      .bubble {
        padding: 0.75rem 1rem; border-radius: 2px;
      }

      .bubble-user {
        background: rgba(0,255,170,0.1);
        border: 1px solid rgba(0,255,170,0.2);
      }

      .bubble-agent {
        background: rgba(8,11,15,0.8);
        border: 1px solid rgba(0,255,170,0.08);
      }

      .bubble-text {
        font-size: 0.85rem; line-height: 1.65; margin: 0; color: #e2e8f0;
      }

      .tx-link {
        display: inline-block; margin-top: 0.5rem;
        font-size: 0.72rem; color: #00ffaa; text-decoration: none;
      }

      .tx-link:hover { text-decoration: underline; }

      .bubble-error {
        font-size: 0.72rem; color: #ef4444; margin: 0.5rem 0 0;
      }

      /* ─── Typing indicator ─── */
      .typing {
        display: flex; align-items: center; gap: 4px;
        padding: 0.85rem 1rem;
      }

      .typing span {
        width: 6px; height: 6px; border-radius: 50%;
        background: #00ffaa; opacity: 0.4;
        animation: typing-dot 1.2s infinite;
      }

      .typing span:nth-child(2) { animation-delay: 0.2s; }
      .typing span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing-dot {
        0%, 60%, 100% { opacity: 0.4; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-4px); }
      }

      /* ─── Confirm bar ─── */
      .confirm-bar {
        display: flex; gap: 0.75rem;
        align-self: flex-start;
        padding: 0.25rem 0;
      }

      .confirm-btn {
        padding: 0.6rem 1.25rem; border-radius: 2px;
        font-family: inherit; font-size: 0.82rem;
        font-weight: 700; cursor: pointer;
        transition: all 0.2s; border: none;
        letter-spacing: 0.04em;
      }

      .confirm-yes {
        background: #00ffaa; color: #080b0f;
        box-shadow: 0 0 12px rgba(0,255,170,0.2);
      }

      .confirm-yes:hover { background: #00cc88; }

      .confirm-no {
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3) !important;
        color: #ef4444;
      }

      .confirm-no:hover { background: rgba(239,68,68,0.2); }

      /* ─── Input area ─── */
      .input-area {
        display: flex; align-items: flex-end; gap: 0.5rem;
        padding: 0.75rem 0 1rem;
        border-top: 1px solid rgba(0,255,170,0.07);
        flex-shrink: 0;
      }

      .clear-btn {
        background: none; border: none; color: #334155;
        font-size: 1rem; cursor: pointer; padding: 0.5rem;
        transition: color 0.2s; flex-shrink: 0;
        align-self: center;
      }

      .clear-btn:hover { color: #ef4444; }

      .chat-input {
        flex: 1; background: rgba(0,255,170,0.03);
        border: 1px solid rgba(0,255,170,0.12); border-radius: 2px;
        padding: 0.75rem 1rem; font-family: inherit;
        font-size: 0.85rem; color: #e2e8f0; outline: none;
        resize: none; line-height: 1.5;
        transition: border-color 0.2s;
        min-height: 44px; max-height: 140px;
        field-sizing: content;
      }

      .chat-input:focus { border-color: rgba(0,255,170,0.35); }
      .chat-input::placeholder { color: #334155; }
      .chat-input:disabled { opacity: 0.5; }

      .send-btn {
        background: #00ffaa; color: #080b0f;
        border: none; border-radius: 2px;
        width: 44px; height: 44px;
        font-size: 1.2rem; font-weight: 700;
        cursor: pointer; flex-shrink: 0;
        transition: all 0.2s;
        box-shadow: 0 0 12px rgba(0,255,170,0.2);
      }

      .send-btn:hover:not(:disabled) {
        background: #00cc88;
        box-shadow: 0 0 20px rgba(0,255,170,0.35);
      }

      .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      /* ─── Loading ─── */
      .loading-center {
        flex: 1; display: flex; align-items: center; justify-content: center;
      }

      .spinner {
        width: 40px; height: 40px;
        border: 3px solid rgba(0,255,170,0.15);
        border-top-color: #00ffaa; border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      @media (max-width: 640px) {
        .dash-header { padding: 0.75rem 1rem; }
        .balance-label { display: none; }
        .msg { max-width: 95%; }
      }
    `}</style>
  );
}

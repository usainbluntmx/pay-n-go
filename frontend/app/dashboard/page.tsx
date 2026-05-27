"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useAgent, AgentMessage } from "@/hooks/useAgent";
import { useHandle } from "@/hooks/useHandle";

export default function DashboardPage() {
  const { identity, balance, refreshBalance, logout, setHandle, isReady } = useIdentity();
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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showHandleModal, setShowHandleModal] = useState(false);
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

  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!identity) return;
    navigator.clipboard.writeText(identity.smartAccountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="header-top">
          <span className="dash-logo">PAY<span className="accent">&apos;N</span>GO</span>
          <div className="header-actions">
            <button className="contacts-btn" onClick={() => setShowContacts(true)} title="Contactos">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 15c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="identity-chip">
              {identity.handle
                ? <span className="handle-display">@{identity.handle}</span>
                : <button className="address-copy-btn" onClick={copyAddress} title="Copiar dirección">
                    {copied ? "✓ Copiado" : shortAddress}
                  </button>
              }
            </div>
            <button className="logout-btn" onClick={() => setConfirmLogout(true)} title="Cerrar sesión">⏻</button>
          </div>
        </div>
        <div className="balance-center">
          <p className="balance-label-big">Balance disponible</p>
          <div className="balance-amount-row">
            <span className="balance-big">
              {balance !== null ? balance : "—"}
            </span>
            <span className="balance-currency">USDC</span>
            <button className="refresh-btn-sm" onClick={refreshBalance} title="Actualizar balance">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5 9A6.5 6.5 0 1 1 9 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 2.5L12 5.5M9 2.5L12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ─── CONFIRM LOGOUT ─── */}
      {confirmLogout && (
        <div className="modal-overlay" onClick={() => setConfirmLogout(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">¿Cerrar sesión?</p>
            <p className="modal-desc">Asegúrate de tener guardadas tus 12 palabras de recuperación antes de salir.</p>
            <div className="modal-actions">
              <button className="modal-btn-danger" onClick={() => { setConfirmLogout(false); logout(); }}>
                Sí, cerrar sesión
              </button>
              <button className="modal-btn-ghost" onClick={() => setConfirmLogout(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTACTS DRAWER ─── */}
      {showContacts && (
        <ContactsDrawer onClose={() => setShowContacts(false)} />
      )}

      {/* ─── HANDLE MODAL ─── */}
      {showHandleModal && (
        <HandleModal
          identity={identity}
          onComplete={(handle) => {
            setHandle(handle);
            setShowHandleModal(false);
          }}
          onClose={() => setShowHandleModal(false)}
        />
      )}

      {/* ─── HANDLE BANNER ─── */}
      {!identity.handle && (
        <div className="handle-banner">
          <span className="handle-banner-text">
            ✦ Elige tu @handle para recibir pagos fácilmente
          </span>
          <button className="handle-banner-btn" onClick={() => setShowHandleModal(true)}>
            Elegir →
          </button>
        </div>
      )}

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
                  "¿A quién le puedo enviar USDC?",
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
            <button className="clear-btn" onClick={clearMessages} title="Volver al inicio">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="7" y1="7" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="15" y1="7" x2="7" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
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

// ─── Handle Modal ─────────────────────────────────────────────

function HandleModal({ identity, onComplete, onClose }: {
  identity: { smartAccountAddress: string };
  onComplete: (handle: string) => void;
  onClose: () => void;
}) {
  const { checkAvailability, registerHandle, loading, available } = useHandle();
  const [handleInput, setHandleInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handleInput || handleInput.length < 3) return;
    const timer = setTimeout(() => checkAvailability(handleInput), 500);
    return () => clearTimeout(timer);
  }, [handleInput, checkAvailability]);

  const handleStatus = !handleInput || handleInput.length < 3 ? null
    : loading ? "checking"
    : available === true ? "available"
    : available === false ? "taken"
    : null;

  const submit = async () => {
    if (!handleInput || handleStatus !== "available") return;
    setError(null);
    const ok = await registerHandle(handleInput, identity.smartAccountAddress);
    if (!ok) { setError("No se pudo registrar. Intenta de nuevo."); return; }
    onComplete(handleInput.toLowerCase());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">Elige tu @handle</p>
        <p className="modal-desc">
          Tu handle es tu identidad en Pay&apos;n Go. Otros te enviarán pagos escribiendo @tuhandle.
        </p>
        <div className="handle-input-wrap" style={{ width: "100%", marginBottom: "0.5rem" }}>
          <span style={{ color: "#00ffaa", fontWeight: 700, paddingRight: "0.25rem" }}>@</span>
          <input
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: "0.9rem", color: "#e2e8f0", padding: "0.75rem 0" }}
            value={handleInput}
            onChange={(e) => { setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(null); }}
            placeholder="tuhandle"
            maxLength={20}
            autoFocus
          />
          {handleStatus === "checking" && <span style={{ color: "#475569", fontSize: "0.85rem" }}>...</span>}
          {handleStatus === "available" && <span style={{ color: "#00ffaa", fontSize: "0.85rem", fontWeight: 700 }}>✓</span>}
          {handleStatus === "taken" && <span style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 700 }}>✗</span>}
        </div>
        {handleStatus === "available" && <p style={{ fontSize: "0.72rem", color: "#00ffaa", margin: "0 0 0.5rem", alignSelf: "flex-start" }}>@{handleInput} está disponible</p>}
        {handleStatus === "taken" && <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: "0 0 0.5rem", alignSelf: "flex-start" }}>@{handleInput} ya está en uso</p>}
        {error && <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: "0 0 0.5rem" }}>{error}</p>}
        <div className="modal-actions">
          <button className="modal-btn-danger" style={{ background: "#00ffaa", color: "#080b0f", borderColor: "transparent" }}
            onClick={submit}
            disabled={loading || handleStatus !== "available"}
          >
            {loading ? "Registrando..." : "Registrar →"}
          </button>
          <button className="modal-btn-ghost" onClick={onClose}>Omitir</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contacts Drawer ─────────────────────────────────────────

interface Contact {
  alias: string;
  handle: string;
  addedAt: number;
}

const CONTACTS_KEY = "payngo_contacts";

function loadContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]");
  } catch { return []; }
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function ContactsDrawer({ onClose }: { onClose: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alias, setAlias] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const addContact = () => {
    setError(null);
    const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
    const cleanAlias = alias.trim();
    if (!cleanAlias) { setError("El alias no puede estar vacío"); return; }
    if (!cleanHandle) { setError("El handle no puede estar vacío"); return; }
    if (contacts.some(c => c.handle === cleanHandle)) { setError("Este handle ya está en tus contactos"); return; }

    const updated = [...contacts, { alias: cleanAlias, handle: cleanHandle, addedAt: Date.now() }];
    setContacts(updated);
    saveContacts(updated);
    setAlias("");
    setHandle("");
  };

  const removeContact = (h: string) => {
    const updated = contacts.filter(c => c.handle !== h);
    setContacts(updated);
    saveContacts(updated);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Contactos</h2>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-add">
          <p className="drawer-section-label">Agregar contacto</p>
          <div className="drawer-field">
            <input
              className="drawer-input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Alias (ej. Carlos Vecino)"
            />
          </div>
          <div className="drawer-field handle-field">
            <span className="handle-at-sm">@</span>
            <input
              className="drawer-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, "").toLowerCase())}
              placeholder="handle"
            />
          </div>
          {error && <p className="drawer-error">{error}</p>}
          <button
            className="drawer-add-btn"
            onClick={addContact}
            disabled={!alias.trim() || !handle.trim()}
          >
            + Agregar
          </button>
        </div>

        <div className="drawer-list">
          {contacts.length === 0 ? (
            <p className="drawer-empty">Aún no tienes contactos guardados.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.handle} className="drawer-contact">
                <div className="contact-info">
                  <span className="contact-alias">{c.alias}</span>
                  <span className="contact-handle">@{c.handle}</span>
                </div>
                <button className="contact-remove" onClick={() => removeContact(c.handle)}>✕</button>
              </div>
            ))
          )}
        </div>
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
        display: flex; flex-direction: column;
        padding: 1rem 1.5rem 1.25rem;
        border-bottom: 1px solid rgba(0,255,170,0.1);
        background: rgba(8,11,15,0.97);
        backdrop-filter: blur(12px);
        flex-shrink: 0; gap: 0.75rem;
      }

      .header-top {
        display: flex; align-items: center;
        justify-content: space-between;
      }

      .dash-logo {
        font-size: 0.9rem; font-weight: 700; letter-spacing: 0.12em;
      }

      .accent { color: #00ffaa; }

      .header-actions {
        display: flex; align-items: center; gap: 0.6rem;
      }

      .balance-center {
        display: flex; flex-direction: column;
        align-items: center; gap: 0.2rem;
        padding: 0.5rem 0 0.25rem;
      }

      .balance-label-big {
        font-size: 0.7rem; color: #475569;
        letter-spacing: 0.1em; margin: 0;
        text-transform: uppercase;
      }

      .balance-amount-row {
        display: flex; align-items: baseline; gap: 0.4rem;
      }

      .balance-big {
        font-size: 2.75rem; font-weight: 700;
        color: #f8fafc; letter-spacing: -0.02em;
        line-height: 1;
      }

      .balance-currency {
        font-size: 1rem; color: #00ffaa;
        font-weight: 600; letter-spacing: 0.05em;
      }

      .refresh-btn-sm {
        background: none; border: none; color: #334155;
        font-size: 0.85rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s; line-height: 1;
      }

      .refresh-btn-sm:hover { color: #00ffaa; }

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
        padding: 0.75rem 0;
        padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid rgba(0,255,170,0.07);
        flex-shrink: 0;
      }

      .clear-btn {
        background: none; border: none; color: #475569;
        cursor: pointer; padding: 0.5rem;
        transition: color 0.2s; flex-shrink: 0;
        align-self: center; display: flex; align-items: center;
      }

      .clear-btn:hover { color: #ef4444; }

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

      /* ─── Modal logout ─── */
      .modal-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 1.5rem;
      }

      .modal-card {
        background: #0d1117;
        border: 1px solid rgba(0,255,170,0.2);
        border-radius: 4px; padding: 1.75rem;
        max-width: 360px; width: 100%;
        display: flex; flex-direction: column; gap: 1rem;
      }

      .modal-title {
        font-size: 1rem; font-weight: 700;
        color: #f8fafc; margin: 0;
      }

      .modal-desc {
        font-size: 0.8rem; color: #64748b;
        margin: 0; line-height: 1.6;
      }

      .modal-actions {
        display: flex; flex-direction: column; gap: 0.6rem;
      }

      .modal-btn-danger {
        width: 100%; padding: 0.75rem;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        color: #ef4444; font-family: inherit;
        font-size: 0.85rem; font-weight: 700;
        border-radius: 2px; cursor: pointer;
        transition: all 0.2s;
      }

      .modal-btn-danger:hover { background: rgba(239,68,68,0.2); }

      .modal-btn-ghost {
        width: 100%; padding: 0.75rem;
        background: none;
        border: 1px solid rgba(0,255,170,0.15);
        color: #475569; font-family: inherit;
        font-size: 0.85rem; border-radius: 2px;
        cursor: pointer; transition: all 0.2s;
      }

      .modal-btn-ghost:hover { color: #e2e8f0; }

      /* ─── Address copy button ─── */
      .address-copy-btn {
        background: none; border: none;
        color: #475569; font-family: inherit;
        font-size: 0.75rem; cursor: pointer;
        padding: 0; transition: color 0.2s;
      }

      .address-copy-btn:hover { color: #00ffaa; }

      /* ─── Handle banner ─── */
      .handle-banner {
        position: relative; z-index: 9;
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 0.6rem 1.5rem;
        background: rgba(0,255,170,0.07);
        border-bottom: 1px solid rgba(0,255,170,0.15);
        flex-shrink: 0;
      }

      .handle-banner-text {
        font-size: 0.75rem; color: #00ffaa; letter-spacing: 0.03em;
      }

      .handle-banner-btn {
        background: #00ffaa; color: #080b0f;
        border: none; border-radius: 2px;
        padding: 0.3rem 0.75rem; font-family: inherit;
        font-size: 0.72rem; font-weight: 700;
        cursor: pointer; transition: all 0.2s; flex-shrink: 0;
      }

      .handle-banner-btn:hover { background: #00cc88; }

      /* ─── Handle input wrap (shared) ─── */
      .handle-input-wrap {
        display: flex; align-items: center;
        border: 1px solid rgba(0,255,170,0.2); border-radius: 2px;
        background: rgba(0,255,170,0.03); padding: 0 0.85rem;
        transition: border-color 0.2s;
      }

      .handle-input-wrap:focus-within { border-color: rgba(0,255,170,0.5); }
      .contacts-btn {
        background: none; border: none; color: #475569;
        cursor: pointer; padding: 0.35rem; transition: color 0.2s;
        display: flex; align-items: center;
      }

      .contacts-btn:hover { color: #00ffaa; }

      /* ─── Refresh button sm ─── */
      .refresh-btn-sm {
        background: none; border: none; color: #475569;
        cursor: pointer; padding: 0.3rem;
        transition: color 0.2s; display: flex; align-items: center;
      }

      .refresh-btn-sm:hover { color: #00ffaa; }

      /* ─── Contacts drawer ─── */
      .drawer-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      }

      .drawer {
        position: absolute; top: 0; right: 0; bottom: 0;
        width: min(340px, 90vw);
        background: #0d1117;
        border-left: 1px solid rgba(0,255,170,0.15);
        display: flex; flex-direction: column;
        overflow: hidden;
        animation: slide-in 0.2s ease;
      }

      @keyframes slide-in {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }

      .drawer-header {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 1.25rem;
        padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
        border-bottom: 1px solid rgba(0,255,170,0.08);
        flex-shrink: 0;
      }

      .drawer-title {
        font-size: 0.9rem; font-weight: 700;
        color: #f8fafc; margin: 0; letter-spacing: 0.05em;
      }

      .drawer-close {
        background: none; border: none; color: #475569;
        font-size: 1rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s;
      }

      .drawer-close:hover { color: #e2e8f0; }

      .drawer-add {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid rgba(0,255,170,0.08);
        display: flex; flex-direction: column; gap: 0.6rem;
        flex-shrink: 0;
      }

      .drawer-section-label {
        font-size: 0.68rem; color: #475569;
        letter-spacing: 0.1em; text-transform: uppercase; margin: 0;
      }

      .handle-field {
        display: flex; align-items: center;
        border: 1px solid rgba(0,255,170,0.1); border-radius: 2px;
        background: rgba(0,255,170,0.03); padding: 0 0.75rem;
      }

      .handle-at-sm {
        color: #00ffaa; font-size: 0.88rem; font-weight: 700;
        flex-shrink: 0; padding-right: 0.2rem;
      }

      .drawer-input {
        width: 100%; background: rgba(0,255,170,0.03);
        border: 1px solid rgba(0,255,170,0.1); border-radius: 2px;
        padding: 0.6rem 0.75rem; font-family: inherit;
        font-size: 0.82rem; color: #e2e8f0; outline: none;
        transition: border-color 0.2s;
      }

      .handle-field .drawer-input {
        border: none; background: none; padding: 0.6rem 0;
      }

      .drawer-input:focus { border-color: rgba(0,255,170,0.35); }
      .drawer-input::placeholder { color: #334155; }

      .drawer-error { font-size: 0.72rem; color: #ef4444; margin: 0; }

      .drawer-add-btn {
        background: #00ffaa; color: #080b0f;
        border: none; border-radius: 2px; padding: 0.65rem;
        font-family: inherit; font-size: 0.82rem; font-weight: 700;
        cursor: pointer; transition: all 0.2s;
      }

      .drawer-add-btn:hover:not(:disabled) { background: #00cc88; }
      .drawer-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .drawer-list {
        flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem;
        display: flex; flex-direction: column; gap: 0.5rem;
      }

      .drawer-empty {
        font-size: 0.78rem; color: #334155;
        text-align: center; padding: 1.5rem 0; margin: 0;
      }

      .drawer-contact {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 0.7rem 0.85rem;
        border: 1px solid rgba(0,255,170,0.07); border-radius: 2px;
      }

      .contact-info { display: flex; flex-direction: column; gap: 0.15rem; }
      .contact-alias { font-size: 0.82rem; color: #e2e8f0; font-weight: 500; }
      .contact-handle { font-size: 0.7rem; color: #475569; }

      .contact-remove {
        background: none; border: none; color: #334155;
        font-size: 0.75rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s;
      }

      .contact-remove:hover { color: #ef4444; }

      @media (max-width: 640px) {
        .dash-header { padding: 0.85rem 1rem 1rem; }
        .balance-big { font-size: 2.25rem; }
        .msg { max-width: 95%; }
        .chat-container { padding: 0 0.75rem; }
        .suggestions-row { gap: 0.4rem; }
        .suggestion-chip { font-size: 0.75rem; padding: 0.5rem 0.75rem; }
      }
    `}</style>
  );
}

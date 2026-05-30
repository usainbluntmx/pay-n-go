"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useAgent, AgentMessage } from "@/hooks/useAgent";
import { useHandle } from "@/hooks/useHandle";
import { usePush } from "@/hooks/usePush";
import { useTransactions, Transaction } from "@/hooks/useTransactions";

export default function DashboardPage() {
  const { identity, balance, refreshBalance, logout, setHandle, isReady } = useIdentity();
  const { txs, loadTxs, saveTx } = useTransactions(identity?.smartAccountAddress);
  const {
    messages,
    loading,
    executingTx,
    pendingSuggestion,
    processInstruction,
    executeSuggestion,
    cancelSuggestion,
    clearMessages,
  } = useAgent(saveTx);

  const { status: pushStatus, subscribe: subscribePush } = usePush(
    identity?.smartAccountAddress
  );

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showHandleModal, setShowHandleModal] = useState(false);
  const [showTxs, setShowTxs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isReady && identity) loadTxs();
  }, [isReady, identity?.smartAccountAddress]);

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
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const copyAddress = () => {
    if (!identity) return;
    navigator.clipboard.writeText(identity.smartAccountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta entrada de voz. Usa Safari o Chrome.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as SpeechRecognitionResultList)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
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
            {(pushStatus === "idle" || pushStatus === "granted") && (
              <button
                className={"push-btn" + (pushStatus === "granted" ? " granted" : "")}
                onClick={pushStatus === "idle" ? subscribePush : undefined}
                title={pushStatus === "granted" ? "Notificaciones activas" : "Activar notificaciones"}
              >
                🔔
              </button>
            )}
            <button className="contacts-btn" onClick={() => { setShowTxs(true); loadTxs(); }} title="Transacciones">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="contacts-btn" onClick={() => setShowContacts(true)} title="Contactos">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 15c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="identity-chip">
              <button className="address-copy-btn" onClick={copyAddress} title="Copiar dirección de wallet">
                {identity.handle
                  ? (copied ? "✓ Copiado" : `@${identity.handle}`)
                  : (copied ? "✓ Copiado" : shortAddress)
                }
              </button>
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
              ↻
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

      {/* ─── TRANSACTIONS DRAWER ─── */}
      {showTxs && (
        <TxsDrawer txs={txs} onClose={() => setShowTxs(false)} />
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
                <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.5" />
                <line x1="7" y1="7" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="15" y1="7" x2="7" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe aquí..."
            rows={1}
            disabled={loading || executingTx}
          />
          <button
            className={"mic-btn" + (listening ? " listening" : "")}
            onClick={startVoice}
            title={listening ? "Detener" : "Hablar"}
            disabled={loading || executingTx}
          >
            {listening ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="4" y="4" width="10" height="10" rx="2" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="6.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 9c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
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

// ─── Transactions Drawer ──────────────────────────────────────

function TxsDrawer({ txs, onClose }: { txs: Transaction[]; onClose: () => void }) {
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Historial</h2>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-list">
          {txs.length === 0 ? (
            <p className="drawer-empty">Aún no tienes transacciones.</p>
          ) : (
            txs.map((tx) => (
              <div key={tx.id} className={"tx-item " + tx.type}>
                <div className="tx-icon">
                  {tx.type === "sent" ? "↑" : "↓"}
                </div>
                <div className="tx-info">
                  <div className="tx-top">
                    <span className="tx-who">
                      {tx.type === "sent" ? "Para " : "De "}
                      <strong>
                        {tx.counterpartHandle
                          ? `@${tx.counterpartHandle}`
                          : tx.counterpartAddress.slice(0, 6) + "..." + tx.counterpartAddress.slice(-4)
                        }
                      </strong>
                    </span>
                    <span className={"tx-amount " + tx.type}>
                      {tx.type === "sent" ? "-" : "+"}{tx.amount} USDC
                    </span>
                  </div>
                  {tx.memo && (
                    <p className="tx-memo">"{tx.memo}"</p>
                  )}
                  <p className="tx-date">{formatDate(tx.timestamp)}</p>
                </div>
              </div>
            ))
          )}
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
      @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400&display=swap');

      *, *::before, *::after { box-sizing: border-box; }

      body {
        background: #f5f0e8;
        color: #1a1a1a;
        font-family: 'Comic Neue', 'Comic Sans MS', cursive;
        margin: 0; overflow: hidden;
      }

      /* ─── Sketch paper background ─── */
      .dash {
        height: 100dvh;
        display: flex; flex-direction: column;
        position: relative;
        background: #f5f0e8;
      }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size: 28px 28px;
        pointer-events: none;
      }

      /* ─── Sketch border mixin (imperfect) ─── */
      .sketch-border {
        border: 2px solid #1a1a1a;
        border-radius: 2px 6px 3px 5px / 5px 3px 6px 2px;
        box-shadow: 2px 3px 0 #1a1a1a;
        position: relative;
      }

      /* ─── Header ─── */
      .dash-header {
        position: relative; z-index: 10;
        display: flex; flex-direction: column;
        padding: 1rem 1.5rem 1.25rem;
        padding-top: max(1.25rem, env(safe-area-inset-top));
        border-bottom: 2px solid #1a1a1a;
        background: #f5f0e8;
        flex-shrink: 0; gap: 0.75rem;
        animation: slide-down 0.4s ease;
      }

      @keyframes slide-down {
        from { opacity: 0; transform: translateY(-12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .header-top {
        display: flex; align-items: center;
        justify-content: space-between;
      }

      .accent { color: #1a1a1a; text-decoration: underline; text-underline-offset: 3px; }

      .dash-logo {
        font-size: 1.1rem; font-weight: 700; letter-spacing: 0.08em;
        font-family: 'Comic Neue', cursive;
        position: relative;
      }

      .dash-logo::after {
        content: '';
        position: absolute; bottom: -2px; left: 0; right: 0;
        height: 2px;
        background: #1a1a1a;
        transform: skewX(-3deg);
      }

      .header-actions {
        display: flex; align-items: center; gap: 0.6rem;
      }

      /* ─── Assets section ─── */
      .assets-section {
        display: flex; flex-direction: column; gap: 0.5rem;
        padding: 0.75rem 0 0.25rem;
        animation: fade-in 0.5s ease 0.1s both;
      }

      .assets-header {
        display: flex; align-items: center;
        justify-content: space-between; padding: 0 0.1rem;
      }

      .assets-label {
        font-size: 0.7rem; color: #555;
        letter-spacing: 0.12em; text-transform: uppercase;
        font-family: 'Comic Neue', cursive;
      }

      .asset-row {
        display: flex; align-items: center; gap: 0.85rem;
        padding: 0.7rem 0.85rem;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 6px / 6px 4px 8px 3px;
        background: #fff;
        box-shadow: 3px 3px 0 #1a1a1a;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        animation: draw-in 0.4s ease both;
      }

      @keyframes draw-in {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .asset-row:hover {
        transform: translate(-1px, -1px);
        box-shadow: 4px 4px 0 #1a1a1a;
      }

      .asset-icon {
        width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; overflow: hidden;
        border: 2px solid #1a1a1a;
      }

      .usdc-icon { background: #2775CA; }

      .asset-info {
        display: flex; flex-direction: column; gap: 0.15rem; flex: 1;
      }

      .asset-name {
        font-size: 0.9rem; font-weight: 700; color: #1a1a1a;
        font-family: 'Comic Neue', cursive;
      }

      .asset-fullname { font-size: 0.68rem; color: #666; }

      .asset-balance {
        display: flex; flex-direction: column;
        align-items: flex-end; gap: 0.1rem;
      }

      .asset-amount {
        font-size: 1rem; font-weight: 700; color: #1a1a1a;
      }

      .asset-symbol { font-size: 0.65rem; color: #666; }

      .refresh-btn-sm {
        background: none; border: none; color: #555;
        font-size: 1.1rem; cursor: pointer; padding: 0.25rem;
        transition: transform 0.3s ease; display: flex; align-items: center;
        font-family: 'Comic Neue', cursive;
      }

      .refresh-btn-sm:hover { transform: rotate(180deg); color: #1a1a1a; }

      /* ─── Handle banner ─── */
      .handle-banner {
        position: relative; z-index: 9;
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 0.6rem 1.5rem;
        background: #fffde7;
        border-bottom: 2px solid #1a1a1a;
        flex-shrink: 0;
        animation: fade-in 0.3s ease;
      }

      .handle-banner-text {
        font-size: 0.78rem; color: #1a1a1a;
        font-family: 'Comic Neue', cursive;
      }

      .handle-banner-btn {
        background: #1a1a1a; color: #f5f0e8;
        border: none;
        border-radius: 2px 5px 3px 4px / 4px 3px 5px 2px;
        padding: 0.3rem 0.85rem; font-family: 'Comic Neue', cursive;
        font-size: 0.75rem; font-weight: 700;
        cursor: pointer; transition: transform 0.15s ease;
      }

      .handle-banner-btn:hover { transform: translate(-1px, -1px); }

      /* ─── Identity chip ─── */
      .identity-chip {
        padding: 0.3rem 0.65rem;
        border: 2px solid #1a1a1a;
        border-radius: 2px 5px 3px 4px / 4px 3px 5px 2px;
        background: #fff;
        font-size: 0.75rem;
      }

      .address-copy-btn {
        background: none; border: none;
        color: #1a1a1a; font-family: 'Comic Neue', cursive;
        font-size: 0.75rem; font-weight: 700; cursor: pointer;
        padding: 0; transition: all 0.15s ease;
      }

      .address-copy-btn:hover { text-decoration: underline; }

      .logout-btn {
        background: none; border: none; color: #555;
        font-size: 0.95rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s, transform 0.2s;
        font-family: 'Comic Neue', cursive;
      }

      .logout-btn:hover { color: #c0392b; transform: scale(1.15); }

      /* ─── Push button ─── */
      .push-btn {
        background: none; border: none; font-size: 1rem;
        cursor: pointer; padding: 0.35rem; opacity: 0.45;
        transition: opacity 0.2s, transform 0.2s; line-height: 1;
      }

      .push-btn:hover { opacity: 1; transform: scale(1.1); }
      .push-btn.granted { opacity: 1; cursor: default; }

      /* ─── Contacts button ─── */
      .contacts-btn {
        background: none; border: none; color: #555;
        cursor: pointer; padding: 0.35rem; transition: color 0.2s, transform 0.2s;
        display: flex; align-items: center;
      }

      .contacts-btn:hover { color: #1a1a1a; transform: scale(1.1); }

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
        display: flex; flex-direction: column; gap: 0.85rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(0,0,0,0.15) transparent;
      }

      /* ─── Welcome ─── */
      .welcome-msg {
        display: flex; flex-direction: column;
        align-items: center; text-align: center;
        gap: 0.75rem; padding: 2rem 1rem;
        margin: auto;
        animation: fade-in 0.6s ease;
      }

      @keyframes fade-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .welcome-icon {
        font-size: 2rem; color: #1a1a1a;
        animation: wobble 3s ease-in-out infinite;
      }

      @keyframes wobble {
        0%, 100% { transform: rotate(-3deg); }
        50% { transform: rotate(3deg); }
      }

      .welcome-title {
        font-size: 1.15rem; font-weight: 700; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive;
        position: relative; display: inline-block;
      }

      .welcome-title::after {
        content: '';
        position: absolute; bottom: -3px; left: 5%; right: 5%;
        height: 2px; background: #1a1a1a;
        transform: skewX(-2deg);
      }

      .welcome-sub {
        font-size: 0.83rem; color: #555; margin: 0;
        max-width: 360px; line-height: 1.7;
        font-family: 'Comic Neue', cursive;
      }

      .suggestions-row {
        display: flex; flex-direction: column; gap: 0.5rem;
        width: 100%; max-width: 400px; margin-top: 0.5rem;
      }

      .suggestion-chip {
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 2px 6px 3px 5px / 5px 3px 6px 2px;
        box-shadow: 2px 2px 0 #1a1a1a;
        color: #333; font-family: 'Comic Neue', cursive; font-size: 0.8rem;
        padding: 0.65rem 0.9rem; cursor: pointer;
        text-align: left;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        animation: draw-in 0.4s ease both;
      }

      .suggestion-chip:nth-child(2) { animation-delay: 0.08s; }
      .suggestion-chip:nth-child(3) { animation-delay: 0.16s; }

      .suggestion-chip:hover {
        transform: translate(-2px, -2px);
        box-shadow: 4px 4px 0 #1a1a1a;
        background: #fffde7;
      }

      /* ─── Mensajes ─── */
      .msg {
        display: flex;
        max-width: 85%;
        animation: msg-appear 0.3s ease;
      }

      @keyframes msg-appear {
        from { opacity: 0; transform: translateY(6px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .msg.user { align-self: flex-end; }
      .msg.agent { align-self: flex-start; }

      .bubble {
        padding: 0.75rem 1rem;
        border: 2px solid #1a1a1a;
      }

      .bubble-user {
        background: #fff;
        border-radius: 6px 2px 5px 3px / 3px 5px 2px 6px;
        box-shadow: 3px 3px 0 #1a1a1a;
      }

      .bubble-agent {
        background: #f5f0e8;
        border-radius: 2px 6px 3px 5px / 5px 3px 6px 2px;
        box-shadow: 3px 3px 0 rgba(0,0,0,0.12);
        border-color: rgba(0,0,0,0.3);
      }

      .bubble-text {
        font-size: 0.87rem; line-height: 1.65; margin: 0; color: #1a1a1a;
        font-family: 'Comic Neue', cursive;
      }

      .tx-link {
        display: inline-block; margin-top: 0.5rem;
        font-size: 0.75rem; color: #2563eb; text-decoration: underline;
        font-family: 'Comic Neue', cursive;
      }

      .bubble-error { font-size: 0.72rem; color: #c0392b; margin: 0.5rem 0 0; }

      /* ─── Typing indicator ─── */
      .typing {
        display: flex; align-items: center; gap: 5px;
        padding: 0.85rem 1rem;
      }

      .typing span {
        width: 7px; height: 7px; border-radius: 50%;
        background: #555; opacity: 0.5;
        animation: typing-dot 1.2s infinite;
      }

      .typing span:nth-child(2) { animation-delay: 0.2s; }
      .typing span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing-dot {
        0%, 60%, 100% { opacity: 0.4; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-5px); }
      }

      /* ─── Confirm bar ─── */
      .confirm-bar {
        display: flex; gap: 0.75rem;
        align-self: flex-start; padding: 0.25rem 0;
        animation: msg-appear 0.3s ease;
      }

      .confirm-btn {
        padding: 0.6rem 1.25rem;
        font-family: 'Comic Neue', cursive; font-size: 0.85rem;
        font-weight: 700; cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        border: 2px solid #1a1a1a;
        letter-spacing: 0.03em;
      }

      .confirm-yes {
        background: #1a1a1a; color: #f5f0e8;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 3px 3px 0 rgba(0,0,0,0.3);
      }

      .confirm-yes:hover {
        transform: translate(-2px, -2px);
        box-shadow: 5px 5px 0 rgba(0,0,0,0.3);
      }

      .confirm-no {
        background: #fff; color: #c0392b;
        border-color: #c0392b;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 3px 3px 0 rgba(192,57,43,0.2);
      }

      .confirm-no:hover {
        transform: translate(-2px, -2px);
        box-shadow: 5px 5px 0 rgba(192,57,43,0.3);
        background: #fff5f5;
      }

      /* ─── Input area ─── */
      .input-area {
        display: flex; align-items: flex-end; gap: 0.5rem;
        padding: 0.75rem 0;
        padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
        border-top: 2px solid #1a1a1a;
        flex-shrink: 0;
      }

      .clear-btn {
        background: none; border: none; color: #888;
        cursor: pointer; padding: 0.5rem;
        transition: color 0.2s, transform 0.2s; flex-shrink: 0;
        align-self: center; display: flex; align-items: center;
      }

      .clear-btn:hover { color: #c0392b; transform: rotate(90deg); }

      .chat-input {
        flex: 1; background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        padding: 0.75rem 1rem; font-family: 'Comic Neue', cursive;
        font-size: 0.88rem; color: #1a1a1a; outline: none;
        resize: none; line-height: 1.5;
        transition: box-shadow 0.2s;
        height: 48px; min-height: 48px; max-height: 140px;
        field-sizing: content;
        box-shadow: 2px 2px 0 #1a1a1a;
      }

      .chat-input:focus {
        box-shadow: 4px 4px 0 #1a1a1a;
      }

      .chat-input::placeholder { color: #999; }
      .chat-input:disabled { opacity: 0.5; }

      .send-btn {
        background: #1a1a1a; color: #f5f0e8;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        width: 44px; height: 44px;
        font-size: 1.1rem; font-weight: 700;
        cursor: pointer; flex-shrink: 0;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        box-shadow: 3px 3px 0 rgba(0,0,0,0.25);
        font-family: 'Comic Neue', cursive;
      }

      .send-btn:hover:not(:disabled) {
        transform: translate(-2px, -2px);
        box-shadow: 5px 5px 0 rgba(0,0,0,0.3);
      }

      .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      /* ─── Mic button ─── */
      .mic-btn {
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        width: 44px; height: 44px;
        color: #555; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        box-shadow: 2px 2px 0 #1a1a1a;
      }

      .mic-btn:hover:not(:disabled) {
        color: #1a1a1a;
        transform: translate(-1px, -1px);
        box-shadow: 3px 3px 0 #1a1a1a;
      }

      .mic-btn.listening {
        color: #c0392b;
        border-color: #c0392b;
        box-shadow: 2px 2px 0 #c0392b;
        animation: mic-pulse 1s ease-in-out infinite;
      }

      .mic-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      @keyframes mic-pulse {
        0%, 100% { box-shadow: 2px 2px 0 #c0392b; }
        50% { box-shadow: 4px 4px 0 #c0392b; transform: translate(-1px, -1px); }
      }

      /* ─── Loading ─── */
      .loading-center {
        flex: 1; display: flex; align-items: center; justify-content: center;
      }

      .spinner {
        width: 40px; height: 40px;
        border: 3px solid rgba(0,0,0,0.1);
        border-top-color: #1a1a1a; border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      /* ─── Modals ─── */
      .modal-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(245,240,232,0.85); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        padding: 1.5rem;
        animation: fade-in 0.2s ease;
      }

      .modal-card {
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 4px 10px 5px 8px / 8px 5px 10px 4px;
        box-shadow: 6px 6px 0 #1a1a1a;
        padding: 1.75rem;
        max-width: 360px; width: 100%;
        display: flex; flex-direction: column; gap: 1rem;
        animation: draw-in 0.3s ease;
      }

      .modal-title {
        font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .modal-desc {
        font-size: 0.82rem; color: #555; margin: 0; line-height: 1.6;
        font-family: 'Comic Neue', cursive;
      }

      .modal-actions { display: flex; flex-direction: column; gap: 0.6rem; }

      .modal-btn-danger {
        width: 100%; padding: 0.75rem;
        background: #c0392b; color: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 3px 3px 0 #1a1a1a;
        font-family: 'Comic Neue', cursive; font-size: 0.87rem; font-weight: 700;
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
      }

      .modal-btn-danger:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 #1a1a1a; }

      .modal-btn-ghost {
        width: 100%; padding: 0.75rem;
        background: #fff; color: #555;
        border: 2px solid #888;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 2px 2px 0 #888;
        font-family: 'Comic Neue', cursive; font-size: 0.87rem;
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
      }

      .modal-btn-ghost:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #888; }

      /* ─── Handle input wrap ─── */
      .handle-input-wrap {
        display: flex; align-items: center;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fff; padding: 0 0.85rem;
        box-shadow: 2px 2px 0 #1a1a1a;
        transition: box-shadow 0.2s;
      }

      .handle-input-wrap:focus-within { box-shadow: 4px 4px 0 #1a1a1a; }

      /* ─── Address copy button ─── */
      .address-copy-btn:hover { text-decoration: underline; }

      /* ─── Contacts drawer ─── */
      .drawer-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(245,240,232,0.7); backdrop-filter: blur(3px);
        animation: fade-in 0.2s ease;
      }

      .drawer {
        position: absolute; top: 0; right: 0; bottom: 0;
        width: min(340px, 90vw);
        background: #f5f0e8;
        border-left: 2px solid #1a1a1a;
        box-shadow: -6px 0 0 rgba(0,0,0,0.08);
        display: flex; flex-direction: column;
        overflow: hidden;
        animation: drawer-in 0.25s ease;
      }

      @keyframes drawer-in {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }

      .drawer-header {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 1.25rem;
        padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
        border-bottom: 2px solid #1a1a1a;
        flex-shrink: 0;
      }

      .drawer-title {
        font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .drawer-close {
        background: none; border: none; color: #555;
        font-size: 1rem; cursor: pointer; padding: 0.25rem;
        transition: transform 0.2s; font-family: 'Comic Neue', cursive;
      }

      .drawer-close:hover { transform: rotate(90deg); color: #1a1a1a; }

      .drawer-add {
        padding: 1rem 1.25rem;
        border-bottom: 2px solid #1a1a1a;
        display: flex; flex-direction: column; gap: 0.6rem;
        flex-shrink: 0;
      }

      .drawer-section-label {
        font-size: 0.7rem; color: #666;
        letter-spacing: 0.1em; text-transform: uppercase; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .handle-field {
        display: flex; align-items: center;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fff; padding: 0 0.75rem;
        box-shadow: 2px 2px 0 #1a1a1a;
      }

      .handle-at-sm {
        color: #1a1a1a; font-size: 0.88rem; font-weight: 700;
        flex-shrink: 0; padding-right: 0.2rem;
        font-family: 'Comic Neue', cursive;
      }

      .drawer-input {
        width: 100%; background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        padding: 0.6rem 0.75rem; font-family: 'Comic Neue', cursive;
        font-size: 0.84rem; color: #1a1a1a; outline: none;
        box-shadow: 2px 2px 0 #1a1a1a;
        transition: box-shadow 0.2s;
      }

      .handle-field .drawer-input {
        border: none; background: none; padding: 0.6rem 0;
        box-shadow: none;
      }

      .drawer-input:focus { box-shadow: 4px 4px 0 #1a1a1a; }
      .drawer-input::placeholder { color: #aaa; }

      .drawer-error { font-size: 0.72rem; color: #c0392b; margin: 0; font-family: 'Comic Neue', cursive; }

      .drawer-add-btn {
        background: #1a1a1a; color: #f5f0e8;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 3px 3px 0 rgba(0,0,0,0.2);
        padding: 0.65rem; font-family: 'Comic Neue', cursive;
        font-size: 0.85rem; font-weight: 700;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }

      .drawer-add-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 rgba(0,0,0,0.25); }
      .drawer-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .drawer-list {
        flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem;
        display: flex; flex-direction: column; gap: 0.5rem;
      }

      .drawer-empty {
        font-size: 0.8rem; color: #888;
        text-align: center; padding: 1.5rem 0; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .drawer-contact {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 0.7rem 0.85rem;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fff;
        box-shadow: 2px 2px 0 #1a1a1a;
        animation: draw-in 0.3s ease;
        transition: transform 0.15s, box-shadow 0.15s;
      }

      .drawer-contact:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #1a1a1a; }

      .contact-info { display: flex; flex-direction: column; gap: 0.15rem; }
      .contact-alias { font-size: 0.84rem; color: #1a1a1a; font-weight: 700; font-family: 'Comic Neue', cursive; }
      .contact-handle { font-size: 0.7rem; color: #666; font-family: 'Comic Neue', cursive; }

      .contact-remove {
        background: none; border: none; color: #aaa;
        font-size: 0.8rem; cursor: pointer; padding: 0.25rem;
        transition: color 0.2s, transform 0.2s;
      }

      .contact-remove:hover { color: #c0392b; transform: scale(1.2); }

      /* ─── Transaction items ─── */
      .tx-item {
        display: flex; align-items: flex-start; gap: 0.75rem;
        padding: 0.75rem 0.85rem;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fff;
        box-shadow: 2px 2px 0 #1a1a1a;
        animation: draw-in 0.3s ease;
        transition: transform 0.15s, box-shadow 0.15s;
      }

      .tx-item:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #1a1a1a; }

      .tx-icon {
        width: 32px; height: 32px; flex-shrink: 0;
        border: 2px solid #1a1a1a; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.9rem; font-weight: 700;
        box-shadow: 2px 2px 0 #1a1a1a;
      }

      .tx-item.sent .tx-icon { background: #fff5f5; color: #c0392b; }
      .tx-item.received .tx-icon { background: #f0fff4; color: #1a7a1a; }

      .tx-info { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }

      .tx-top {
        display: flex; align-items: baseline;
        justify-content: space-between; gap: 0.5rem;
      }

      .tx-who {
        font-size: 0.82rem; color: #1a1a1a;
        font-family: 'Comic Neue', cursive;
      }

      .tx-amount {
        font-size: 0.88rem; font-weight: 700;
        font-family: 'Comic Neue', cursive; white-space: nowrap;
      }

      .tx-amount.sent { color: #c0392b; }
      .tx-amount.received { color: #1a7a1a; }

      .tx-memo {
        font-size: 0.74rem; color: #666; margin: 0;
        font-family: 'Comic Neue', cursive;
        font-style: italic;
      }

      .tx-date {
        font-size: 0.68rem; color: #aaa; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      @media (max-width: 640px) {
        .dash-header { padding: 0.85rem 1rem 1rem; padding-top: max(0.85rem, env(safe-area-inset-top)); }
        .msg { max-width: 95%; }
        .chat-container { padding: 0 0.75rem; }
        .suggestions-row { gap: 0.4rem; }
        .suggestion-chip { font-size: 0.76rem; padding: 0.5rem 0.75rem; }
      }
    `}</style>
  );
}


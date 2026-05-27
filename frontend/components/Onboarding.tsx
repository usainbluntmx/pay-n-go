"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useHandle } from "@/hooks/useHandle";

type OnboardingStep = "welcome" | "creating" | "backup" | "handle" | "recover";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { createIdentity, recoverIdentity, setHandle: saveHandle, identity, loading, error, step } = useIdentity();
  const { checkAvailability, registerHandle, loading: handleLoading, available } = useHandle();

  const [screen, setScreen] = useState<OnboardingStep>("welcome");
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const [handleInput, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleChecking, setHandleChecking] = useState(false);

  const [recoverInput, setRecoverInput] = useState("");
  const [recoverError, setRecoverError] = useState<string | null>(null);

  const stepLabel: Record<string, string> = {
    generating: "Generando tus claves...",
    creating_account: "Creando tu Smart Account...",
    recovering: "Recuperando cuenta...",
  };

  // Debounce para verificar handle mientras escribe
  useEffect(() => {
    if (!handleInput || handleInput.length < 3) return;
    const timer = setTimeout(() => {
      checkAvailability(handleInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [handleInput, checkAvailability]);

  const handleCreate = async () => {
    setScreen("creating");
    try {
      const id = await createIdentity();
      setMnemonic(id.mnemonic.split(" "));
      setScreen("backup");
    } catch {
      setScreen("welcome");
    }
  };

  const handleConfirmBackup = () => {
    if (!confirmed) return;
    setScreen("handle");
  };

  const handleRegister = async () => {
    if (!handleInput || !identity) return;
    setHandleError(null);

    if (!available) {
      setHandleError("Este handle no está disponible");
      return;
    }

    const ok = await registerHandle(handleInput, identity.smartAccountAddress);
    if (!ok) {
      setHandleError("No se pudo registrar el handle");
      return;
    }

    saveHandle(handleInput.toLowerCase());
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleRecover = async () => {
    setRecoverError(null);
    const words = recoverInput.trim().toLowerCase();
    try {
      await recoverIdentity(words);
      // Después de recuperar, ofrecer registrar handle
      setScreen("handle");
    } catch (e) {
      setRecoverError(e instanceof Error ? e.message : "Error al recuperar");
    }
  };

  const getHandleStatus = () => {
    if (!handleInput || handleInput.length < 3) return null;
    if (handleLoading || handleChecking) return "checking";
    if (available === true) return "available";
    if (available === false) return "taken";
    return null;
  };

  const handleStatus = getHandleStatus();

  return (
    <main className="onboarding">
      <div className="grid-bg" />

      {/* ─── WELCOME ─── */}
      {screen === "welcome" && (
        <div className="ob-card">
          <div className="ob-logo">
            PAY<span className="accent">&apos;N</span>GO
          </div>
          <p className="ob-tagline">Envía USDC tan fácil como un mensaje.</p>
          <p className="ob-desc">
            Sin wallet. Sin crypto. Sin complicaciones.
            Solo tú y tu dinero.
          </p>
          <button className="ob-btn-primary" onClick={handleCreate} disabled={loading}>
            Crear mi cuenta →
          </button>
          <button className="ob-btn-ghost" onClick={() => setScreen("recover")}>
            Ya tengo cuenta — Recuperar
          </button>
        </div>
      )}

      {/* ─── CREATING ─── */}
      {screen === "creating" && (
        <div className="ob-card">
          <div className="ob-spinner">
            <div className="spinner-ring" />
          </div>
          <p className="ob-creating-label">
            {stepLabel[step] || "Preparando tu cuenta..."}
          </p>
          <p className="ob-creating-sub">Esto toma unos segundos</p>
          {error && <p className="ob-error">{error}</p>}
        </div>
      )}

      {/* ─── BACKUP ─── */}
      {screen === "backup" && (
        <div className="ob-card ob-card-wide">
          <h2 className="ob-title">Guarda tu código de recuperación</h2>
          <p className="ob-desc">
            Estas 12 palabras son la única forma de recuperar tu cuenta
            si pierdes acceso. Guárdalas en un lugar seguro — puede ser
            un papel, una nota o cualquier lugar offline.
          </p>
          <div className="mnemonic-grid">
            {mnemonic.map((word, i) => (
              <div key={i} className="mnemonic-word">
                <span className="word-num">{i + 1}</span>
                <span className="word-text">{word}</span>
              </div>
            ))}
          </div>
          <div className="ob-warning">
            ⚠ No compartas estas palabras con nadie. Quien las tenga
            puede acceder a tu cuenta y tus fondos.
          </div>
          <label className="ob-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>Ya guardé mis 12 palabras en un lugar seguro</span>
          </label>
          <button
            className="ob-btn-primary"
            onClick={handleConfirmBackup}
            disabled={!confirmed}
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ─── HANDLE ─── */}
      {screen === "handle" && (
        <div className="ob-card">
          <h2 className="ob-title">Elige tu @handle</h2>
          <p className="ob-desc">
            Tu handle es tu identidad en Pay&apos;n Go. Otros usuarios
            te podrán enviar pagos escribiendo <strong>@tuhandle</strong>.
          </p>

          <div className="handle-input-wrap">
            <span className="handle-at">@</span>
            <input
              className="handle-input"
              value={handleInput}
              onChange={(e) => {
                setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                setHandleError(null);
              }}
              placeholder="tuhandle"
              maxLength={20}
              autoFocus
            />
            {handleStatus === "checking" && (
              <span className="handle-status checking">...</span>
            )}
            {handleStatus === "available" && (
              <span className="handle-status ok">✓</span>
            )}
            {handleStatus === "taken" && (
              <span className="handle-status taken">✗</span>
            )}
          </div>

          {handleStatus === "available" && (
            <p className="handle-msg ok">@{handleInput} está disponible</p>
          )}
          {handleStatus === "taken" && (
            <p className="handle-msg taken">@{handleInput} ya está en uso</p>
          )}
          {handleError && <p className="ob-error">{handleError}</p>}

          <p className="ob-hint">
            Solo letras minúsculas, números y _ · 3-20 caracteres
          </p>

          <button
            className="ob-btn-primary"
            onClick={handleRegister}
            disabled={handleLoading || !handleInput || handleStatus !== "available"}
          >
            {handleLoading ? "Registrando..." : "Registrar @" + (handleInput || "handle") + " →"}
          </button>
          <button className="ob-btn-ghost" onClick={handleSkip}>
            Omitir por ahora
          </button>
        </div>
      )}

      {/* ─── RECOVER ─── */}
      {screen === "recover" && (
        <div className="ob-card">
          <h2 className="ob-title">Recuperar cuenta</h2>
          <p className="ob-desc">
            Ingresa tus 12 palabras de recuperación separadas por espacios.
          </p>
          <div className="field">
            <textarea
              value={recoverInput}
              onChange={(e) => setRecoverInput(e.target.value)}
              placeholder="palabra1 palabra2 palabra3 ..."
              rows={4}
              className="ob-textarea"
            />
          </div>
          {recoverError && <p className="ob-error">{recoverError}</p>}
          <button
            className="ob-btn-primary"
            onClick={handleRecover}
            disabled={loading || recoverInput.trim().split(" ").length < 12}
          >
            {loading ? (stepLabel[step] || "Recuperando...") : "Recuperar cuenta →"}
          </button>
          <button className="ob-btn-ghost" onClick={() => setScreen("welcome")}>
            ← Volver
          </button>
        </div>
      )}

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

      .onboarding {
        min-height: 100vh;
        display: flex; align-items: center; justify-content: center;
        position: relative; padding: 2rem 1rem;
      }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,255,170,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,170,0.03) 1px, transparent 1px);
        background-size: 40px 40px; pointer-events: none;
      }

      .ob-card {
        position: relative; z-index: 1;
        width: 100%; max-width: 420px;
        border: 1px solid rgba(0,255,170,0.15);
        background: rgba(8,11,15,0.95);
        border-radius: 4px; padding: 2.5rem 2rem;
        display: flex; flex-direction: column;
        align-items: center; gap: 1.25rem;
        text-align: center;
      }

      .ob-card-wide { max-width: 560px; }

      .ob-logo {
        font-size: 2rem; font-weight: 700; letter-spacing: 0.1em;
      }

      .accent { color: #00ffaa; }

      .ob-tagline {
        font-size: 1rem; color: #f8fafc; margin: 0; font-weight: 500;
      }

      .ob-desc {
        font-size: 0.82rem; color: #64748b; margin: 0; line-height: 1.7;
      }

      .ob-title {
        font-size: 0.95rem; font-weight: 700; color: #f8fafc;
        margin: 0; letter-spacing: 0.04em;
      }

      .ob-hint {
        font-size: 0.72rem; color: #334155; margin: -0.5rem 0 0;
      }

      .ob-btn-primary {
        width: 100%; background: #00ffaa; color: #080b0f;
        border: none; border-radius: 2px; padding: 0.85rem 1.5rem;
        font-family: inherit; font-size: 0.88rem; font-weight: 700;
        letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s;
        box-shadow: 0 0 16px rgba(0,255,170,0.2);
      }

      .ob-btn-primary:hover:not(:disabled) {
        background: #00cc88; box-shadow: 0 0 24px rgba(0,255,170,0.4);
      }

      .ob-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

      .ob-btn-ghost {
        width: 100%; background: none;
        border: 1px solid rgba(0,255,170,0.15); color: #475569;
        font-family: inherit; font-size: 0.8rem; padding: 0.7rem;
        border-radius: 2px; cursor: pointer; transition: all 0.2s;
      }

      .ob-btn-ghost:hover { color: #00ffaa; border-color: rgba(0,255,170,0.4); }

      .ob-spinner {
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;
      }

      .spinner-ring {
        width: 48px; height: 48px;
        border: 3px solid rgba(0,255,170,0.15);
        border-top-color: #00ffaa; border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      .ob-creating-label {
        font-size: 0.88rem; color: #00ffaa; margin: 0; letter-spacing: 0.04em;
      }

      .ob-creating-sub { font-size: 0.75rem; color: #334155; margin: 0; }

      .mnemonic-grid {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem; width: 100%;
      }

      .mnemonic-word {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid rgba(0,255,170,0.1); border-radius: 2px;
        background: rgba(0,255,170,0.03);
      }

      .word-num { font-size: 0.65rem; color: #334155; width: 16px; text-align: right; flex-shrink: 0; }
      .word-text { font-size: 0.82rem; color: #e2e8f0; font-weight: 500; }

      .ob-warning {
        width: 100%; font-size: 0.72rem; color: #f59e0b;
        padding: 0.75rem; border: 1px solid rgba(245,158,11,0.2);
        border-radius: 2px; background: rgba(245,158,11,0.05);
        text-align: left; line-height: 1.5;
      }

      .ob-checkbox {
        display: flex; align-items: flex-start; gap: 0.75rem;
        cursor: pointer; font-size: 0.8rem; color: #94a3b8;
        text-align: left; line-height: 1.5;
      }

      .ob-checkbox input { margin-top: 2px; accent-color: #00ffaa; flex-shrink: 0; }

      /* ─── Handle input ─── */
      .handle-input-wrap {
        width: 100%; display: flex; align-items: center;
        border: 1px solid rgba(0,255,170,0.2); border-radius: 2px;
        background: rgba(0,255,170,0.03); padding: 0 0.85rem;
        transition: border-color 0.2s;
      }

      .handle-input-wrap:focus-within { border-color: rgba(0,255,170,0.5); }

      .handle-at {
        color: #00ffaa; font-size: 1rem; font-weight: 700;
        padding-right: 0.25rem; flex-shrink: 0;
      }

      .handle-input {
        flex: 1; background: none; border: none; outline: none;
        font-family: inherit; font-size: 0.9rem; color: #e2e8f0;
        padding: 0.75rem 0;
      }

      .handle-input::placeholder { color: #334155; }

      .handle-status {
        font-size: 0.85rem; font-weight: 700; flex-shrink: 0;
      }

      .handle-status.ok { color: #00ffaa; }
      .handle-status.taken { color: #ef4444; }
      .handle-status.checking { color: #475569; }

      .handle-msg {
        font-size: 0.75rem; margin: -0.5rem 0 0; width: 100%; text-align: left;
      }

      .handle-msg.ok { color: #00ffaa; }
      .handle-msg.taken { color: #ef4444; }

      /* ─── Recover ─── */
      .ob-textarea {
        width: 100%; box-sizing: border-box;
        background: rgba(0,255,170,0.03);
        border: 1px solid rgba(0,255,170,0.1); border-radius: 2px;
        padding: 0.75rem; font-family: inherit; font-size: 0.82rem;
        color: #e2e8f0; outline: none; resize: vertical; line-height: 1.7;
      }

      .ob-textarea:focus { border-color: rgba(0,255,170,0.4); }
      .ob-textarea::placeholder { color: #334155; }

      .ob-error { font-size: 0.78rem; color: #ef4444; margin: 0; text-align: left; width: 100%; }

      .field { width: 100%; }

      @media (max-width: 480px) {
        .ob-card { padding: 2rem 1.25rem; }
        .mnemonic-grid { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  );
}

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
      @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400&display=swap');

      body {
        background: #f5f0e8;
        color: #1a1a1a;
        font-family: 'Comic Neue', 'Comic Sans MS', cursive;
        margin: 0;
      }

      .onboarding {
        min-height: 100vh;
        display: flex; align-items: center; justify-content: center;
        position: relative; padding: 2rem 1rem;
        background: #f5f0e8;
      }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size: 28px 28px; pointer-events: none;
      }

      .ob-card {
        position: relative; z-index: 1;
        width: 100%; max-width: 420px;
        border: 2px solid #1a1a1a;
        border-radius: 4px 12px 6px 10px / 10px 6px 12px 4px;
        background: #fff;
        box-shadow: 6px 6px 0 #1a1a1a;
        padding: 2.5rem 2rem;
        display: flex; flex-direction: column;
        align-items: center; gap: 1.25rem;
        text-align: center;
        animation: card-appear 0.4s ease;
      }

      @keyframes card-appear {
        from { opacity: 0; transform: translateY(16px) rotate(-0.5deg); }
        to { opacity: 1; transform: translateY(0) rotate(0deg); }
      }

      .ob-card-wide { max-width: 560px; }

      .ob-logo {
        font-size: 2.2rem; font-weight: 700; letter-spacing: 0.08em;
        font-family: 'Comic Neue', cursive;
        color: #1a1a1a;
        position: relative; display: inline-block;
      }

      .ob-logo::after {
        content: '';
        position: absolute; bottom: -3px; left: 0; right: 0;
        height: 3px; background: #1a1a1a;
        transform: skewX(-4deg);
        border-radius: 2px;
      }

      .accent {
        color: #1a1a1a;
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-thickness: 2px;
      }

      .ob-tagline {
        font-size: 1rem; color: #1a1a1a; margin: 0; font-weight: 700;
        font-family: 'Comic Neue', cursive;
      }

      .ob-desc {
        font-size: 0.84rem; color: #555; margin: 0; line-height: 1.75;
        font-family: 'Comic Neue', cursive;
      }

      .ob-title {
        font-size: 1rem; font-weight: 700; color: #1a1a1a;
        margin: 0; font-family: 'Comic Neue', cursive;
        position: relative; display: inline-block;
      }

      .ob-title::after {
        content: '';
        position: absolute; bottom: -2px; left: 0; right: 0;
        height: 2px; background: #1a1a1a; transform: skewX(-2deg);
      }

      .ob-hint {
        font-size: 0.72rem; color: #888; margin: -0.5rem 0 0;
        font-family: 'Comic Neue', cursive;
      }

      .ob-btn-primary {
        width: 100%; background: #1a1a1a; color: #f5f0e8;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        padding: 0.85rem 1.5rem;
        font-family: 'Comic Neue', cursive; font-size: 0.9rem; font-weight: 700;
        cursor: pointer;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.25);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .ob-btn-primary:hover:not(:disabled) {
        transform: translate(-2px, -2px);
        box-shadow: 6px 6px 0 rgba(0,0,0,0.25);
      }

      .ob-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

      .ob-btn-ghost {
        width: 100%; background: #fff; color: #555;
        border: 2px solid #888;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        padding: 0.75rem;
        font-family: 'Comic Neue', cursive; font-size: 0.83rem;
        cursor: pointer;
        box-shadow: 2px 2px 0 #888;
        transition: transform 0.15s ease, box-shadow 0.15s ease, color 0.15s;
      }

      .ob-btn-ghost:hover {
        color: #1a1a1a; border-color: #1a1a1a;
        box-shadow: 3px 3px 0 #1a1a1a;
        transform: translate(-1px, -1px);
      }

      /* ─── Spinner ─── */
      .ob-spinner {
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;
      }

      .spinner-ring {
        width: 48px; height: 48px;
        border: 3px solid rgba(0,0,0,0.1);
        border-top-color: #1a1a1a; border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      .ob-creating-label {
        font-size: 0.9rem; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive; font-weight: 700;
        animation: blink-label 1.5s ease-in-out infinite;
      }

      @keyframes blink-label {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .ob-creating-sub {
        font-size: 0.75rem; color: #888; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Mnemónico ─── */
      .mnemonic-grid {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem; width: 100%;
      }

      .mnemonic-word {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.5rem 0.65rem;
        border: 2px solid #1a1a1a;
        border-radius: 2px 5px 3px 4px / 4px 3px 5px 2px;
        background: #f5f0e8;
        box-shadow: 2px 2px 0 #1a1a1a;
        animation: draw-in 0.3s ease both;
      }

      @keyframes draw-in {
        from { opacity: 0; transform: translateX(-6px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .mnemonic-word:nth-child(2) { animation-delay: 0.03s; }
      .mnemonic-word:nth-child(3) { animation-delay: 0.06s; }
      .mnemonic-word:nth-child(4) { animation-delay: 0.09s; }
      .mnemonic-word:nth-child(5) { animation-delay: 0.12s; }
      .mnemonic-word:nth-child(6) { animation-delay: 0.15s; }
      .mnemonic-word:nth-child(7) { animation-delay: 0.18s; }
      .mnemonic-word:nth-child(8) { animation-delay: 0.21s; }
      .mnemonic-word:nth-child(9) { animation-delay: 0.24s; }
      .mnemonic-word:nth-child(10) { animation-delay: 0.27s; }
      .mnemonic-word:nth-child(11) { animation-delay: 0.30s; }
      .mnemonic-word:nth-child(12) { animation-delay: 0.33s; }

      .word-num {
        font-size: 0.62rem; color: #888; width: 16px;
        text-align: right; flex-shrink: 0;
        font-family: 'Comic Neue', cursive;
      }

      .word-text {
        font-size: 0.82rem; color: #1a1a1a; font-weight: 700;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Warning ─── */
      .ob-warning {
        width: 100%; font-size: 0.74rem; color: #7a4f00;
        padding: 0.75rem;
        border: 2px solid #c8860a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fffde7;
        box-shadow: 3px 3px 0 rgba(200,134,10,0.2);
        text-align: left; line-height: 1.55;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Checkbox ─── */
      .ob-checkbox {
        display: flex; align-items: flex-start; gap: 0.75rem;
        cursor: pointer; font-size: 0.82rem; color: #444;
        text-align: left; line-height: 1.55;
        font-family: 'Comic Neue', cursive;
      }

      .ob-checkbox input { margin-top: 3px; accent-color: #1a1a1a; flex-shrink: 0; }

      /* ─── Handle input ─── */
      .handle-input-wrap {
        width: 100%; display: flex; align-items: center;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        background: #fff; padding: 0 0.85rem;
        box-shadow: 3px 3px 0 #1a1a1a;
        transition: box-shadow 0.2s;
      }

      .handle-input-wrap:focus-within { box-shadow: 5px 5px 0 #1a1a1a; }

      .handle-at {
        color: #1a1a1a; font-size: 1rem; font-weight: 700;
        padding-right: 0.25rem; flex-shrink: 0;
        font-family: 'Comic Neue', cursive;
      }

      .handle-input {
        flex: 1; background: none; border: none; outline: none;
        font-family: 'Comic Neue', cursive; font-size: 0.92rem; color: #1a1a1a;
        padding: 0.75rem 0;
      }

      .handle-input::placeholder { color: #bbb; }

      .handle-status {
        font-size: 0.88rem; font-weight: 700; flex-shrink: 0;
        font-family: 'Comic Neue', cursive;
      }

      .handle-status.ok { color: #1a7a1a; }
      .handle-status.taken { color: #c0392b; }
      .handle-status.checking { color: #888; }

      .handle-msg {
        font-size: 0.76rem; margin: -0.5rem 0 0;
        width: 100%; text-align: left;
        font-family: 'Comic Neue', cursive;
      }

      .handle-msg.ok { color: #1a7a1a; }
      .handle-msg.taken { color: #c0392b; }

      /* ─── Recover ─── */
      .ob-textarea {
        width: 100%; box-sizing: border-box;
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 7px 4px 6px / 6px 4px 7px 3px;
        box-shadow: 3px 3px 0 #1a1a1a;
        padding: 0.75rem; font-family: 'Comic Neue', cursive;
        font-size: 0.84rem; color: #1a1a1a; outline: none;
        resize: vertical; line-height: 1.7;
        transition: box-shadow 0.2s;
      }

      .ob-textarea:focus { box-shadow: 5px 5px 0 #1a1a1a; }
      .ob-textarea::placeholder { color: #bbb; }

      .ob-error {
        font-size: 0.78rem; color: #c0392b; margin: 0;
        text-align: left; width: 100%;
        font-family: 'Comic Neue', cursive;
      }

      .field { width: 100%; }

      @media (max-width: 480px) {
        .ob-card { padding: 2rem 1.25rem; }
        .mnemonic-grid { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  );
}

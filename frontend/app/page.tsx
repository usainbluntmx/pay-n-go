"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function LandingPage() {
  // ─── Scroll-triggered animations ─────────────────────────────
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollDown = () => {
    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="landing">
      <div className="grid-bg" />

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">✦ Nueva forma de enviar dinero</div>
          <div className="hero-logo-big">
            <span className="logo-p">P</span>
            <span className="logo-a">A</span>
            <span className="logo-y">Y</span>
            <span className="logo-apos">'</span>
            <span className="logo-n">N</span>
            <span className="logo-g">G</span>
            <span className="logo-o">O</span>
          </div>
          <h1 className="hero-tagline">
            Envía y recibe dinero tan fácil y rápido<br />
            <span className="hero-highlight">como enviar un mensaje</span>
          </h1>
          <p className="hero-sub">
            Sin wallet. Sin crypto. Sin complicaciones.<br />
            Solo tú, tu teléfono y tu dinero.
          </p>
          <div className="hero-actions">
            <Link href="/app" className="cta-btn-hero">
              Crea tu cuenta aquí →
            </Link>
            <p className="hero-hint">Gratis · Sin registros · Sin contraseñas</p>
          </div>
          <div className="hero-tokens">
            <div className="token-pill">
              <span className="token-dot usdc-dot" />
              USDC · Dólares Digitales
            </div>
            <div className="token-pill">
              <span className="token-dot mxnb-dot" />
              MXNB · Pesos Digitales
            </div>
          </div>
        </div>

        {/* Flecha scroll */}
        <button className="scroll-arrow" onClick={scrollDown} aria-label="Ver más">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 12 L16 22 L24 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section className="section" id="como-funciona">
        <div className="section-inner">
          <h2 className="section-title reveal">¿Cómo funciona?</h2>
          <div className="steps">
            {[
              { n: "1", title: "Crea tu cuenta", desc: "Abre la app, elige tu @handle y listo. Sin formularios, sin datos personales, sin correo." },
              { n: "2", title: "Agrega dinero", desc: "Deposita USDC (dólares digitales) o MXNB (pesos digitales) a tu cuenta desde cualquier exchange." },
              { n: "3", title: "Envía o recibe", desc: 'Dile al agente qué hacer: "Envía 100 pesos a @carlos por la comida" — él se encarga del resto.' },
            ].map((s, i) => (
              <div key={s.n} className="step-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="step-num">{s.n}</div>
                <div className="step-content">
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CARACTERÍSTICAS ─── */}
      <section className="section section-alt">
        <div className="section-inner">
          <h2 className="section-title reveal">¿Por qué Pay&apos;n Go?</h2>
          <div className="features">
            {[
              { icon: "⚡", title: "Pagos instantáneos", desc: "Las transacciones se confirman en segundos, sin esperas ni intermediarios." },
              { icon: "0️⃣", title: "Sin comisiones de gas", desc: "Nosotros pagamos las comisiones de red. Tú solo pagas una pequeña comisión del 0.3% por transacción." },
              { icon: "🤖", title: "AI Payment Agent", desc: "Habla o escribe en lenguaje natural. El agente entiende y ejecuta el pago por ti." },
              { icon: "🎙️", title: "Entrada de voz", desc: "Di en voz alta lo que quieres hacer y la app lo ejecuta. Ideal para quienes no quieren escribir." },
              { icon: "🔒", title: "Tus llaves, tu dinero", desc: "Tu cuenta se genera localmente en tu dispositivo. Nadie más tiene acceso a tus fondos." },
              { icon: "🌎", title: "USDC y MXNB", desc: "Envía dólares digitales o pesos mexicanos digitales con la misma facilidad." },
            ].map((f, i) => (
              <div key={f.title} className="feature-card reveal" style={{ transitionDelay: `${i * 0.07}s` }}>
                <span className="feature-icon">{f.icon}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INSTALACIÓN ─── */}
      <section className="section">
        <div className="section-inner">
          <h2 className="section-title">Instala la app en tu teléfono</h2>
          <p className="section-sub">Pay&apos;n Go es una Progressive Web App (PWA). No necesitas descargarla de ninguna tienda — se instala directo desde el navegador.</p>
          <div className="install-grid">
            <div className="install-card">
              <h3 className="install-title"> iPhone (iOS)</h3>
              <ol className="install-steps">
                <li>Abre <strong>Safari</strong> en tu iPhone</li>
                <li>Entra a <strong>pay-n-go-weld.vercel.app</strong></li>
                <li>Toca el ícono de <strong>compartir</strong> (cuadrado con flecha ↑)</li>
                <li>Desliza y toca <strong>&quot;Agregar a pantalla de inicio&quot;</strong></li>
                <li>Toca <strong>&quot;Agregar&quot;</strong></li>
                <li>¡Listo! Abre Pay&apos;n Go desde tu pantalla principal</li>
              </ol>
            </div>
            <div className="install-card">
              <h3 className="install-title"> Android</h3>
              <ol className="install-steps">
                <li>Abre <strong>Chrome</strong> en tu Android</li>
                <li>Entra a <strong>pay-n-go-weld.vercel.app</strong></li>
                <li>Toca el menú de <strong>tres puntos</strong> (⋮) arriba a la derecha</li>
                <li>Toca <strong>&quot;Agregar a pantalla de inicio&quot;</strong></li>
                <li>Toca <strong>&quot;Agregar&quot;</strong> en la ventana emergente</li>
                <li>¡Listo! Abre Pay&apos;n Go desde tu pantalla principal</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section section-alt">
        <div className="section-inner">
          <h2 className="section-title">Preguntas frecuentes</h2>
          <div className="faq-list">
            {[
              {
                q: "¿Necesito saber de crypto para usar Pay'n Go?",
                a: "Para nada. La app está diseñada para que cualquier persona pueda usarla. Nunca verás una wallet address, una llave privada ni nada técnico.",
              },
              {
                q: "¿Cómo recupero mi cuenta si cambio de teléfono?",
                a: "Al crear tu cuenta recibirás 12 palabras de recuperación. Guárdalas en un lugar seguro. Con ellas podrás recuperar tu cuenta en cualquier dispositivo.",
              },
              {
                q: "¿Cuánto cuesta usar Pay'n Go?",
                a: "Cobraremos una comisión del 0.3% por transacción. Si envías 100 USDC, la comisión es de 0.30 USDC. Las comisiones de red (gas) las pagamos nosotros.",
              },
              {
                q: "¿Qué es USDC y MXNB?",
                a: "USDC es un dólar digital — siempre vale 1 dólar americano. MXNB es un peso mexicano digital — siempre vale 1 peso mexicano. Puedes usar ambos dentro de la app.",
              },
              {
                q: "¿Es seguro guardar dinero en Pay'n Go?",
                a: "Tu cuenta es una Smart Account en blockchain. El dinero vive en la cadena de bloques, no en nuestros servidores. Solo tú, con tus 12 palabras, tienes acceso.",
              },
              {
                q: "¿Puedo enviar dinero a alguien que no tiene Pay'n Go?",
                a: "Por ahora el receptor necesita tener una cuenta en Pay'n Go. Estamos trabajando en opciones para enviar a cualquier persona.",
              },
            ].map((item, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-q">{item.q}</summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="section cta-section">
        <div className="section-inner cta-inner">
          <h2 className="cta-title">¿Listo para empezar?</h2>
          <p className="cta-sub">Crea tu cuenta en menos de 30 segundos. Sin datos personales.</p>
          <Link href="/app" className="cta-btn cta-btn-lg">
            Crea tu cuenta aquí →
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <span>Pay&apos;n Go — construido por <a href="https://github.com/usainbluntmx" target="_blank" rel="noopener noreferrer">Zero Two Labs</a></span>
      </footer>

      <Styles />
    </main>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400&display=swap');

      *, *::before, *::after { box-sizing: border-box; }

      body {
        background: #f5f0e8;
        color: #1a1a1a;
        font-family: 'Comic Neue', 'Comic Sans MS', cursive;
        margin: 0; scroll-behavior: smooth;
      }

      .landing { min-height: 100vh; position: relative; }

      .grid-bg {
        position: fixed; inset: 0; z-index: 0;
        background-image:
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size: 28px 28px; pointer-events: none;
      }

      /* ─── HERO — full screen, sin card ─── */
      .hero {
        position: relative; z-index: 1;
        min-height: 100vh;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 3rem 1.5rem 5rem;
        text-align: center;
        overflow: hidden;
      }

      .hero-content {
        display: flex; flex-direction: column;
        align-items: center; gap: 1.5rem;
        max-width: 680px;
        animation: hero-in 0.7s ease;
      }

      @keyframes hero-in {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .hero-badge {
        display: inline-block;
        padding: 0.35rem 1rem;
        border: 2px solid #1a1a1a;
        border-radius: 99px;
        font-size: 0.78rem; font-weight: 700;
        background: #fff;
        box-shadow: 2px 2px 0 #1a1a1a;
        letter-spacing: 0.04em;
        animation: badge-bounce 2s ease-in-out infinite;
      }

      @keyframes badge-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      /* Logo animado letra por letra */
      .hero-logo-big {
        display: flex; align-items: center; gap: 0.05em;
        font-size: clamp(4rem, 15vw, 8rem);
        font-weight: 700; letter-spacing: -0.02em;
        line-height: 1;
      }

      .hero-logo-big span {
        display: inline-block;
        animation: letter-drop 0.5s ease both;
      }

      .logo-p { animation-delay: 0.05s; }
      .logo-a { animation-delay: 0.1s; }
      .logo-y { animation-delay: 0.15s; }
      .logo-apos { animation-delay: 0.2s; text-decoration: underline; text-underline-offset: 4px; }
      .logo-n { animation-delay: 0.25s; }
      .logo-g { animation-delay: 0.3s; }
      .logo-o { animation-delay: 0.35s; }

      @keyframes letter-drop {
        from { opacity: 0; transform: translateY(-20px) rotate(-5deg); }
        to { opacity: 1; transform: translateY(0) rotate(0); }
      }

      .hero-tagline {
        font-size: clamp(1.1rem, 4vw, 1.5rem);
        font-weight: 700; color: #1a1a1a; margin: 0;
        line-height: 1.4; font-family: 'Comic Neue', cursive;
      }

      .hero-highlight {
        position: relative; display: inline;
      }

      .hero-highlight::after {
        content: '';
        position: absolute; bottom: 0; left: 0; right: 0;
        height: 4px; background: #1a1a1a;
        transform: skewX(-3deg); border-radius: 2px;
      }

      .hero-sub {
        font-size: 1rem; color: #555; margin: 0; line-height: 1.75;
        font-family: 'Comic Neue', cursive;
      }

      .hero-actions {
        display: flex; flex-direction: column;
        align-items: center; gap: 0.6rem; width: 100%;
      }

      .cta-btn-hero {
        display: inline-block;
        background: #1a1a1a; color: #f5f0e8;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        padding: 1rem 2.5rem;
        font-family: 'Comic Neue', cursive; font-size: 1.1rem; font-weight: 700;
        text-decoration: none;
        box-shadow: 5px 5px 0 rgba(0,0,0,0.2);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        max-width: 360px; width: 100%; text-align: center;
      }

      .cta-btn-hero:hover {
        transform: translate(-3px, -3px);
        box-shadow: 8px 8px 0 rgba(0,0,0,0.2);
      }

      .hero-hint {
        font-size: 0.75rem; color: #888; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .hero-tokens {
        display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;
      }

      .token-pill {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.35rem 0.85rem;
        border: 2px solid #1a1a1a;
        border-radius: 99px; background: #fff;
        font-size: 0.78rem; font-weight: 700;
        box-shadow: 2px 2px 0 #1a1a1a;
      }

      .token-dot {
        width: 10px; height: 10px; border-radius: 50%;
        flex-shrink: 0;
      }

      .usdc-dot { background: #2775CA; }
      .mxnb-dot { background: #006847; }

      /* ─── Scroll arrow ─── */
      .scroll-arrow {
        position: absolute; bottom: 2rem; left: 50%;
        transform: translateX(-50%);
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 50%;
        width: 52px; height: 52px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: #1a1a1a;
        box-shadow: 3px 3px 0 #1a1a1a;
        animation: arrow-bounce 1.5s ease-in-out infinite;
        transition: transform 0.15s, box-shadow 0.15s;
      }

      .scroll-arrow:hover {
        transform: translateX(-50%) translate(-1px, -1px);
        box-shadow: 4px 4px 0 #1a1a1a;
      }

      @keyframes arrow-bounce {
        0%, 100% { bottom: 2rem; }
        50% { bottom: 2.6rem; }
      }

      /* ─── Reveal animations ─── */
      .reveal {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 0.5s ease, transform 0.5s ease;
      }

      .reveal.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* ─── Sections ─── */
      .section {
        position: relative; z-index: 1;
        padding: 4rem 1.5rem;
      }

      .section-alt { background: rgba(255,255,255,0.5); }

      .section-inner {
        max-width: 860px; margin: 0 auto;
        display: flex; flex-direction: column; gap: 2rem;
      }

      .section-title {
        font-size: 1.6rem; font-weight: 700; color: #1a1a1a;
        margin: 0; text-align: center;
        font-family: 'Comic Neue', cursive;
        position: relative; display: inline-block; align-self: center;
      }

      .section-title::after {
        content: '';
        position: absolute; bottom: -4px; left: 0; right: 0;
        height: 3px; background: #1a1a1a; transform: skewX(-2deg);
        border-radius: 2px;
      }

      .section-sub {
        text-align: center; color: #555; font-size: 0.9rem;
        line-height: 1.7; margin: -1rem 0 0;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Steps ─── */
      .steps { display: flex; flex-direction: column; gap: 1rem; }

      .step-card {
        display: flex; align-items: flex-start; gap: 1.25rem;
        padding: 1.25rem;
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        box-shadow: 4px 4px 0 #1a1a1a;
        transition: transform 0.15s, box-shadow 0.15s, opacity 0.5s ease, translateY 0.5s ease;
      }

      .step-card:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #1a1a1a; }

      .step-num {
        width: 40px; height: 40px; flex-shrink: 0;
        border: 2px solid #1a1a1a; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem; font-weight: 700;
        background: #1a1a1a; color: #f5f0e8;
        box-shadow: 2px 2px 0 rgba(0,0,0,0.2);
        font-family: 'Comic Neue', cursive;
      }

      .step-content { display: flex; flex-direction: column; gap: 0.3rem; }

      .step-title {
        font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .step-desc {
        font-size: 0.84rem; color: #555; margin: 0; line-height: 1.6;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Features ─── */
      .features {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .feature-card {
        padding: 1.25rem;
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        box-shadow: 3px 3px 0 #1a1a1a;
        display: flex; flex-direction: column; gap: 0.5rem;
        transition: transform 0.15s, box-shadow 0.15s, opacity 0.5s ease;
      }

      .feature-card:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #1a1a1a; }

      .feature-icon { font-size: 1.75rem; line-height: 1; }

      .feature-title {
        font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .feature-desc {
        font-size: 0.82rem; color: #555; margin: 0; line-height: 1.6;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── Install ─── */
      .install-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.25rem;
      }

      .install-card {
        padding: 1.5rem;
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        box-shadow: 4px 4px 0 #1a1a1a;
      }

      .install-title {
        font-size: 1rem; font-weight: 700; color: #1a1a1a;
        margin: 0 0 1rem; font-family: 'Comic Neue', cursive;
        border-bottom: 2px solid #1a1a1a; padding-bottom: 0.5rem;
      }

      .install-steps {
        margin: 0; padding-left: 1.25rem;
        display: flex; flex-direction: column; gap: 0.5rem;
      }

      .install-steps li {
        font-size: 0.85rem; color: #333; line-height: 1.5;
        font-family: 'Comic Neue', cursive;
      }

      /* ─── FAQ ─── */
      .faq-list { display: flex; flex-direction: column; gap: 0.75rem; }

      .faq-item {
        background: #fff;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        box-shadow: 3px 3px 0 #1a1a1a;
        overflow: hidden;
      }

      .faq-item[open] { box-shadow: 4px 4px 0 #1a1a1a; }

      .faq-q {
        padding: 1rem 1.25rem;
        font-size: 0.9rem; font-weight: 700; color: #1a1a1a;
        cursor: pointer; list-style: none;
        font-family: 'Comic Neue', cursive;
        display: flex; align-items: center; justify-content: space-between;
        user-select: none;
      }

      .faq-q::-webkit-details-marker { display: none; }
      .faq-q::after { content: '+'; font-size: 1.2rem; flex-shrink: 0; margin-left: 0.5rem; }
      details[open] .faq-q::after { content: '−'; }

      .faq-a {
        padding: 0.75rem 1.25rem 1rem;
        font-size: 0.84rem; color: #555; margin: 0; line-height: 1.7;
        font-family: 'Comic Neue', cursive;
        border-top: 1px solid rgba(0,0,0,0.08);
      }

      /* ─── CTA final ─── */
      .cta-section { background: rgba(0,0,0,0.03); }
      .cta-inner { align-items: center; text-align: center; gap: 1.25rem; }

      .cta-title {
        font-size: 1.6rem; font-weight: 700; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .cta-sub {
        font-size: 0.9rem; color: #555; margin: 0;
        font-family: 'Comic Neue', cursive;
      }

      .cta-btn {
        display: inline-block;
        background: #1a1a1a; color: #f5f0e8;
        border: 2px solid #1a1a1a;
        border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
        padding: 0.9rem 2rem;
        font-family: 'Comic Neue', cursive; font-size: 1rem; font-weight: 700;
        text-decoration: none;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.25);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        width: 100%; text-align: center; max-width: 320px;
      }

      .cta-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 rgba(0,0,0,0.25); }
      .cta-btn-lg { font-size: 1.05rem; padding: 1rem 2rem; }

      /* ─── Footer ─── */
      .footer {
        position: relative; z-index: 1;
        padding: 1.5rem;
        border-top: 2px solid #1a1a1a;
        display: flex; align-items: center; justify-content: center;
        gap: 0.75rem; flex-wrap: wrap;
        font-size: 0.8rem; color: #666;
        font-family: 'Comic Neue', cursive;
        background: #fff;
      }

      .footer a, .footer-link {
        color: #1a1a1a; font-weight: 700; text-decoration: underline;
        text-underline-offset: 2px;
      }

      .footer-sep { color: #ccc; }

      @media (max-width: 640px) {
        .hero { padding-bottom: 6rem; }
        .hero-logo-big { font-size: clamp(3rem, 18vw, 5rem); }
        .hero-tagline { font-size: 1rem; }
        .section { padding: 3rem 1.25rem; }
        .features { grid-template-columns: 1fr; }
        .install-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

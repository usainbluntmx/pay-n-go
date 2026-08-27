"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIdentityContext as useIdentity } from "@/context/IdentityProvider";
import { Onboarding } from "@/components/Onboarding";

export default function HomePage() {
  const { hasIdentity, loading } = useIdentity();
  const router = useRouter();

  // Solo queremos auto-redirigir a /dashboard cuando el usuario YA tenía una
  // cuenta lista al entrar a esta página (ej. abrió /app directo con sesión
  // activa) — nunca cuando la cuenta se acaba de crear DURANTE el onboarding
  // que se muestra en esta misma visita. Sin esta distinción, hasIdentity se
  // vuelve true en cuanto createIdentity() resuelve (antes de que el usuario
  // vea el backup de las 12 palabras o elija su handle) y este efecto
  // redirige de inmediato, saltándose esas pantallas.
  const hasCheckedInitialIdentity = useRef(false);
  const [shouldAutoRedirect, setShouldAutoRedirect] = useState(false);

  useEffect(() => {
    if (loading || hasCheckedInitialIdentity.current) return;
    hasCheckedInitialIdentity.current = true;
    if (hasIdentity) setShouldAutoRedirect(true);
  }, [loading, hasIdentity]);

  useEffect(() => {
    if (shouldAutoRedirect) router.push("/dashboard");
  }, [shouldAutoRedirect, router]);

  if (loading) {
    return (
      <main style={{
        minHeight: "100vh", background: "#f5f0e8",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid rgba(0,0,0,0.1)",
          borderTopColor: "#1a1a1a",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  // Si ya había una cuenta activa al montar, no renderizamos el Onboarding
  // en absoluto — el efecto de arriba ya está redirigiendo a /dashboard.
  if (shouldAutoRedirect) return null;

  return (
    <Onboarding
      onComplete={() => router.push("/dashboard")}
    />
  );
}
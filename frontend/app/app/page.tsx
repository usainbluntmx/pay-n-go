"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentityContext as useIdentity } from "@/context/IdentityProvider";
import { Onboarding } from "@/components/Onboarding";

export default function HomePage() {
  const { hasIdentity, loading } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (hasIdentity) {
      router.push("/dashboard");
    }
    // Si !hasIdentity y !loading, el Onboarding se muestra automáticamente
    // — incluye la pantalla de "unlock" si hay una sesión cifrada bloqueada
    // (isLocked), o el flujo de bienvenida si no hay ninguna cuenta.
  }, [loading, hasIdentity, router]);

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

  if (!hasIdentity) {
    return <Onboarding onComplete={() => router.push("/dashboard")} />;
  }

  return null;
}
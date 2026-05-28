"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/useIdentity";
import { Onboarding } from "@/components/Onboarding";

export default function HomePage() {
  const { hasIdentity, loading } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (hasIdentity) {
      router.push("/dashboard");
    }
    // Si !hasIdentity y !loading, el onboarding se muestra automáticamente
  }, [loading, hasIdentity, router]);

  if (loading) {
    return (
      <main style={{
        minHeight: "100vh", background: "#080b0f",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid rgba(0,255,170,0.15)",
          borderTopColor: "#00ffaa",
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
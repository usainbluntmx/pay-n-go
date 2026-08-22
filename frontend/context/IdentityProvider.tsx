"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useIdentity } from "@/hooks/useIdentity";

// El tipo de retorno de useIdentity() — lo inferimos automáticamente para no
// duplicar la interfaz cada vez que el hook cambia.
type IdentityContextValue = ReturnType<typeof useIdentity>;

const IdentityContext = createContext<IdentityContextValue | null>(null);

// Una sola instancia de useIdentity() para toda la app. Esto es lo que
// mantiene la sesión desbloqueada (la contraseña derivada en memoria) viva
// mientras el usuario navega entre /app y /dashboard — sin este Provider,
// cada ruta monta su propia instancia del hook y pierde el estado en memoria,
// forzando al usuario a re-ingresar su contraseña en cada navegación.
export function IdentityProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  return (
    <IdentityContext.Provider value={identity}>
      {children}
    </IdentityContext.Provider>
  );
}

// Reemplaza las llamadas directas a useIdentity() en componentes — misma API,
// pero comparte la instancia única del Provider en vez de crear una nueva.
export function useIdentityContext(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error("useIdentityContext debe usarse dentro de <IdentityProvider>");
  }
  return ctx;
}
"use client";

import { useState, useEffect, useCallback } from "react";

export type PushStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export function usePush(smartAccountAddress: string | undefined) {
  const [status, setStatus] = useState<PushStatus>("idle");

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  // Convertir VAPID public key a formato compatible
  const getAppServerKey = (base64String: string): ArrayBuffer => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i);
    }
    return buffer;
  };

  // Verificar estado inicial al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setStatus("granted");
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    }
  }, []);

  // Solicitar permiso y suscribir
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!smartAccountAddress) return false;
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return false;
    }

    setStatus("requesting");

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: getAppServerKey(vapidPublicKey),
      });

      // Guardar suscripción en el servidor
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          address: smartAccountAddress,
        }),
      });

      if (!res.ok) {
        setStatus("idle");
        return false;
      }

      setStatus("granted");
      return true;
    } catch (e) {
      console.error("[Push] subscribe error:", e);
      setStatus("idle");
      return false;
    }
  }, [smartAccountAddress, vapidPublicKey]);

  // Cancelar suscripción
  const unsubscribe = useCallback(async () => {
    if (!smartAccountAddress) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: smartAccountAddress }),
      });

      setStatus("idle");
    } catch (e) {
      console.error("[Push] unsubscribe error:", e);
    }
  }, [smartAccountAddress]);

  return { status, subscribe, unsubscribe };
}

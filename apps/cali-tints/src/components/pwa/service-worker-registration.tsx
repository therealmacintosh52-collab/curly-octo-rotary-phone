"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production. In development the SW is skipped so HMR and
 * fresh RSC payloads are never served from cache.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);
  return null;
}

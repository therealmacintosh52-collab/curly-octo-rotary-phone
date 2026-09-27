"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production. In development the SW is skipped so HMR and
 * fresh RSC payloads are never served from cache.
 *
 * After a deploy the new worker installs, takes control (skipWaiting +
 * clients.claim in sw.js) and this component reloads the page once so the
 * user never keeps looking at a build that is already gone.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    // Only reload on a *change* of controller (an update), not on first install.
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // Check for a new build whenever the app comes back to the foreground.
        const check = () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", check);
      })
      .catch((err) => {
        console.warn("Service worker registration failed", err);
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}

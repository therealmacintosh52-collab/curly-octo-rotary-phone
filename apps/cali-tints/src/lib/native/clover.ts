"use client";

import { useEffect, useState } from "react";

/*
  The Cali Tints Clover app (apps/cali-tints-clover) wraps this site in a
  WebView and exposes `window.CaliClover`. Calls are fire-and-forget; the app
  answers through `window.__caliCloverReply(requestId, result)`.
*/

export interface CloverBridge {
  /** JSON: { app, version, device, clover, camera } */
  info(): string;
  /** Opens the Clover barcode scanner; the result arrives as a reply under requestId. */
  scan(requestId: string): void;
  stopScan(): void;
  /** Asks Android for the camera permission ahead of time (optional). */
  requestCamera?(): void;
}

export type CloverScanResult = { ok: true; text: string } | { ok: false; error: string; code: "timeout" | "cancelled" | "unavailable" | "error" };

export interface CloverInfo {
  app: string;
  version: string;
  device: string;
  clover: boolean;
  camera: boolean;
}

type ReplyFn = (requestId: string, result: CloverScanResult) => void;
declare global {
  interface Window {
    CaliClover?: CloverBridge;
    __caliCloverReply?: ReplyFn;
  }
}

const pending = new Map<string, (r: CloverScanResult) => void>();

function installReplyHandler() {
  if (typeof window === "undefined" || window.__caliCloverReply) return;
  window.__caliCloverReply = (id, result) => {
    const resolve = pending.get(id);
    pending.delete(id);
    resolve?.(result);
  };
}

/** The bridge when this page runs inside the Clover app, else null. */
export function getCloverBridge(): CloverBridge | null {
  if (typeof window === "undefined") return null;
  const b = window.CaliClover;
  return b && typeof b.scan === "function" ? b : null;
}

export function cloverInfo(): CloverInfo | null {
  const b = getCloverBridge();
  if (!b) return null;
  try {
    return JSON.parse(b.info()) as CloverInfo;
  } catch {
    return null;
  }
}

/** Scan one barcode with the Clover scanner. Rejects with the app's error message (cancel, timeout, no scanner). */
export function scanWithClover(timeoutMs = 65_000): Promise<string> {
  const bridge = getCloverBridge();
  if (!bridge) return Promise.reject(new Error("The Clover scanner is only available inside the Clover app"));
  installReplyHandler();
  const id = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      try {
        bridge.stopScan();
      } catch {
        /* ignore */
      }
      reject(new Error("No barcode read"));
    }, timeoutMs);
    pending.set(id, (r) => {
      clearTimeout(timer);
      if (r.ok) resolve(r.text);
      else reject(Object.assign(new Error(r.error), { code: r.code }));
    });
    try {
      bridge.scan(id);
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err instanceof Error ? err : new Error("Could not start the Clover scanner"));
    }
  });
}

export function stopCloverScan() {
  try {
    getCloverBridge()?.stopScan();
  } catch {
    /* ignore */
  }
}

/** True once mounted inside the Clover app (false during SSR and on phones). */
export function useCloverBridge(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInApp(!!getCloverBridge()), 0);
    return () => clearTimeout(t);
  }, []);
  return inApp;
}

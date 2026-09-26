"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { OUTBOX_EVENT, pendingCount } from "@/lib/offline/outbox";

interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncState>({ online: true, pending: 0, syncing: false, syncNow: async () => {} });

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Owns the offline sync loop: reacts to connectivity changes, the outbox
 * changing, tab visibility and a slow interval while anything is pending.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true, // server snapshot
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const pendingRef = useRef(0);

  const refreshCount = useCallback(async () => {
    try {
      const n = await pendingCount();
      pendingRef.current = n;
      setPending(n);
    } catch {
      /* IndexedDB unavailable (private mode): nothing to count */
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    // Nothing queued: skip entirely, so the Supabase SDK (~65 KB gz) never loads on an ordinary page view.
    try {
      if ((await pendingCount()) === 0) return;
    } catch {
      return;
    }
    setSyncing(true);
    try {
      const { syncOutbox } = await import("@/lib/offline/sync");
      const r = await syncOutbox();
      if (r.synced > 0) toast.success(r.synced === 1 ? "1 job synced" : `${r.synced} jobs synced`);
    } catch (err) {
      // e.g. Supabase not configured (guest preview): leave items queued, never crash the UI.
      console.warn("sync failed", err);
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  // Kick a sync whenever we come back online (deferred so the effect body itself never sets state).
  useEffect(() => {
    if (!online) return;
    const t = window.setTimeout(() => void syncNow(), 0);
    return () => window.clearTimeout(t);
  }, [online, syncNow]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshCount(), 0);
    const onOutbox = () => {
      void refreshCount();
      void syncNow();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => {
      if (pendingRef.current > 0) void syncNow();
    }, 30_000);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(OUTBOX_EVENT, onOutbox);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [refreshCount, syncNow]);

  return <SyncContext.Provider value={{ online, pending, syncing, syncNow }}>{children}</SyncContext.Provider>;
}

export function useSync() {
  return useContext(SyncContext);
}

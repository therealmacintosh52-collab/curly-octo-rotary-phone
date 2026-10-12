"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, RefreshCwIcon, ScanSearchIcon, XIcon } from "lucide-react";
import { OPEN_EVENT, bayintelConfigured, bayintelUrl, parseBayintelMessage } from "@/lib/intel/bridge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IntelContext {
  open: boolean;
  configured: boolean;
  /** Open BayIntel on a screen ("/garage" by default). */
  openRetail: (path?: string) => void;
  close: () => void;
}

const Ctx = createContext<IntelContext | null>(null);

/** The BayIntel window from a client component: `const { openRetail } = useIntel()`. */
export function useIntel(): IntelContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIntel must be used inside IntelProvider");
  return ctx;
}

const LOAD_TIMEOUT_MS = 10_000;

/**
 * BayIntel inside this app: a full-screen sheet on a phone (the back gesture
 * closes it), a large centered window on a desktop (Esc closes it). The
 * iframe is mounted the first time it opens and kept mounted while hidden, so
 * switching tabs never reloads BayIntel. The camera is allowed (the VIN
 * scanner); no sandbox, so BayIntel's own auth cookies work where the
 * browser lets a framed site keep them (see the README: same-site domains).
 *
 * TODO(sso): a shared-session hand-off would go here, e.g. a short-lived
 * token from this app's session posted to BayIntel on load. Until then the
 * user signs in to BayIntel inside the window; nothing is shared across the
 * two origins.
 */
export function IntelProvider({ children }: { children: React.ReactNode }) {
  const configured = bayintelConfigured();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const pushed = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const openRetail = useCallback((path = "/garage") => {
    const url = bayintelUrl(path);
    if (url && url !== src) {
      setSrc(url);
      setStatus("loading");
    }
    setMounted(true);
    setOpen((was) => {
      if (!was && typeof window !== "undefined") {
        window.history.pushState({ intel: true }, "");
        pushed.current = true;
      }
      return true;
    });
  }, [src]);

  const close = useCallback(() => {
    if (pushed.current && typeof window !== "undefined" && (window.history.state as { intel?: boolean } | null)?.intel) {
      pushed.current = false;
      window.history.back(); // popstate below closes it, so the back gesture and the X behave the same
      return;
    }
    pushed.current = false;
    setOpen(false);
  }, []);

  // The device back gesture / browser back closes the window.
  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Esc closes it; the body stops scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  // openRetail(path) from anywhere in the app.
  useEffect(() => {
    const onOpen = (e: Event) => openRetail((e as CustomEvent<{ path?: string }>).detail?.path);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [openRetail]);

  // Messages from BayIntel (its origin only): close, or move to another screen.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = parseBayintelMessage(e);
      if (!m) return;
      if (m.type === "bayintel:close") close();
      else {
        const url = bayintelUrl(m.path);
        if (url) setSrc(url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [close]);

  // Loading skeleton until the iframe loads; a fallback when nothing arrives in time (blocked framing, offline).
  useEffect(() => {
    if (!mounted || status !== "loading") return;
    const t = setTimeout(() => setStatus((s) => (s === "loading" ? "failed" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [mounted, status, src]);

  const retry = () => {
    setStatus("loading");
    if (frame.current && src) frame.current.src = src;
  };

  return (
    <Ctx.Provider value={{ open, configured, openRetail, close }}>
      {children}
      {mounted && (
        <div
          role="dialog"
          aria-modal={open ? true : undefined}
          aria-label="BayIntel"
          aria-hidden={!open}
          data-testid="intel-window"
          data-state={open ? "open" : "closed"}
          className={cn("fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-[5vh_5vw]", !open && "pointer-events-none")}
        >
          <div onClick={close} aria-hidden className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} />
          <div
            className={cn(
              "relative flex w-full flex-col overflow-hidden bg-background shadow-popover transition-transform duration-250 ease-out",
              "h-dvh md:h-[90vh] md:w-[90vw] md:max-w-7xl md:rounded-2xl md:border md:border-border",
              open ? "translate-y-0" : "translate-y-full md:translate-y-8",
              !open && "md:opacity-0",
            )}
          >
            <div className="pt-safe flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-2 md:h-11">
              <div className="flex min-w-0 items-center gap-2 pl-2 text-sm font-semibold">
                <ScanSearchIcon className="size-4 text-primary" /> BayIntel
                <span className="hidden text-caption font-normal text-subtle sm:inline">· repair intelligence, signed in separately</span>
              </div>
              <div className="flex items-center gap-1">
                {src && (
                  <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                    <a href={src} target="_blank" rel="noopener noreferrer" data-testid="intel-open-new">
                      <ExternalLinkIcon /> Open in new window
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Close BayIntel" onClick={close} data-testid="intel-close" className="size-11 md:size-9">
                  <XIcon />
                </Button>
              </div>
            </div>
            <div className={cn("relative min-h-0 flex-1", configured ? "bg-[#0b0f14]" : "overflow-y-auto bg-background p-4")}>
              {!configured && <IntelNotConnected />}
              {configured && status === "loading" && (
                <div className="absolute inset-0 grid gap-3 p-4" data-testid="intel-loading" aria-live="polite">
                  <Skeleton className="h-10 w-2/3 bg-white/10" />
                  <Skeleton className="h-28 w-full bg-white/10" />
                  <Skeleton className="h-6 w-1/2 bg-white/10" />
                  <Skeleton className="h-16 w-full bg-white/10" />
                  <Skeleton className="h-16 w-full bg-white/10" />
                </div>
              )}
              {configured && status === "failed" && (
                <div className="absolute inset-0 flex items-center justify-center p-6" data-testid="intel-failed">
                  <div className="max-w-sm rounded-2xl border border-border bg-card p-5 text-sm">
                    <div className="font-semibold">BayIntel did not load</div>
                    <p className="mt-1 text-muted-foreground">It may refuse to open inside another site, or the network is slow. Open it on its own page instead.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {src && (
                        <Button asChild>
                          <a href={src} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /> Open BayIntel</a>
                        </Button>
                      )}
                      <Button variant="outline" onClick={retry}><RefreshCwIcon /> Try again</Button>
                    </div>
                  </div>
                </div>
              )}
              {src && (
                <iframe
                  ref={frame}
                  src={src}
                  title="BayIntel"
                  allow="camera; clipboard-write"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => setStatus("ready")}
                  onError={() => setStatus("failed")}
                  data-testid="intel-frame"
                  className={cn("size-full border-0", status !== "ready" && "opacity-0")}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** What the tab shows when no BayIntel URL is configured. */
export function IntelNotConnected() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-5 text-sm" data-testid="intel-not-connected">
      <div className="flex items-center gap-2 font-semibold"><ScanSearchIcon className="size-4 text-primary" /> BayIntel is not connected yet</div>
      <p className="mt-1 text-muted-foreground">Set <code className="font-mono text-caption">NEXT_PUBLIC_BAYINTEL_URL</code> to the BayIntel deployment and redeploy; the Intel tab then opens it here.</p>
    </div>
  );
}

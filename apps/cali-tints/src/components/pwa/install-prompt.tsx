"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cali-tints:install-dismissed";

/**
 * "Add to home screen" nudge. Chrome/Android fire beforeinstallprompt; iOS
 * needs manual Share → Add to Home Screen, so we show a hint there instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const t = setTimeout(() => {
      if (isIos) setShowIosHint(true);
    }, 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  function dismiss() {
    setDeferred(null);
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!deferred && !showIosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-xl border border-border bg-popover p-3 shadow-2xl shadow-black/60 md:left-auto md:right-4 md:bottom-4 md:w-96">
      <DownloadIcon className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">Install Cali Tints</div>
        <div className="text-xs text-muted-foreground">{deferred ? "Opens full-screen and works without signal." : "Tap Share, then “Add to Home Screen”."}</div>
      </div>
      {deferred && (
        <Button
          size="sm"
          onClick={async () => {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") setDeferred(null);
            else dismiss();
          }}
        >
          Install
        </Button>
      )}
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="p-1 text-muted-foreground">
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import type { CardResult } from "./pay-on-device-dialog";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";

export interface CloverCardConfig {
  /** Public (PAKMS) key: safe in the browser, only tokenises cards. */
  publicKey: string;
  merchantId: string;
  /** sdk.js for the chosen environment. */
  sdkUrl: string;
}

/* Minimal typing for Clover's iframe SDK (window.Clover). */
interface CloverElement {
  mount(selector: string): void;
}
interface CloverElements {
  create(type: "CARD_NUMBER" | "CARD_DATE" | "CARD_CVV" | "CARD_POSTAL_CODE", styles?: Record<string, unknown>): CloverElement;
}
interface CloverSdk {
  elements(): CloverElements;
  createToken(): Promise<{ token?: string; errors?: Record<string, string> }>;
}
declare global {
  interface Window {
    Clover?: new (publicKey: string, opts?: { merchantId?: string }) => CloverSdk;
  }
}

function loadSdk(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Clover) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load the Clover card form")));
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the Clover card form"));
    document.head.appendChild(s);
  });
}

const FIELD_STYLES = {
  body: { fontFamily: "system-ui, sans-serif", fontSize: "16px" },
  input: { fontSize: "16px", padding: "10px 12px", border: "none", color: "#f2f4f5", backgroundColor: "#1a1e22" },
  "input::placeholder": { color: "#7d8892" },
};

/**
 * Charge a card on the spot. Card data never touches our servers: Clover's
 * iframe fields tokenise it and only the single-use token is sent to
 * `charge`, which runs the server action (invoice payment or terminal sale).
 */
export function ChargeCardDialog({
  subtitle,
  balance,
  lockAmount = false,
  config,
  onDone,
  charge,
}: {
  subtitle: string;
  /** Maximum (and default) amount. */
  balance: number;
  /** Amount was entered elsewhere (the Terminal keypad): no amount field. */
  lockAmount?: boolean;
  config: CloverCardConfig;
  onDone: (r: CardResult) => void;
  charge: (input: { token: string; amount: number }) => Promise<ActionResult<CardResult>>;
}) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [ready, setReady] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const sdkRef = useRef<CloverSdk | null>(null);
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= balance + 0.005;

  useEffect(() => {
    if (demo) {
      const t = setTimeout(() => setReady("ready"), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    loadSdk(config.sdkUrl)
      .then(() => {
        if (cancelled || !window.Clover) return;
        const clover = new window.Clover(config.publicKey, { merchantId: config.merchantId });
        const elements = clover.elements();
        elements.create("CARD_NUMBER", FIELD_STYLES).mount("#clover-card-number");
        elements.create("CARD_DATE", FIELD_STYLES).mount("#clover-card-date");
        elements.create("CARD_CVV", FIELD_STYLES).mount("#clover-card-cvv");
        elements.create("CARD_POSTAL_CODE", FIELD_STYLES).mount("#clover-card-postal");
        sdkRef.current = clover;
        setReady("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoadError(err.message);
        setReady("error");
      });
    return () => {
      cancelled = true;
    };
  }, [config.sdkUrl, config.publicKey, config.merchantId, demo]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const rounded = Math.round(n * 100) / 100;
    if (demo) {
      toast.success(`Charged ${formatMoney(rounded)} to card ending 4242`, { description: "Guest preview — not actually charged" });
      onDone({ amount: rounded, last4: "4242" });
      return;
    }
    start(async () => {
      const sdk = sdkRef.current;
      if (!sdk) {
        toast.error("Card form is not ready yet");
        return;
      }
      const result = await sdk.createToken();
      if (!result.token) {
        const first = result.errors ? Object.values(result.errors)[0] : null;
        toast.error(first ?? "Check the card details");
        return;
      }
      const r = await charge({ token: result.token, amount: rounded });
      if (r.ok) {
        toast.success(`Charged ${formatMoney(r.data.amount)}${r.data.last4 ? ` to card ending ${r.data.last4}` : ""}`);
        onDone(r.data);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const box = "min-h-11 rounded-lg border border-border bg-input px-1";

  return (
    <DialogContent>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-5 text-primary" /> Charge a card
          </DialogTitle>
          <DialogDescription>{subtitle}. Card details go straight to Clover; only the result is recorded here.</DialogDescription>
        </DialogHeader>

        {lockAmount ? (
          <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl font-semibold tabular-nums">{formatMoney(n)}</div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="charge-amount">Amount</Label>
            <Input id="charge-amount" inputMode="decimal" type="number" step="0.01" min="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
            {n > 0 && n < balance && <Hint tone="warning">Partial payment; {formatMoney(balance - n)} stays open.</Hint>}
          </div>
        )}

        {ready === "error" ? (
          <Hint tone="error">{loadError}</Hint>
        ) : (
          <div className="grid gap-3" aria-busy={ready === "loading"}>
            <div className="grid gap-1.5">
              <Label>Card number</Label>
              {demo ? <Input placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" /> : <div id="clover-card-number" className={box} />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Expiry</Label>
                {demo ? <Input placeholder="MM/YY" defaultValue="12/28" /> : <div id="clover-card-date" className={box} />}
              </div>
              <div className="grid gap-1.5">
                <Label>CVV</Label>
                {demo ? <Input placeholder="123" defaultValue="123" /> : <div id="clover-card-cvv" className={box} />}
              </div>
              <div className="grid gap-1.5">
                <Label>ZIP</Label>
                {demo ? <Input placeholder="95762" defaultValue="95762" /> : <div id="clover-card-postal" className={box} />}
              </div>
            </div>
            {ready === "loading" && <Hint>Loading secure card form…</Hint>}
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="flex items-center gap-1 text-caption text-subtle">
            <LockIcon className="size-3" /> PCI handled by Clover
          </span>
          <Button type="submit" loading={pending} disabled={!valid || ready !== "ready"}>
            Charge {valid ? formatMoney(n) : ""}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

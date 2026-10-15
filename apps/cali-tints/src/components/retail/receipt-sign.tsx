"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLineIcon } from "lucide-react";
import { toast } from "sonner";
import { signReceiptRemoteAction } from "@/app/r/[token]/actions";
import { REMOTE_SIGN_CONSENT } from "@/lib/retail/receipt-consent";
import { SignaturePad, signatureBlob } from "@/components/retail/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

/**
 * "Sign from your phone": a customer who is not at the counter signs the paid invoice from their own link:
 * the same statement as the pickup signature, typed name and drawn mark. Appears only once the invoice is paid and not yet signed.
 */
export function ReceiptSign({ token, paid, demo = false }: { token: string; paid: number; demo?: boolean }) {
  const router = useRouter();
  const padRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();

  function sign() {
    if (name.trim().length < 2) return void toast.error("Type your name");
    if (!hasInk) return void toast.error("Sign in the box");
    if (!agree) return void toast.error("Tick the box to agree");
    start(async () => {
      if (demo) return void toast.success("Signed · guest preview", { description: "Nothing was saved" });
      const blob = await signatureBlob(padRef.current);
      if (!blob) return void toast.error("Could not read the signature; try again");
      const fd = new FormData();
      fd.append("signature", blob, "signature.png");
      const res = await fetch(`/api/r/${token}/signature`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !body.path) return void toast.error(body.error ?? "Could not save the signature");
      const r = await signReceiptRemoteAction(token, { name: name.trim(), signature_path: body.path });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Thank you: signed");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-card p-4" data-testid="receipt-sign">
      <h2 className="flex items-center gap-2 font-semibold"><PenLineIcon className="size-4 text-primary" /> Sign from your phone</h2>
      <p className="text-sm text-muted-foreground">I received my vehicle, the work was done as described, and I paid {formatMoney(paid)}.</p>
      <div className="grid gap-1.5">
        <Label htmlFor="rs-name">Your name</Label>
        <Input id="rs-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="First and last name" data-testid="receipt-sign-name" />
      </div>
      <div className="grid gap-1.5" ref={padRef}>
        <Label>Signature</Label>
        <SignaturePad onChange={setHasInk} />
      </div>
      <label className="flex items-start gap-2 text-caption text-subtle">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" data-testid="receipt-sign-agree" />
        <span>{REMOTE_SIGN_CONSENT}</span>
      </label>
      <Button size="lg" onClick={sign} loading={pending} data-testid="receipt-sign-button"><PenLineIcon /> Sign</Button>
    </section>
  );
}

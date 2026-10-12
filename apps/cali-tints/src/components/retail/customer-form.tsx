"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Customer, CustomerSource } from "@/lib/db/types";
import { findDuplicateCustomersAction, saveCustomerAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { formatPhone } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const SOURCE_LABEL: Record<CustomerSource, string> = {
  walk_in: "Walk-in",
  online_booking: "Booked online",
  referral: "Referral",
  phone: "Phone",
  social: "Instagram / Facebook",
  other: "Other",
};

type Draft = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  source: CustomerSource;
  tags: string;
  marketing_opt_in: boolean;
  sms_opt_in: boolean;
  notes: string;
};

const EMPTY: Draft = { first_name: "", last_name: "", phone: "", email: "", address_line1: "", city: "", state: "CA", postal_code: "", source: "walk_in", tags: "", marketing_opt_in: false, sms_opt_in: false, notes: "" };

function toDraft(c: Customer): Draft {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    address_line1: c.address_line1 ?? "",
    city: c.city ?? "",
    state: c.state ?? "CA",
    postal_code: c.postal_code ?? "",
    source: c.source,
    tags: c.tags.join(", "),
    marketing_opt_in: c.marketing_opt_in,
    sms_opt_in: c.sms_opt_in,
    notes: c.notes ?? "",
  };
}

/**
 * New or edit a customer. Phone and email are checked against existing
 * customers as you type, so a repeat visitor is found instead of created
 * twice. Consents are two separate switches (texts about their car, and
 * marketing), each stamped when turned on.
 */
export function CustomerForm({
  customer,
  compact = false,
  onSaved,
  onCancel,
}: {
  customer?: Customer | null;
  /** Fewer fields (name, phone, email, consents): the inline create on New job. */
  compact?: boolean;
  onSaved?: (c: Customer) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { demo } = useSession();
  const [d, setD] = useState<Draft>(() => (customer ? toDraft(customer) : EMPTY));
  const [pending, start] = useTransition();
  const [dupes, setDupes] = useState<{ id: string; display_name: string | null; phone: string | null; email: string | null }[]>([]);
  const dupeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // Duplicate check, debounced, on phone or email.
  useEffect(() => {
    if (demo) return;
    if (dupeTimer.current) clearTimeout(dupeTimer.current);
    const phone = d.phone.trim();
    const email = d.email.trim();
    const enough = phone.replace(/\D/g, "").length >= 7 || email.includes("@");
    dupeTimer.current = setTimeout(async () => {
      if (!enough) return void setDupes([]);
      const r = await findDuplicateCustomersAction(phone || null, email.includes("@") ? email : null, customer?.id ?? null);
      if (r.ok) setDupes(r.data);
    }, 400);
    return () => {
      if (dupeTimer.current) clearTimeout(dupeTimer.current);
    };
  }, [d.phone, d.email, customer?.id, demo]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.first_name.trim() && !d.last_name.trim() && !d.phone.trim() && !d.email.trim()) {
      toast.error("A name, phone or email is required");
      return;
    }
    start(async () => {
      if (demo) {
        toast.success(`Saved ${[d.first_name, d.last_name].join(" ").trim() || d.phone} · guest preview, not actually saved`);
        onSaved?.({ ...(customer ?? ({} as Customer)), id: customer?.id ?? "demo", first_name: d.first_name, last_name: d.last_name, display_name: [d.first_name, d.last_name].join(" ").trim(), phone: d.phone || null, email: d.email || null } as Customer);
        if (!onSaved) router.push("/retail/customers");
        return;
      }
      const r = await saveCustomerAction({
        id: customer?.id,
        first_name: d.first_name,
        last_name: d.last_name,
        phone: d.phone || null,
        email: d.email || null,
        address_line1: d.address_line1 || null,
        city: d.city || null,
        state: d.state || null,
        postal_code: d.postal_code || null,
        source: d.source,
        tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
        marketing_opt_in: d.marketing_opt_in,
        sms_opt_in: d.sms_opt_in,
        consent_source: d.sms_opt_in || d.marketing_opt_in ? "in person" : null,
        notes: d.notes || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(customer ? "Saved" : `Added ${r.data.display_name ?? formatPhone(r.data.phone)}`);
      if (onSaved) onSaved(r.data);
      else router.push(`/retail/customers/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="customer-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="c-first">First name</Label>
          <Input id="c-first" value={d.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="off" autoCapitalize="words" autoFocus={!customer} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-last">Last name</Label>
          <Input id="c-last" value={d.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="off" autoCapitalize="words" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" type="tel" inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} onBlur={() => set("phone", formatPhone(d.phone))} placeholder="(916) 555-0100" autoComplete="off" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" inputMode="email" value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoComplete="off" autoCapitalize="none" />
        </div>
      </div>

      {dupes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm" role="status" data-testid="customer-dupes">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <div className="font-medium">Already a customer?</div>
            <ul className="mt-0.5 text-muted-foreground">
              {dupes.map((x) => (
                <li key={x.id}>
                  <Link href={`/retail/customers/${x.id}`} className="underline-offset-2 hover:underline">
                    {x.display_name ?? formatPhone(x.phone)}
                  </Link>
                  {x.phone ? ` · ${formatPhone(x.phone)}` : ""}
                  {x.email ? ` · ${x.email}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-border p-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Texts about their car</span>
            <span className="block text-caption text-muted-foreground">Confirmations, ready for pickup, receipts.</span>
          </span>
          <Switch checked={d.sms_opt_in} onCheckedChange={(v) => set("sms_opt_in", v)} aria-label="Texts about their car" />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Marketing</span>
            <span className="block text-caption text-muted-foreground">Offers and reminders. Off unless they said yes.</span>
          </span>
          <Switch checked={d.marketing_opt_in} onCheckedChange={(v) => set("marketing_opt_in", v)} aria-label="Marketing" />
        </label>
      </div>

      {!compact && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-source">How they found us</Label>
              <Select value={d.source} onValueChange={(v) => set("source", v as CustomerSource)}>
                <SelectTrigger id="c-source" aria-label="How they found us">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABEL) as CustomerSource[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SOURCE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-tags">Tags</Label>
              <Input id="c-tags" value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="vip, fleet, referral" autoComplete="off" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="c-addr">Address (optional)</Label>
              <Input id="c-addr" value={d.address_line1} onChange={(e) => set("address_line1", e.target.value)} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" value={d.city} onChange={(e) => set("city", e.target.value)} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-state">State</Label>
              <Input id="c-state" value={d.state} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-zip">ZIP</Label>
              <Input id="c-zip" inputMode="numeric" value={d.postal_code} onChange={(e) => set("postal_code", e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Prefers mornings, gate code, allergies to scents…" className="min-h-20" />
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={pending} data-testid="customer-save">
          {customer ? "Save" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { Dealership, InvoiceMode, SubmissionMethod } from "@/lib/db/types";
import { saveDealershipAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id?: string;
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  contact_name: string;
  contact_phone: string;
  ap_contact_name: string;
  ap_emails: string;
  submission_method: SubmissionMethod;
  invoice_mode: InvoiceMode;
  payment_terms: string;
  tax_percent: string;
  active: boolean;
};

const empty: Draft = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "CA",
  postal_code: "",
  contact_name: "",
  contact_phone: "",
  ap_contact_name: "",
  ap_emails: "",
  submission_method: "email",
  invoice_mode: "batch",
  payment_terms: "",
  tax_percent: "",
  active: true,
};

function toDraft(d: Dealership): Draft {
  return {
    id: d.id,
    name: d.name,
    address_line1: d.address_line1 ?? "",
    address_line2: d.address_line2 ?? "",
    city: d.city ?? "",
    state: d.state ?? "",
    postal_code: d.postal_code ?? "",
    contact_name: d.contact_name ?? "",
    contact_phone: d.contact_phone ?? "",
    ap_contact_name: d.ap_contact_name ?? "",
    ap_emails: d.ap_emails.join(", "),
    submission_method: d.submission_method,
    invoice_mode: d.invoice_mode,
    payment_terms: d.payment_terms ?? "",
    tax_percent: d.tax_rate === null ? "" : String(Number(d.tax_rate) * 100),
    active: d.active,
  };
}

export function DealershipsManager({ dealerships }: { dealerships: Dealership[] }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...empty })}>
          <PlusIcon /> Add dealership
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {dealerships.map((d) => (
          <Card key={d.id} className={!d.active ? "opacity-60" : undefined}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.name}</span>
                  {!d.active && <Badge variant="muted">Inactive</Badge>}
                  <Badge variant="outline">{d.invoice_mode === "per_job" ? "Per job" : "Batch"}</Badge>
                  <Badge variant="outline">{d.submission_method}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{[d.address_line1, d.city, d.state].filter(Boolean).join(", ") || "No address"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  AP: {d.ap_contact_name || "—"} · {d.ap_emails.length ? d.ap_emails.join(", ") : <span className="text-warning">no AP email</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Terms: {d.payment_terms ?? "company default"} · Tax: {d.tax_rate === null ? "company default" : `${Number(d.tax_rate) * 100}%`}
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(toDraft(d))}>
                <PencilIcon />
              </Button>
            </CardContent>
          </Card>
        ))}
        {dealerships.length === 0 && <p className="text-sm text-muted-foreground">No dealerships yet.</p>}
      </div>
      {editing && <DealershipSheet draft={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DealershipSheet({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(draft);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const emails = f.ap_emails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    start(async () => {
      const r = await saveDealershipAction({
        id: f.id,
        name: f.name,
        address_line1: f.address_line1,
        address_line2: f.address_line2,
        city: f.city,
        state: f.state,
        postal_code: f.postal_code,
        contact_name: f.contact_name,
        contact_phone: f.contact_phone,
        ap_contact_name: f.ap_contact_name,
        ap_emails: emails,
        submission_method: f.submission_method,
        invoice_mode: f.invoice_mode,
        payment_terms: f.payment_terms,
        tax_rate: f.tax_percent.trim() === "" ? null : Number(f.tax_percent) / 100,
        active: f.active,
      });
      if (r.ok) {
        toast.success("Dealership saved");
        onClose();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle>{f.id ? "Edit dealership" : "New dealership"}</SheetTitle>
            <SheetDescription>Address and AP details print on the invoice; mode and method drive how it is submitted.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-5">
            <div className="grid gap-1.5">
              <Label htmlFor="d-name">Name</Label>
              <Input id="d-name" value={f.name} onChange={set("name")} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-a1">Address</Label>
              <Input id="d-a1" value={f.address_line1} onChange={set("address_line1")} placeholder="Street" />
              <Input value={f.address_line2} onChange={set("address_line2")} placeholder="Suite, building (optional)" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={f.city} onChange={set("city")} placeholder="City" aria-label="City" className="col-span-1" />
              <Input value={f.state} onChange={set("state")} placeholder="State" aria-label="State" />
              <Input value={f.postal_code} onChange={set("postal_code")} placeholder="ZIP" aria-label="ZIP" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="d-cn">Service contact</Label>
                <Input id="d-cn" value={f.contact_name} onChange={set("contact_name")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-cp">Contact phone</Label>
                <Input id="d-cp" value={f.contact_phone} onChange={set("contact_phone")} />
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-4 text-sm font-semibold">Accounts payable &amp; submission</div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-ap">AP contact name</Label>
              <Input id="d-ap" value={f.ap_contact_name} onChange={set("ap_contact_name")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-ape">AP email(s)</Label>
              <Textarea id="d-ape" value={f.ap_emails} onChange={set("ap_emails")} className="min-h-16" placeholder="ap@dealer.com, controller@dealer.com" />
              <p className="text-xs text-muted-foreground">Comma-separated. Invoices are emailed here with the company CC&apos;d.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>Preferred method</Label>
                <Select value={f.submission_method} onValueChange={(v) => setF((s) => ({ ...s, submission_method: v as SubmissionMethod }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="portal">Dealer portal</SelectItem>
                    <SelectItem value="paper">Paper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Invoice mode</Label>
                <Select value={f.invoice_mode} onValueChange={(v) => setF((s) => ({ ...s, invoice_mode: v as InvoiceMode }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="batch">Batch (date range)</SelectItem>
                    <SelectItem value="per_job">Per job (one per RO/PO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {f.invoice_mode === "per_job" && <p className="text-xs text-muted-foreground">Per-job mode creates one invoice per job (jobs that share an RO/PO number are grouped).</p>}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="d-terms">Payment terms</Label>
                <Input id="d-terms" value={f.payment_terms} onChange={set("payment_terms")} placeholder="Company default" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-tax">Tax rate (%)</Label>
                <Input id="d-tax" type="number" step="0.001" min="0" value={f.tax_percent} onChange={set("tax_percent")} placeholder="Company default" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive dealerships are hidden from job entry.</div>
              </div>
              <Switch checked={f.active} onCheckedChange={(v) => setF((s) => ({ ...s, active: v }))} />
            </div>
          </div>
          <div className="mt-auto flex gap-2 px-5 pb-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />} Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

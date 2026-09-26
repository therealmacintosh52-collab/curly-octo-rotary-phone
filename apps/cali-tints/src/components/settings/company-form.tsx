"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/db/types";
import { removeLogoAction, updateCompanyAction, uploadLogoAction } from "@/app/(app)/settings/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIMEZONES = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];

function Field({ label, id, children, hint }: { label: string; id: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CompanyForm({ company, logoUrl }: { company: Company; logoUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: company.name,
    email: company.email ?? "",
    phone: company.phone ?? "",
    address_line1: company.address_line1 ?? "",
    address_line2: company.address_line2 ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    postal_code: company.postal_code ?? "",
    ein: company.ein ?? "",
    payment_terms: company.payment_terms,
    tax_percent: String(Number(company.tax_rate) * 100),
    invoice_prefix: company.invoice_prefix,
    reminder_days: String(company.reminder_days),
    timezone: company.timezone,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const fileRef = useRef<HTMLInputElement>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await updateCompanyAction({
        ...f,
        tax_rate: Number(f.tax_percent) / 100,
        reminder_days: Number(f.reminder_days),
      });
      if (r.ok) {
        toast.success("Company saved");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form onSubmit={save} className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Company profile</CardTitle>
            <CardDescription>Shown on every invoice and in the email footer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" id="name">
              <Input id="name" value={f.name} onChange={set("name")} required />
            </Field>
            <Field label="EIN / tax ID" id="ein">
              <Input id="ein" value={f.ein} onChange={set("ein")} placeholder="12-3456789" />
            </Field>
            <Field label="Billing email" id="email" hint="CC'd on every invoice email and used as reply-to.">
              <Input id="email" type="email" value={f.email} onChange={set("email")} />
            </Field>
            <Field label="Phone" id="phone">
              <Input id="phone" value={f.phone} onChange={set("phone")} />
            </Field>
            <Field label="Address line 1" id="a1">
              <Input id="a1" value={f.address_line1} onChange={set("address_line1")} />
            </Field>
            <Field label="Address line 2" id="a2">
              <Input id="a2" value={f.address_line2} onChange={set("address_line2")} />
            </Field>
            <Field label="City" id="city">
              <Input id="city" value={f.city} onChange={set("city")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State" id="state">
                <Input id="state" value={f.state} onChange={set("state")} />
              </Field>
              <Field label="ZIP" id="zip">
                <Input id="zip" value={f.postal_code} onChange={set("postal_code")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoicing defaults</CardTitle>
            <CardDescription>Dealerships can override terms and tax rate individually.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment terms" id="terms" hint='"Net 30" style terms also set the due date on the PDF.'>
              <Input id="terms" value={f.payment_terms} onChange={set("payment_terms")} />
            </Field>
            <Field label="Tax rate (%)" id="tax" hint="0 for labor-only services in most states.">
              <Input id="tax" type="number" step="0.001" min="0" max="50" value={f.tax_percent} onChange={set("tax_percent")} />
            </Field>
            <Field label="Invoice number prefix" id="prefix" hint={`Next invoice: ${f.invoice_prefix}${String(company.next_invoice_number).padStart(6, "0")}`}>
              <Input id="prefix" value={f.invoice_prefix} onChange={set("invoice_prefix")} />
            </Field>
            <Field label="Overdue reminder (days)" id="reminder" hint="Submitted invoices unpaid this long are flagged on the dashboard.">
              <Input id="reminder" type="number" min="1" max="365" value={f.reminder_days} onChange={set("reminder_days")} />
            </Field>
            <Field label="Timezone" id="tz" hint="Used to decide which day a job belongs to.">
              <Select value={f.timezone} onValueChange={(v) => setF((s) => ({ ...s, timezone: v }))}>
                <SelectTrigger id="tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  {!TIMEZONES.includes(f.timezone) && <SelectItem value={f.timezone}>{f.timezone}</SelectItem>}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />} Save changes
          </Button>
        </div>
      </form>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>PNG, JPG, WebP or SVG up to 2 MB. Square works best on the PDF.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Logo size={120} src={logoUrl} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const r = await uploadLogoAction(fd);
                if (r.ok) {
                  toast.success("Logo updated");
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
            className="flex w-full flex-col gap-2"
          >
            <input ref={fileRef} type="file" name="logo" accept="image/*" className="hidden" onChange={(e) => e.target.form?.requestSubmit()} />
            <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
              <UploadIcon /> Upload new logo
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await removeLogoAction();
                    if (r.ok) router.refresh();
                    else toast.error(r.error);
                  })
                }
              >
                Use default Cali Tints mark
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

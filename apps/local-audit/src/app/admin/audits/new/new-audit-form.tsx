"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAuditAction } from "../actions";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NewAuditForm() {
  const [state, action, pending] = useActionState(createAuditAction, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{state.error}</AlertTitle>
          {state.problems?.length ? (
            <AlertDescription>
              <ul className="list-disc pl-4">
                {state.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <Field id="website" label="Website" hint="Bare domain is fine. We follow redirects and read the home and contact pages.">
        <Input id="website" name="website" placeholder="testplumbing.example" autoComplete="off" />
      </Field>
      <Field id="gbp" label="Google Business Profile" hint="A maps.app.goo.gl share link, a google.com/maps URL, or just “Business name, City”.">
        <Input id="gbp" name="gbp" placeholder="https://maps.app.goo.gl/… or Test Plumbing, Sacramento CA" autoComplete="off" />
      </Field>
      <Field id="yelp" label="Yelp URL" hint="yelp.com/biz/… Only used when a Yelp key is configured.">
        <Input id="yelp" name="yelp" placeholder="https://www.yelp.com/biz/test-plumbing-sacramento" autoComplete="off" />
      </Field>
      <Field id="extraUrls" label="Other profiles (optional)" hint="One per line: Facebook, Instagram, Nextdoor, BBB, Angi, Thumbtack… Stored now, checked in later phases.">
        <textarea
          id="extraUrls"
          name="extraUrls"
          rows={3}
          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="serviceArea" label="Service area (optional)">
          <Input id="serviceArea" name="serviceArea" placeholder="Sacramento, CA" />
        </Field>
        <Field id="services" label="Main services (optional)">
          <Input id="services" name="services" placeholder="plumbing, water heaters" />
        </Field>
        <Field id="avgTicket" label="Average ticket $ (optional)">
          <Input id="avgTicket" name="avgTicket" inputMode="decimal" placeholder="300" />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-caption text-muted-foreground">Phase 1 resolves the business and cross-checks name, address and phone. Costs a few cents in Google/Yelp calls when keys are set.</p>
        <Button type="submit" loading={pending}>
          Run audit
        </Button>
      </div>
    </form>
  );
}

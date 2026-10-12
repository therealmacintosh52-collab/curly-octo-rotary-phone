import Link from "next/link";
import { Activity, Car, ShieldCheck, Sparkles, Wrench, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const FEATURES = [
  { icon: Car, title: "VIN decode + garage", text: "Scan the door-jamb barcode, decode specs, save the vehicle." },
  { icon: ShieldCheck, title: "Recalls & complaints", text: "Open NHTSA recalls and owner complaints grouped by component." },
  { icon: Activity, title: "DTC lookup", text: "Definitions, confirmed fixes ranked by net confirmations, related complaints." },
  { icon: Wrench, title: "Confirmed Fixes", text: "Structured write-ups with tests, root cause, parts and real labor time." },
  { icon: Sparkles, title: "AI diagnostic assistant", text: "Ranked causes and a cheapest-first test plan, grounded only in our data with citations." },
  { icon: FileText, title: "Estimates & repair orders", text: "Line items, tax, PDF, shareable customer link. One tap from RO to fix." },
];

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/garage");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-10">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-block size-7 rounded-md bg-primary" aria-hidden /> {APP_NAME}
      </div>
      <h1 className="mt-10 text-4xl font-bold leading-tight tracking-tight">{APP_TAGLINE}</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Repair intelligence for independent shops, mobile mechanics and serious DIYers. Built on public data and
        community-confirmed fixes, with an AI layer that only cites what is in the database.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/signup">Create free account</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-xl border border-border bg-card p-4">
            <Icon className="size-6 text-primary" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-xs text-muted-foreground">
        All information is advisory and must be verified against OEM service information. <Link href="/terms" className="underline">Terms</Link> ·{" "}
        <Link href="/pricing" className="underline">Pricing</Link>
      </p>
    </main>
  );
}

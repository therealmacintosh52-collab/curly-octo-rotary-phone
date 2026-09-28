import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cloverContext } from "@/lib/clover/invoices";
import { CLOVER_HOSTS } from "@/lib/clover/env";
import { cloverPublicKey } from "@/lib/clover/client";
import { CloverSetupChecklist, cloverSetupSteps } from "@/components/clover/setup-checklist";
import { cloverStatus } from "@/lib/clover/status";
import type { TerminalTransaction } from "@/lib/db/types";
import { Terminal } from "@/components/terminal/terminal";
import { todayIn } from "@/lib/dates";
import type { OpenInvoiceOption } from "@/components/invoices/clover-queue";

export const metadata: Metadata = { title: "Terminal" };
// "Pay on terminal" waits for the customer to tap; give server actions from this page up to 60 s.
export const maxDuration = 60;

/** Point of sale: everything the Clover terminal does, from any phone or laptop. */
export default async function TerminalPage(props: PageProps<"/terminal">) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const today = todayIn(session.company.timezone);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const [{ data: txs }, { data: invoices }] = await Promise.all([
    supabase.rpc("terminal_transactions", { p_start: date, p_end: date }),
    supabase.from("invoices").select("id, display_number, total, amount_paid, dealership:dealerships(name, ap_emails)").in("status", ["draft", "submitted", "partial"]).order("number", { ascending: false }).limit(200),
  ]);
  const openInvoices: OpenInvoiceOption[] = (invoices ?? [])
    .map((i) => {
      const d = i.dealership as unknown as { name: string; ap_emails: string[] } | null;
      return { id: i.id, display_number: i.display_number, dealership: d?.name ?? "", balance: Number(i.total) - Number(i.amount_paid), email: d?.ap_emails?.[0] ?? null };
    })
    .filter((i) => i.balance > 0);
  // Deep link from "Save & charge" / "Collect payment": ?invoice=<id>&method=card|device
  const initialInvoiceId = typeof sp.invoice === "string" && openInvoices.some((i) => i.id === sp.invoice) ? sp.invoice : null;
  // ?invoices=all or ?invoices=a,b,c: settle several with one payment
  const initialInvoiceIds = typeof sp.invoices === "string" ? (sp.invoices === "all" ? openInvoices.map((i) => i.id) : sp.invoices.split(",").filter((id) => openInvoices.some((i) => i.id === id))) : null;
  const initialMethod = sp.method === "card" || sp.method === "device" ? sp.method : null;
  const missingInvoice = typeof sp.invoice === "string" && !initialInvoiceId ? sp.invoice : null;

  const clover = cloverContext(session.company);
  const ecomPublicKey = clover ? await cloverPublicKey(clover) : null;
  const cloverCard = clover && ecomPublicKey ? { publicKey: ecomPublicKey, merchantId: clover.merchantId, sdkUrl: CLOVER_HOSTS[clover.env].sdk } : null;

  const status = await cloverStatus(session.company);
  const checklist = cloverSetupSteps(session.company, status, process.env.NEXT_PUBLIC_APP_URL ?? null);

  return (
    <Terminal
      date={date}
      initialInvoiceId={initialInvoiceId}
      initialInvoiceIds={initialInvoiceIds}
      initialMethod={initialMethod}
      missingInvoice={missingInvoice}
      checklist={<CloverSetupChecklist steps={checklist} className="mt-6" />}
      connection={{ enabled: status.enabled, connected: status.connected, healthy: status.healthy, needsReconnect: status.needsReconnect, merchantName: status.merchantName, device: status.device }}
      today={today}
      transactions={(txs ?? []) as TerminalTransaction[]}
      openInvoices={openInvoices}
      cloverCard={cloverCard}
      cloverDevice={!!(clover && session.company.clover_device_id)}
      cloverEnabled={!!clover}
      company={session.company}
    />
  );
}

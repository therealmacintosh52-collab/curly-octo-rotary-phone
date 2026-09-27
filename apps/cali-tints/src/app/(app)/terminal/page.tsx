import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cloverContext } from "@/lib/clover/invoices";
import { CLOVER_HOSTS, cloverSecrets } from "@/lib/clover/env";
import type { TerminalTransaction } from "@/lib/db/types";
import { Terminal } from "@/components/terminal/terminal";
import type { OpenInvoiceOption } from "@/components/invoices/clover-queue";

export const metadata: Metadata = { title: "Terminal" };
// "Pay on terminal" waits for the customer to tap; give server actions from this page up to 60 s.
export const maxDuration = 60;

function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Point of sale: everything the Clover terminal does, from any phone or laptop. */
export default async function TerminalPage(props: PageProps<"/terminal">) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const today = todayIn(session.company.timezone);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const [{ data: txs }, { data: invoices }] = await Promise.all([
    supabase.rpc("terminal_transactions", { p_start: date, p_end: date }),
    supabase.from("invoices").select("id, display_number, total, amount_paid, dealership:dealerships(name)").in("status", ["draft", "submitted", "partial"]).order("number", { ascending: false }).limit(200),
  ]);
  const openInvoices: OpenInvoiceOption[] = (invoices ?? [])
    .map((i) => ({ id: i.id, display_number: i.display_number, dealership: (i.dealership as unknown as { name: string } | null)?.name ?? "", balance: Number(i.total) - Number(i.amount_paid) }))
    .filter((i) => i.balance > 0);

  const clover = cloverContext(session.company);
  const ecomPublicKey = cloverSecrets().ecomPublicKey;
  const cloverCard = clover && ecomPublicKey ? { publicKey: ecomPublicKey, merchantId: clover.merchantId, sdkUrl: CLOVER_HOSTS[clover.env].sdk } : null;

  return (
    <Terminal
      date={date}
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

import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Terminal } from "@/components/terminal/terminal";
import type { OpenInvoiceOption } from "@/components/invoices/clover-queue";
import type { Profile } from "@/lib/db/types";
import { invoiceBundleFixture, invoiceListFixture, terminalTransactionsFixture } from "@/test/fixtures";

/** Dev-only Terminal with fixture transactions (guest preview in production). Sales and refunds are simulated. */
export default async function DevTerminalPreview(props: PageProps<"/dev/preview/terminal">) {
  const sp = await props.searchParams;
  const b = invoiceBundleFixture();
  const profile = { id: "u1", company_id: b.company.id, role: "owner", full_name: "Mike", email: null, active: true } as Profile;
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const invoiceParam = typeof sp.invoice === "string" ? sp.invoice : null;
  const invoicesParam = typeof sp.invoices === "string" ? sp.invoices : null;
  const method = sp.method === "card" || sp.method === "device" ? sp.method : null;

  // The same open invoices the Invoices list shows: one car each, plus the old multi-car INV-000012 (the sample invoice page).
  const AP: Record<string, string> = { "Mercedes-Benz of El Dorado Hills": b.dealership.ap_emails[0] ?? "ap@mbeldoradohills.example", "Mercedes-Benz of Sacramento": "ap@mbsacramento.example" };
  const openInvoices: OpenInvoiceOption[] = invoiceListFixture()
    .filter((r) => r.balance > 0 && !r.deleted)
    .map((r) => ({
      id: r.display_number === b.invoice.display_number ? b.invoice.id : r.id,
      display_number: r.display_number,
      dealership: r.dealership,
      balance: r.balance,
      email: AP[r.dealership] ?? null,
      tag: r.cars[0]?.tag ?? null,
      vehicle: r.cars[0]?.vehicle ?? null,
      service: r.services.join(", ") || null,
      date: r.period_end,
      car_count: r.car_count,
    }));
  const known = (id: string) => openInvoices.some((i) => i.id === id);

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company: b.company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Terminal
            date={date}
            today={today}
            transactions={date === today ? terminalTransactionsFixture() : []}
            openInvoices={openInvoices}
            // ?invoice= from a preview page lands on that fixture; anything else lands on the sample invoice.
            initialInvoiceId={invoiceParam ? (known(invoiceParam) ? invoiceParam : b.invoice.id) : null}
            initialInvoiceIds={invoicesParam ? (invoicesParam === "all" ? openInvoices.map((i) => i.id) : invoicesParam.split(",").filter(known)) : null}
            initialMethod={method}
            connection={{ enabled: true, connected: true, healthy: true, needsReconnect: false, merchantName: "Cali Tints (sandbox)", device: true }}
            cloverCard={{ publicKey: "demo", merchantId: "7G9V9DP834ZY2", sdkUrl: "about:blank" }}
            cloverDevice
            cloverEnabled
            company={b.company}
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}

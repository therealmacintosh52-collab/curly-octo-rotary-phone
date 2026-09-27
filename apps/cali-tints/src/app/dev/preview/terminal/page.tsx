import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Terminal } from "@/components/terminal/terminal";
import type { Profile } from "@/lib/db/types";
import { invoiceBundleFixture, terminalTransactionsFixture } from "@/test/fixtures";

/** Dev-only Terminal with fixture transactions (guest preview in production). Sales and refunds are simulated. */
export default async function DevTerminalPreview(props: PageProps<"/dev/preview/terminal">) {
  const sp = await props.searchParams;
  const b = invoiceBundleFixture();
  const profile = { id: "u1", company_id: b.company.id, role: "owner", full_name: "Owner (preview)", email: null, active: true } as Profile;
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const balance = Number(b.invoice.total) - Number(b.invoice.amount_paid);
  const invoiceParam = typeof sp.invoice === "string" ? sp.invoice : null;
  const method = sp.method === "card" || sp.method === "device" ? sp.method : null;

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company: b.company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Terminal
            date={date}
            today={today}
            transactions={date === today ? terminalTransactionsFixture() : []}
            openInvoices={[
              { id: b.invoice.id, display_number: b.invoice.display_number, dealership: b.dealership.name, balance, email: b.dealership.ap_emails[0] ?? null },
              { id: "30000000-0000-4000-8000-000000000002", display_number: "INV-000011", dealership: "Mercedes-Benz of Sacramento", balance: 1375.5, email: "ap@mbsacramento.example" },
              { id: "30000000-0000-4000-8000-000000000003", display_number: "INV-000010", dealership: "Mercedes-Benz of Sacramento", balance: 4210, email: "ap@mbsacramento.example" },
            ]}
            // Any ?invoice= in the guest preview lands on the sample invoice (ids from other preview pages are fixtures too).
            initialInvoiceId={invoiceParam ? b.invoice.id : null}
            initialMethod={method}
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

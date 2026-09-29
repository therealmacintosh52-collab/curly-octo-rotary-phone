import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { UserRole } from "@/lib/db/types";
import { canTakePayments, canManageSettings, isCompanyWide } from "@/lib/roles";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/*
  "How it works": every screen the signed-in person can use, every input on
  it, and what comes out. Written for the lot, not for engineers. The role
  decides which sections show, so a detailer never reads about the Terminal.
*/

const ROLE_LABEL: Record<UserRole, string> = { owner: "Owner", admin: "Admin", manager: "Manager", detailer: "Detailer" };

/** One input or button: what you do, what happens. */
function Row({ what, does }: { what: string; does: React.ReactNode }) {
  return (
    <li className="grid gap-0.5 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
      <span className="text-sm font-medium">{what}</span>
      <span className="text-sm text-muted-foreground">{does}</span>
    </li>
  );
}

function Section({ id, title, intro, children, only }: { id: string; title: string; intro?: string; children: React.ReactNode; only?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-border bg-card surface-raised px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-heading">{title}</h2>
        {only && <Badge variant="outline">{only}</Badge>}
      </div>
      {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Inputs({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h3 className="text-label mt-3 text-subtle">What you do</h3>
      <ul className="divide-y divide-border">{children}</ul>
    </>
  );
}

function Outputs({ items }: { items: React.ReactNode[] }) {
  return (
    <>
      <h3 className="text-label mt-3 text-subtle">What comes out</h3>
      <ul className="mt-1 grid gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Guide({ role, name, welcome = false, roleSwitcher }: { role: UserRole; name: string; /** First sign-in: a "Got it" button at the end. */ welcome?: boolean; /** Guest preview only: the role picker. */ roleSwitcher?: React.ReactNode }) {
  const wide = isCompanyWide(role);
  const money = canTakePayments(role);
  const settings = canManageSettings(role);
  const first = name.trim().split(/\s+/)[0] || "there";

  const toc = [
    { id: "sign-in", label: "Signing in" },
    { id: "dashboard", label: "Dashboard" },
    { id: "new", label: "New invoice" },
    { id: "invoices", label: "Invoices" },
    { id: "invoice", label: "One invoice" },
    ...(money ? [{ id: "terminal", label: "Terminal" }] : []),
    ...(settings ? [{ id: "settings", label: "Settings" }] : []),
    { id: "status", label: "What the statuses mean" },
    { id: "help", label: "If something looks wrong" },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="How it works"
        title={welcome ? `Welcome, ${first}` : "How it works"}
        description={`Every screen you can use as ${ROLE_LABEL[role].toLowerCase()}, what to type or tap, and what happens next. Five minutes, then you know the whole app.`}
        actions={roleSwitcher}
      />

      <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-1.5">
        {toc.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-full border border-border bg-card px-3 py-1 text-caption font-medium text-muted-foreground hover:border-border-strong hover:text-foreground">
            {t.label}
          </a>
        ))}
      </nav>

      <div className="mt-5 grid gap-4">
        <Section id="sign-in" title="Signing in" intro="One login per person. Your name shows on everything you log.">
          <Inputs>
            <Row what="Email and password" does="The ones the owner gave you. Tap Forgot password on the sign-in page to get a reset link by email." />
            <Row what="Add to Home Screen" does="Open the app in Safari or Chrome, Share → Add to Home Screen. It becomes an icon like any app and keeps working with no signal; anything you log offline sends itself when you are back on." />
          </Inputs>
          <Outputs items={["Your dashboard opens.", "The bottom bar shows only the screens your role can use."]} />
        </Section>

        <Section id="dashboard" title="Dashboard" intro={wide ? "The day at a glance for the whole company. Every number opens the invoices behind it." : "Your own cars at a glance. Nobody else's work, no money."}>
          <Inputs>
            {wide ? (
              <>
                <Row what="Today · This week · This month" does="Cars detailed, with the split by service (Used, PDI, Sold…). Tap one to see those cars in the Invoices list." />
                <Row what="Still to collect · Not sent yet · Sent, unpaid" does="What the dealerships owe and where each invoice stands. Tap to see the list." />
                <Row what="Paid · Collected · Overdue" does="Money received in the last 90 days, and invoices unpaid longer than the reminder period in Settings." />
                <Row what="Income range (Week, Month, YTD…)" does="Changes the income tiles below it. The page stays where you are." />
                <Row what="Breakdown · month picker" does="Revenue by service and by week for that month." />
                <Row what="New invoice button" does="Same as the New tab: log the next car." />
              </>
            ) : (
              <>
                <Row what="Today" does="How many cars you logged today and the split by service." />
                <Row what="This week · This month" does="Your totals. Tap to see the cars." />
                <Row what="Today's cars" does="Each car you logged today. Tap one to open its invoice." />
                <Row what="Your cars per day" does="The last 30 days, one bar per day." />
              </>
            )}
          </Inputs>
          <Outputs items={["Nothing is changed by looking. Numbers update the moment a car is logged or a payment lands.", "The greeting follows the clock: Good morning until noon, afternoon until 5, then evening."]} />
        </Section>

        <Section id="new" title="New invoice" intro="Every car you log becomes its own invoice the moment you save. There is no separate invoicing step.">
          <Inputs>
            <Row what="Dealership" does="Who gets billed. Remembers your last pick." />
            <Row what="Tag / stock number" does="The number on the car. Required. Type it or tap Scan barcode and point the camera at the window sticker or the key tag." />
            <Row what="VIN" does="Optional. Type the 17 characters or scan the barcode; the year, make and model fill in on their own." />
            <Row what="Year · Make · Model · Color" does="Filled by the VIN when you scan. Make lists the common ones; pick Other to type a make that is not there." />
            <Row what="Services" does="Tap every service done on this car: Used, PDI, Sold, Loaner, Paint Correction and so on. The price comes from the price list. Pick Other and type what was done when it is not on the menu." />
            <Row what="Price" does="Pre-filled from the dealership's price list. Change it only when the job was different; a reason is asked when the price is outside the normal range." />
            {wide && <Row what="Detailer" does="Who did the car. Defaults to you." />}
            <Row what="RO / PO number" does="Optional. The dealership's repair or purchase order, printed on the invoice." />
            <Row what="Notes" does="Optional. Anything the office should know. Printed on the invoice." />
            <Row what="Save" does="Saves the car and makes its invoice. The form clears for the next car." />
            {money && <Row what="Save & charge" does="Saves, then opens the Terminal with this invoice selected so you can take the card right away." />}
          </Inputs>
          <Outputs
            items={[
              "A green card shows the tag, the invoice number (INV-000123) and the total.",
              "The invoice appears at the top of the Invoices list, under Today, marked Not sent.",
              wide ? "If Clover is on, the invoice is also created as an order in Clover." : "The office sees it on their side right away.",
              "No signal? It is kept on the phone and sent when you are back online. The Invoices list shows a Waiting badge until then.",
            ]}
          />
        </Section>

        <Section id="invoices" title="Invoices" intro={wide ? "Every car ever logged, one row each, newest first under day headers." : "The cars you logged, one row each, newest first."}>
          <Inputs>
            <Row what="Search box" does={<>Type a tag, VIN, model, invoice number, dealership or service. Or a date: <em>today</em>, <em>yesterday</em>, <em>9/27</em>, <em>sep 27</em>, <em>last week</em>.</>} />
            <Row what="Scan VIN" does="Finds the car by its VIN barcode." />
            <Row what="All · Unpaid · Overdue · Paid" does={wide ? "Show only invoices in that state. Unpaid opens extra chips: Not sent, Sent to dealer, Partly paid. Owners and admins also see Void and Archive." : "Show only invoices in that state."} />
            <Row what="Filters" does="Dealership, service, detailer and a date range. Chips above the list show what is on; tap one to clear it." />
            <Row what="Day headers" does="Today, Yesterday, then each weekday, with the count and total for that day." />
            <Row what="A row" does="Opens that invoice." />
            {wide && <Row what="Send invoices" does="Emails every Not sent invoice to its dealership. Tick which ones, tap the eye to see the email first, then Send. Each goes as its own email with the PDF and a CSV attached." />}
            {money && <Row what="Collect all unpaid" does="Opens the Terminal with every unpaid invoice selected so one payment settles them all." />}
            {money && <Row what="Collect on a row" does="Opens the Terminal with just that invoice." />}
          </Inputs>
          <Outputs items={["Sent invoices change from Not sent to Sent to dealer and get a timestamp.", "Nothing else changes by searching or filtering."]} />
        </Section>

        <Section id="invoice" title="One invoice" intro="Everything about one car on one page: the car, where the money stands, the services and prices, and every email and payment.">
          <Inputs>
            <Row what="Where it stands" does="Three steps: Logged, Sent to the dealership, Paid. The current step is highlighted with the date." />
            <Row what="Edit invoice" does="Fix a typo or add a service, only while the invoice is Not sent with nothing paid. After that the car is locked and the invoice is the record." />
            <Row what="Delete invoice" does="Moves it to the Archive with the reason you type. Nothing is ever erased; Restore brings it back as an unsent draft with the same number." />
            {wide && <Row what="Submit by email · Resend" does="Emails the invoice to the dealership's AP contact with the PDF and CSV. Every send is listed under History." />}
            {wide && <Row what="Send payment link" does="Emails, copies or texts a Clover pay-by-card link for the balance. The dealership pays on Clover's page and the invoice flips to Paid on its own." />}
            {money && <Row what="Collect" does="The menu: pay on the Clover terminal, card typed in the app, cash, check or ACH. Each opens the Terminal with this invoice ready." />}
            {wide && <Row what="Add payment" does="Record a check or ACH that arrived in the mail: amount, date, method, reference. The balance updates." />}
            {wide && <Row what="Mark as submitted" does="For invoices uploaded to the dealer portal or handed over on paper. Attach the confirmation if you have one." />}
            {wide && <Row what="Download" does="Branded PDF, print-ready PDF, CSV or Excel of the lines." />}
            {wide && <Row what="Void" does="Cancels the invoice (only if nothing is paid). The number is kept; the car can be invoiced again." />}
          </Inputs>
          <Outputs items={["Every action is written to History with who did it and when.", wide ? "A payment marks the invoice Partly paid or Paid, and it leaves Unpaid everywhere." : "When the office records the payment, the invoice shows Paid."]} />
        </Section>

        {money && (
          <Section id="terminal" title="Terminal" only="Owner and admin" intro="The register. Take a payment for one or many invoices, or a quick sale, and see the day's money.">
            <Inputs>
              <Row what="Keypad" does="Type the amount like a register: 4 5 00 is $45.00. It fills itself when you tick invoices." />
              <Row what="Invoices · Quick sale" does="Invoices: pay open invoices. Quick sale: a walk-in or anything not on an invoice, with a description, name and email for the receipt." />
              <Row what="Search box" does="Tag, model, invoice number, dealership, or a date." />
              <Row what="Date chips · day picker" does="All dates, Today, Yesterday, This week, Last week, This month, Last month, or any day. The list keeps its day headers." />
              <Row what="The list" does="Tick one or several invoices. The amount becomes their balance. Select all unpaid ticks everything shown." />
              <Row what="Card" does="Type the card into Clover's secure form. The number never touches this app." />
              <Row what="Terminal" does="Sends the amount to the Clover device; the customer taps their card there." />
              <Row what="Cash · Check · ACH" does="Records money that arrived that way. Check asks for the check number." />
              <Row what="Today (right side)" does="Every sale and refund today, with Sales, Refunds and Net. Change the date to see another day. Tap a line for its receipt." />
              <Row what="Receipt" does="Email it to the dealership, print it, or refund part or all of it. Card refunds go back to the same card." />
            </Inputs>
            <Outputs items={["The payment lands on the invoice(s) at once; a partial amount goes to the oldest first.", "The invoice shows Paid or Partly paid everywhere; the day's Net updates.", "With Settings → Receipts on, the dealership gets the receipt by email automatically."]} />
          </Section>
        )}

        {settings && (
          <Section id="settings" title="Settings" only="Owner and admin" intro="Set once, change any time.">
            <Inputs>
              <Row what="Company" does="Name, address, phone, billing email and EIN as they print on invoices and receipts. Tax rate, invoice number prefix, overdue reminder days, timezone, logo." />
              <Row what="Receipts" does="Email a receipt automatically: when on, every invoice payment emails the dealership's AP contact a receipt the moment it lands. Off by default." />
              <Row what="Dealerships" does="Each dealership's AP contact and emails (where invoices go), how they want invoices (email, portal, paper) and a tax override." />
              <Row what="Services & prices" does="The menu and its prices, plus a per-dealership price grid. A service can have a normal range; prices outside it ask for a reason." />
              <Row what="Users" does="Add people with a password or an email invite. Roles: Detailer (own cars), Manager (every invoice, sending, no Terminal or Settings), Admin (everything), Owner. Deactivate to block sign-in without losing history." />
              <Row what="Clover" does="Sign in with Clover, device serial, connection test. The Getting set up checklist lists what is missing." />
              <Row what="Export" does="Every table as CSV for the accountant." />
            </Inputs>
            <Outputs items={["Changes apply immediately to new invoices; existing invoices keep the details they were made with."]} />
          </Section>
        )}

        <Section id="status" title="What the statuses mean">
          <ul className="divide-y divide-border">
            <Row what="Not sent" does="Invoice made, not sent to the dealership yet." />
            <Row what="Sent to dealer" does="Emailed or handed to the dealership; waiting on their payment." />
            <Row what="Partly paid" does="Some money received, balance still due." />
            <Row what="Paid" does="Paid in full." />
            <Row what="Overdue" does="Unpaid longer than the reminder period in Settings." />
            <Row what="Void" does="Cancelled; nothing billed; the car can be invoiced again." />
            <Row what="Archive" does="Deleted with Delete invoice; restorable any time." />
            <Row what="Waiting" does="Logged with no signal; sends itself when the phone is back online." />
          </ul>
        </Section>

        <Section id="help" title="If something looks wrong">
          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li>A car is missing: check the date filter and the status chips first, then search its tag.</li>
            <li>A price is wrong on a Not sent invoice: Edit invoice. On a sent one: Void it and log the car again.</li>
            <li>Logged the wrong car: Delete invoice. It sits in the Archive if you need it back.</li>
            {money && <li>Card declined on the terminal: try again or take it as Card in the app; nothing is recorded until Clover approves.</li>}
            <li>Still stuck: tell the owner what you tapped and what the screen said. Every action is in the invoice History.</li>
          </ul>
        </Section>
      </div>

      <div className={cn("mt-6 flex flex-wrap items-center gap-3", welcome ? "justify-between" : "justify-end")}>
        <p className="text-caption text-subtle">You can reopen this any time from the ? in the top bar.</p>
        <Button asChild size="lg">
          <Link href="/">{welcome ? "Got it, take me to the app" : "Back to the app"}</Link>
        </Button>
      </div>
    </Page>
  );
}

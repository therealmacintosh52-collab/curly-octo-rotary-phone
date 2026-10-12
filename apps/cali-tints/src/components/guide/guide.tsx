import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { UserRole } from "@/lib/db/types";
import { canManageSettings, canSeeMoney, isCompanyWide } from "@/lib/roles";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/*
  "How it works": every screen the signed-in person can use, every input on
  it, and what comes out. Written for the lot, not for engineers. The role
  decides which sections show, so a detailer never reads about Settings.
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
  const settings = canManageSettings(role);
  const money = canSeeMoney(role);
  const first = name.trim().split(/\s+/)[0] || "there";

  const toc = [
    { id: "sign-in", label: "Signing in" },
    { id: "dashboard", label: "Dashboard" },
    { id: "new", label: "New job" },
    { id: "jobs", label: "Jobs" },
    { id: "clover-flex", label: "On the Clover Flex" },
    ...(money ? [{ id: "invoices", label: "Invoices" }, { id: "invoice", label: "One invoice" }] : []),
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

        <Section id="dashboard" title="Dashboard" intro={money ? "The day at a glance for the whole company. Every number opens the jobs behind it." : wide ? "The whole team's day at a glance: cars, not money." : "Your own cars at a glance. Nobody else's work, no money."}>
          <Inputs>
            {money ? (
              <>
                <Row what="Today · This week · This month" does="Cars detailed, with the split by service (Used, PDI, Sold…). Tap one to see those cars in the Jobs list." />
                <Row what="Still to collect · Not sent yet · Sent, unpaid" does="What the dealerships owe and where each invoice stands. Tap to see the list." />
                <Row what="Paid · Collected · Overdue" does="Money received in the last 90 days, and invoices unpaid longer than the reminder period in Settings." />
                <Row what="Income range (Week, Month, YTD…)" does="Changes the income tiles below it. The page stays where you are." />
                <Row what="Breakdown · month picker" does="Revenue by service and by week for that month." />
                <Row what="Jobs needing a price" does="Open jobs where someone logged Other without a price. Tap to see them; set the price with Edit job before the month closes." />
                <Row what="New job button" does="Same as the New tab: log the next car." />
              </>
            ) : wide ? (
              <>
                <Row what="Today · This week · This month" does="Cars the team detailed, with the split by service. Tap one to see those cars in the Jobs list." />
                <Row what="This month by detailer" does="Who logged how many cars today and this month." />
                <Row what="Today's cars" does="Every car logged today, by anyone. Tap one to open the job." />
              </>
            ) : (
              <>
                <Row what="Today" does="How many cars you logged today and the split by service." />
                <Row what="This week · This month" does="Your totals. Tap to see the cars." />
                <Row what="Today's cars" does="Each car you logged today. Tap one to open the job." />
                <Row what="Your cars per day" does="The last 30 days, one bar per day." />
              </>
            )}
          </Inputs>
          <Outputs items={["Nothing is changed by looking. Numbers update the moment a car is logged or a payment lands.", "The greeting follows the clock: Good morning until noon, afternoon until 5, then evening."]} />
        </Section>

        <Section id="new" title="New job" intro="One car, one job. Every job goes straight onto the dealership's QuickBooks invoice for the month; nobody types anything into QuickBooks by hand.">
          <Inputs>
            <Row what="Dealership" does="Who gets billed. Remembers your last pick." />
            <Row what="Stock number" does="The dealership's stock number for the car. Required. Type it or tap Scan barcode and point the camera at the window sticker or the stock tag." />
            <Row what="VIN" does="Optional. Type the 17 characters or scan the barcode; the year, make and model fill in on their own." />
            <Row what="Year · Make · Model" does="Required. Filled by the VIN when you scan; otherwise pick them. Make lists the common ones; pick Other to type a make that is not there. Color is optional." />
            <Row what="Services" does={money ? "Tap every service done on this car: Used, PDI, Sold, Loaner, Paint Correction and so on. The price comes from the price list. Pick Other and type what was done when it is not on the menu." : "Tap every service done on this car: Used, PDI, Sold, Loaner, Paint Correction and so on. No prices here; the owner's price list does that. Pick Other and type what was done when it is not on the menu."} />
            {money && <Row what="Price" does="Pre-filled from the dealership's price list. Change it only when the job was different; a reason is asked when the price is outside the normal range. Other logged by someone else shows Needs a price until you set it." />}
            {wide && <Row what="Detailer" does="Who did the car. Defaults to you." />}
            <Row what="RO / PO number" does="Optional. The dealership's repair or purchase order, printed on the invoice." />
            <Row what="Notes" does="Optional. Anything the office should know. Printed on the invoice." />
            <Row what="Photos" does="Optional. Take a photo opens the camera (inside the app on a Clover Flex); up to eight per car. A photo settles any damage question." />
            <Row what="Save & next" does="Saves the job. The form clears for the next car." />
          </Inputs>
          <Outputs
            items={[
              "A green card shows the stock number and the dealership, with Open job.",
              "The job appears at the top of the Jobs list, under Today, and within seconds as a line on the dealership's open QuickBooks invoice for the month (the QB number shows on the row).",
              "The office sees it on their side right away.",
              "No signal? It is kept on the device and sent when you are back online.",
            ]}
          />
        </Section>

        <Section id="jobs" title="Jobs" intro={wide ? "Every car ever logged, one row each, newest first under day headers." : "The cars you logged, one row each, newest first."}>
          <Inputs>
            <Row what="Search box" does={<>Type a stock number, VIN, model, service or dealership. Or a date: <em>today</em>, <em>yesterday</em>, <em>9/27</em>, <em>sep 27</em>, <em>last week</em>.</>} />
            <Row what="Scan VIN" does="Finds the car by its VIN barcode." />
            <Row what="All · Not invoiced · Invoiced" does={wide ? "Not invoiced: this month's jobs, waiting for the 1st. Invoiced: on a month's invoice. Owners and admins also see the Archive." : "Not invoiced: this month's jobs, waiting for the 1st. Invoiced: on a month's invoice."} />
            <Row what="Filters" does={wide ? "Dealership, detailer, service and a date range. Chips above the list show what is on; tap one to clear it." : "Dealership, service and a date range. Chips above the list show what is on; tap one to clear it."} />
            <Row what="Day headers" does="Today, Yesterday, then each weekday, with the count for that day." />
            <Row what="A row" does="Opens that job: the car, the services, the photos, where it stands." />
            <Row what="Edit job · Add photos" does="Fix a typo or add a service while the job is Not invoiced yet; Add photos puts more before/after shots on it, and tapping a photo opens it full size with Remove. Once the job is on an invoice it is locked." />
            {wide && <Row what="Delete job" does="Moves it to the Archive with the reason you type. Nothing is ever erased; Restore brings it back." />}
          </Inputs>
          <Outputs items={["Nothing changes by searching or filtering.", "On the 1st, every Not invoiced job from the month moves to Invoiced on its own."]} />
        </Section>

        <Section id="clover-flex" title="On the Clover Flex" intro="The same app, installed on the company's Clover handhelds from the Clover App Market. Nothing about payments: it is for logging cars.">
          <Inputs>
            <Row what="Open Cali Tints" does="Tap the Cali Tints icon on the Flex. Sign in once; it remembers you." />
            <Row what="Scan barcode" does="Uses the Clover's own scanner: aim at the VIN sticker or the stock tag and it fills in on its own." />
            <Row what="Before · After" does="Opens the camera inside the app (the Flex has no photo gallery app). Allow the camera the first time it asks." />
            <Row what="No signal" does="The app shows No connection. Jobs you saved are kept on the device and send themselves when Wi-Fi is back." />
          </Inputs>
          <Outputs items={["Everything you do on the Flex shows up on every other device and on the owner's computer right away.", "The owner installs updates from the Clover App Market; nothing to do on your side."]} />
        </Section>

        {money && (
          <Section id="invoices" title="Invoices" only="Owner" intro="One invoice per dealership per month, made on the 1st from that month's jobs.">
            <Inputs>
              <Row what="This month so far" does="Each dealership's open QuickBooks invoice for the month: cars, running total, the QuickBooks number with a link to open it there. Send it from QuickBooks when the month ends. Invoice now closes a dealership early." />
              <Row what="Search box" does={<>Invoice number, dealership, a stock number on it, or a month: <em>sep</em>, <em>september 2026</em>.</>} />
              <Row what="All · Unpaid · Overdue · Paid" does="Show only invoices in that state. Unpaid opens extra chips: Not sent, Sent to dealer, Partly paid. Void and Archive too." />
              <Row what="A row" does="Opens that month's invoice." />
              <Row what="Send invoices" does="Optional: emails Not sent invoices from the app with the PDF and CSV. Normally you send from QuickBooks instead; an invoice you emailed from QuickBooks shows as Sent here after the next sync." />
            </Inputs>
            <Outputs items={["Sent invoices change from Not sent to Sent to dealer and get a timestamp.", "With QuickBooks connected (Settings), every invoice is created there the moment it is made; a QB mark on the row says it is in. Payments recorded in QuickBooks show up here the next morning."]} />
          </Section>
        )}

        {money && (
          <Section id="invoice" title="One invoice" only="Owner" intro="One month for one dealership: every car and service, where the money stands, and every email and payment.">
            <Inputs>
              <Row what="Where it stands" does="Three steps: Logged, Sent to the dealership, Paid. The current step is highlighted with the date." />
              <Row what="Submit by email · Resend" does="Emails the invoice to the dealership's AP contact with the PDF and CSV. Every send is listed under History." />
              <Row what="Add payment" does="Record a check, ACH or card payment that arrived: amount, date, method, reference. The balance updates." />
              <Row what="Mark as submitted" does="For invoices uploaded to the dealer portal or handed over on paper. Attach the confirmation if you have one." />
              <Row what="Download" does="Branded PDF, print-ready PDF, CSV or Excel of the lines." />
              <Row what="QuickBooks" does="Where this invoice stands in your books: its QuickBooks number, the balance there and the last sync. Send to QuickBooks / Resend pushes it now; the daily sync does it on its own." />
              <Row what="Void" does="Cancels the invoice (only if nothing is paid). The number is kept; its jobs go back to Not invoiced and the next month close picks them up, or Invoice older jobs does it now." />
            </Inputs>
            <Outputs items={["Every action is written to History with who did it and when.", "A payment marks the invoice Partly paid or Paid, and it leaves Unpaid everywhere."]} />
          </Section>
        )}

        {settings && (
          <Section id="settings" title="Settings" only="Owner and admin" intro="Set once, change any time.">
            <Inputs>
              <Row what="Company" does="Name, address, phone, billing email and EIN as they print on invoices. Monthly invoicing: email each month's invoice automatically, Run month close. Tax rate, invoice number prefix, overdue reminder days, timezone, logo." />
              {money && <Row what="QuickBooks Online" does="Connect QuickBooks once with the Intuit login that owns the books. From then on every month's invoice is created there automatically and payments recorded in QuickBooks come back here. Sync now runs it by hand; Disconnect stops it. Owner only." />}
              <Row what="Dealerships" does="Each dealership's AP contact and emails (where invoices go), how they want invoices (email, portal, paper) and a tax override." />
              {money && <Row what="Services & prices" does="The menu and its prices, plus a per-dealership price grid. A service can have a normal range; prices outside it ask for a reason. Owner only." />}
              <Row what="Users" does="Add people with a password or an email invite. Roles: Detailer (own cars), Manager (every job, no money, no Settings), Admin (everything but money), Owner (the only one who sees money). Deactivate to block sign-in without losing history." />
              {money && <Row what="Export" does="Every table as CSV for the accountant. Owner only." />}
            </Inputs>
            <Outputs items={["Changes apply immediately to new invoices; existing invoices keep the details they were made with."]} />
          </Section>
        )}

        <Section id="status" title="What the statuses mean">
          <ul className="divide-y divide-border">
            <Row what="Not invoiced yet" does="A job from the month in progress. It goes on the dealership's invoice on the 1st." />
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
            <li>A car is missing: check the date filter and the status chips first, then search its stock number.</li>
            <li>Something is wrong on a job that is Not invoiced yet: Edit job. Once it is on an invoice: the owner voids the invoice, fixes the job and re-invoices.</li>
            <li>Logged the wrong car: Delete job. It sits in the Archive if you need it back.</li>
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

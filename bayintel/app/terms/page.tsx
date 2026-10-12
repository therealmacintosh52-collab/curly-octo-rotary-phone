import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { SourceBadge } from "@/components/source-badge";

export const metadata = { title: "Terms & data sources" };

export default function TermsPage() {
  return (
    <main className="prose prose-invert mx-auto max-w-3xl px-5 py-10 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <Link href="/" className="flex items-center gap-2 font-semibold no-underline">
        <span className="inline-block size-7 rounded-md bg-primary" aria-hidden /> {APP_NAME}
      </Link>
      <h1 className="mt-8">Terms of service and data sources</h1>
      <p>Last updated 2026-10-12. This is a plain-language summary intended to be reviewed by counsel before launch.</p>

      <h2>1. Advisory information only</h2>
      <p>
        Everything in {APP_NAME} (decoded specifications, recalls, complaints, trouble-code definitions, community fixes, estimates and AI output) is advisory. It is not OEM service information. You must verify every procedure, specification, torque value, fluid capacity, wiring detail and safety step against the vehicle manufacturer&apos;s service information before performing or authorizing a repair. You are responsible for the work you perform.
      </p>

      <h2>2. License you grant on submitted content</h2>
      <p>
        When you submit a Confirmed Fix, confirmation, note, photo or repair-order content, you grant {APP_NAME} a worldwide, perpetual, irrevocable, royalty-free, sublicensable license to store, reproduce, adapt, display, distribute and use that content in the service, including to train and ground diagnostic models and to show it to other users with your display name. You confirm the content is your own work and does not reproduce third-party service information.
      </p>

      <h2>3. What you may not submit</h2>
      <ul>
        <li>Text, tables, diagrams or procedures copied from ALLDATA, Mitchell 1 / ProDemand, Identifix Direct-Hit, MOTOR, OEM service manuals or any other licensed source.</li>
        <li>Content you do not have the right to license.</li>
        <li>Unsafe advice, spam, or content that targets a person.</li>
      </ul>
      <p>Submissions are reviewed in a moderation queue and may be edited, flagged or removed. Repeat violations end accounts.</p>

      <h2>4. Source labels</h2>
      <p>Every data point in the product carries one of these labels:</p>
      <ul>
        <li>
          <SourceBadge source="NHTSA" /> Public data from the National Highway Traffic Safety Administration (vPIC VIN decode, recalls, owner complaints). Owner complaints are unverified statements by vehicle owners.
        </li>
        <li>
          <SourceBadge source="COMMUNITY" /> Submitted by a user and confirmed by other users. Ranked by net confirmations; &quot;Verified&quot; means at least three net confirmations.
        </li>
        <li>
          <SourceBadge source="OWNER" /> Entered by a user or vehicle owner and not independently verified.
        </li>
        <li>
          <SourceBadge source="LICENSED" /> From a licensed data provider under its own terms (none connected in this release).
        </li>
        <li>
          <SourceBadge source="SAMPLE" /> Illustrative sample data seeded to show the shape of the product. Not real repair information. Part numbers in sample data are placeholders.
        </li>
      </ul>

      <h2>5. AI assistant</h2>
      <p>
        The diagnostic assistant reasons only over the sources above and shows its citations. It is instructed never to produce torque specifications, fluid capacities, wiring pinouts, connector identifiers or calibration values; where such a value is needed it says &quot;Not in database — verify in OEM service information.&quot; Output can still be wrong. Safety-system flags (brakes, SRS, steering, EV high voltage, fuel) are reminders, not a substitute for OEM procedures.
      </p>

      <h2>6. Estimates and repair orders</h2>
      <p>Estimates are generated from the numbers you enter. {APP_NAME} is not party to any transaction between a shop and its customer. Shareable estimate links are unlisted but not password protected; do not include sensitive personal data in them.</p>

      <h2>7. Accounts, billing and contributor rewards</h2>
      <p>Paid plans are billed through Stripe and renew monthly until cancelled. Verified fixes earn free months, applied at checkout. We may change plan limits with notice.</p>

      <h2>8. No warranty, limitation of liability</h2>
      <p>The service is provided &quot;as is&quot; without warranties of any kind. To the fullest extent permitted by law, {APP_NAME} is not liable for any damages arising from use of the service, including vehicle damage, injury, or lost business.</p>

      <h2>9. Third-party data terms</h2>
      <p>NHTSA data is used under its public-data terms. We do not scrape, cache or redistribute content from ALLDATA, Mitchell 1, Identifix, MOTOR or OEM portals. Licensed providers added later will be labeled and used only within their license.</p>
    </main>
  );
}

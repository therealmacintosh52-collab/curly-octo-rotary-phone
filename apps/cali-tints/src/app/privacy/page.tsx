import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacy policy" };

/** Public: linked from the Clover App Market listing and the sign-in page. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-10">
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <h1 className="text-title">Privacy policy</h1>
          <p className="text-sm text-muted-foreground">Cali Tints · jobs and invoicing for dealership detailing · updated October 2026</p>
        </div>
      </div>
      <div className="prose-sm mt-8 flex flex-col gap-5 text-sm leading-relaxed text-foreground/90 [&_h2]:text-heading [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Who uses this app</h2>
          <p>Cali Tints is a private business tool. It is used by the detailing company that runs it (the owner) and the people the owner adds as users: admins, managers and detailers. There is no public sign-up. The app runs on the web and, through the Cali Tints Clover app, on the company&apos;s Clover devices.</p>
        </section>
        <section>
          <h2>What the app stores</h2>
          <ul>
            <li><strong>Users</strong>: name, email and role of each person the owner adds, and when they sign in.</li>
            <li><strong>Jobs</strong>: for each car detailed, the dealership, stock number, VIN (optional), year, make, model, color, the services done, the date, notes and before/after photos of the car.</li>
            <li><strong>Invoices and payments</strong>: the monthly invoice per dealership, its lines, when it was sent and what was paid. Only the owner can see prices, totals and payments.</li>
            <li><strong>Dealership contacts</strong>: the accounts-payable name and email addresses invoices are sent to.</li>
          </ul>
          <p>Photos show cars, not people. The app does not read contacts, location, messages or files on the device beyond the photos you choose to attach.</p>
        </section>
        <section>
          <h2>Camera</h2>
          <p>The camera is used only when you tap Scan barcode (to read the VIN or stock barcode) or Before / After (to photograph the car). Nothing is recorded in the background. You can refuse the permission; the app still works without the camera.</p>
        </section>
        <section>
          <h2>Where the data lives and who sees it</h2>
          <p>Data is stored in the company&apos;s own Supabase project (PostgreSQL and file storage, hosted in the United States) and served by Vercel. Access is enforced by database rules: detailers see their own jobs, admins and managers see every job, and only the owner sees money. Invoices are emailed to the dealership through Resend, and, when the owner connects it, created in the company&apos;s QuickBooks Online account through Intuit&apos;s API. No data is sold or shared with anyone else.</p>
        </section>
        <section>
          <h2>Clover</h2>
          <p>The Cali Tints Clover app does not take payments, read card data or access Clover orders, inventory or customers. It uses the device&apos;s barcode scanner and camera only. It stores the signed-in session on the device so you do not have to sign in every time.</p>
        </section>
        <section>
          <h2>Retention and deletion</h2>
          <p>Records are kept for as long as the company needs them for billing and tax purposes. The owner can deactivate a user at any time, delete a job (it moves to an archive and can be restored) and export every table as CSV. To have your data removed, ask the owner of the company you work for; they can delete it or contact the operator of the app.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Questions about this policy go to the company that operates the app: the email address on its invoices (Settings → Company → Billing email).</p>
        </section>
      </div>
      <p className="mt-10 text-caption text-muted-foreground">
        <Link href="/terms" className="text-primary underline-offset-4 hover:underline">Terms of use</Link> · <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </main>
  );
}

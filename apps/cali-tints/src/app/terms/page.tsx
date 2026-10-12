import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Terms of use" };

/** Public: linked from the Clover App Market listing and the sign-in page. */
export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-10">
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <h1 className="text-title">Terms of use</h1>
          <p className="text-sm text-muted-foreground">Cali Tints · jobs and invoicing for dealership detailing · updated October 2026</p>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-5 text-sm leading-relaxed text-foreground/90 [&_h2]:text-heading [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>What this is</h2>
          <p>Cali Tints is a private tool for one detailing company: logging the cars its team details at dealerships, turning each month&apos;s work into one invoice per dealership, and keeping those invoices in step with QuickBooks. The company that operates it (the owner) decides who may use it.</p>
        </section>
        <section>
          <h2>Accounts</h2>
          <ul>
            <li>Only the owner creates accounts. Keep your password to yourself and sign out of shared devices.</li>
            <li>Log only work that was actually done, on the car it was done to. What you log becomes a line on a dealership&apos;s invoice.</li>
            <li>The owner may change your role or deactivate your account at any time; your history stays with the company.</li>
          </ul>
        </section>
        <section>
          <h2>Devices and the Clover app</h2>
          <p>The Cali Tints Clover app is a window onto the same web app for the company&apos;s Clover devices. It does not process payments and is not a Clover point-of-sale feature. Keep the device&apos;s software up to date; the app needs an internet connection to open and syncs anything saved offline when the connection returns.</p>
        </section>
        <section>
          <h2>Money and books</h2>
          <p>Prices, invoices, payments and the QuickBooks connection are the owner&apos;s responsibility. The app records what the owner and the team enter; it does not give tax or accounting advice. Check invoices before they go out and reconcile QuickBooks as you would with any other system.</p>
        </section>
        <section>
          <h2>Availability and liability</h2>
          <p>The app is provided as is. The operator does its best to keep it running, but there is no guarantee it will be available at every moment, and the operator is not liable for lost work, lost profit or indirect damage arising from its use, to the extent the law allows. Export your data regularly (Settings → Export).</p>
        </section>
        <section>
          <h2>Changes</h2>
          <p>These terms may be updated as the app changes; the date above says when. Continuing to use the app after a change means you accept it.</p>
        </section>
      </div>
      <p className="mt-10 text-caption text-muted-foreground">
        <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy policy</Link> · <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </main>
  );
}

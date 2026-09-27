import type { Metadata } from "next";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

/** Public landing page after Clover hosted checkout. Shows no invoice data. */
export default async function PayDonePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const ok = sp.ok === "1";
  const inv = typeof sp.inv === "string" ? sp.inv.replace(/[^A-Za-z0-9-]/g, "") : null;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo size={72} />
      <div className={`flex size-16 items-center justify-center rounded-full ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{ok ? <CheckCircle2Icon className="size-8" /> : <XCircleIcon className="size-8" />}</div>
      <div>
        <h1 className="text-heading">{ok ? "Payment received" : "Payment not completed"}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {ok
            ? `Thank you${inv ? ` for paying invoice ${inv}` : ""}. Clover will email your receipt; the invoice is marked paid on our side automatically.`
            : "Nothing was charged. You can reopen the link in the invoice email to try again, or pay by check or ACH as usual."}
        </p>
      </div>
    </main>
  );
}

import Link from "next/link";
import { CalendarPlusIcon, CheckCircle2Icon, FileDownIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PayEstimateDeposit } from "./pay-estimate-deposit";

/** After the customer answers: what happens next. Booking a time arrives with the next slice; until then the shop confirms it. */
export function EstimateDone({ token, declined, pay, company, phone, displayNumber, deposit = 0, depositsOnline = false, justPaid = false, demo = false }: { token: string; declined: boolean; pay: "deposit" | "at_shop"; company: string; phone: string | null; displayNumber: string | null; deposit?: number; depositsOnline?: boolean; justPaid?: boolean; demo?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 py-10 text-center" data-testid="estimate-done">
      <Logo size={56} />
      {declined ? (
        <>
          <h1 className="text-title">Thanks for letting us know</h1>
          <p className="text-sm text-muted-foreground">If you change your mind, call {company}{phone ? ` at ${phone}` : ""} and we will write you a fresh estimate.</p>
        </>
      ) : (
        <>
          <CheckCircle2Icon className="size-12 text-success" />
          <h1 className="text-title">Approved. Thank you!</h1>
          <p className="text-sm text-muted-foreground">
            {company} has your approval{displayNumber ? ` for ${displayNumber}` : ""}. Pick a drop-off time now, or we will reach out to set it{pay === "deposit" ? " and take the deposit" : ""}.
          </p>
          {pay === "deposit" && deposit > 0 && <PayEstimateDeposit token={token} deposit={deposit} depositsOnline={depositsOnline} justPaid={justPaid} demo={demo} />}
          <Button asChild size="lg">
            <Link href={`/book?e=${token}`} data-testid="estimate-pick-time">
              <CalendarPlusIcon /> Pick a time
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/e/${token}/pdf`}>
              <FileDownIcon /> Download your signed copy
            </a>
          </Button>
        </>
      )}
      <Link href={`/e/${token}`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">Back to the estimate</Link>
    </main>
  );
}

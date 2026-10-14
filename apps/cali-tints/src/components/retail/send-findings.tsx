"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, MailIcon, MessageSquareTextIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { sendFindingsAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { detectPlatform, smsHref } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "Send findings": the customer gets what the tech found (photos, clips,
 * recommendations) by text and/or email, as a link to the estimate or the
 * invoice. The text is the phone's own messaging app, prefilled; email goes
 * through the shop's templates. Owner, admin and advisor.
 */
export function SendFindings({ estimateId, firstName, vehicle, phone, email, url, sentAt, count }: { estimateId: string; firstName: string; vehicle: string | null; phone: string | null; email: string | null; url: string; sentAt: string | null; count: number }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  const body = `Hi ${firstName || "there"}, our tech went over your ${vehicle ?? "car"} and wrote up what they found, with photos and what we recommend: ${url}`;
  const sms = smsHref(phone, body, platform);

  function mark(via: "email" | "text") {
    start(async () => {
      if (demo) return void toast.success(via === "email" ? "Email sent" : "Marked as sent", { description: "Guest preview — nothing sent" });
      const r = await sendFindingsAction(estimateId, via);
      if (!r.ok) return void toast.error(r.error);
      if (via === "email") {
        if (r.data.emailed) toast.success("Emailed the findings");
        else toast.error(r.data.note ?? "The email could not be sent");
      }
      router.refresh();
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy; long-press the link instead");
    }
  }

  return (
    <Card data-testid="send-findings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SendIcon className="size-4 text-primary" /> Send to the customer</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-caption text-subtle">
          {count === 0 ? "Nothing to send yet: add a finding first." : `${count} ${count === 1 ? "item" : "items"} the customer will see: notes, photos, clips and what we recommend. Internal notes stay internal.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {sms ? (
            <Button asChild size="sm" disabled={count === 0}>
              <a href={sms} onClick={() => mark("text")} data-testid="findings-text"><MessageSquareTextIcon /> Text it</a>
            </Button>
          ) : (
            <Button size="sm" disabled title="No phone number on file"><MessageSquareTextIcon /> Text it</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => mark("email")} loading={pending} disabled={!email || count === 0} title={email ? undefined : "No email on file"} data-testid="findings-email">
            <MailIcon /> Email it
          </Button>
          <Button size="sm" variant="ghost" onClick={copy} data-testid="findings-copy"><CopyIcon /> Copy the link</Button>
        </div>
        {sentAt && <p className="text-caption text-subtle" data-testid="findings-sent">Findings sent {formatDateTime(sentAt)}</p>}
      </CardContent>
    </Card>
  );
}

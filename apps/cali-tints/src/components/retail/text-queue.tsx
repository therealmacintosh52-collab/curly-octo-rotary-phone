"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, MessageSquareTextIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { TextQueueRow } from "@/lib/db/types";
import { textQueueDoneAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { detectPlatform, formatPhone, smsHref } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Texts the automations wrote for the owner's phone. One tap opens the
 * phone's own texting app with the number and the message filled in; "Sent"
 * clears it. The free path: no SMS provider, nothing leaves the app itself.
 */
export function TextQueue({ rows }: { rows: TextQueueRow[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  function done(id: string, dismiss: boolean) {
    start(async () => {
      if (demo) return void toast.success(dismiss ? "Dismissed" : "Marked sent", { description: "Guest preview — nothing changed" });
      const r = await textQueueDoneAction(id, dismiss);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }
  return (
    <Card className="mt-6 border-info/40" data-testid="text-queue">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquareTextIcon className="size-4 text-info" /> Texts to send ({rows.length})</CardTitle>
        <CardDescription>Written by the automations. Tap one to open it in your texting app, send, then mark it sent.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm">
          {rows.map((t) => {
            const href = smsHref(t.phone, t.body, platform);
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium">{t.customer ?? formatPhone(t.phone)} <span className="text-caption text-subtle">· {t.reason ?? "text"} · {formatDateTime(t.created_at)}</span></div>
                  <div className="line-clamp-2 text-caption text-subtle">{t.body}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {href && (
                    <Button asChild size="sm">
                      <a href={href} data-testid="text-open"><MessageSquareTextIcon /> Text</a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => done(t.id, false)} loading={pending} aria-label="Mark sent" data-testid="text-sent"><CheckIcon /></Button>
                  <Button size="sm" variant="ghost" onClick={() => done(t.id, true)} aria-label="Dismiss"><XIcon /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

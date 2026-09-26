import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import type { InvoiceSubmission } from "@/lib/db/types";
import { formatDateTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = InvoiceSubmission & { created_by_name: string | null; confirmation_url: string | null };

const METHOD_LABEL = { email: "Email", portal: "Portal", paper: "Paper" } as const;

/** Full send history: every email attempt (with message id) and manual submission. */
export function SubmissionsCard({ submissions, submittedAt }: { submissions: Row[]; submittedAt: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission history</CardTitle>
        {submittedAt && <p className="text-xs text-muted-foreground">First submitted {formatDateTime(submittedAt)}</p>}
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not submitted yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {s.status === "sent" ? <CheckIcon className="size-4 text-success" /> : <XIcon className="size-4 text-destructive" />}
                    <span className="font-medium">{METHOD_LABEL[s.method]}</span>
                    {s.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</span>
                </div>
                <div className="mt-0.5 pl-6 text-xs text-muted-foreground">
                  {s.created_by_name ? `${s.created_by_name} · ` : ""}
                  {s.recipients.length > 0 && <>to {s.recipients.join(", ")}</>}
                  {s.cc.length > 0 && <> · cc {s.cc.join(", ")}</>}
                  {s.message_id && <div className="truncate font-mono">msg {s.message_id}</div>}
                  {s.error && <div className="text-destructive">{s.error}</div>}
                  {s.note && <div className="text-foreground/80">{s.note}</div>}
                  {s.confirmation_url && (
                    <a href={s.confirmation_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Confirmation <ExternalLinkIcon className="size-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

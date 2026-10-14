"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ClipboardCheckIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateJobPriority } from "@/lib/db/types";
import { completeRoWorkAction, qualityCheckAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface WorkJob {
  id: string;
  title: string;
  priority: EstimateJobPriority;
  cause: string | null;
  correction: string | null;
}

export interface RoWork {
  jobs: WorkJob[];
  mileageIn: number | null;
  odometerOut: number | null;
  completedAt: string | null;
  qcAt: string | null;
  qcNote: string | null;
  parts: "offered" | "returned" | "declined" | null;
}

const PRIORITY: Record<EstimateJobPriority, string> = { safety: "Safety", soon: "Due soon", optional: "Optional" };
const PARTS: { value: "offered" | "returned" | "declined"; label: string }[] = [
  { value: "offered", label: "Offered back" },
  { value: "returned", label: "Returned to the customer" },
  { value: "declined", label: "Customer declined them" },
];
export const partsLabel = (v: RoWork["parts"]) => PARTS.find((p) => p.value === v)?.label ?? null;

/**
 * Finishing a retail estimate: the tech writes the mileage out and, for every
 * item, what caused it and what was done; a second person signs it off. Only
 * then can the advisor make the customer's invoice.
 */
export function RoWorkCard({ jobId, work, canComplete, canQc, unauthorized, invoiced }: { jobId: string; work: RoWork; canComplete: boolean; canQc: boolean; unauthorized: number; invoiced: boolean }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [out, setOut] = useState(work.odometerOut != null ? String(work.odometerOut) : "");
  const [parts, setParts] = useState<RoWork["parts"]>(work.parts);
  const [notes, setNotes] = useState<Record<string, { cause: string; correction: string }>>(() => Object.fromEntries(work.jobs.map((j) => [j.id, { cause: j.cause ?? "", correction: j.correction ?? "" }])));
  const [qcNote, setQcNote] = useState("");
  const done = !!work.completedAt;
  const form = !invoiced && canComplete && (!done || editing);
  const outNumber = Number(out.replace(/[^\d]/g, ""));
  const lowOut = work.mileageIn != null && out !== "" && outNumber < work.mileageIn;
  const missing = work.jobs.filter((j) => !notes[j.id]?.cause.trim() || !notes[j.id]?.correction.trim());

  function save() {
    start(async () => {
      if (demo) {
        toast.success("Marked done", { description: "Guest preview — nothing changed" });
        setEditing(false);
        return;
      }
      const r = await completeRoWorkAction(jobId, { odometer_out: out, parts_disposition: parts, jobs: work.jobs.map((j) => ({ id: j.id, cause: notes[j.id]?.cause ?? "", correction: notes[j.id]?.correction ?? "" })) });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Marked done");
      setEditing(false);
      router.refresh();
    });
  }

  function signOff() {
    start(async () => {
      if (demo) return void toast.success("Signed off", { description: "Guest preview — nothing changed" });
      const r = await qualityCheckAction(jobId, qcNote);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Signed off");
      router.refresh();
    });
  }

  return (
    <Card id="ro-work" className="scroll-mt-24" data-testid="ro-work">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <WrenchIcon className="size-4 text-primary" /> What was done
        </CardTitle>
        {work.qcAt ? <Badge variant="success" data-testid="ro-qc-badge">Checked</Badge> : done ? <Badge variant="warning" data-testid="ro-qc-badge">Needs a check</Badge> : <Badge variant="muted" data-testid="ro-qc-badge">In progress</Badge>}
      </CardHeader>
      <CardContent className="grid gap-4">
        {work.jobs.length === 0 && !done && <p className="text-sm text-muted-foreground">Nothing approved yet.</p>}

        {form ? (
          <>
            {unauthorized > 0 && <p className="text-caption text-warning">Some items are not approved yet. Get the approval before marking it done.</p>}
            {work.jobs.map((j) => (
              <div key={j.id} className="grid gap-2 rounded-lg border border-border p-3" data-testid="work-job">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{j.title}</span>
                  <Badge variant="outline">{PRIORITY[j.priority]}</Badge>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`cause-${j.id}`}>Cause</Label>
                  <Textarea id={`cause-${j.id}`} data-testid="work-cause" rows={2} maxLength={600} className="min-h-0" value={notes[j.id]?.cause ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [j.id]: { ...(n[j.id] ?? { cause: "", correction: "" }), cause: e.target.value } }))} placeholder="What was wrong, and why" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`corr-${j.id}`}>Correction</Label>
                  <Textarea id={`corr-${j.id}`} data-testid="work-correction" rows={2} maxLength={600} className="min-h-0" value={notes[j.id]?.correction ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [j.id]: { ...(n[j.id] ?? { cause: "", correction: "" }), correction: e.target.value } }))} placeholder="What was done to fix it" />
                </div>
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label htmlFor="odometer-out">Mileage out{work.mileageIn != null ? ` (in: ${work.mileageIn.toLocaleString()})` : ""}</Label>
              <Input id="odometer-out" data-testid="work-odometer-out" inputMode="numeric" value={out} onChange={(e) => setOut(e.target.value)} placeholder="48,215" aria-invalid={lowOut} />
              {lowOut && <p className="text-caption text-destructive">Lower than the mileage that came in.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Replaced parts</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Replaced parts">
                {PARTS.map((p) => (
                  <button key={p.value} type="button" role="radio" aria-checked={parts === p.value} data-testid={`parts-${p.value}`} onClick={() => setParts(parts === p.value ? null : p.value)} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${parts === p.value ? "border-primary bg-accent-soft text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} loading={pending} disabled={unauthorized > 0 || work.jobs.length === 0 || missing.length > 0 || out === "" || lowOut} data-testid="work-done"><ClipboardCheckIcon /> Mark it done</Button>
              {done && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
            {missing.length > 0 && <p className="text-caption text-subtle">Cause and correction for each item: {missing.map((j) => j.title).join(", ")}.</p>}
          </>
        ) : (
          <>
            <ul className="grid gap-3 text-sm" data-testid="work-summary">
              {work.jobs.map((j) => (
                <li key={j.id} className="grid gap-0.5">
                  <span className="font-medium">{j.title}</span>
                  {j.cause || j.correction ? (
                    <>
                      <span className="text-muted-foreground"><span className="text-subtle">Cause · </span>{j.cause || "—"}</span>
                      <span className="text-muted-foreground"><span className="text-subtle">Correction · </span>{j.correction || "—"}</span>
                    </>
                  ) : (
                    <span className="text-caption text-subtle">Not written yet</span>
                  )}
                </li>
              ))}
            </ul>
            {done && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Mileage out</dt>
                <dd data-testid="work-mileage-out">{work.odometerOut != null ? `${work.odometerOut.toLocaleString()} mi` : "—"}</dd>
                {work.parts && (<><dt className="text-muted-foreground">Replaced parts</dt><dd>{partsLabel(work.parts)}</dd></>)}
                <dt className="text-muted-foreground">Done</dt>
                <dd>{formatDateTime(work.completedAt)}</dd>
                {work.qcAt && (<><dt className="text-muted-foreground">Checked</dt><dd data-testid="work-qc-at">{formatDateTime(work.qcAt)}{work.qcNote ? ` · ${work.qcNote}` : ""}</dd></>)}
              </dl>
            )}
            {!done && !canComplete && <p className="text-caption text-subtle">The tech writes the cause and correction when it is finished.</p>}
            {done && !work.qcAt && !invoiced && canQc && (
              <div className="grid gap-2 rounded-lg border border-border p-3">
                <Label htmlFor="qc-note">Quality check</Label>
                <Input id="qc-note" data-testid="qc-note" value={qcNote} onChange={(e) => setQcNote(e.target.value)} maxLength={500} placeholder="Test drive, torque, fluids, anything to note (optional)" />
                <Button onClick={signOff} loading={pending} data-testid="qc-sign"><CheckCircle2Icon /> Check it and sign off</Button>
              </div>
            )}
            {done && !work.qcAt && !invoiced && !canQc && <p className="text-caption text-subtle">Waiting for the advisor or owner to check it.</p>}
            {!invoiced && canComplete && done && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setEditing(true)} data-testid="work-edit">Change what was written</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

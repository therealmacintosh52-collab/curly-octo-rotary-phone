"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, BookOpenCheckIcon, CheckCircle2Icon, HistoryIcon, LogInIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/db/types";
import { disconnectQuickBooksAction, importQuickBooksHistoryAction, syncQuickBooksAction, updateQuickBooksSettingsAction } from "@/app/(app)/settings/actions";
import { historyWindows } from "@/lib/quickbooks/history-parse";
import { toDateInput } from "@/lib/dates";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CompanyQbo = Pick<Company, "quickbooks_realm_id" | "quickbooks_company_name" | "quickbooks_env" | "quickbooks_connected_at" | "quickbooks_item_name" | "quickbooks_auto_push" | "quickbooks_last_sync_at" | "quickbooks_last_error">;

export interface QuickBooksNotice {
  kind: "connected" | "error";
  message: string | null;
  pushed?: number;
}

/**
 * QuickBooks Online (owner only). One button connects the company's books;
 * from then on every monthly invoice is created in QuickBooks and payments
 * recorded there come back here. Keys live in the hosting environment.
 */
export interface HistoryStats {
  lines: number;
  unread: number;
  invoices: number;
  last_import: string | null;
}

export function QuickBooksCard({ company, configured, notice = null, dealerships = [], history = null }: { company: CompanyQbo; configured: boolean; notice?: QuickBooksNotice | null; /** The dealerships whose past invoices can be imported. */ dealerships?: { id: string; name: string }[]; history?: HistoryStats | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [itemName, setItemName] = useState(company.quickbooks_item_name);
  const [autoPush, setAutoPush] = useState(company.quickbooks_auto_push);
  const connected = !!company.quickbooks_realm_id;
  const dirty = itemName.trim() !== company.quickbooks_item_name || autoPush !== company.quickbooks_auto_push;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (demo) return toast.success("QuickBooks settings saved", { description: "Guest preview — not actually saved" });
    startSave(async () => {
      const r = await updateQuickBooksSettingsAction({ quickbooks_item_name: itemName.trim() || "Auto detailing", quickbooks_auto_push: autoPush });
      if (r.ok) {
        toast.success("QuickBooks settings saved");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function sync() {
    if (demo) return toast.success("QuickBooks is up to date", { description: "2 invoices sent · 1 payment recorded · simulated" });
    startSync(async () => {
      const r = await syncQuickBooksAction();
      if (!r.ok) return void toast.error(r.error);
      const d = r.data;
      const parts = [d.live.length ? `${d.live.length} open ${d.live.length === 1 ? "month" : "months"} live` : null, d.pushed.length ? `${d.pushed.length} ${d.pushed.length === 1 ? "invoice" : "invoices"} sent` : null, d.paymentsRecorded ? `${d.paymentsRecorded} ${d.paymentsRecorded === 1 ? "payment" : "payments"} recorded` : null].filter(Boolean);
      if (d.pushErrors.length || d.pullErrors.length) toast.warning(parts.length ? parts.join(" · ") : "Sync ran with errors", { description: d.pushErrors[0]?.error ?? d.pullErrors[0] });
      else toast.success(parts.length ? parts.join(" · ") : "QuickBooks is up to date");
      router.refresh();
    });
  }

  function disconnect() {
    if (!confirm("Disconnect QuickBooks? New invoices stop going to QuickBooks until you connect again. Invoices already there stay.")) return;
    if (demo) return toast.success("QuickBooks disconnected", { description: "Guest preview — nothing changed" });
    startDisconnect(async () => {
      const r = await disconnectQuickBooksAction();
      if (r.ok) {
        toast.success("QuickBooks disconnected");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const connectHref = "/api/quickbooks/connect";
  const demoConnect = (e: React.MouseEvent) => {
    if (!demo) return;
    e.preventDefault();
    toast.success("Connecting QuickBooks", { description: "Guest preview — opens Intuit's sign-in on the real app" });
  };

  return (
    <Card id="quickbooks" className="scroll-mt-24" data-testid="quickbooks-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenCheckIcon className="size-4 text-primary" /> QuickBooks Online
        </CardTitle>
        <CardDescription>Every job goes to QuickBooks the moment it is saved: one open invoice per dealership per month, one line per car and service, numbered by QuickBooks. You send it and take payments in QuickBooks; the app shows the number, the balance and what was paid.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {notice?.kind === "connected" && (
          <Alert variant="success">
            <CheckCircle2Icon />
            <AlertTitle>Connected to QuickBooks{notice.message ? ` · ${notice.message}` : ""}</AlertTitle>
            <AlertDescription>{notice.pushed ? `${notice.pushed} open ${notice.pushed === 1 ? "invoice" : "invoices"} sent over right away.` : "Nothing else to set up."}</AlertDescription>
          </Alert>
        )}
        {notice?.kind === "error" && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>QuickBooks sign-in did not finish</AlertTitle>
            <AlertDescription>{notice.message ?? "Try again."}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div className="grid gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              {connected ? (
                <>
                  <CheckCircle2Icon className="size-4 text-success" /> Connected to {company.quickbooks_company_name ?? "QuickBooks"}
                  {company.quickbooks_env === "sandbox" && <Badge variant="warning">Sandbox</Badge>}
                </>
              ) : (
                <>
                  <UnplugIcon className="size-4 text-muted-foreground" /> Not connected
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {connected
                ? `Since ${formatDateTime(company.quickbooks_connected_at ?? new Date().toISOString())}${company.quickbooks_last_sync_at ? ` · last sync ${formatDateTime(company.quickbooks_last_sync_at)}` : ""}`
                : configured
                  ? "Sign in with the Intuit account that owns the books. Takes a minute."
                  : "Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in your hosting environment first (README → QuickBooks Online)."}
            </span>
            {company.quickbooks_last_error && <span className="text-xs text-destructive">{company.quickbooks_last_error}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button type="button" size="sm" variant="outline" loading={syncing} onClick={sync} data-testid="quickbooks-sync">
                  <RefreshCwIcon /> Sync now
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={connectHref} onClick={demoConnect}>Reconnect</a>
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" loading={disconnecting} onClick={disconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button asChild size="sm" disabled={!configured && !demo}>
                <a href={configured || demo ? connectHref : undefined} onClick={demoConnect} aria-disabled={!configured && !demo} data-testid="quickbooks-connect">
                  <LogInIcon /> Connect QuickBooks
                </a>
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start justify-between gap-4 sm:col-span-2">
            <span className="grid gap-1">
              <span className="text-sm font-medium">Keep QuickBooks live</span>
              <span className="text-xs text-muted-foreground">Every saved, edited or deleted job updates the dealership&apos;s open invoice in QuickBooks right away, and the daily sync catches anything missed. Off: use Sync now or Send to QuickBooks on an invoice.</span>
            </span>
            <Switch checked={autoPush} onCheckedChange={setAutoPush} aria-label="Send every invoice to QuickBooks automatically" data-testid="quickbooks-auto-push" />
          </label>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="qbo-item">Service item in QuickBooks</Label>
            <Input id="qbo-item" value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={100} />
            <Hint>Every line posts to this Service item (created on your first Income account if it does not exist). Change it before the first sync or map it yourself in QuickBooks.</Hint>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={!dirty} loading={saving}>
              Save QuickBooks settings
            </Button>
          </div>
        </form>
        {connected && <HistoryImport dealerships={dealerships} stats={history} />}
        <p className="text-caption text-subtle">
          QuickBooks numbers the invoices; those numbers show on jobs and invoices here. Using QuickBooks Desktop? Use Export → CSV or the invoice&apos;s Excel download and import it there.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Read the dealerships' past invoices from QuickBooks so New job can warn when a car was already billed.
 * Nothing is created: the lines are kept in a lookup list of their own. Safe to run again.
 */
function HistoryImport({ dealerships, stats }: { dealerships: { id: string; name: string }[]; stats: HistoryStats | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [months, setMonths] = useState("24");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<{ invoices: number; lines: number; unread: number; skipped: string[] } | null>(null);

  async function run() {
    setRunning(true);
    setReport(null);
    const totals = { invoices: 0, lines: 0, unread: 0, skipped: [] as string[] };
    try {
      if (demo) {
        for (const d of dealerships) {
          setProgress(`${d.name} · reading…`);
          await new Promise((r) => setTimeout(r, 350));
        }
        setReport({ invoices: 42, lines: 318, unread: 9, skipped: [] });
        toast.success("Past invoices read", { description: "Guest preview · simulated" });
        return;
      }
      const windows = historyWindows(toDateInput(new Date()), Number(months));
      for (const d of dealerships) {
        windowLoop: for (const w of windows) {
          let start = 1;
          for (;;) {
            setProgress(`${d.name} · ${w.from} to ${w.to}`);
            const r = await importQuickBooksHistoryAction({ dealershipId: d.id, from: w.from, to: w.to, start });
            if (!r.ok) throw new Error(r.error);
            totals.invoices += r.data.invoices;
            totals.lines += r.data.lines;
            totals.unread += r.data.unread;
            if (r.data.skipped) {
              totals.skipped.push(`${d.name}: ${r.data.skipped}`);
              break windowLoop;
            }
            if (r.data.next === null) break;
            start = r.data.next;
          }
        }
      }
      setReport(totals);
      toast.success(`Read ${totals.invoices} past ${totals.invoices === 1 ? "invoice" : "invoices"}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The import stopped");
      setReport(totals);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border px-3 py-3" data-testid="quickbooks-history">
      <div className="grid gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <HistoryIcon className="size-4 text-primary" /> Past invoices: stop double billing
        </span>
        <span className="text-xs text-muted-foreground">
          Reads the dealerships&apos; older invoices from QuickBooks so New job warns when a stock number or VIN was already billed. It only reads: nothing is created or changed in QuickBooks, and no job is made. Run it once, and again any time.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="qbo-history-months">How far back</Label>
          <Select value={months} onValueChange={setMonths} disabled={running}>
            <SelectTrigger id="qbo-history-months" className="w-40" data-testid="quickbooks-history-months">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
              <SelectItem value="36">36 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" variant="outline" loading={running} onClick={run} disabled={dealerships.length === 0} data-testid="quickbooks-history-run">
          Import past invoices
        </Button>
      </div>
      {progress && <p className="text-xs text-muted-foreground" data-testid="quickbooks-history-progress">{progress}</p>}
      {report && (
        <p className="text-sm" data-testid="quickbooks-history-report">
          Read {report.invoices} {report.invoices === 1 ? "invoice" : "invoices"}, {report.lines} lines
          {report.unread > 0 ? `; ${report.unread} lines have no stock number or VIN I could read, so they cannot warn.` : "."}
          {report.skipped.map((m) => (
            <span key={m} className="block text-warning">{m}</span>
          ))}
        </p>
      )}
      {!report && stats && stats.lines > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="quickbooks-history-stats">
          Last import {stats.last_import ? formatDateTime(stats.last_import) : ""}: {stats.invoices} invoices, {stats.lines} lines{stats.unread ? ` (${stats.unread} unreadable)` : ""}.
        </p>
      )}
    </div>
  );
}

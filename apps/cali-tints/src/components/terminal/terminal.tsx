"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BanknoteIcon, CreditCardIcon, DeleteIcon, FileTextIcon, LandmarkIcon, MoreHorizontalIcon, PlugZapIcon, ReceiptTextIcon, SearchIcon, TabletSmartphoneIcon, Undo2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod, TerminalTransaction } from "@/lib/db/types";
import { takeSaleAction, type SaleInput } from "@/app/(app)/terminal/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly, nowMs } from "@/lib/dates";
import { METHOD_LABELS, paidWith, receiptSubject, type ReceiptCompany } from "@/lib/terminal/receipt";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerItem } from "@/components/motion/primitives";
import { fireConfetti, haptic } from "@/components/motion/confetti";
import { ChargeCardDialog, type CloverCardConfig } from "@/components/invoices/charge-card-dialog";
import { PayOnDeviceDialog, type CardResult } from "@/components/invoices/pay-on-device-dialog";
import type { OpenInvoiceOption } from "@/components/invoices/clover-queue";
import { ReceiptView } from "./receipt-view";
import { RefundDialog } from "./refund-dialog";
import { cn } from "@/lib/utils";

type ManualMethod = Exclude<PaymentMethod, "card">;
type Dialog = null | "card" | "device" | { manual: ManualMethod };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

/**
 * Point of sale. Left: amount keypad, what it is for (quick sale or an open
 * invoice), how it is paid. Right: the day's transactions with totals. Every
 * transaction opens a receipt that can be emailed, printed or refunded.
 */
export function Terminal({
  date,
  today,
  transactions,
  openInvoices,
  cloverCard,
  cloverDevice,
  cloverEnabled,
  company,
  initialInvoiceId = null,
  initialMethod = null,
  missingInvoice = null,
  checklist = null,
  connection = null,
}: {
  date: string;
  today: string;
  transactions: TerminalTransaction[];
  openInvoices: OpenInvoiceOption[];
  cloverCard: CloverCardConfig | null;
  cloverDevice: boolean;
  cloverEnabled: boolean;
  company: ReceiptCompany;
  /** Deep link (?invoice=): start with this invoice selected and its balance on the keypad. */
  initialInvoiceId?: string | null;
  /** Deep link (?method=): open this payment dialog right away when it is available. */
  initialMethod?: "card" | "device" | null;
  /** ?invoice= pointed at an invoice with no open balance. */
  missingInvoice?: string | null;
  /** Server-rendered Clover setup checklist (null when complete). */
  checklist?: React.ReactNode;
  /** Live Clover state for the header pill. */
  connection?: { enabled: boolean; connected: boolean; healthy: boolean; needsReconnect: boolean; merchantName: string | null; device: boolean } | null;
}) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();

  const initialInvoice = initialInvoiceId ? (openInvoices.find((i) => i.id === initialInvoiceId) ?? null) : null;
  // Amount is kept in cents so the keypad behaves like a register (typing 1 2 5 0 → $12.50).
  const [cents, setCents] = useState(initialInvoice ? Math.round(initialInvoice.balance * 100) : 0);
  const [mode, setMode] = useState<"sale" | "invoice">(initialInvoice ? "invoice" : "sale");
  const [invoiceId, setInvoiceId] = useState<string | null>(initialInvoice?.id ?? null);
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [reference, setReference] = useState("");
  const [dialog, setDialog] = useState<Dialog>(() => (initialInvoice && initialMethod === "card" && cloverCard ? "card" : initialInvoice && initialMethod === "device" && cloverDevice ? "device" : null));
  const [receipt, setReceipt] = useState<TerminalTransaction | null>(null);
  const [viewing, setViewing] = useState<TerminalTransaction | null>(null);
  const [refunding, setRefunding] = useState<TerminalTransaction | null>(null);
  // Guest preview keeps its own additions; the real app refreshes from the server.
  const [local, setLocal] = useState<TerminalTransaction[]>([]);

  useEffect(() => {
    if (missingInvoice) toast.info("That invoice has nothing left to pay", { description: "Pick another invoice or take a quick sale." });
    // One-time notice for the deep link only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amount = cents / 100;
  const invoice = invoiceId ? (openInvoices.find((i) => i.id === invoiceId) ?? null) : null;
  const max = invoice ? invoice.balance : 1_000_000;
  const valid = amount > 0 && amount <= max + 0.005;
  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? openInvoices.filter((i) => i.display_number.toLowerCase().includes(q) || i.dealership.toLowerCase().includes(q)) : openInvoices).slice(0, 8);
  }, [openInvoices, query]);

  const list = useMemo(() => {
    const merged = [...local, ...transactions];
    // Apply local refunds to their sales for the guest preview.
    return merged.map((t) => {
      if (t.kind !== "sale") return t;
      const refunded = local.filter((r) => r.kind === "refund" && r.refund_of === t.id).reduce((s, r) => s + Number(r.amount), 0);
      if (refunded === 0) return t;
      const total = Number(t.refunded_amount) + refunded;
      return { ...t, refunded_amount: total, status: total >= Number(t.amount) - 0.004 ? "refunded" : "partially_refunded" } as TerminalTransaction;
    });
  }, [local, transactions]);
  const totals = useMemo(() => {
    const sales = list.filter((t) => t.kind === "sale");
    const refunds = list.filter((t) => t.kind === "refund");
    const gross = sales.reduce((s, t) => s + Number(t.amount), 0);
    const back = refunds.reduce((s, t) => s + Number(t.amount), 0);
    const byMethod = new Map<PaymentMethod, number>();
    for (const t of list) byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + (t.kind === "sale" ? Number(t.amount) : -Number(t.amount)));
    return { count: sales.length, gross, back, net: gross - back, byMethod: [...byMethod.entries()].filter(([, v]) => Math.abs(v) > 0.004) };
  }, [list]);

  function key(k: string) {
    if (k === "⌫") return setCents((c) => Math.floor(c / 10));
    const next = Number(String(cents) + k);
    if (next > 100_000_000) return; // $1,000,000
    setCents(next);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === "Backspace") key("⌫");
    else if (e.key === "Escape") setCents(0);
    else return;
    e.preventDefault();
  }

  function pickInvoice(i: OpenInvoiceOption) {
    setInvoiceId(i.id);
    setMode("invoice");
    setCents(Math.round(i.balance * 100));
  }

  function reset() {
    setCents(0);
    setInvoiceId(null);
    setDescription("");
    setCustomerName("");
    setCustomerEmail("");
    setReference("");
    setDialog(null);
  }

  const base = (): SaleInput => ({
    amount: Math.round(cents) / 100,
    method: "cash",
    invoiceId: invoice?.id,
    description: invoice ? undefined : description.trim() || undefined,
    customerName: customerName.trim() || (invoice ? invoice.dealership : undefined),
    customerEmail: customerEmail.trim() || (invoice ? (invoice.email ?? undefined) : undefined),
    reference: reference.trim() || undefined,
  });

  /** Guest preview: fabricate the ledger row a real sale would return. */
  function demoTx(input: SaleInput, card?: CardResult): TerminalTransaction {
    const isCard = input.method === "card" || input.method === "device";
    const stamp = nowMs();
    return {
      // uuid-shaped so the receipt number (first 8 hex chars) looks real
      id: `${stamp.toString(16).padStart(12, "0").slice(-8)}-0000-4000-8000-${stamp.toString().padStart(12, "0").slice(-12)}`,
      kind: "sale",
      status: "captured",
      amount: card?.amount ?? input.amount,
      refunded_amount: 0,
      method: isCard ? "card" : (input.method as PaymentMethod),
      source: input.method === "card" ? "clover_card" : input.method === "device" ? "clover_pos" : "manual",
      invoice_id: invoice?.id ?? null,
      invoice_number: invoice?.display_number ?? null,
      dealership: invoice?.dealership ?? null,
      payment_id: invoice ? `demo-pay-${stamp}` : null,
      refund_of: null,
      description: invoice ? null : input.description || "Counter sale",
      customer_name: input.customerName ?? null,
      customer_email: input.customerEmail || null,
      reference: input.reference ?? null,
      card_brand: isCard ? "VISA" : null,
      last4: isCard ? (card?.last4 ?? "4242") : null,
      clover_payment_id: isCard ? `demo-clv-${stamp}` : null,
      receipt_sent_at: null,
      at: new Date(stamp).toISOString(),
    };
  }

  function finish(tx: TerminalTransaction) {
    if (demo) setLocal((l) => [tx, ...l]);
    setReceipt(tx);
    reset();
    // The good part of the job.
    fireConfetti({ y: 0.4 });
    haptic();
  }

  function takeManual(method: ManualMethod) {
    const input = { ...base(), method };
    if (demo) {
      toast.success(`${METHOD_LABELS[method]} payment of ${formatMoney(input.amount)} recorded`, { description: "Guest preview — nothing saved" });
      finish(demoTx(input));
      return;
    }
    start(async () => {
      const r = await takeSaleAction(input);
      if (r.ok) {
        toast.success(`${METHOD_LABELS[method]} payment of ${formatMoney(r.data.amount)} recorded`);
        finish(r.data);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const subtitle = invoice ? `${invoice.display_number} · balance ${formatMoney(invoice.balance)}` : description.trim() || "Counter sale";
  const forLabel = invoice ? `${invoice.display_number} · ${invoice.dealership}` : "Quick sale";

  const methodButton = (label: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void, opts: { disabled?: boolean; hint?: string; primary?: boolean } = {}) => (
    <Button type="button" size="lg" variant={opts.primary ? "default" : "secondary"} className="h-14 flex-col gap-0.5 text-sm" disabled={!valid || opts.disabled || pending} onClick={onClick} title={opts.hint}>
      <Icon className="size-5" />
      {label}
    </Button>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Point of sale"
        title="Terminal"
        description="Take a payment for an invoice or a quick sale, then email or print the receipt."
        actions={connection ? <ConnectionPill c={connection} /> : undefined}
      />
      {checklist}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
        {/* ---- Take a payment ---- */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Take a payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {invoice && (
              <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-primary/30 bg-accent-soft px-3 py-2 text-sm" data-testid="paying-invoice">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <FileTextIcon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate">
                    Paying <strong>{invoice.display_number}</strong> · {invoice.dealership}
                  </span>
                </span>
                <button type="button" aria-label="Clear invoice" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => { setInvoiceId(null); setCents(0); }}>
                  <XIcon className="size-4" />
                </button>
              </div>
            )}
            <div
              role="textbox"
              tabIndex={0}
              aria-label="Amount"
              aria-live="polite"
              onKeyDown={onKeyDown}
              className={cn("rounded-xl border border-border bg-surface-2 px-4 py-4 text-right text-[2.25rem] leading-10 font-semibold tracking-tight tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/70", cents === 0 && "text-subtle")}
            >
              {formatMoney(amount)}
            </div>
            {invoice && amount > invoice.balance + 0.004 && <Hint tone="error">More than the balance of {formatMoney(invoice.balance)}.</Hint>}
            <div className="grid grid-cols-3 gap-2" aria-label="Keypad">
              {KEYS.map((k) => (
                <Button key={k} type="button" variant="secondary" size="lg" className="h-13 text-lg" onClick={() => key(k)} aria-label={k === "⌫" ? "Backspace" : k}>
                  {k === "⌫" ? <DeleteIcon className="size-5" /> : k}
                </Button>
              ))}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>For</Label>
                <Segmented
                  size="sm"
                  aria-label="What the payment is for"
                  items={[
                    { value: "sale", label: "Quick sale" },
                    { value: "invoice", label: "Open invoice" },
                  ]}
                  value={mode}
                  onValueChange={(v) => {
                    setMode(v as "sale" | "invoice");
                    if (v === "sale") setInvoiceId(null);
                  }}
                />
              </div>
              {mode === "sale" ? (
                <div className="grid gap-2">
                  <Input placeholder="What for (e.g. Full detail · black GLE)" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" maxLength={200} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} aria-label="Customer name" maxLength={120} />
                    <Input type="email" inputMode="email" placeholder="Email for receipt" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} aria-label="Customer email" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                    <Input className="pl-9" placeholder="Invoice number or dealership" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find an open invoice" />
                  </div>
                  {filteredInvoices.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No open invoices match.</p>
                  ) : (
                    <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border" role="listbox" aria-label="Open invoices">
                      {filteredInvoices.map((i) => (
                        <li key={i.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={i.id === invoiceId}
                            onClick={() => pickInvoice(i)}
                            className={cn("flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50", i.id === invoiceId && "bg-accent-soft")}
                          >
                            <span className="min-w-0">
                              <span className="font-semibold">{i.display_number}</span>
                              <span className="block truncate text-caption text-muted-foreground">{i.dealership}</span>
                            </span>
                            <span className="shrink-0 tabular-nums">{formatMoney(i.balance)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {invoice && amount > 0 && amount < invoice.balance - 0.004 && <Hint tone="warning">Partial payment; {formatMoney(invoice.balance - amount)} stays open on {invoice.display_number}.</Hint>}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Paid with</Label>
              <div className="grid grid-cols-3 gap-2">
                {methodButton("Card", CreditCardIcon, () => setDialog("card"), { primary: true, disabled: !cloverCard, hint: cloverCard ? undefined : cloverEnabled ? "Add CLOVER_ECOM_PUBLIC_KEY to take cards in the app" : "Turn on Clover in Settings to take cards" })}
                {methodButton("Terminal", TabletSmartphoneIcon, () => setDialog("device"), { primary: true, disabled: !cloverDevice, hint: cloverDevice ? undefined : "Add the Clover device serial in Settings → Clover" })}
                {methodButton("Cash", BanknoteIcon, () => setDialog({ manual: "cash" }))}
                {methodButton("Check", ReceiptTextIcon, () => setDialog({ manual: "check" }))}
                {methodButton("ACH", LandmarkIcon, () => setDialog({ manual: "ach" }))}
                {methodButton("Other", MoreHorizontalIcon, () => setDialog({ manual: "other" }))}
              </div>
              {!cloverEnabled && <Hint>Card and Terminal need Clover (Settings → Clover). Cash, check and ACH work now.</Hint>}
            </div>
          </CardContent>
        </Card>

        {/* ---- The day ---- */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>{date === today ? "Today" : formatDateOnly(date, "EEEE, MMM d")}</span>
              <span className="flex items-center gap-2">
                {date !== today && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => router.push("/terminal")}>
                    Today
                  </Button>
                )}
                <Input type="date" value={date} max={today} onChange={(e) => e.target.value && router.push(`/terminal?date=${e.target.value}`)} className="h-9 w-40 text-sm" aria-label="Day" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Sales" value={formatMoney(totals.gross)} sub={`${totals.count} ${totals.count === 1 ? "sale" : "sales"}`} />
              <Stat label="Refunds" value={totals.back ? `-${formatMoney(totals.back)}` : "—"} sub={totals.back ? undefined : "none"} tone={totals.back ? "warning" : undefined} />
              <Stat label="Net" value={formatMoney(totals.net)} sub={totals.byMethod.map(([m, v]) => `${METHOD_LABELS[m]} ${formatMoney(v)}`).join(" · ") || undefined} tone="accent" />
            </div>

            {list.length === 0 ? (
              <EmptyState icon={ReceiptTextIcon} title={date === today ? "Nothing taken yet today" : "No transactions that day"} description="Sales and refunds from the Terminal, the invoice pages and Clover all show up here." className="mt-4" />
            ) : (
              <ul className="mt-4 divide-y divide-border text-sm">
                {list.map((t, i) => (
                  <StaggerItem key={t.id} index={i} as="li">
                    <button type="button" onClick={() => setViewing(t)} className="-mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent/50">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", t.kind === "refund" ? "bg-warning/12 text-warning" : "bg-accent-soft text-primary")}>
                          {t.kind === "refund" ? <Undo2Icon className="size-4" /> : t.invoice_number ? <FileTextIcon className="size-4" /> : t.method === "card" ? <CreditCardIcon className="size-4" /> : <BanknoteIcon className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{receiptSubject(t)}</span>
                          <span className="block truncate text-caption text-subtle">
                            {formatDate(t.at, "h:mm a")} · {paidWith(t)}
                            {t.customer_name ? ` · ${t.customer_name}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={cn("block font-semibold tabular-nums", t.kind === "refund" && "text-warning")}>
                          {t.kind === "refund" ? "-" : ""}
                          {formatMoney(t.amount)}
                        </span>
                        {t.kind === "sale" && t.status !== "captured" && (
                          <Badge variant={t.status === "refunded" ? "muted" : "warning"} className="mt-0.5">
                            {t.status === "refunded" ? "Refunded" : "Partial refund"}
                          </Badge>
                        )}
                      </span>
                    </button>
                  </StaggerItem>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Dialogs ---- */}
      {cloverCard && (
        <Dialog open={dialog === "card"} onOpenChange={(o) => !o && setDialog(null)}>
          {dialog === "card" && (
            <ChargeCardDialog
              subtitle={`${subtitle} · ${forLabel}`}
              balance={amount}
              lockAmount
              config={cloverCard}
              onDone={(r) => {
                if (demo) finish(demoTx({ ...base(), method: "card" }, r));
              }}
              charge={async (i) => {
                const r = await takeSaleAction({ ...base(), method: "card", token: i.token, amount: i.amount });
                if (r.ok) {
                  finish(r.data);
                  return { ok: true, data: { amount: r.data.amount, last4: r.data.last4 } };
                }
                return r;
              }}
            />
          )}
        </Dialog>
      )}
      {cloverDevice && (
        <Dialog open={dialog === "device"} onOpenChange={(o) => !o && setDialog(null)}>
          {dialog === "device" && (
            <PayOnDeviceDialog
              subtitle={`${subtitle} · ${forLabel}`}
              balance={amount}
              lockAmount
              onDone={(r) => {
                if (demo) finish(demoTx({ ...base(), method: "device" }, r));
              }}
              send={async (i) => {
                const r = await takeSaleAction({ ...base(), method: "device", amount: i.amount });
                if (r.ok) {
                  finish(r.data);
                  return { ok: true, data: { amount: r.data.amount, last4: r.data.last4 } };
                }
                return r;
              }}
            />
          )}
        </Dialog>
      )}
      <Dialog open={typeof dialog === "object" && dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        {typeof dialog === "object" && dialog !== null && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{METHOD_LABELS[dialog.manual]} payment</DialogTitle>
              <DialogDescription>
                {formatMoney(amount)} · {forLabel}
              </DialogDescription>
            </DialogHeader>
            {(dialog.manual === "check" || dialog.manual === "ach" || dialog.manual === "other") && (
              <div className="grid gap-1.5">
                <Label htmlFor="manual-ref">{dialog.manual === "check" ? "Check number" : "Reference"}</Label>
                <Input id="manual-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} autoFocus />
              </div>
            )}
            <DialogFooter>
              <Button type="button" loading={pending} onClick={() => takeManual(dialog.manual)}>
                Record {formatMoney(amount)}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Receipt after a sale */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        {receipt && (
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Paid! 🎉</DialogTitle>
              <DialogDescription>
                {totals.count} {totals.count === 1 ? "sale" : "sales"} today · {formatMoney(totals.net)} net. Email or print the receipt, or start the next one.
              </DialogDescription>
            </DialogHeader>
            <ReceiptView tx={receipt} company={company} onNew={() => setReceipt(null)} />
          </DialogContent>
        )}
      </Dialog>

      {/* A transaction from the list */}
      <Dialog open={!!viewing && !refunding} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && (
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{viewing.kind === "refund" ? "Refund" : "Sale"}</DialogTitle>
              <DialogDescription>{formatDate(viewing.at, "EEEE, MMM d · h:mm a")}</DialogDescription>
            </DialogHeader>
            <ReceiptView tx={viewing} company={company} onRefund={() => setRefunding(viewing)} />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={!!refunding} onOpenChange={(o) => !o && setRefunding(null)}>
        {refunding && (
          <RefundDialog
            tx={refunding}
            onDone={(r) => {
              if (demo) setLocal((l) => [r, ...l]);
              setRefunding(null);
              setViewing(r);
            }}
          />
        )}
      </Dialog>
    </Page>
  );
}

/** Header pill: is Clover ready to take a card right now? */
function ConnectionPill({ c }: { c: NonNullable<React.ComponentProps<typeof Terminal>["connection"]> }) {
  const tone = !c.enabled ? "muted" : c.needsReconnect ? "warning" : c.healthy ? "success" : "muted";
  const label = !c.enabled ? "Set up Clover" : c.needsReconnect ? "Reconnect Clover" : c.healthy ? `Clover · ${c.merchantName ?? "connected"}${c.device ? " · terminal ready" : ""}` : "Clover · check connection";
  return (
    <Link
      href="/settings#clover"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
        tone === "success" && "border-success/30 bg-success/10 text-success hover:bg-success/15",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
        tone === "muted" && "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
      )}
    >
      <PlugZapIcon className="size-4" />
      <span className={cn("size-2 rounded-full", tone === "success" && "bg-success", tone === "warning" && "bg-warning", tone === "muted" && "bg-subtle")} aria-hidden />
      {label}
    </Link>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "accent" | "warning" }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-base font-semibold tabular-nums sm:text-lg", tone === "accent" && "text-primary", tone === "warning" && "text-warning")}>{value}</div>
      {sub && <div className="truncate text-caption text-subtle">{sub}</div>}
    </div>
  );
}

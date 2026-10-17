"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { InventoryItem, InventoryItemInput, PartOrder, StockMovement, Vendor } from "@/lib/db/types";
import { adjustStockAction, cancelPartOrderAction, createPartOrderAction, inventoryHistoryAction, markPartOrderOrderedAction, partOrderDetailAction, receivePartOrderAction, saveInventoryItemAction, saveVendorAction } from "@/app/(app)/retail/parts/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, receiveDefaults, receivePayload, remaining, stockLabel } from "@/lib/retail/inventory";
import { cn } from "@/lib/utils";
import { Page, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PartsTab = "parts" | "orders" | "vendors";

const TONE: Record<string, "success" | "warning" | "destructive" | "muted"> = { ok: "success", low: "warning", out: "destructive", negative: "destructive" };
const STATUS_TONE: Record<PartOrder["status"], "muted" | "info" | "success" | "destructive"> = { draft: "muted", ordered: "info", received: "success", cancelled: "destructive" };
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Retail → Parts: what is on the shelf (name, number, bin, how many, and for the people who may see
 * prices the cost and list price), the orders to vendors and what arrived, and the vendors. Stock
 * leaves when a visit that uses a stocked part is approved; receiving an order puts it back.
 */
export function PartsManager({ tab, items, orders, vendors, q, low, canEdit, showMoney, openOrder }: { tab: PartsTab; items: InventoryItem[]; orders: PartOrder[]; vendors: Vendor[]; q: string; low: boolean; canEdit: boolean; showMoney: boolean; /** An order to open straight away (the one made from an estimate). */ openOrder?: PartOrder | null }) {
  const tabs: { value: PartsTab; label: string; href: string }[] = [
    { value: "parts", label: "Parts", href: "/retail/parts" },
    ...(showMoney ? [{ value: "orders" as const, label: "Orders", href: "/retail/parts?tab=orders" }, { value: "vendors" as const, label: "Vendors", href: "/retail/parts?tab=vendors" }] : []),
  ];
  return (
    <Page>
      <PageHeader eyebrow="Retail" title="Parts" description="What is on the shelf, what is on order, and where it comes from." />
      <nav aria-label="Parts sections" className="mt-4 flex gap-5 border-b border-border" data-testid="parts-tabs">
        {tabs.map((t) => (
          <Link key={t.value} href={t.href} aria-current={tab === t.value ? "page" : undefined} className={cn("-mb-px border-b-2 px-1 py-2.5 text-sm font-medium", tab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")} data-testid={`parts-tab-${t.value}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {tab === "parts" && <PartsTab items={items} vendors={vendors} q={q} low={low} canEdit={canEdit} showMoney={showMoney} />}
        {tab === "orders" && showMoney && <OrdersTab orders={orders} vendors={vendors} openOrder={openOrder ?? null} />}
        {tab === "vendors" && showMoney && <VendorsTab vendors={vendors} />}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
function PartsTab({ items, vendors, q, low, canEdit, showMoney }: { items: InventoryItem[]; vendors: Vendor[]; q: string; low: boolean; canEdit: boolean; showMoney: boolean }) {
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action="/retail/parts" className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={q} placeholder="Search name, number, brand or bin" aria-label="Search parts" className="h-10 w-full rounded-md border border-border bg-input pr-3 pl-8 text-base outline-none focus-visible:border-primary" data-testid="parts-search" />
          {low && <input type="hidden" name="low" value="1" />}
        </form>
        <Button asChild variant={low ? "default" : "outline"} size="sm">
          <Link href={low ? `/retail/parts${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/retail/parts?low=1${q ? `&q=${encodeURIComponent(q)}` : ""}`} data-testid="parts-low-filter">Low stock</Link>
        </Button>
        {canEdit && (
          <Button size="sm" className="ml-auto" onClick={() => setEditing("new")} data-testid="part-add">
            <PlusIcon /> Add a part
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="parts-list">
        {items.map((i) => {
          const s = stockLabel(i);
          return (
            <li key={i.id} className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3", !i.active && "opacity-60")} data-testid="part-row" data-low={i.low ? "1" : "0"}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-caption text-subtle">{i.part_number}</span>
                  {!i.active && <Badge variant="muted">Off</Badge>}
                </div>
                <div className="text-caption text-subtle">{[i.brand, i.bin ? `Bin ${i.bin}` : null, i.vendor].filter(Boolean).join(" · ") || "No bin or vendor yet"}</div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {showMoney && i.list_price !== null && <span className="text-sm tabular-nums text-muted-foreground" title={i.cost !== null ? `Your cost ${formatMoney(i.cost)}` : undefined}>{formatMoney(i.list_price)}{i.cost !== null ? ` · cost ${formatMoney(i.cost)}` : ""}</span>}
                <Badge variant={TONE[s.tone]} data-testid="part-stock">{s.text}</Badge>
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(i)} data-testid="part-adjust">Adjust</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                      <PencilIcon />
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">{q || low ? "No parts match." : canEdit ? "No stocked parts yet. Add the parts you keep on the shelf." : "No stocked parts yet."}</li>}
      </ul>
      {editing && <ItemDialog item={editing === "new" ? null : editing} vendors={vendors} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustDialog item={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function ItemDialog({ item, vendors, onClose }: { item: InventoryItem | null; vendors: Vendor[]; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ part_number: item?.part_number ?? "", name: item?.name ?? "", vendor_id: item?.vendor_id ?? "", brand: item?.brand ?? "", bin: item?.bin ?? "", cost: item?.cost != null ? String(item.cost) : "", list_price: item?.list_price != null ? String(item.list_price) : "", reorder_at: item?.reorder_at != null ? String(item.reorder_at) : "", qty: "", active: item?.active ?? true });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  function save() {
    const input: InventoryItemInput = { id: item?.id, part_number: f.part_number, name: f.name, vendor_id: f.vendor_id || null, brand: f.brand || null, bin: f.bin || null, cost: num(f.cost), list_price: num(f.list_price), reorder_at: num(f.reorder_at), active: f.active, ...(item ? {} : { qty_on_hand: Number(f.qty) || 0 }) };
    start(async () => {
      if (demo) {
        toast.success("Saved", { description: "Guest preview — nothing changed" });
        return onClose();
      }
      const r = await saveInventoryItemAction(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit the part" : "Add a part"}</DialogTitle>
          <DialogDescription>{item ? "The count changes with Adjust, orders and visits, so there is a record of why." : "Type how many are on the shelf now; after that the count follows the orders and the visits."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pt-number" label="Part number" value={f.part_number} onChange={(v) => set({ part_number: v })} testId="pt-number" maxLength={60} />
          <Field id="pt-name" label="Name" value={f.name} onChange={(v) => set({ name: v })} testId="pt-name" maxLength={120} />
          <Field id="pt-brand" label="Brand (optional)" value={f.brand} onChange={(v) => set({ brand: v })} maxLength={60} />
          <Field id="pt-bin" label="Bin (optional)" value={f.bin} onChange={(v) => set({ bin: v })} maxLength={30} />
          <Field id="pt-cost" label="Your cost, each" value={f.cost} onChange={(v) => set({ cost: v })} inputMode="decimal" testId="pt-cost" />
          <Field id="pt-price" label="List price, each" value={f.list_price} onChange={(v) => set({ list_price: v })} inputMode="decimal" testId="pt-price" />
          <Field id="pt-reorder" label="Reorder at (optional)" value={f.reorder_at} onChange={(v) => set({ reorder_at: v })} inputMode="decimal" testId="pt-reorder" />
          {!item && <Field id="pt-qty" label="On the shelf now" value={f.qty} onChange={(v) => set({ qty: v })} inputMode="decimal" testId="pt-qty" />}
          <div className="grid gap-1.5">
            <Label htmlFor="pt-vendor">Vendor (optional)</Label>
            <select id="pt-vendor" value={f.vendor_id} onChange={(e) => set({ vendor_id: e.target.value })} className="h-10 rounded-md border border-border bg-input px-2 text-sm">
              <option value="">None</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <label className="flex items-center justify-between gap-3 self-end text-sm sm:col-span-1">
            <span>On (offered on estimates)</span>
            <Switch checked={f.active} onCheckedChange={(v) => set({ active: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} loading={pending} disabled={!f.part_number.trim() || !f.name.trim()} data-testid="pt-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, value, onChange, inputMode, testId, maxLength }: { id: string; label: string; value: string; onChange: (v: string) => void; inputMode?: "decimal"; testId?: string; maxLength?: number }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength} data-testid={testId} />
    </div>
  );
}

function AdjustDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<StockMovement[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  if (!loaded) {
    setLoaded(true);
    if (demo) setHistory([]);
    else void inventoryHistoryAction(item.id).then((r) => setHistory(r.ok ? r.data : []));
  }
  function save() {
    const n = Number(delta);
    start(async () => {
      if (demo) {
        toast.success("Adjusted", { description: "Guest preview — nothing changed" });
        return onClose();
      }
      const r = await adjustStockAction(item.id, n, note);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Count updated");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust {item.name}</DialogTitle>
          <DialogDescription>{stockLabel(item).text}. Type a plus or minus number: a recount, a damaged part, one used outside a visit.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field id="adj-delta" label="Add or remove" value={delta} onChange={setDelta} inputMode="decimal" testId="adj-delta" />
          <Field id="adj-note" label="Why (optional)" value={note} onChange={setNote} testId="adj-note" maxLength={200} />
        </div>
        <Button onClick={save} loading={pending} disabled={!Number(delta)} data-testid="adj-save">Update the count</Button>
        <div>
          <h3 className="mb-1 text-label text-subtle">History</h3>
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm" data-testid="adj-history">
            {(history ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0 truncate">{m.note ?? m.reason}{m.order ? ` · ${m.order}` : ""}{m.estimate ? ` · ${m.estimate}` : ""}</span>
                <span className="shrink-0 text-caption text-subtle">{m.by ? `${m.by} · ` : ""}{formatDateTime(m.created_at)}</span>
                <span className={cn("w-10 shrink-0 text-right tabular-nums", m.qty_delta < 0 ? "text-destructive" : "text-success")}>{m.qty_delta > 0 ? "+" : ""}{m.qty_delta}</span>
              </li>
            ))}
            {history !== null && history.length === 0 && <li className="px-3 py-3 text-muted-foreground">Nothing recorded yet.</li>}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function OrdersTab({ orders, vendors, openOrder }: { orders: PartOrder[]; vendors: Vendor[]; openOrder: PartOrder | null }) {
  const { demo } = useSession();
  const [open, setOpen] = useState<PartOrder | null>(openOrder);
  const [creating, setCreating] = useState(false);
  async function show(o: PartOrder) {
    if (demo || o.lines) return setOpen(o);
    const r = await partOrderDetailAction(o.id);
    if (!r.ok) return void toast.error(r.error);
    setOpen(r.data);
  }
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)} data-testid="order-new">
          <PlusIcon /> New order
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="orders-list">
        {orders.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => void show(o)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40" data-testid="order-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{o.number}</span><Badge variant={STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></div>
                <div className="text-caption text-subtle">{[o.vendor ?? "No vendor yet", o.estimate_number ? `for ${o.estimate_number}` : null, `${o.line_count} ${o.line_count === 1 ? "line" : "lines"}`].filter(Boolean).join(" · ")}</div>
              </div>
              <span className="tabular-nums text-sm text-muted-foreground">{formatMoney(o.total)}</span>
            </button>
          </li>
        ))}
        {orders.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No orders yet. Open an estimate and tap Order parts, or start one here.</li>}
      </ul>
      {open && <OrderDialog order={open} vendors={vendors} onClose={() => setOpen(null)} />}
      {creating && <NewOrderDialog vendors={vendors} onClose={() => setCreating(false)} onCreated={(o) => { setCreating(false); setOpen(o); }} />}
    </div>
  );
}

function OrderDialog({ order: first, vendors, onClose }: { order: PartOrder; vendors: Vendor[]; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [order, setOrder] = useState(first);
  const [vendor, setVendor] = useState(first.vendor_id ?? "");
  const [typed, setTyped] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(receiveDefaults(first)).map(([k, v]) => [k, String(v)])));
  const lines = order.lines ?? [];
  const closed = order.status === "received" || order.status === "cancelled";
  function run(fn: () => Promise<{ ok: true; data: PartOrder } | { ok: false; error: string }>, done: string) {
    start(async () => {
      if (demo) return void toast.success(done, { description: "Guest preview — nothing changed" });
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      setOrder(r.data);
      setTyped(Object.fromEntries(Object.entries(receiveDefaults(r.data)).map(([k, v]) => [k, String(v)])));
      toast.success(done);
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="order-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{order.number} <Badge variant={STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge></DialogTitle>
          <DialogDescription>{order.note || (order.estimate_number ? `For ${order.estimate_number}` : "Parts to order")}</DialogDescription>
        </DialogHeader>
        {order.status === "draft" && (
          <div className="grid gap-1.5">
            <Label htmlFor="ord-vendor">Vendor</Label>
            <select id="ord-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-10 rounded-md border border-border bg-input px-2 text-sm" data-testid="order-vendor">
              <option value="">Pick the vendor</option>
              {vendors.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
        <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="order-lines">
          {lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium">{l.name}</div>
                <div className="text-caption text-subtle">{[l.part_number, l.cost !== null ? `${formatMoney(l.cost)} each` : null].filter(Boolean).join(" · ")} · ordered {l.qty} · received {l.received_qty}</div>
              </div>
              {!closed && order.status !== "draft" && remaining(l) > 0 ? (
                <Input aria-label={`Received ${l.name}`} inputMode="decimal" value={typed[l.id] ?? ""} onChange={(e) => setTyped((t) => ({ ...t, [l.id]: e.target.value }))} className="h-9 w-20 text-center" data-testid="receive-qty" />
              ) : (
                <span className="text-caption text-subtle">{remaining(l) === 0 ? "In" : `${remaining(l)} to come`}</span>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-wrap gap-2">
          {!closed && (
            <Button variant="ghost" disabled={pending} onClick={() => run(async () => { const r = await cancelPartOrderAction(order.id); return r.ok ? { ok: true as const, data: { ...order, status: "cancelled" as const } } : r; }, "Order cancelled")}>
              Cancel the order
            </Button>
          )}
          {order.status === "draft" && (
            <Button loading={pending} disabled={!vendor} onClick={() => run(() => markPartOrderOrderedAction(order.id, vendor || null), "Marked as ordered")} data-testid="order-mark-ordered">
              Mark as ordered
            </Button>
          )}
          {order.status === "draft" || order.status === "ordered" ? (
            <Button variant={order.status === "ordered" ? "default" : "outline"} loading={pending} disabled={order.status === "draft" || receivePayload(order, typed).length === 0} onClick={() => run(() => receivePartOrderAction(order.id, receivePayload(order, typed)), "Parts received")} data-testid="order-receive">
              Receive what arrived
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewOrderDialog({ vendors, onClose, onCreated }: { vendors: Vendor[]; onClose: () => void; onCreated: (o: PartOrder) => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([{ key: "r0", name: "", part_number: "", qty: "1", cost: "" }]);
  const set = (key: string, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  function create() {
    const lines = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), part_number: r.part_number.trim() || null, qty: Number(r.qty) || 0, cost: num(r.cost) }));
    start(async () => {
      if (demo) {
        toast.success("Order created", { description: "Guest preview — nothing changed" });
        return onClose();
      }
      const r = await createPartOrderAction({ vendor_id: vendor || null, note: note || null, lines });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data.number} created`);
      router.refresh();
      onCreated(r.data);
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>What to buy. A part number that matches a stocked part adds to its count when it arrives; a new number becomes a stocked part.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="no-vendor">Vendor (optional)</Label>
            <select id="no-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-10 rounded-md border border-border bg-input px-2 text-sm">
              <option value="">Decide later</option>
              {vendors.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <Field id="no-note" label="Note (optional)" value={note} onChange={setNote} maxLength={300} />
        </div>
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_6rem_3.5rem_4.5rem_2rem] items-center gap-1.5" data-testid="new-order-line">
              <Input aria-label="Part name" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Part" className="h-9" />
              <Input aria-label="Part number" value={r.part_number} onChange={(e) => set(r.key, { part_number: e.target.value })} placeholder="Number" className="h-9" />
              <Input aria-label="Quantity" inputMode="decimal" value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} placeholder="Qty" className="h-9" />
              <Input aria-label="Cost each" inputMode="decimal" value={r.cost} onChange={(e) => set(r.key, { cost: e.target.value })} placeholder="Cost" className="h-9" />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove the line" onClick={() => setRows((x) => (x.length > 1 ? x.filter((y) => y.key !== r.key) : x))}>
                <XIcon />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setRows((x) => [...x, { key: `r${x.length}-${crypto.randomUUID()}`, name: "", part_number: "", qty: "1", cost: "" }])}>
            <PlusIcon /> Another part
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={create} loading={pending} disabled={!rows.some((r) => r.name.trim())} data-testid="order-create">Create the order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function VendorsTab({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", phone: "", email: "", account_no: "", notes: "", active: true });
  function begin(v: Vendor | "new") {
    setF(v === "new" ? { name: "", phone: "", email: "", account_no: "", notes: "", active: true } : { name: v.name, phone: v.phone ?? "", email: v.email ?? "", account_no: v.account_no ?? "", notes: v.notes ?? "", active: v.active });
    setEditing(v);
  }
  function save() {
    start(async () => {
      if (demo) {
        toast.success("Saved", { description: "Guest preview — nothing changed" });
        return setEditing(null);
      }
      const r = await saveVendorAction({ id: editing && editing !== "new" ? editing.id : undefined, name: f.name, phone: f.phone || null, email: f.email || null, account_no: f.account_no || null, notes: f.notes || null, active: f.active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      setEditing(null);
      router.refresh();
    });
  }
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => begin("new")} data-testid="vendor-add">
          <PlusIcon /> Add a vendor
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="vendors-list">
        {vendors.map((v) => (
          <li key={v.id} className={cn("flex items-center justify-between gap-3 px-4 py-3", !v.active && "opacity-60")} data-testid="vendor-row">
            <div className="min-w-0">
              <div className="font-medium">{v.name}{!v.active && <Badge variant="muted" className="ml-2">Off</Badge>}</div>
              <div className="text-caption text-subtle">{[v.phone, v.email, v.account_no ? `Acct ${v.account_no}` : null].filter(Boolean).join(" · ") || "No contact yet"}</div>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${v.name}`} onClick={() => begin(v)}>
              <PencilIcon />
            </Button>
          </li>
        ))}
        {vendors.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No vendors yet.</li>}
      </ul>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Add a vendor" : "Edit the vendor"}</DialogTitle>
              <DialogDescription>Where parts come from: the people you call or order from.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="vn-name" label="Name" value={f.name} onChange={(v) => setF((x) => ({ ...x, name: v }))} testId="vn-name" maxLength={80} />
              <Field id="vn-phone" label="Phone" value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} maxLength={40} />
              <Field id="vn-email" label="Email" value={f.email} onChange={(v) => setF((x) => ({ ...x, email: v }))} maxLength={120} />
              <Field id="vn-acct" label="Account number" value={f.account_no} onChange={(v) => setF((x) => ({ ...x, account_no: v }))} maxLength={40} />
              <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="vn-notes">Notes</Label><Input id="vn-notes" value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} maxLength={500} /></div>
              <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2"><span>On</span><Switch checked={f.active} onCheckedChange={(v) => setF((x) => ({ ...x, active: v }))} /></label>
            </div>
            <DialogFooter>
              <Button onClick={save} loading={pending} disabled={!f.name.trim()} data-testid="vn-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


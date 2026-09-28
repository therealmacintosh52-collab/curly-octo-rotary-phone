"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, CircleCheckBigIcon, CloudOffIcon, CreditCardIcon, ExternalLinkIcon, LoaderCircleIcon, ScanLineIcon, TriangleAlertIcon, WalletIcon, XIcon } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { toast } from "sonner";
import type { Dealership, JobPayload, PriceListRow } from "@/lib/db/types";
import { useSession } from "@/components/app/session-provider";
import { useSync } from "@/components/offline/sync-provider";
import { enqueueJob, findLocalDuplicates, getOutboxItem, OUTBOX_EVENT, saveRecentJobs, saveReference } from "@/lib/offline/outbox";
import { fireConfetti, haptic } from "@/components/motion/confetti";
import { invoiceJobAction } from "@/app/(app)/invoices/actions";
import type { OutboxItem, RecentJob } from "@/lib/offline/db";
import { decodeVin } from "@/lib/vin-client";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { COLORS, DEFAULT_MAKE, MAKES, MERCEDES_MODELS, yearOptions } from "@/lib/vehicles";
import { dateInputToIso, nowMs, toDateInput } from "@/lib/dates";
import { formatMoney, sumPrices } from "@/lib/money";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServicePicker, type SelectedService } from "./service-picker";
import { CountUp } from "@/components/motion/primitives";
// The barcode engine (ZXing) is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("./vin-scanner").then((mod) => mod.VinScanner), { ssr: false });
import { ModelCombobox } from "./model-combobox";
import { DuplicateDialog, type DuplicateHit } from "./duplicate-dialog";

const LAST_DEALERSHIP_KEY = "cali-tints:last-dealership";

interface Props {
  dealerships: Dealership[];
  priceLists: Record<string, PriceListRow[]>;
  detailers: { id: string; full_name: string }[];
  recentJobs: RecentJob[];
  /** Admins also get "Save & charge": invoice this car now and open the Terminal. */
  isAdmin?: boolean;
}

type SaveIntent = "next" | "charge";

/** The car just saved, shown in the success card while the form is ready for the next one. */
interface SavedCar {
  clientId: string;
  tag: string;
  model: string | null;
  dealership: string;
  total: number;
  /** syncing: on its way to the server · queued: offline · ready: invoice made · failed: server said no */
  status: "syncing" | "queued" | "ready" | "failed";
  invoiceId: string | null;
  invoiceNumber: string | null;
  error?: string | null;
}

/**
 * New invoice. Optimistic by design: "Save & next" writes to the local outbox and
 * returns immediately; the sync loop pushes it to Supabase, where the car
 * becomes its own invoice, and the success card fills in the invoice number.
 * "Save & charge" (admins, online) saves straight to the server and opens the
 * Terminal with the invoice ready to pay.
 */
export function JobForm({ dealerships, priceLists, detailers, recentJobs, isAdmin = false }: Props) {
  const router = useRouter();
  const { company, demo, isAdmin: sessionAdmin } = useSession();
  const { online } = useSync();
  const canCharge = isAdmin || sessionAdmin;
  const tagRef = useRef<HTMLInputElement>(null);

  // --- form state ------------------------------------------------------------
  const [dealershipId, setDealershipId] = useState<string>(() => dealerships[0]?.id ?? "");
  const [tag, setTag] = useState("");
  const [vin, setVin] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [decodedLabel, setDecodedLabel] = useState<string | null>(null);
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>(DEFAULT_MAKE);
  const [customMake, setCustomMake] = useState(""); // typed when Make is "Other"
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [services, setServices] = useState<SelectedService[]>([]);
  const [performedAt, setPerformedAt] = useState(() => toDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateHit[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [charging, setCharging] = useState(false);
  const [intent, setIntent] = useState<SaveIntent>("next");
  const [savedCount, setSavedCount] = useState(0);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedByService, setSavedByService] = useState<Record<string, number>>({});
  const [lastSaved, setLastSaved] = useState<SavedCar | null>(null);

  const dealership = dealerships.find((d) => d.id === dealershipId) ?? null;
  const priceList = priceLists[dealershipId] ?? [];
  const total = useMemo(() => sumPrices(services), [services]);
  const vinState = vinStatus(vin);

  // Restore last dealership + warm the offline caches.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const last = localStorage.getItem(LAST_DEALERSHIP_KEY);
        if (last && dealerships.some((d) => d.id === last)) setDealershipId(last);
      } catch {
        /* ignore */
      }
      void saveReference({ fetched_at: Date.now(), dealerships, price_lists: priceLists, detailers }).catch(() => {});
      void saveRecentJobs(recentJobs).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [dealerships, priceLists, detailers, recentJobs]);

  // Follow the car we just queued: when it syncs, the invoice number lands in the card.
  const followId = lastSaved?.status === "syncing" || lastSaved?.status === "queued" ? lastSaved.clientId : null;
  useEffect(() => {
    if (!followId) return;
    let alive = true;
    const check = async () => {
      const item = await getOutboxItem(followId).catch(() => undefined);
      if (!alive || !item) return;
      if (item.status === "done") {
        setLastSaved((c) => (c && c.clientId === followId ? { ...c, status: "ready", invoiceId: item.invoice_id ?? null, invoiceNumber: item.invoice_number ?? null } : c));
        haptic([15]);
      } else if (item.status === "error") {
        setLastSaved((c) => (c && c.clientId === followId ? { ...c, status: "failed", error: item.last_error } : c));
      } else if (item.status === "syncing") {
        setLastSaved((c) => (c && c.clientId === followId && c.status === "queued" ? { ...c, status: "syncing" } : c));
      }
    };
    window.addEventListener(OUTBOX_EVENT, check);
    const t = setTimeout(check, 0);
    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener(OUTBOX_EVENT, check);
    };
  }, [followId]);

  // Switching dealership resets selected services (prices differ per dealer).
  function changeDealership(id: string) {
    setDealershipId(id);
    setServices([]);
    try {
      localStorage.setItem(LAST_DEALERSHIP_KEY, id);
    } catch {
      /* ignore */
    }
  }

  // --- VIN decode --------------------------------------------------------------
  const applyDecode = useCallback(async (v: string) => {
    setDecoding(true);
    try {
      const r = await decodeVin(v);
      if (r.year) setYear(String(r.year));
      if (r.make) {
        if ((MAKES as readonly string[]).includes(r.make)) setMake(r.make);
        else {
          setMake("Other");
          setCustomMake(r.make);
        }
      }
      if (r.model) setModel(r.model);
      const label = [r.year, r.make, r.model].filter(Boolean).join(" ");
      setDecodedLabel(label || null);
      if (!label) toast.warning("NHTSA could not decode that VIN. Fill in year / model by hand.");
    } catch (err) {
      setDecodedLabel(null);
      toast.warning(navigator.onLine ? errorMessage(err, "VIN lookup failed") : "Offline: VIN saved, year/model can be filled by hand");
    } finally {
      setDecoding(false);
    }
  }, []);

  function onVinChange(raw: string) {
    const v = normalizeVin(raw).slice(0, 17);
    setVin(v);
    setDecodedLabel(null);
    if (v.length === 17 && vinStatus(v) !== "invalid") void applyDecode(v);
  }

  const onScanned = useCallback(
    (v: string) => {
      setVin(v);
      setDecodedLabel(null);
      void applyDecode(v);
      toast.success("VIN scanned");
    },
    [applyDecode],
  );

  // --- validation --------------------------------------------------------------
  function validate(): string | null {
    if (!dealershipId) return "Pick a dealership";
    if (!tag.trim()) return "Key tag number is required";
    if (vin && vinState === "invalid") return "VIN must be 17 characters (no I, O or Q)";
    if (services.length === 0) return "Select at least one service";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(performedAt)) return "Date is invalid";
    return null;
  }

  // --- save ------------------------------------------------------------------
  async function checkDuplicates(): Promise<DuplicateHit[]> {
    const local = await findLocalDuplicates(tag, vin || null).catch(() => [] as RecentJob[]);
    let remote: DuplicateHit[] = [];
    if (navigator.onLine && !demo) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().rpc("find_duplicate_jobs", { p_tag_number: tag.trim(), p_vin: vin || null, p_dealership_id: null });
        remote = (data ?? []).map((d) => ({ ...d, detailer_name: d.detailer_name }));
      } catch {
        /* offline or slow: local check is enough */
      }
    }
    const seen = new Set(remote.map((r) => r.id));
    return [...remote, ...local.filter((l) => !seen.has(l.id))];
  }

  async function onSubmit(e?: React.FormEvent, how: SaveIntent = "next") {
    e?.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setIntent(how);
    const busy = how === "charge" ? setCharging : setSaving;
    busy(true);
    try {
      const hits = await checkDuplicates();
      if (hits.length > 0) {
        setDuplicates(hits);
        return;
      }
      await save(how);
    } finally {
      busy(false);
    }
  }

  async function save(how: SaveIntent = "next") {
    const clientId = crypto.randomUUID();
    const payload: JobPayload = {
      client_id: clientId,
      dealership_id: dealershipId,
      tag_number: tag.trim().toUpperCase(),
      vin: vin || null,
      year: year ? Number(year) : null,
      make: make === "Other" ? customMake.trim() || null : make || null,
      model: model.trim() || null,
      color: color === "Other" ? null : color || null,
      performed_at: dateInputToIso(performedAt),
      ro_po_number: null,
      notes: notes.trim() || null,
      services: services.map((s) => ({
        service_id: s.service_id,
        price: s.price,
        override_reason: s.override_reason,
        label: s.label ?? null,
      })),
    };
    const item: OutboxItem = {
      client_id: clientId,
      company_id: company.id,
      payload,
      photos: [],
      summary: { tag_number: payload.tag_number, model: payload.model ?? null, dealership_name: dealership?.name ?? "", total },
      status: "pending",
      attempts: 0,
      last_error: null,
      created_at: nowMs(),
      synced_at: null,
      job_id: null,
    };

    const saved: SavedCar = { clientId, tag: payload.tag_number, model: payload.model ?? null, dealership: dealership?.name ?? "", total, status: online ? "syncing" : "queued", invoiceId: null, invoiceNumber: null };
    const celebrate = () => {
      setSavedCount((c) => c + 1);
      setSavedTotal((t) => t + total);
      setSavedByService((m) => {
        const next = { ...m };
        for (const s of services) next[s.name] = (next[s.name] ?? 0) + 1;
        return next;
      });
      haptic([20]);
      fireConfetti({ y: 0.25 });
    };

    if (demo) {
      // Guest preview: nothing is persisted; pretend the invoice came back.
      celebrate();
      if (how === "charge") {
        router.push("/terminal?invoice=demo&method=device");
        return;
      }
      setLastSaved({ ...saved, status: "ready", invoiceId: "demo", invoiceNumber: `INV-${String(125 + savedCount).padStart(6, "0")}` });
      toast.success(`Saved ${payload.tag_number} · guest preview, not actually saved`);
      resetForNext();
      return;
    }

    if (how === "charge") {
      // Straight to the server so we have the invoice, then go collect.
      try {
        const { createJobDirect } = await import("@/lib/offline/sync");
        const car = await createJobDirect(item);
        celebrate();
        let invoiceId = car.invoice_id;
        if (!invoiceId) {
          // Auto-invoicing is off for this company: invoice the car explicitly.
          const r = await invoiceJobAction(car.id);
          if (!r.ok) {
            toast.error(`Saved ${payload.tag_number}, but the invoice failed: ${r.error}`);
            resetForNext();
            return;
          }
          invoiceId = r.data;
        }
        toast.success(`${payload.tag_number} saved · ${car.invoice_number ?? "invoice"} ready to charge`);
        router.push(`/terminal?invoice=${invoiceId}`);
      } catch (err) {
        toast.error(errorMessage(err, "Could not save the car"));
      }
      return;
    }

    try {
      await enqueueJob(item); // sync loop picks it up immediately
      setLastSaved(saved);
    } catch {
      // IndexedDB unavailable (rare: private mode). Save straight to the server instead.
      try {
        const { createJobDirect } = await import("@/lib/offline/sync");
        const car = await createJobDirect(item);
        setLastSaved({ ...saved, status: "ready", invoiceId: car.invoice_id, invoiceNumber: car.invoice_number });
      } catch (err) {
        toast.error(errorMessage(err, "Could not save the car"));
        return;
      }
    }

    celebrate();
    resetForNext();
  }

  function resetForNext() {
    setTag("");
    setVin("");
    setDecodedLabel(null);
    setYear("");
    setMake(DEFAULT_MAKE);
    setCustomMake("");
    setModel("");
    setColor("");
    setServices([]);
    setPerformedAt(toDateInput(new Date()));
    setNotes("");
    setDuplicates(null);
    requestAnimationFrame(() => {
      tagRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // --- render ----------------------------------------------------------------
  const modelOptions = make === DEFAULT_MAKE || make.startsWith("Mercedes") ? MERCEDES_MODELS : [];

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pt-5 pb-36 sm:px-6">
      {/* Title row */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-title">New invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tag, services, save. The car you log is the invoice.</p>
        </div>
        <AnimatePresence>
          {savedCount > 0 && (
            <m.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-caption font-medium tabular-nums text-primary" data-testid="today-pill">
              {savedCount} {savedCount === 1 ? "car" : "cars"} · {formatMoney(savedTotal)} today
              {Object.keys(savedByService).length > 0 && ` · ${priceList.filter((s) => savedByService[s.name]).map((s) => `${s.name} ${savedByService[s.name]}`).join(" · ")}`}
            </m.span>
          )}
        </AnimatePresence>
      </div>

      {/* The car just saved: its invoice, and what to do with it */}
      <AnimatePresence initial={false}>
        {lastSaved && (
          <m.div key={lastSaved.clientId} initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: -28 }} className={cn("overflow-hidden rounded-xl border p-4 surface-raised", lastSaved.status === "failed" ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-accent-soft/60")} data-testid="saved-card" role="status">
            <div className="flex items-start gap-3">
              {lastSaved.status === "ready" ? <CircleCheckBigIcon className="mt-0.5 size-5 shrink-0 text-primary" /> : lastSaved.status === "failed" ? <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" /> : lastSaved.status === "queued" ? <CloudOffIcon className="mt-0.5 size-5 shrink-0 text-warning" /> : <LoaderCircleIcon className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-semibold tracking-wide">{lastSaved.tag}</span>
                  {lastSaved.model && <span className="truncate text-sm text-muted-foreground">{lastSaved.model}</span>}
                  <span className="ml-auto font-semibold tabular-nums">{formatMoney(lastSaved.total)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lastSaved.status === "ready" && (
                    <>
                      <span className="font-medium text-foreground">{lastSaved.invoiceNumber ?? "Invoice"}</span> ready · {lastSaved.dealership}
                    </>
                  )}
                  {lastSaved.status === "syncing" && "Saved · making the invoice…"}
                  {lastSaved.status === "queued" && "Queued on this phone · the invoice is made when signal returns"}
                  {lastSaved.status === "failed" && (lastSaved.error ?? "The server rejected this car")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastSaved.status === "ready" && lastSaved.invoiceId && canCharge && (
                    <Button asChild size="sm">
                      <Link href={`/terminal?invoice=${lastSaved.invoiceId}`}>
                        <WalletIcon /> Collect {formatMoney(lastSaved.total)}
                      </Link>
                    </Button>
                  )}
                  {lastSaved.status === "ready" && lastSaved.invoiceId && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/invoices/${lastSaved.invoiceId}`}>
                        <ExternalLinkIcon /> Open invoice
                      </Link>
                    </Button>
                  )}
                  {lastSaved.status === "failed" && (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/jobs/outbox">Sync queue</Link>
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => { setLastSaved(null); tagRef.current?.focus(); }}>
                    Next invoice
                  </Button>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Where and when */}
      <section className="grid gap-3 sm:grid-cols-[2fr_3fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="performed">Date</Label>
          <Input id="performed" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dealership">Dealership</Label>
          <Select value={dealershipId} onValueChange={changeDealership}>
            <SelectTrigger id="dealership" aria-label="Dealership">
              <SelectValue placeholder="Pick a dealership" />
            </SelectTrigger>
            <SelectContent>
              {dealerships.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Vehicle */}
      <section className="flex flex-col gap-4">
        <h2 className="text-label text-subtle">Vehicle</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="tag">Key tag number</Label>
          <Input
            ref={tagRef}
            id="tag"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="e.g. 4821"
            className="h-16 rounded-xl text-[1.75rem] font-semibold tracking-wider placeholder:text-xl placeholder:font-medium placeholder:tracking-normal focus-visible:glow-primary"
            required
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="vin">VIN (optional)</Label>
            {vinState === "warn" && <Hint tone="warning">Check digit does not match</Hint>}
            {vinState === "invalid" && <Hint tone="error">17 characters, no I / O / Q</Hint>}
          </div>
          <div className="flex gap-2">
            <Input
              id="vin"
              value={vin}
              onChange={(e) => onVinChange(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={17}
              placeholder="Scan or type 17 characters"
              className={cn("font-mono tracking-wide uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal", vinState === "valid" && "border-success/60")}
              aria-invalid={vinState === "invalid"}
            />
            <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={() => { setScannerMounted(true); setScannerOpen(true); }} aria-label="Scan VIN barcode" title="Scan the VIN barcode on the door jamb or windshield">
              {decoding ? <LoaderCircleIcon className="animate-spin" /> : <ScanLineIcon className="size-5" />} Scan barcode
            </Button>
          </div>
          {!vin && !decodedLabel && <p className="text-caption text-subtle">Point the camera at the barcode on the door jamb or the windshield plate; year, make and model fill in on their own.</p>}
          <AnimatePresence>
            {decodedLabel && (
              <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm text-success">
                <CheckIcon className="size-4" /> Decoded: {decodedLabel}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="year">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="year" aria-label="Year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions().map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="make">Make</Label>
            <Select
              value={MAKES.includes(make as (typeof MAKES)[number]) ? make : "Other"}
              onValueChange={(v) => {
                setMake(v);
                if (v !== "Other") setCustomMake("");
              }}
            >
              <SelectTrigger id="make" aria-label="Make">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAKES.map((mk) => (
                  <SelectItem key={mk} value={mk}>
                    {mk}
                  </SelectItem>
                ))}
                {!MAKES.includes("Other" as (typeof MAKES)[number]) && <SelectItem value="Other">Other</SelectItem>}
              </SelectContent>
            </Select>
            {(make === "Other" || !MAKES.includes(make as (typeof MAKES)[number])) && (
              <Input id="make-other" value={customMake} onChange={(e) => setCustomMake(e.target.value)} placeholder="Type the make, e.g. Porsche" aria-label="Other make" autoCapitalize="words" maxLength={60} autoFocus />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="model">Model</Label>
            <ModelCombobox id="model" value={model} onChange={setModel} options={modelOptions} placeholder="e.g. GLE 450" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="color">Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger id="color" aria-label="Color">
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                {COLORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-label text-subtle">Services</h2>
          <AnimatePresence>
            {services.length > 0 && (
              <m.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setServices([])}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-3" /> Clear
              </m.button>
            )}
          </AnimatePresence>
        </div>
        <ServicePicker priceList={priceList} value={services} onChange={setServices} />
      </section>

      {/* Notes */}
      <section className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scratches noted, customer waiting, etc." className="min-h-20" />
      </section>

      {/* Sticky action bar */}
      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-border/70 bg-background/85 px-4 py-3 backdrop-blur-md md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-2xl items-center gap-3 sm:px-2">
          <div className="min-w-0 flex-1">
            <div className="text-caption text-muted-foreground">{services.length === 0 ? "No services selected" : `${services.length} service${services.length > 1 ? "s" : ""}`}</div>
            <CountUp value={total} format={formatMoney} className="text-stat block" />
          </div>
          {canCharge && (
            <Button type="button" size="lg" variant="secondary" loading={charging} disabled={saving || !online} aria-label="Save & charge" title={online ? "Save this car and open the Terminal to charge its invoice" : "Charge when back online"} onClick={() => onSubmit(undefined, "charge")} className="shrink-0 px-4">
              <CreditCardIcon /> <span className="hidden sm:inline">Save &amp; charge</span>
            </Button>
          )}
          <Button type="submit" size="lg" loading={saving} disabled={charging} className="min-w-32 shrink-0 glow-primary sm:min-w-40">
            Save &amp; next
          </Button>
        </div>
      </div>

      {scannerMounted && <VinScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={onScanned} />}
      <DuplicateDialog
        hits={duplicates}
        onCancel={() => setDuplicates(null)}
        onContinue={async () => {
          setDuplicates(null);
          const busy = intent === "charge" ? setCharging : setSaving;
          busy(true);
          try {
            await save(intent);
          } finally {
            busy(false);
          }
        }}
      />
    </form>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon, ScanLineIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Dealership, JobPayload, PriceListRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/app/session-provider";
import { useSync } from "@/components/offline/sync-provider";
import { enqueueJob, findLocalDuplicates, saveRecentJobs, saveReference } from "@/lib/offline/outbox";
import type { OutboxItem, RecentJob } from "@/lib/offline/db";
import { createJobDirect } from "@/lib/offline/sync";
import { decodeVin } from "@/lib/vin-client";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { COLORS, DEFAULT_MAKE, MAKES, MERCEDES_MODELS, yearOptions } from "@/lib/vehicles";
import { dateInputToIso, nowMs, toDateInput } from "@/lib/dates";
import { formatMoney, sumPrices } from "@/lib/money";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServicePicker, type SelectedService } from "./service-picker";
import { VinScanner } from "./vin-scanner";
import { ModelCombobox } from "./model-combobox";
import { DuplicateDialog, type DuplicateHit } from "./duplicate-dialog";

const LAST_DEALERSHIP_KEY = "cali-tints:last-dealership";

interface Props {
  dealerships: Dealership[];
  priceLists: Record<string, PriceListRow[]>;
  detailers: { id: string; full_name: string }[];
  recentJobs: RecentJob[];
}

/**
 * Quick Job Entry. Optimistic by design: "Save & next" writes to the local
 * outbox and returns immediately; the sync loop pushes it to Supabase.
 */
export function JobForm({ dealerships, priceLists, detailers, recentJobs }: Props) {
  const { company, demo } = useSession();
  const { online } = useSync();
  const tagRef = useRef<HTMLInputElement>(null);

  // --- form state ------------------------------------------------------------
  const [dealershipId, setDealershipId] = useState<string>(() => dealerships[0]?.id ?? "");
  const [tag, setTag] = useState("");
  const [vin, setVin] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [decodedLabel, setDecodedLabel] = useState<string | null>(null);
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>(DEFAULT_MAKE);
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [services, setServices] = useState<SelectedService[]>([]);
  const [performedAt, setPerformedAt] = useState(() => toDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateHit[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

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
      if (r.make) setMake(r.make);
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
        const { data } = await createClient().rpc("find_duplicate_jobs", { p_tag_number: tag.trim(), p_vin: vin || null, p_dealership_id: null });
        remote = (data ?? []).map((d) => ({ ...d, detailer_name: d.detailer_name }));
      } catch {
        /* offline or slow: local check is enough */
      }
    }
    const seen = new Set(remote.map((r) => r.id));
    return [...remote, ...local.filter((l) => !seen.has(l.id))];
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const hits = await checkDuplicates();
      if (hits.length > 0) {
        setDuplicates(hits);
        return;
      }
      await save();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const clientId = crypto.randomUUID();
    const payload: JobPayload = {
      client_id: clientId,
      dealership_id: dealershipId,
      tag_number: tag.trim().toUpperCase(),
      vin: vin || null,
      year: year ? Number(year) : null,
      make: make === "Other" ? null : make || null,
      model: model.trim() || null,
      color: color === "Other" ? null : color || null,
      performed_at: dateInputToIso(performedAt),
      ro_po_number: null,
      notes: notes.trim() || null,
      services: services.map((s) => ({
        service_id: s.service_id,
        price: s.price,
        override_reason: s.override_reason,
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

    if (demo) {
      // Guest preview: nothing is persisted.
      toast.success(`Saved ${payload.tag_number}${payload.model ? ` · ${payload.model}` : ""}`, { description: "Guest preview — not actually saved" });
      setSavedCount((c) => c + 1);
      resetForNext();
      return;
    }

    try {
      await enqueueJob(item); // sync loop picks it up immediately
    } catch {
      // IndexedDB unavailable (rare: private mode). Save straight to the server instead.
      try {
        await createJobDirect(item);
      } catch (err) {
        toast.error(errorMessage(err, "Could not save the job"));
        return;
      }
    }

    toast.success(`Saved ${payload.tag_number}${payload.model ? ` · ${payload.model}` : ""}`, {
      description: online ? undefined : "Queued offline — will sync when signal returns",
    });
    setSavedCount((c) => c + 1);
    resetForNext();
  }

  function resetForNext() {
    setTag("");
    setVin("");
    setDecodedLabel(null);
    setYear("");
    setMake(DEFAULT_MAKE);
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
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-32 sm:px-6">
      {/* Date first so it is never missed */}
      <div className="grid gap-1.5">
        <Label htmlFor="performed">Date</Label>
        <Input id="performed" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
      </div>

      {/* Dealership (the job is logged under the signed-in user) */}
      <div className="grid gap-1.5">
        <Label htmlFor="dealership">Dealership</Label>
        <Select value={dealershipId} onValueChange={changeDealership}>
          <SelectTrigger id="dealership">
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

      {/* Tag */}
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
          className="h-16 text-2xl font-semibold tracking-wider"
          required
        />
      </div>

      {/* VIN */}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="vin">VIN (optional)</Label>
          {vinState === "warn" && <span className="text-xs text-warning">Check digit does not match — double-check</span>}
          {vinState === "invalid" && <span className="text-xs text-destructive">17 characters, no I / O / Q</span>}
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
          <Button type="button" variant="secondary" size="icon" className="h-12 w-14 shrink-0" onClick={() => setScannerOpen(true)} aria-label="Scan VIN barcode">
            {decoding ? <LoaderCircleIcon className="animate-spin" /> : <ScanLineIcon className="size-5" />}
          </Button>
        </div>
        {decodedLabel && (
          <div className="flex items-center gap-1.5 text-sm text-success">
            <CheckIcon className="size-4" /> Decoded: {decodedLabel}
          </div>
        )}
      </div>

      {/* Vehicle */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="year">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="year">
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
          <Select value={MAKES.includes(make as (typeof MAKES)[number]) ? make : "Other"} onValueChange={(v) => setMake(v)}>
            <SelectTrigger id="make">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAKES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
              {!MAKES.includes(make as (typeof MAKES)[number]) && make && <SelectItem value={make}>{make}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="model">Model</Label>
          <ModelCombobox id="model" value={model} onChange={setModel} options={modelOptions} placeholder="e.g. GLE 450" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="color">Color</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger id="color">
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

      {/* Services */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Services</Label>
          {services.length > 0 && (
            <button type="button" onClick={() => setServices([])} className="flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> clear
            </button>
          )}
        </div>
        <ServicePicker priceList={priceList} value={services} onChange={setServices} />
      </div>

      {/* Notes */}
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scratches noted, customer waiting, etc." className="min-h-20" />
      </div>

      {/* Sticky action bar */}
      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-2xl items-center gap-3 sm:px-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">
              {services.length === 0 ? "No services" : `${services.length} service${services.length > 1 ? "s" : ""}`}
              {savedCount > 0 && <span className="ml-2 text-success">· {savedCount} logged this session</span>}
            </div>
            <div className="text-xl font-semibold tabular-nums">{formatMoney(total)}</div>
          </div>
          <Button type="submit" size="lg" disabled={saving} className="min-w-40">
            {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
            Save &amp; next
          </Button>
        </div>
      </div>

      <VinScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={onScanned} />
      <DuplicateDialog
        hits={duplicates}
        onCancel={() => setDuplicates(null)}
        onContinue={async () => {
          setDuplicates(null);
          setSaving(true);
          try {
            await save();
          } finally {
            setSaving(false);
          }
        }}
      />
    </form>
  );
}

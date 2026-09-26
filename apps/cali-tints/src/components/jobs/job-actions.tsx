"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { PriceListRow } from "@/lib/db/types";
import { restoreJobAction, softDeleteJobAction, updateJobAction } from "@/app/(app)/jobs/actions";
import { dateInputToIso, toDateInput } from "@/lib/dates";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { COLORS, DEFAULT_MAKE, MAKES, MERCEDES_MODELS, yearOptions } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServicePicker, type SelectedService } from "./service-picker";
import { ModelCombobox } from "./model-combobox";

export interface EditableJob {
  id: string;
  dealership_id: string;
  detailer_id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  notes: string | null;
  deleted_at: string | null;
  per_job: boolean;
  services: { service_id: string; name: string; price: number; override_reason: string | null }[];
}

export function JobActions({
  job,
  priceList,
  detailers,
  canEdit,
  isAdmin,
  locked,
}: {
  job: EditableJob;
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <PencilIcon /> Edit
        </Button>
      )}
      {locked && (
        <Button variant="outline" disabled>
          <LockIcon /> Locked by invoice
        </Button>
      )}
      {isAdmin && !job.deleted_at && !locked && (
        <Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon /> Delete
        </Button>
      )}
      {isAdmin && job.deleted_at && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await restoreJobAction(job.id);
              if (r.ok) {
                toast.success("Job restored");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <RotateCcwIcon /> Restore
        </Button>
      )}

      {editOpen && <EditSheet job={job} priceList={priceList} detailers={detailers} isAdmin={isAdmin} onClose={() => setEditOpen(false)} />}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteDialog
          onConfirm={(reason) =>
            start(async () => {
              const r = await softDeleteJobAction(job.id, reason);
              if (r.ok) {
                toast.success("Job deleted (kept for audit)");
                setDeleteOpen(false);
                router.refresh();
              } else toast.error(r.error);
            })
          }
          pending={pending}
        />
      </Dialog>
    </div>
  );
}

function DeleteDialog({ onConfirm, pending }: { onConfirm: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete this job?</DialogTitle>
        <DialogDescription>It is hidden from lists and invoicing but kept in the audit trail. You can restore it later.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="delete-reason">Reason (optional)</Label>
        <Input id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Duplicate entry, wrong dealership…" />
      </div>
      <DialogFooter>
        <Button variant="destructive" disabled={pending} onClick={() => onConfirm(reason)}>
          Delete job
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditSheet({
  job,
  priceList,
  detailers,
  isAdmin,
  onClose,
}: {
  job: EditableJob;
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const listRow = (id: string) => priceList.find((p) => p.service_id === id);
  const listPrice = (id: string) => Number(listRow(id)?.price ?? 0);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

  const [tag, setTag] = useState(job.tag_number);
  const [vin, setVin] = useState(job.vin ?? "");
  const [year, setYear] = useState(job.year ? String(job.year) : "");
  const [make, setMake] = useState(job.make ?? DEFAULT_MAKE);
  const [model, setModel] = useState(job.model ?? "");
  const [color, setColor] = useState(job.color ?? "");
  const [performedAt, setPerformedAt] = useState(toDateInput(new Date(job.performed_at)));
  const [notes, setNotes] = useState(job.notes ?? "");
  const [detailerId, setDetailerId] = useState(job.detailer_id);
  const [services, setServices] = useState<SelectedService[]>(
    job.services.map((s) => ({
      service_id: s.service_id,
      name: s.name,
      list_price: listPrice(s.service_id),
      price_min: num(listRow(s.service_id)?.price_min),
      price_max: num(listRow(s.service_id)?.price_max),
      price: s.price,
      override_reason: s.override_reason,
    })),
  );

  function submit() {
    if (!tag.trim()) return toast.error("Tag number is required");
    if (vin && vinStatus(vin) === "invalid") return toast.error("VIN must be 17 characters");
    if (services.length === 0) return toast.error("Select at least one service");
    start(async () => {
      const r = await updateJobAction({
        id: job.id,
        detailer_id: isAdmin ? detailerId : undefined,
        tag_number: tag.trim().toUpperCase(),
        vin: vin ? normalizeVin(vin) : null,
        year: year ? Number(year) : null,
        make: make || null,
        model: model.trim() || null,
        color: color || null,
        // Unchanged date keeps the original timestamp; a new date is stored per dateInputToIso.
        performed_at: performedAt === toDateInput(new Date(job.performed_at)) ? job.performed_at : dateInputToIso(performedAt),
        ro_po_number: job.ro_po_number ?? null,
        notes: notes.trim() || null,
        services: services.map((s) => ({ service_id: s.service_id, price: s.price, override_reason: s.override_reason })),
      });
      if (r.ok) {
        toast.success("Job updated");
        onClose();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const modelOptions = make.startsWith("Mercedes") ? MERCEDES_MODELS : [];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Edit job {job.tag_number}</SheetTitle>
          <SheetDescription>Changes are recorded in the job history.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="e-tag">Tag</Label>
              <Input id="e-tag" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} autoCapitalize="characters" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-vin">VIN</Label>
              <Input id="e-vin" value={vin} onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))} className="font-mono" maxLength={17} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="e-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions(25).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-make">Make</Label>
              <Select value={make} onValueChange={setMake}>
                <SelectTrigger id="e-make">
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
              <Label htmlFor="e-model">Model</Label>
              <ModelCombobox id="e-model" value={model} onChange={setModel} options={modelOptions} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-color">Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger id="e-color">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  {!COLORS.includes(color as (typeof COLORS)[number]) && color && <SelectItem value={color}>{color}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
            </div>
            {isAdmin && detailers.length > 1 && (
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="e-detailer">Detailer</Label>
                <Select value={detailerId} onValueChange={setDetailerId}>
                  <SelectTrigger id="e-detailer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {detailers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Services</Label>
            <ServicePicker priceList={priceList} value={services} onChange={setServices} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea id="e-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={pending} onClick={submit}>
            Save changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

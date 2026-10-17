"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, ClipboardCheckIcon, FlagIcon, MinusIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { InspectionItem, InspectionState, InspectionTemplate, VisitInspection } from "@/lib/db/types";
import { addInspectionAction, addInspectionItemAction, deleteInspectionAction, deleteInspectionItemAction, inspectionItemToFindingAction, setInspectionCustomerAction, setInspectionItemAction } from "@/app/(app)/retail/inspection-actions";
import { useSession } from "@/components/app/session-provider";
import { groupInspectionItems, INSPECTION_STATE_LABEL, inspectionProgress, nextInspectionState } from "@/lib/retail/inspection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const BOX: Record<InspectionState, string> = {
  pending: "border-border bg-card text-transparent",
  ok: "border-success bg-success text-white",
  attention: "border-destructive bg-destructive text-white",
  na: "border-border bg-muted text-muted-foreground",
};

/**
 * The checklists on a visit (0073): tap a row to cycle grey → green → red → not applicable.
 * A tech ticks them on the phone or the Flex; a red row can become a finding. Internal
 * unless the advisor turns on "Show the customer".
 */
export function InspectionCard({ estimateId, inspections: initial, templates, canShare, canWrite = true }: { estimateId: string; inspections: VisitInspection[]; templates: InspectionTemplate[]; canShare: boolean; canWrite?: boolean }) {
  const router = useRouter();
  const { demo } = useSession();
  const [list, setList] = useState(initial);
  const [pending, start] = useTransition();

  const replace = (i: VisitInspection) => setList((l) => l.map((x) => (x.id === i.id ? i : x)));

  function add(template: InspectionTemplate | null) {
    start(async () => {
      if (demo) {
        const items = (template?.items ?? []).map((it) => ({ id: `demo-${crypto.randomUUID()}`, label: it.label, group: it.group ?? null, state: "pending" as const, note: null, finding_id: null, checked_at: null, checked_by: null }));
        setList((l) => [...l, { id: `demo-${crypto.randomUUID()}`, name: template?.name ?? "Inspection", estimate_job_id: null, job_title: null, show_customer: false, items }]);
        return void toast.success("Added", { description: "Guest preview — nothing saved" });
      }
      const r = await addInspectionAction(estimateId, { template: template?.id ?? null, name: template ? null : "Inspection" });
      if (!r.ok) return void toast.error(r.error);
      setList((l) => [...l, r.data]);
    });
  }

  function setState(i: VisitInspection, it: InspectionItem, state: InspectionState, note?: string | null) {
    // optimistic: the box moves at once, the server answer replaces the checklist
    replace({ ...i, items: i.items.map((x) => (x.id === it.id ? { ...x, state, note: note === undefined ? x.note : note } : x)) });
    if (demo) return;
    start(async () => {
      const r = await setInspectionItemAction(estimateId, it.id, state, note);
      if (!r.ok) {
        replace(i);
        return void toast.error(r.error);
      }
      replace(r.data);
    });
  }

  function addItem(i: VisitInspection, label: string) {
    if (demo) {
      replace({ ...i, items: [...i.items, { id: `demo-${crypto.randomUUID()}`, label, group: null, state: "pending", note: null, finding_id: null, checked_at: null, checked_by: null }] });
      return;
    }
    start(async () => {
      const r = await addInspectionItemAction(estimateId, i.id, label);
      if (!r.ok) return void toast.error(r.error);
      replace(r.data);
    });
  }

  function removeItem(i: VisitInspection, it: InspectionItem) {
    if (demo) return replace({ ...i, items: i.items.filter((x) => x.id !== it.id) });
    start(async () => {
      const r = await deleteInspectionItemAction(estimateId, it.id);
      if (!r.ok) return void toast.error(r.error);
      replace(r.data);
    });
  }

  function remove(i: VisitInspection) {
    start(async () => {
      if (!demo) {
        const r = await deleteInspectionAction(estimateId, i.id);
        if (!r.ok) return void toast.error(r.error);
      }
      setList((l) => l.filter((x) => x.id !== i.id));
    });
  }

  function share(i: VisitInspection, show: boolean) {
    replace({ ...i, show_customer: show });
    if (demo) return;
    start(async () => {
      const r = await setInspectionCustomerAction(estimateId, i.id, show);
      if (!r.ok) {
        replace(i);
        return void toast.error(r.error);
      }
    });
  }

  function toFinding(i: VisitInspection, it: InspectionItem) {
    if (demo) return void toast.success("Made a finding", { description: "Guest preview — nothing saved" });
    start(async () => {
      const r = await inspectionItemToFindingAction(estimateId, it.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Added to the findings");
      router.refresh();
    });
  }

  return (
    <Card data-testid="inspections">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><ClipboardCheckIcon className="size-4 text-muted-foreground" /> Inspections</CardTitle>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending} data-testid="inspection-add">
                <PlusIcon /> Inspection <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {templates.filter((t) => t.active).map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => add(t)} data-testid="inspection-template-pick">
                  {t.name}
                </DropdownMenuItem>
              ))}
              {templates.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => add(null)} data-testid="inspection-blank">
                Blank list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No checklist on this car yet. Add the check-in or a pre-purchase list and tick it as you go.</p>}
        {list.map((i) => (
          <Checklist key={i.id} i={i} canShare={canShare} canWrite={canWrite} onState={(it, s, n) => setState(i, it, s, n)} onAdd={(l) => addItem(i, l)} onRemoveItem={(it) => removeItem(i, it)} onRemove={() => remove(i)} onShare={(v) => share(i, v)} onFinding={(it) => toFinding(i, it)} />
        ))}
      </CardContent>
    </Card>
  );
}

function Checklist({ i, canShare, canWrite, onState, onAdd, onRemoveItem, onRemove, onShare, onFinding }: { i: VisitInspection; canShare: boolean; canWrite: boolean; onState: (it: InspectionItem, s: InspectionState, note?: string | null) => void; onAdd: (label: string) => void; onRemoveItem: (it: InspectionItem) => void; onRemove: () => void; onShare: (show: boolean) => void; onFinding: (it: InspectionItem) => void }) {
  const [label, setLabel] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const p = inspectionProgress(i.items);
  return (
    <section data-testid="inspection" aria-label={i.name} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">{i.name}</h3>
          <p className="text-caption text-subtle" data-testid="inspection-progress">{p.label}{i.job_title ? ` · ${i.job_title}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          {canShare && (
            <label className="flex items-center gap-2 text-caption text-muted-foreground">
              <Switch checked={i.show_customer} onCheckedChange={onShare} aria-label={`Show ${i.name} to the customer`} data-testid="inspection-share" />
              Show the customer
            </label>
          )}
          {canShare && (
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.name}`} onClick={onRemove} data-testid="inspection-remove">
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>
      {!i.show_customer && <Badge variant="muted" className="w-fit">Internal: not visible to the customer</Badge>}
      <div className="divide-y divide-border rounded-xl border border-border">
        {groupInspectionItems(i.items).map((g, gi) => (
          <div key={gi}>
            {g.group && <div className="bg-muted/40 px-3 py-1.5 text-caption font-medium uppercase tracking-wide text-subtle">{g.group}</div>}
            <ul className="divide-y divide-border">
              {g.items.map((it) => (
                <li key={it.id} className={cn("px-3 py-2", it.state === "attention" && "bg-destructive/5")} data-testid="inspection-item" data-state={it.state}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!canWrite}
                      aria-label={`${it.label}: ${INSPECTION_STATE_LABEL[it.state]}. Tap to change`}
                      onClick={() => onState(it, nextInspectionState(it.state))}
                      className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", BOX[it.state])}
                      data-testid="inspection-box"
                    >
                      {it.state === "ok" && <CheckIcon className="size-4" />}
                      {it.state === "attention" && <XIcon className="size-4" />}
                      {it.state === "na" && <MinusIcon className="size-4" />}
                    </button>
                    <button type="button" className={cn("min-w-0 flex-1 text-left text-sm", it.state === "na" && "text-muted-foreground line-through", it.state === "attention" && "font-medium")} onClick={() => setOpen(open === it.id ? null : it.id)}>
                      {it.label}
                      {it.note && <span className="ml-2 text-caption font-normal text-subtle">{it.note}</span>}
                    </button>
                    {it.checked_by && <span className="shrink-0 text-caption text-subtle" title={it.checked_at ?? undefined}>{it.checked_by}</span>}
                  </div>
                  {open === it.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
                      <NoteField value={it.note ?? ""} disabled={!canWrite} onSave={(n) => onState(it, it.state, n)} />
                      {canWrite && it.state === "attention" && !it.finding_id && (
                        <Button size="sm" variant="outline" onClick={() => onFinding(it)} data-testid="inspection-finding">
                          <FlagIcon /> Make a finding
                        </Button>
                      )}
                      {it.finding_id && <Badge variant="info">Finding added</Badge>}
                      {canWrite && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${it.label}`} onClick={() => onRemoveItem(it)}>
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {i.items.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No items yet.</p>}
      </div>
      {canWrite && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            onAdd(label.trim());
            setLabel("");
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Inspection item name" maxLength={120} aria-label="New inspection item" data-testid="inspection-new-item" />
          <Button type="submit" size="icon" variant="outline" aria-label="Add the item" disabled={!label.trim()}>
            <PlusIcon />
          </Button>
        </form>
      )}
    </section>
  );
}

function NoteField({ value, onSave, disabled }: { value: string; onSave: (note: string) => void; disabled: boolean }) {
  const [v, setV] = useState(value);
  return <Input value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} placeholder="Note (what you saw)" maxLength={500} className="h-8 min-w-48 flex-1" aria-label="Note" />;
}

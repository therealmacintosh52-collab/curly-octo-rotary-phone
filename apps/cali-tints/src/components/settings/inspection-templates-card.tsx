"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { InspectionTemplate } from "@/lib/db/types";
import { deleteInspectionTemplateAction, saveInspectionTemplateAction } from "@/app/(app)/settings/retail-actions";
import { useSession } from "@/components/app/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** "Brakes: Front pads" → {group, label}; a line without a colon is just an item. */
export function parseTemplateItems(text: string): { label: string; group?: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      if (i > 0 && i < 60 && l.slice(i + 1).trim()) return { group: l.slice(0, i).trim(), label: l.slice(i + 1).trim() };
      return { label: l };
    });
}
export const templateItemsText = (items: InspectionTemplate["items"]) => items.map((i) => (i.group ? `${i.group}: ${i.label}` : i.label)).join("\n");

/** Settings → Shop menu: the reusable inspection checklists (Check-in, Pre-purchase, Multi-point…). */
export function InspectionTemplatesCard({ templates }: { templates: InspectionTemplate[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<InspectionTemplate | "new" | null>(null);

  function remove(t: InspectionTemplate) {
    start(async () => {
      if (demo) return void toast.success("Removed", { description: "Guest preview — nothing changed" });
      const r = await deleteInspectionTemplateAction(t.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <Card data-testid="inspection-templates">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Inspection lists</CardTitle>
          <CardDescription>Checklists a tech ticks on a car (check-in, pre-purchase, multi-point). Add one to an estimate from its Inspections section; the items are copied, so changing a list here never changes a car already checked.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")} data-testid="inspection-template-add">
          <PlusIcon /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id} className={cn("flex items-center justify-between gap-3 py-2.5", !t.active && "opacity-60")} data-testid="inspection-template-row">
              <div className="min-w-0">
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">{t.items.length} items</span>
                {!t.active && <Badge variant="muted" className="ml-2">Off</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}>
                  <PencilIcon />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${t.name}`} disabled={pending} onClick={() => remove(t)}>
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
          {templates.length === 0 && <li className="py-3 text-sm text-muted-foreground">No lists yet. Add one to reuse it on every car.</li>}
        </ul>
      </CardContent>
      {editing && <TemplateDialog template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TemplateDialog({ template, onClose }: { template: InspectionTemplate | null; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [text, setText] = useState(template ? templateItemsText(template.items) : "");
  const [active, setActive] = useState(template?.active ?? true);

  function save() {
    const items = parseTemplateItems(text);
    start(async () => {
      if (demo) {
        toast.success("Saved", { description: "Guest preview — nothing changed" });
        return onClose();
      }
      const r = await saveInspectionTemplateAction({ id: template?.id, name, items, active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? "Edit the list" : "New inspection list"}</DialogTitle>
          <DialogDescription>One item per line. Put a heading before a colon to group items (Brakes: Front pads).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Pre-purchase inspection" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-items">Items</Label>
            <Textarea id="tpl-items" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={"Tire condition\nBrakes: Front pads\nBrakes: Rotors"} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="tpl-active">On (offered when adding an inspection)</Label>
            <Switch id="tpl-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} loading={pending} disabled={!name.trim()} data-testid="inspection-template-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

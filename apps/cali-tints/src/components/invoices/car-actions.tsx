"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { PriceListRow } from "@/lib/db/types";
import { deleteInvoiceCarAction, editInvoiceCarAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { EditCarSheet, type EditableCar } from "@/components/jobs/edit-car-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The car on a one-car invoice: fix it while the invoice is still a draft
 * with nothing paid, or remove it (void + soft delete). Once sent or paid,
 * the car is locked and the invoice is the record.
 */
export function CarActions({
  invoiceId,
  car,
  priceList,
  detailers,
  canEdit,
  canDelete,
  lockedReason,
}: {
  invoiceId: string;
  car: EditableCar;
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  /** Why the car cannot be changed, when it cannot. */
  lockedReason: string | null;
}) {
  const router = useRouter();
  const { demo, isAdmin } = useSession();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!canEdit && !canDelete && !lockedReason) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <PencilIcon /> Edit invoice
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon /> Delete invoice
        </Button>
      )}
      {!canEdit && lockedReason && (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" title={lockedReason}>
          <LockIcon className="size-4" /> {lockedReason}
        </span>
      )}

      {editOpen && (
        <EditCarSheet
          car={car}
          priceList={priceList}
          detailers={detailers}
          isAdmin={isAdmin}
          save={async (input) => {
            if (demo) return { ok: true, data: undefined };
            return editInvoiceCarAction({ ...input, invoice_id: invoiceId });
          }}
          onClose={() => setEditOpen(false)}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteCarDialog
          tag={car.tag_number}
          pending={pending}
          onConfirm={(reason) =>
            start(async () => {
              if (demo) {
                toast.success("Invoice deleted", { description: "Guest preview — nothing changed" });
                setDeleteOpen(false);
                return;
              }
              const r = await deleteInvoiceCarAction(invoiceId, reason);
              if (r.ok) {
                toast.success("Invoice deleted");
                setDeleteOpen(false);
                router.push("/invoices");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        />
      </Dialog>
    </div>
  );
}

function DeleteCarDialog({ tag, onConfirm, pending }: { tag: string; onConfirm: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete the invoice for {tag}?</DialogTitle>
        <DialogDescription>The invoice is voided (its number stays in the audit trail) and the car comes off the lists. Nothing is billed for it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="delete-reason">Reason (optional)</Label>
        <Input id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Logged twice, wrong dealership…" />
      </div>
      <DialogFooter>
        <Button variant="destructive" disabled={pending} onClick={() => onConfirm(reason)}>
          Delete invoice
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

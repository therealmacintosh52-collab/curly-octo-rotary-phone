"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { invoiceNowAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Close one dealership's month early: every open job through today goes on one invoice now. */
export function InvoiceNowButton({ dealershipId, dealership, cars }: { dealershipId: string; dealership: string; cars: number }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={cars === 0}>
        <FileCheckIcon /> Invoice now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice {dealership} now?</DialogTitle>
            <DialogDescription>
              The {cars} {cars === 1 ? "job" : "jobs"} logged so far this month go on one invoice today. Jobs logged after this get a second invoice for the rest of the month on the 1st. Normally you do not need this: the month closes on its own.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  if (demo) {
                    toast.success(`Invoiced ${dealership}`, { description: "Guest preview — nothing changed" });
                    setOpen(false);
                    return;
                  }
                  const r = await invoiceNowAction(dealershipId);
                  if (r.ok) {
                    toast.success("Invoice made");
                    setOpen(false);
                    router.push(`/invoices/${r.data}`);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Make the invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";
import { restoreInvoiceCarAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";

/** Bring a deleted invoice back from the archive as an unsent draft, same number, same car. */
export function RestoreInvoiceButton({ invoiceId, number, size = "sm", className }: { invoiceId: string; number: string; size?: "sm" | "default"; className?: string }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      variant="outline"
      className={className}
      loading={pending}
      onClick={() =>
        start(async () => {
          if (demo) {
            toast.success(`${number} restored`, { description: "Guest preview — nothing changed" });
            return;
          }
          const r = await restoreInvoiceCarAction(invoiceId);
          if (r.ok) {
            toast.success(`${number} restored · back as an unsent draft`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {!pending && <ArchiveRestoreIcon />} Restore
    </Button>
  );
}

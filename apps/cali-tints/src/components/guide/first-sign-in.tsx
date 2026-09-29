"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenIcon } from "lucide-react";
import { dismissGuideAction } from "@/app/(app)/guide/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Shown once, the first time a person signs in: offers the guide for their
 * role. Reading it or skipping it marks the profile so it never shows again.
 */
export function FirstSignIn({ seen }: { seen: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useSession();
  const [open, setOpen] = useState(!seen && pathname !== "/guide");
  if (seen) return null;
  const first = profile.full_name.trim().split(/\s+/)[0] || "there";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="first-sign-in">
        <DialogHeader>
          <DialogTitle>Welcome, {first}</DialogTitle>
          <DialogDescription>A five-minute guide shows every screen you will use, what to type or tap, and what happens next. You can reopen it any time from the ? in the top bar.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              void dismissGuideAction();
            }}
          >
            Skip for now
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              router.push("/guide?welcome=1");
            }}
          >
            <BookOpenIcon /> Show me how it works
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

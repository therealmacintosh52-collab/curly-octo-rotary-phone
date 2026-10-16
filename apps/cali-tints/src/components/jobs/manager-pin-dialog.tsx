"use client";

import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { KeyRoundIcon } from "lucide-react";
import { verifyManagerPinAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The guest demo accepts this PIN so the screen can be tried without a database. */
export const DEMO_MANAGER_PIN = "1234";

/**
 * A detailer who edits or deletes a job needs a manager to type their own PIN on the detailer's phone.
 * `ask()` opens the dialog and resolves with a one-time approval id (or null when it is cancelled);
 * owner, admin and manager need no PIN and `ask()` resolves with an empty string at once.
 */
export function useManagerPin(): { ask: (what: string) => Promise<string | null>; dialog: ReactNode } {
  const { isAdmin, demo } = useSession();
  const [what, setWhat] = useState<string | null>(null);
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const ask = useCallback(
    (label: string) => {
      if (isAdmin) return Promise.resolve("");
      return new Promise<string | null>((resolve) => {
        resolver.current = resolve;
        setWhat(label);
      });
    },
    [isAdmin],
  );
  const finish = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setWhat(null);
  };
  const dialog = what !== null ? <ManagerPinDialog what={what} demo={!!demo} onDone={finish} /> : null;
  return { ask, dialog };
}

function ManagerPinDialog({ what, demo, onDone }: { what: string; demo: boolean; onDone: (grant: string | null) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (!/^[0-9]{4,6}$/.test(pin)) return setError("The PIN is 4 to 6 digits");
    start(async () => {
      if (demo) {
        if (pin === DEMO_MANAGER_PIN) return onDone("00000000-0000-4000-8000-000000000000");
        return setError("That PIN is not right (in the guest preview the PIN is 1234)");
      }
      const r = await verifyManagerPinAction(pin);
      if (r.ok) return onDone(r.grant);
      setError(r.message);
      setPin("");
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onDone(null)}>
      <DialogContent className="max-w-sm" data-testid="manager-pin-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRoundIcon className="size-5 text-primary" /> A manager must approve</DialogTitle>
          <DialogDescription>{what}. Hand the phone to a manager: they type their own PIN.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="manager-pin">Manager PIN</Label>
          <Input
            id="manager-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="text-center text-xl tracking-[0.4em]"
            placeholder="••••"
            autoFocus
            data-testid="manager-pin-input"
          />
          {error && <p className="text-sm text-destructive" role="alert" data-testid="manager-pin-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
          <Button onClick={submit} loading={pending} disabled={pin.length < 4} data-testid="manager-pin-ok">Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

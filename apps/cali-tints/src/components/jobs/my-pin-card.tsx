"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { setMyPinAction } from "@/app/(app)/pin/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Set or change the PIN that approves a detailer's edit or delete. Only the hash is stored; nobody can read the PIN back. */
export function MyPinCard({ canHavePin, hasPin, setAt }: { canHavePin: boolean; hasPin: boolean; setAt: string | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [pending, start] = useTransition();
  const [savedNow, setSavedNow] = useState(false);

  if (!canHavePin) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">Only managers, admins and the owner have an approval PIN. Ask a manager when you need a job changed.</CardContent>
      </Card>
    );
  }

  function save() {
    if (!/^[0-9]{4,6}$/.test(pin)) return void toast.error("The PIN is 4 to 6 digits");
    if (pin !== again) return void toast.error("The two PINs do not match");
    start(async () => {
      if (demo) {
        toast.success("PIN saved", { description: "Guest preview: nothing was saved. In the preview the PIN that works is 1234." });
        setSavedNow(true);
        return;
      }
      const r = await setMyPinAction(pin);
      if (!r.ok) return void toast.error(r.error);
      toast.success("PIN saved");
      setPin("");
      setAgain("");
      setSavedNow(true);
      router.refresh();
    });
  }

  const has = hasPin || savedNow;
  return (
    <Card data-testid="my-pin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRoundIcon className="size-4 text-primary" /> {has ? "Change your PIN" : "Set your PIN"}</CardTitle>
        <CardDescription>
          4 to 6 digits. Keep it to yourself: a detailer who wants to edit or delete a job hands you the phone and you type it. It is stored scrambled, so not even the owner can read it; the owner can only reset it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {has && (
          <p className="flex items-center gap-1.5 text-sm text-success" data-testid="pin-status">
            <CheckCircle2Icon className="size-4" /> PIN is set{setAt && !savedNow ? ` · ${formatDateTime(setAt)}` : ""}
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="new-pin">New PIN</Label>
          <Input id="new-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} data-testid="pin-new" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="again-pin">Type it again</Label>
          <Input id="again-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={again} onChange={(e) => setAgain(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} data-testid="pin-again" />
        </div>
        <Button onClick={save} loading={pending} disabled={pin.length < 4} className="justify-self-start" data-testid="pin-save">Save PIN</Button>
      </CardContent>
    </Card>
  );
}

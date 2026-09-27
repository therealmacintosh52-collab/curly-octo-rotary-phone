"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters.");
        if (password !== confirm) return setError("Passwords do not match.");
        setError(null);
        start(async () => {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setError("This link has expired. Ask the owner to send a new invite.");
            return;
          }
          const { error } = await supabase.auth.updateUser({ password });
          if (error) return setError(error.message);
          router.replace("/");
          router.refresh();
        });
      }}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 surface-gradient"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="pw">New password</Label>
        <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw2">Confirm</Label>
        <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircleIcon className="animate-spin" />} Save and continue
      </Button>
    </form>
  );
}

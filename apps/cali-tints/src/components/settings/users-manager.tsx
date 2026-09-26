"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRoundIcon, LoaderCircleIcon, PencilIcon, PlusIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { Profile, UserRole } from "@/lib/db/types";
import { createUserAction, resetUserPasswordAction, updateUserAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ROLE_LABEL: Record<UserRole, string> = { owner: "Owner", admin: "Admin", detailer: "Detailer" };

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function UsersManager({ users, currentUserId, currentRole, emailConfigured }: { users: Profile[]; currentUserId: string; currentRole: UserRole; emailConfigured: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [resetting, setResetting] = useState<Profile | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {!emailConfigured && (
        <Alert variant="warning">
          <AlertDescription>SUPABASE_SERVICE_ROLE_KEY is not set on the server, so creating users and resetting passwords will fail. See the README.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <PlusIcon /> Add user
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {users.map((u) => (
          <Card key={u.id} className={!u.active ? "opacity-60" : undefined}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent">
                  <UserIcon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.full_name || u.email}</span>
                    <Badge variant={u.role === "detailer" ? "outline" : "info"}>{ROLE_LABEL[u.role]}</Badge>
                    {!u.active && <Badge variant="muted">Inactive</Badge>}
                    {u.id === currentUserId && <Badge variant="muted">You</Badge>}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Reset password" onClick={() => setResetting(u)}>
                  <KeyRoundIcon />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(u)}>
                  <PencilIcon />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <EditUserDialog user={editing} currentRole={currentRole} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      </Dialog>
    </div>
  );
}

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "detailer">("detailer");
  const [password, setPassword] = useState(() => randomPassword());
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  if (created) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account created</DialogTitle>
          <DialogDescription>Share these with the detailer now. The password is not shown again, but you can reset it any time.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {created.email}
          </div>
          <div>
            <span className="text-muted-foreground">Password: </span>
            {created.password}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(`Cali Tints login\nEmail: ${created.email}\nPassword: ${created.password}\n${location.origin}/login`);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createUserAction({ email, full_name: name, role, mode, password: mode === "password" ? password : undefined });
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            router.refresh();
            if (mode === "password") setCreated({ email, password });
            else {
              toast.success(`Invite sent to ${email}`);
              onClose();
            }
          });
        }}
        className="grid gap-4"
      >
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Detailers can log and view their own jobs only. Admins can do everything except transfer ownership.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "password" | "invite")}>
          <TabsList className="w-full">
            <TabsTrigger value="password">Set a password</TabsTrigger>
            <TabsTrigger value="invite">Email an invite</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-1.5">
          <Label htmlFor="u-name">Full name</Label>
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="u-email">Email (used to sign in)</Label>
          <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoCapitalize="none" />
        </div>
        <div className="grid gap-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "detailer")}>
            <SelectTrigger aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detailer">Detailer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "password" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="u-pass">Temporary password</Label>
            <div className="flex gap-2">
              <Input id="u-pass" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="font-mono" />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                New
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Best for detailers without email access on the lot.</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Supabase emails a link; they pick their own password. Requires the Supabase invite template to be enabled.</p>
        )}
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />} {mode === "password" ? "Create account" : "Send invite"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditUserDialog({ user, currentRole, isSelf, onClose }: { user: Profile; currentRole: UserRole; isSelf: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [active, setActive] = useState(user.active);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
        <DialogDescription>Deactivating keeps their history but blocks sign-in.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="e-name">Full name</Label>
          <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isSelf}>
            <SelectTrigger aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detailer">Detailer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {currentRole === "owner" && <SelectItem value="owner">Owner</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="text-sm font-medium">Active</div>
          <Switch checked={active} onCheckedChange={setActive} disabled={isSelf} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateUserAction({ id: user.id, full_name: name, role, active });
              if (r.ok) {
                toast.success("User updated");
                onClose();
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState(() => randomPassword());
  const [done, setDone] = useState(false);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reset password for {user.full_name || user.email}</DialogTitle>
        <DialogDescription>{done ? "Share the new password now; it is not shown again." : "Sets a new password immediately. Their current sessions stay signed in until they sign out."}</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="font-mono" readOnly={done} />
        {!done && (
          <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
            New
          </Button>
        )}
      </div>
      <DialogFooter>
        {done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button
            disabled={pending || password.length < 8}
            onClick={() =>
              start(async () => {
                const r = await resetUserPasswordAction(user.id, password);
                if (r.ok) setDone(true);
                else toast.error(r.error);
              })
            }
          >
            {pending && <LoaderCircleIcon className="animate-spin" />} Set password
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

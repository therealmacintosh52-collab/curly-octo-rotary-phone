import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };

/** Landing page for invite links: the session exists (from /auth/callback); the user picks a password. */
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={72} />
          <h1 className="text-xl font-semibold">Set your password</h1>
          <p className="text-sm text-muted-foreground">You&apos;ll use this to sign in on the lot.</p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/app/sign-out-button";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo size={72} />
      <div>
        <h1 className="text-xl font-semibold">This account is not active</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your login works, but it is not attached to an active profile. Ask the owner to activate your account in Settings → Users.
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}

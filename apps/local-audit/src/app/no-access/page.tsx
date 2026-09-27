import { SignOutButton } from "@/components/app/sign-out-button";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">This account cannot open the admin area</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your login works, but it is not an active admin profile. Client reports are opened from the private link you were sent.
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}

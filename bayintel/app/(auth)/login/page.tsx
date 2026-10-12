import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}

import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}

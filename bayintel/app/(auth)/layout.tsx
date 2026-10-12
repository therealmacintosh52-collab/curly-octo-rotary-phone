import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="inline-block size-7 rounded-md bg-primary" aria-hidden /> {APP_NAME}
      </Link>
      {children}
    </main>
  );
}

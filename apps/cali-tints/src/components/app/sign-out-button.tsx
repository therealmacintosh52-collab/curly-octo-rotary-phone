"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      className={cn(className)}
      disabled={pending}
      onClick={() =>
        start(async () => {
          // Supabase SDK loads on click, not with the shell.
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut();
          router.replace("/login");
          router.refresh();
        })
      }
    >
      <LogOutIcon />
      Sign out
    </Button>
  );
}

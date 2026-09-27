import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
  isAdmin: boolean;
}

/**
 * Current user + profile, memoised per request. Redirects to /login when
 * signed out and to /no-access when the account has no active profile.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) redirect("/no-access");

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    isAdmin: profile.role === "admin",
  };
});

/** Like getSession() but only admins get through; everyone else lands on /no-access. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session.isAdmin) redirect("/no-access");
  return session;
}

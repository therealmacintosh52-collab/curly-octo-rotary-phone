import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Company, Profile } from "@/lib/db/types";

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
  company: Company;
  isAdmin: boolean;
}

/**
 * Current user + profile + company, memoised per request. Redirects to
 * /login when signed out and to /no-access when the account is deactivated.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) redirect("/no-access");

  const { data: company } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
  if (!company) redirect("/no-access");

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    company,
    isAdmin: profile.role === "owner" || profile.role === "admin",
  };
});

/** Like getSession() but sends detailers to their home page. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session.isAdmin) redirect("/jobs/new");
  return session;
}

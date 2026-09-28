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
  /** owner, admin or manager: the whole company's cars, invoices and money. */
  isAdmin: boolean;
  /** owner or admin: Settings (company, dealerships, prices, users, Clover, export). */
  canSettings: boolean;
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
    isAdmin: profile.role === "owner" || profile.role === "admin" || profile.role === "manager",
    canSettings: profile.role === "owner" || profile.role === "admin",
  };
});

/** Like getSession() but sends detailers to their own dashboard. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session.isAdmin) redirect("/");
  return session;
}

/** Settings: owner and admin only. Managers and detailers go to their dashboard. */
export async function requireOwnerAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session.canSettings) redirect("/");
  return session;
}

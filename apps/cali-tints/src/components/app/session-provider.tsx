"use client";

import { createContext, useContext } from "react";
import type { Company, Profile } from "@/lib/db/types";

export interface ClientSession {
  userId: string;
  email: string | null;
  profile: Profile;
  company: Company;
  isAdmin: boolean;
}

const SessionContext = createContext<ClientSession | null>(null);

export function SessionProvider({ value, children }: { value: ClientSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Session for client components inside the (app) layout. */
export function useSession(): ClientSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

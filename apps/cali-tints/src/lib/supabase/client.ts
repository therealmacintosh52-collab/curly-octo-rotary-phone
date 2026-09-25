"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { supabasePublicKey, supabaseUrl } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client (singleton). Used by the offline sync loop and by
 * client components that talk to the database directly under RLS.
 */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl(), supabasePublicKey());
  }
  return browserClient;
}

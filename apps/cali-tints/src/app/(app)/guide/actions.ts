"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** "Skip for now" on the first-sign-in welcome: do not ask again; the ? in the top bar still opens the guide. */
export async function dismissGuideAction(): Promise<void> {
  const session = await getSession();
  const supabase = await createClient();
  await supabase.from("profiles").update({ guide_seen_at: new Date().toISOString() }).eq("id", session.userId);
}

import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Guide } from "@/components/guide/guide";

export const metadata: Metadata = { title: "How it works" };

/** The role-aware guide. Opening it once marks the first-sign-in welcome as done. */
export default async function GuidePage(props: PageProps<"/guide">) {
  const session = await getSession();
  const sp = await props.searchParams;
  const welcome = sp.welcome === "1" || !session.profile.guide_seen_at;
  if (!session.profile.guide_seen_at) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ guide_seen_at: new Date().toISOString() }).eq("id", session.userId);
  }
  return <Guide role={session.profile.role} name={session.profile.full_name} welcome={welcome} />;
}

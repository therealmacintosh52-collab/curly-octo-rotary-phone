import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { formatDate } from "@/lib/utils";
import { aiConfigured } from "@/lib/ai/diagnose";

export const metadata = { title: "AI assistant" };

export default async function AssistantPage() {
  const supabase = await createClient();
  const profile = (await getProfile())!;
  const ent = await getEntitlements(profile);
  const { data: sessions } = await supabase.from("ai_sessions").select("id, title, created_at, ai_messages(count)").order("created_at", { ascending: false }).limit(50);
  const remaining = Number.isFinite(ent.aiQueriesPerMonth) ? Math.max(0, ent.aiQueriesPerMonth - profile.ai_queries_used) : null;

  return (
    <Page
      title="AI diagnostic assistant"
      subtitle={remaining === null ? "Unlimited queries on your plan." : `${remaining} of ${ent.aiQueriesPerMonth} free queries left this month.`}
      actions={
        <Button asChild size="sm">
          <Link href="/assistant/new">
            <Plus /> New
          </Link>
        </Button>
      }
    >
      {!aiConfigured() && <p className="mb-4 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">The AI assistant is not configured on this server (missing ANTHROPIC_API_KEY).</p>}
      {!sessions?.length ? (
        <Empty title="No diagnostic sessions yet">
          <Link href="/assistant/new" className="text-primary underline">
            Start one
          </Link>{" "}
          with a vehicle, symptoms and codes.
        </Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/assistant/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent">
                <Sparkles className="size-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(s.created_at)} · {s.ai_messages?.[0]?.count ?? 0} messages
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {remaining === 0 && (
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/pricing">Upgrade for unlimited AI diagnostics</Link>
        </Button>
      )}
    </Page>
  );
}

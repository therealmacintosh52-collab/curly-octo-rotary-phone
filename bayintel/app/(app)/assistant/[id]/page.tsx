import { notFound } from "next/navigation";
import { Page } from "@/components/shell/page";
import { DiagnosisView } from "@/components/ai/diagnosis-view";
import { FollowUp } from "@/components/ai/follow-up";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { ContextDoc, Diagnosis } from "@/lib/ai/schema";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase.from("ai_sessions").select("*, ai_messages(*)").eq("id", id).maybeSingle();
  if (!session) notFound();
  const messages = [...session.ai_messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = messages.find((m) => m.role === "user");
  const snapshot = session.vehicle_snapshot as { year?: number; make?: string; model?: string; engine?: string | null; mileage?: number | null };
  const codesLine = first?.content.match(/Codes:\s*([^\n]+)/)?.[1] ?? "";
  const symptoms = first?.content.split("\nCodes:")[0] ?? "";

  return (
    <Page title={session.title} subtitle={`${formatDate(session.created_at)}${snapshot.engine ? ` · ${snapshot.engine}` : ""}${snapshot.mileage ? ` · ${snapshot.mileage.toLocaleString()} mi` : ""}`}>
      <div className="space-y-6">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-6 whitespace-pre-wrap rounded-xl rounded-tr-sm bg-secondary p-3 text-sm">
              {m.content}
            </div>
          ) : m.structured ? (
            <div key={m.id}>
              <DiagnosisView diagnosis={m.structured as unknown as Diagnosis} citations={(m.citations as unknown as ContextDoc[]) ?? []} />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {m.model} · {m.input_tokens ?? 0} in / {m.output_tokens ?? 0} out
              </p>
            </div>
          ) : (
            <div key={m.id} className="rounded-xl bg-card p-3 text-sm">
              {m.content}
            </div>
          ),
        )}
        <FollowUp sessionId={session.id} symptoms={symptoms} codes={codesLine} mileage={snapshot.mileage ?? null} />
      </div>
    </Page>
  );
}

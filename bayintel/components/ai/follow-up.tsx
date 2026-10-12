"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseDtcList } from "@/lib/utils";

export function FollowUp({ sessionId, symptoms, codes, mileage }: { sessionId: string; symptoms: string; codes: string; mileage: number | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, symptoms, codes: parseDtcList(codes), tests: [], mileage, follow_up: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3 md:bottom-4">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-16" placeholder="Report a test result or ask a follow-up (e.g. 'smoke test found no leaks, trims still +20%')" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button className="w-full" disabled={busy || !text.trim()} onClick={send}>
        {busy ? <Loader2 className="animate-spin" /> : <Send />} Update diagnosis
      </Button>
    </div>
  );
}

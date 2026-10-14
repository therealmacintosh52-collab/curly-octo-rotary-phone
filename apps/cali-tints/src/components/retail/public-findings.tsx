"use client";

import { useState } from "react";
import { FilmIcon, PlayIcon } from "lucide-react";
import type { JobFinding } from "@/lib/db/types";
import { formatClipLength, isVideoMime } from "@/lib/media/kind";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** What the tech found, as the customer sees it on the invoice page: severity in plain words, photos and clips, what we recommend. */
export function PublicFindings({ findings, title = "What we found" }: { findings: JobFinding[]; title?: string }) {
  const [media, setMedia] = useState<{ url: string | null; video: boolean } | null>(null);
  if (findings.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4" data-testid="public-findings">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-3">
        {findings.map((f) => (
          <li key={f.id} className="text-sm">
            <div className="flex items-center gap-2">
              {f.kind === "finding" && <span className={cn("inline-block size-2.5 shrink-0 rounded-full", f.severity === "urgent" ? "bg-destructive" : f.severity === "soon" ? "bg-warning" : "bg-success")} />}
              <span className="font-medium">{f.title}</span>
              {f.kind === "finding" && <span className="text-caption text-subtle">{f.severity === "urgent" ? "needs attention now" : f.severity === "soon" ? "soon" : "for your information"}</span>}
            </div>
            {f.body && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{f.body}</p>}
            {f.recommendation && <p className="mt-0.5 text-caption font-semibold tracking-wide" data-testid="public-recommendation">{{ replace: "RECOMMEND REPLACE", diagnose: "RECOMMEND DIAG", monitor: "RECOMMEND MONITOR" }[f.recommendation]}</p>}
            {f.recommended_service && <p className="mt-0.5 text-caption font-medium">We recommend: {f.recommended_service}</p>}
            {f.media.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {f.media.map((m) => {
                  const video = isVideoMime(m.mime) || m.kind === "video";
                  return (
                    <button key={m.id} type="button" onClick={() => setMedia({ url: m.url ?? null, video })} aria-label={video ? "Play the clip" : "Open the photo"} className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {video ? (
                        <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground"><PlayIcon className="size-5" /><span className="text-caption">{formatClipLength(m.duration_s) || "Clip"}</span></span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        m.url && <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!media} onOpenChange={(o) => !o && setMedia(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Media</DialogTitle>
          {media?.video ? (
            media.url ? (
              <video src={media.url} controls playsInline className="max-h-[80vh] w-full rounded-lg bg-black" />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><FilmIcon className="size-6" /> The clip is not available in the preview.</div>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            media?.url && <img src={media.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

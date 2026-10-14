import { addEstimateFindingPhotosAction, addFindingPhotosAction, registerEstimateFindingMediaAction, registerFindingMediaAction } from "@/app/(app)/jobs/actions";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, extensionFor, isVideoMime, mediaMime } from "@/lib/media/kind";

export type ClipPick = { file: File; mime: string; duration: number | null };

/** Where a finding lives: the repair order, or an estimate that is not approved yet. */
export type FindingSubject = { jobId: string } | { estimateId: string };

/** Check a picked video against the app's limits; returns the clip or the reason it was refused. */
export async function readClip(file: File): Promise<{ clip: ClipPick } | { error: string }> {
  const mime = mediaMime(file.type, file.name);
  if (!mime || !isVideoMime(mime)) return { error: "That is not a video the app can keep (mp4, webm or mov)" };
  if (file.size > MAX_VIDEO_BYTES) return { error: "Keep clips under 100 MB (about a minute at 720p)" };
  const { clipDuration } = await import("@/lib/media/upload");
  const duration = await clipDuration(file);
  if (duration && duration > MAX_VIDEO_SECONDS + 1) return { error: `Keep clips under ${MAX_VIDEO_SECONDS} seconds` };
  return { clip: { file, mime, duration } };
}

/**
 * Put photos and/or a clip on a finding that already exists: photos through the
 * server action (compressed on the device already), a clip straight to storage
 * (resumable above 6 MB) and then registered. Returns the problems, if any.
 */
export async function uploadFindingMedia(o: { subject: FindingSubject; companyId: string; findingId: string; photos?: File[]; clip?: ClipPick | null; onProgress?: (s: string | null) => void }): Promise<string[]> {
  const jobId = "jobId" in o.subject ? o.subject.jobId : null;
  const estimateId = "estimateId" in o.subject ? o.subject.estimateId : null;
  const problems: string[] = [];
  const photos = o.photos ?? [];
  if (photos.length) {
    o.onProgress?.(`Uploading ${photos.length} ${photos.length === 1 ? "photo" : "photos"}…`);
    const form = new FormData();
    for (const ph of photos) form.append("photo", ph);
    const r = jobId ? await addFindingPhotosAction(jobId, o.findingId, form) : await addEstimateFindingPhotosAction(estimateId!, o.findingId, form);
    if (!r.ok) problems.push(r.error);
  }
  if (o.clip) {
    const { uploadJobMedia } = await import("@/lib/media/upload");
    const path = `${o.companyId}/${jobId ? jobId : `estimates/${estimateId}`}/${crypto.randomUUID()}.${extensionFor(o.clip.mime as Parameters<typeof extensionFor>[0])}`;
    o.onProgress?.("Uploading the clip… 0%");
    try {
      await uploadJobMedia(path, o.clip.file, o.clip.mime, (pct) => o.onProgress?.(`Uploading the clip… ${pct}%`));
      const meta = { path, mime: o.clip.mime, size: o.clip.file.size, duration: o.clip.duration };
      const r = jobId ? await registerFindingMediaAction(jobId, o.findingId, meta) : await registerEstimateFindingMediaAction(estimateId!, o.findingId, meta);
      if (!r.ok) problems.push(r.error);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "The clip did not upload; the finding is saved, try the clip again");
    }
  }
  o.onProgress?.(null);
  return problems;
}

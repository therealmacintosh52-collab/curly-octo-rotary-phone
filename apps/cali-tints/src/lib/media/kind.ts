/**
 * Media on the repair order's notes tab: photos and short clips. Pure helpers
 * shared by the picker, the uploader and the server actions.
 */

/** Above this a file goes up resumable (TUS, 6 MB chunks), per Supabase's guidance for files over 6 MB. */
export const TUS_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
/** The bucket allows 100 MB; a 30-second phone clip at 720p is 20 to 40 MB. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export type MediaMime = (typeof VIDEO_MIMES)[number] | (typeof IMAGE_MIMES)[number];

/** Normalise what the browser reports (an iPhone says "video/quicktime" for .mov; some Androids send an empty type). */
export function mediaMime(type: string | null | undefined, name?: string | null): MediaMime | null {
  const t = (type ?? "").toLowerCase().split(";")[0].trim();
  if ((VIDEO_MIMES as readonly string[]).includes(t) || (IMAGE_MIMES as readonly string[]).includes(t)) return t as MediaMime;
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export const isVideoMime = (mime: string | null | undefined) => !!mime && mime.startsWith("video/");

export function extensionFor(mime: MediaMime): string {
  switch (mime) {
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/** Plain upload for small files, resumable for the rest. */
export const uploadMode = (bytes: number): "plain" | "resumable" => (bytes > TUS_THRESHOLD_BYTES ? "resumable" : "plain");

/**
 * Supabase recommends the storage hostname for large uploads
 * (https://supabase.com/docs/guides/storage/uploads/resumable-uploads):
 * `https://<ref>.supabase.co` → `https://<ref>.storage.supabase.co`.
 * Any other host (self-hosted, local) is used as is.
 */
export function storageHost(projectUrl: string): string {
  const m = projectUrl.trim().replace(/\/+$/, "").match(/^(https?:\/\/)([a-z0-9-]+)\.supabase\.co$/i);
  return m ? `${m[1]}${m[2]}.storage.supabase.co` : projectUrl.trim().replace(/\/+$/, "");
}

/** "0:12" for a clip's length. */
export function formatClipLength(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

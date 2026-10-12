"use client";

import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/env";
import { TUS_CHUNK_BYTES, storageHost, uploadMode } from "./kind";

/**
 * Upload a photo or clip from the browser under RLS: a plain upload for small
 * files, a resumable (TUS) upload for the rest so a dropped Wi-Fi connection
 * picks up where it left off. The file is overwritten on retry (x-upsert),
 * which the bucket's update policy allows inside the company folder.
 * Source: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */
export async function uploadJobMedia(path: string, file: Blob, contentType: string, onProgress?: (pct: number) => void): Promise<void> {
  const supabase = createClient();
  if (uploadMode(file.size) === "plain") {
    const { error } = await supabase.storage.from("job-photos").upload(path, file, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    onProgress?.(100);
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You are signed out");
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${storageHost(supabaseUrl())}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, "x-upsert": "true" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: "job-photos", objectName: path, contentType, cacheControl: "3600" },
      chunkSize: TUS_CHUNK_BYTES,
      onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
      onProgress: (sent, total) => onProgress?.(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
}

/** How long a clip is, read from the file before it goes up (null when the browser cannot tell). */
export function clipDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

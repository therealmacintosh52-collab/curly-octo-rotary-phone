"use client";

import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import type { OutboxItem } from "./db";
import { addRecentJob, listOutbox, pruneDone, updateOutboxItem } from "./outbox";

let inFlight: Promise<SyncResult> | null = null;

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
}

/** Errors that mean "try again later", as opposed to a server-side rejection. */
function isTransient(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("load failed") ||
    msg.includes("aborted")
  );
}

/**
 * Pushes every pending outbox item to Supabase. Safe to call repeatedly:
 * concurrent calls share one run, and create_job is idempotent on client_id
 * so a retry after a dropped response never duplicates a job.
 */
export function syncOutbox(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return result;

  const supabase = createClient();
  const items = (await listOutbox()).filter((i) => i.status === "pending" || i.status === "error");
  // Oldest first so invoice periods stay chronological.
  items.sort((a, b) => a.created_at - b.created_at);

  for (const item of items) {
    // A server-rejected item stays in "error" until the user edits/discards it.
    if (item.status === "error" && item.attempts >= 1 && !isTransient(item.last_error)) {
      result.skipped++;
      continue;
    }
    await updateOutboxItem(item.client_id, { status: "syncing" });
    try {
      const { data: job, error } = await supabase.rpc("create_job", { p: { ...item.payload, client_id: item.client_id } });
      if (error) throw error;

      await uploadPhotos(item, job.id);

      await addRecentJob({
        id: job.id,
        tag_number: job.tag_number,
        vin: job.vin,
        dealership_id: job.dealership_id,
        performed_at: job.performed_at,
        model: job.model,
        detailer_name: "You",
      });
      await updateOutboxItem(item.client_id, {
        status: "done",
        job_id: job.id,
        synced_at: Date.now(),
        last_error: null,
        photos: [], // free the blobs
      });
      result.synced++;
    } catch (err) {
      const transient = isTransient(err);
      await updateOutboxItem(item.client_id, {
        status: transient ? "pending" : "error",
        attempts: item.attempts + 1,
        last_error: errorMessage(err),
      });
      result.failed++;
      if (transient) break; // no point hammering a dead connection
    }
  }

  await pruneDone();
  return result;
}

/**
 * Save one job straight to the server, bypassing the outbox. Used only when
 * IndexedDB is unavailable; the normal path is enqueueJob() + syncOutbox().
 */
export async function createJobDirect(item: OutboxItem): Promise<string> {
  const supabase = createClient();
  const { data: job, error } = await supabase.rpc("create_job", { p: { ...item.payload, client_id: item.client_id } });
  if (error) throw error;
  await uploadPhotos(item, job.id);
  return job.id;
}

/** Upload compressed photos to storage and register them on the job. */
async function uploadPhotos(item: OutboxItem, jobId: string) {
  if (!item.photos.length) return;
  const supabase = createClient();
  for (const photo of item.photos) {
    const path = `${item.company_id}/${jobId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, photo.blob, {
      contentType: photo.blob.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { error: rowErr } = await supabase.from("job_photos").insert({
      company_id: item.company_id,
      job_id: jobId,
      kind: photo.kind,
      storage_path: path,
      size_bytes: photo.blob.size,
    });
    if (rowErr) throw rowErr;
  }
}

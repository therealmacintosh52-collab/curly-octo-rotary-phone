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
      await liveQuickBooks(job.id);
      const invoiceNumber = await invoiceNumberFor(job.invoice_id, job.id);

      await addRecentJob({
        id: job.id,
        tag_number: job.tag_number,
        vin: job.vin,
        dealership_id: job.dealership_id,
        performed_at: job.performed_at,
        model: job.model,
      });
      await updateOutboxItem(item.client_id, {
        status: "done",
        job_id: job.id,
        invoice_id: job.invoice_id,
        invoice_number: invoiceNumber,
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

/** The invoice number a synced car got (invoices are the owner's; the RPC tells everyone the number). Best effort. */
async function invoiceNumberFor(invoiceId: string | null, jobId?: string | null): Promise<string | null> {
  if (!invoiceId || !jobId) return null;
  try {
    const { data } = await createClient().rpc("job_invoice_number", { p_job_id: jobId });
    return data ?? null;
  } catch {
    return null;
  }
}

export interface SavedCar {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
}

/**
 * Save one car straight to the server, bypassing the outbox: "Save & charge",
 * or when IndexedDB is unavailable. The normal path is enqueueJob() + syncOutbox().
 */
export async function createJobDirect(item: OutboxItem): Promise<SavedCar> {
  const supabase = createClient();
  const { data: job, error } = await supabase.rpc("create_job", { p: { ...item.payload, client_id: item.client_id } });
  if (error) throw error;
  await uploadPhotos(item, job.id);
  await liveQuickBooks(job.id);
  return { id: job.id, invoice_id: job.invoice_id, invoice_number: await invoiceNumberFor(job.invoice_id, job.id) };
}

/** Ask the server to put this job on the dealership's QuickBooks invoice now. Best effort: the daily sync covers a miss. */
async function liveQuickBooks(jobId: string) {
  try {
    await fetch("/api/quickbooks/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId }), credentials: "same-origin", keepalive: true });
  } catch {
    /* offline again, or the server is busy */
  }
}

/**
 * Upload compressed photos to storage and register them on the job. The
 * storage path and the row's client_id come from the photo's own id, so a
 * retry after a half-finished attempt overwrites the file and skips the row
 * it already made (unique on job_id + client_id).
 */
async function uploadPhotos(item: OutboxItem, jobId: string) {
  if (!item.photos.length) return;
  const supabase = createClient();
  for (const photo of item.photos) {
    const clientId = photo.id ?? crypto.randomUUID();
    const path = `${item.company_id}/${jobId}/${clientId}.jpg`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, photo.blob, {
      contentType: photo.blob.type || "image/jpeg",
      upsert: true,
    });
    if (upErr) throw upErr;
    const { error: rowErr } = await supabase.from("job_photos").insert({
      company_id: item.company_id,
      job_id: jobId,
      kind: photo.kind,
      storage_path: path,
      size_bytes: photo.blob.size,
      client_id: clientId,
    });
    if (rowErr && rowErr.code !== "23505") throw rowErr; // 23505: this photo was registered by an earlier attempt
  }
}

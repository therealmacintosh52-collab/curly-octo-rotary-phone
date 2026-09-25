"use client";

import { getDb, type OutboxItem, type RecentJob, type ReferenceSnapshot } from "./db";

/** Fired whenever the outbox changes so UI badges can refresh. */
export const OUTBOX_EVENT = "cali-tints:outbox";
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export async function enqueueJob(item: OutboxItem): Promise<void> {
  const db = await getDb();
  await db.put("outbox", item);
  notify();
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("outbox", "by-created");
  return all.sort((a, b) => b.created_at - a.created_at);
}

export async function getOutboxItem(clientId: string): Promise<OutboxItem | undefined> {
  const db = await getDb();
  return db.get("outbox", clientId);
}

export async function updateOutboxItem(clientId: string, patch: Partial<OutboxItem>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("outbox", "readwrite");
  const item = await tx.store.get(clientId);
  if (item) await tx.store.put({ ...item, ...patch });
  await tx.done;
  notify();
}

export async function removeOutboxItem(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", clientId);
  notify();
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const pending = await db.countFromIndex("outbox", "by-status", "pending");
  const syncing = await db.countFromIndex("outbox", "by-status", "syncing");
  const error = await db.countFromIndex("outbox", "by-status", "error");
  return pending + syncing + error;
}

/** Drop synced entries older than a day so the store does not grow forever. */
export async function pruneDone(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDb();
  const done = await db.getAllFromIndex("outbox", "by-status", "done");
  const cutoff = Date.now() - maxAgeMs;
  for (const item of done) {
    if ((item.synced_at ?? 0) < cutoff) await db.delete("outbox", item.client_id);
  }
}

// --- reference data ---------------------------------------------------------

export async function saveReference(snapshot: Omit<ReferenceSnapshot, "key">): Promise<void> {
  const db = await getDb();
  await db.put("reference", { key: "reference", ...snapshot });
}

export async function loadReference(): Promise<ReferenceSnapshot | undefined> {
  const db = await getDb();
  return db.get("reference", "reference");
}

// --- recent jobs (offline duplicate check) ----------------------------------

export async function saveRecentJobs(jobs: RecentJob[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("recent_jobs", "readwrite");
  await tx.store.clear();
  for (const j of jobs) await tx.store.put(j);
  await tx.done;
}

export async function addRecentJob(job: RecentJob): Promise<void> {
  const db = await getDb();
  await db.put("recent_jobs", job);
}

/** Local duplicate check over cached jobs + unsynced outbox, last 7 days. */
export async function findLocalDuplicates(tag: string, vin: string | null): Promise<RecentJob[]> {
  const db = await getDb();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const up = tag.trim().toUpperCase();
  const v = vin?.trim().toUpperCase() || null;
  const recent = await db.getAll("recent_jobs");
  const fromCache = recent.filter(
    (j) => new Date(j.performed_at).getTime() >= cutoff && (j.tag_number.toUpperCase() === up || (v && j.vin === v)),
  );
  const outbox = await db.getAll("outbox");
  const fromOutbox: RecentJob[] = outbox
    .filter((o) => o.status !== "done" && o.created_at >= cutoff)
    .filter((o) => o.payload.tag_number.toUpperCase() === up || (v && o.payload.vin?.toUpperCase() === v))
    .map((o) => ({
      id: o.client_id,
      tag_number: o.payload.tag_number,
      vin: o.payload.vin ?? null,
      dealership_id: o.payload.dealership_id,
      performed_at: o.payload.performed_at ?? new Date(o.created_at).toISOString(),
      model: o.payload.model ?? null,
      detailer_name: "You (unsynced)",
    }));
  return [...fromOutbox, ...fromCache].slice(0, 5);
}

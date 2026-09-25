"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Dealership, JobPayload, PriceListRow, Profile } from "@/lib/db/types";

/** A job waiting to be synced, plus its photos as Blobs. */
export interface OutboxItem {
  client_id: string;
  company_id: string;
  payload: JobPayload;
  photos: { kind: "before" | "after"; blob: Blob; name: string }[];
  /** Denormalised for the pending list UI. */
  summary: { tag_number: string; model: string | null; dealership_name: string; total: number };
  status: "pending" | "syncing" | "error" | "done";
  attempts: number;
  last_error: string | null;
  created_at: number;
  synced_at: number | null;
  job_id: string | null;
}

/** Slim copy of recent jobs so the duplicate check works offline. */
export interface RecentJob {
  id: string;
  tag_number: string;
  vin: string | null;
  dealership_id: string;
  performed_at: string;
  model: string | null;
  detailer_name: string;
}

/** Reference data snapshot so the form renders with no signal. */
export interface ReferenceSnapshot {
  key: "reference";
  fetched_at: number;
  dealerships: Dealership[];
  price_lists: Record<string, PriceListRow[]>;
  detailers: Pick<Profile, "id" | "full_name">[];
}

interface CaliTintsDB extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { "by-status": string; "by-created": number } };
  recent_jobs: { key: string; value: RecentJob; indexes: { "by-performed": string } };
  reference: { key: "reference"; value: ReferenceSnapshot };
}

let dbPromise: Promise<IDBPDatabase<CaliTintsDB>> | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB<CaliTintsDB>("cali-tints", 1, {
      upgrade(db) {
        const outbox = db.createObjectStore("outbox", { keyPath: "client_id" });
        outbox.createIndex("by-status", "status");
        outbox.createIndex("by-created", "created_at");
        const recent = db.createObjectStore("recent_jobs", { keyPath: "id" });
        recent.createIndex("by-performed", "performed_at");
        db.createObjectStore("reference", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

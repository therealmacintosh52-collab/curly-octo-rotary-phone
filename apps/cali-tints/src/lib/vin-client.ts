"use client";

import type { VinDecodeResult } from "./vin";

const KEY = "cali-tints:vin:";

/** Browser-side memo of decodes so a re-scan of the same car costs nothing, even offline. */
export function readVinMemo(vin: string): VinDecodeResult | null {
  try {
    const raw = localStorage.getItem(KEY + vin);
    return raw ? (JSON.parse(raw) as VinDecodeResult) : null;
  } catch {
    return null;
  }
}

export function writeVinMemo(result: VinDecodeResult) {
  try {
    localStorage.setItem(KEY + result.vin, JSON.stringify(result));
  } catch {
    /* quota / private mode */
  }
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const memo = readVinMemo(vin);
  if (memo) return memo;
  const res = await fetch(`/api/vin/${vin}`);
  const body = (await res.json()) as (VinDecodeResult & { source: string }) | { error: string };
  if (!res.ok || "error" in body) {
    throw new Error("error" in body ? body.error : "VIN lookup failed");
  }
  writeVinMemo(body);
  return body;
}

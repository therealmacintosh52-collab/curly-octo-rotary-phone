import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstimateView } from "@/lib/db/types";

/** The company logo and the latest signature as data URIs, for the PDF. */
export async function estimateAssets(db: SupabaseClient<Database>, e: EstimateView): Promise<{ logoDataUri: string | null; signatureDataUri: string | null }> {
  let logoDataUri: string | null = null;
  let signatureDataUri: string | null = null;
  if (e.company.logo_path) {
    const { data } = await db.storage.from("logos").download(e.company.logo_path);
    if (data) logoDataUri = `data:${data.type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  const sig = e.authorizations.find((a) => a.signature_path)?.signature_path;
  if (sig) {
    const { data } = await db.storage.from("signatures").download(sig);
    if (data) signatureDataUri = `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  return { logoDataUri, signatureDataUri };
}

export function estimateFileStem(e: EstimateView): string {
  const who = (e.customer.display_name ?? e.customer.first_name ?? "customer").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${e.display_number}-${who || "customer"}`;
}

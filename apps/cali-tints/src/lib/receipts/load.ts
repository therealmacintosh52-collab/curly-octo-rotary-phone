import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReceiptView } from "@/lib/db/types";

/** The company logo and the pickup signature as data URIs, for the PDF (admin client: the signatures bucket has no app policies). */
export async function receiptAssets(db: SupabaseClient<Database>, r: ReceiptView): Promise<{ logoDataUri: string | null; signatureDataUri: string | null }> {
  let logoDataUri: string | null = null;
  let signatureDataUri: string | null = null;
  if (r.company.logo_path) {
    const { data } = await db.storage.from("logos").download(r.company.logo_path);
    if (data) logoDataUri = `data:${data.type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  if (r.has_signature) {
    const { data: path } = await db.rpc("receipt_signature_path", { p_job_id: r.id });
    if (path) {
      const { data } = await db.storage.from("signatures").download(path);
      if (data) signatureDataUri = `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
    }
  }
  return { logoDataUri, signatureDataUri };
}

export function receiptFileStem(r: ReceiptView): string {
  const who = (r.customer?.display_name ?? r.customer?.first_name ?? "customer").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `receipt-${r.tag.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${who || "customer"}`;
}

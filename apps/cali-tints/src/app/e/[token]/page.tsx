import { notFound } from "next/navigation";
import { loadPublicEstimate } from "@/lib/estimates/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/media/signed";
import { EstimatePublic } from "@/components/retail/estimate-public";

export const dynamic = "force-dynamic";

/** /e/:token — the customer's copy of the estimate, where they pick, sign and approve. */
export default async function PublicEstimatePage(props: PageProps<"/e/[token]">) {
  const { token } = await props.params;
  const e = await loadPublicEstimate(token);
  if (!e) notFound();
  // The findings' photos and clips live in a private bucket: short-lived links, minted here (the page is the customer's key).
  if (e.findings?.length) {
    try {
      const urls = await signedUrls(createAdminClient(), "job-photos", e.findings.flatMap((f) => f.media.map((m) => m.storage_path)));
      e.findings = e.findings.map((f) => ({ ...f, media: f.media.map((m) => ({ ...m, url: urls.get(m.storage_path) ?? null })) }));
    } catch {
      /* no service key: the findings show without their media */
    }
  }
  return <EstimatePublic e={e} token={token} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/media/signed";
import { ReceiptView } from "@/components/retail/receipt-view";

export const metadata: Metadata = { title: "Your invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /r/:token — the customer's invoice for a retail job (amount due, what the tech found), and the receipt once it is paid. */
export default async function ReceiptPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  if (!isTokenShape(token)) notFound();
  const { data, error } = await anonClient().rpc("receipt_by_token", { p_token: token });
  if (error || !data) notFound();
  // The findings' photos and clips live in a private bucket: short-lived links, minted here (the page is the customer's key).
  if (data.findings?.length) {
    try {
      const urls = await signedUrls(createAdminClient(), "job-photos", data.findings.flatMap((f) => f.media.map((m) => m.storage_path)));
      data.findings = data.findings.map((f) => ({ ...f, media: f.media.map((m) => ({ ...m, url: urls.get(m.storage_path) ?? null })) }));
    } catch {
      /* no service key: the findings show without their media */
    }
  }
  return <ReceiptView r={data} token={token} />;
}

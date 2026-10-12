import { notFound } from "next/navigation";
import { EstimateDoc } from "@/components/estimates/estimate-doc";
import { createAdminClient } from "@/lib/supabase/admin";
import { ESTIMATE_SELECT, toEstimateDoc } from "@/lib/estimates/queries";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: "Estimate", robots: { index: false, follow: false } };

/** Public customer view. Looked up by unguessable share token with the service role. */
export default async function SharedEstimatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data } = await db.from("estimates").select(ESTIMATE_SELECT).eq("share_token", token).maybeSingle();
  if (!data) notFound();
  const doc = toEstimateDoc(data as Parameters<typeof toEstimateDoc>[0]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <EstimateDoc e={doc} />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Sent with {APP_NAME}. Questions? Contact the shop using the details above.
      </p>
    </main>
  );
}

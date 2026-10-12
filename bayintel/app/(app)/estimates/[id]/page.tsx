import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EstimateDoc } from "@/components/estimates/estimate-doc";
import { CopyShareLink, EstimatePdfButton } from "@/components/estimates/estimate-pdf-button";
import { EstimateStatusButtons } from "@/components/estimates/estimate-status";
import { createClient } from "@/lib/supabase/server";
import { getEstimate, toEstimateDoc } from "@/lib/estimates/queries";
import { APP_NAME, APP_URL } from "@/lib/config";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const e = await getEstimate(supabase, id);
  if (!e) notFound();
  const doc = toEstimateDoc(e);
  const shareUrl = `${APP_URL}/share/estimate/${e.share_token}`;
  return (
    <Page
      title={`Estimate #${e.estimate_number}`}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href={`/estimates/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      }
    >
      <div className="no-print mb-4 grid grid-cols-2 gap-2">
        <EstimatePdfButton e={doc} appName={APP_NAME} />
        <CopyShareLink url={shareUrl} />
      </div>
      <EstimateDoc e={doc} />
      <div className="no-print mt-4">
        <EstimateStatusButtons id={e.id} status={e.status} />
        <p className="mt-3 break-all text-xs text-muted-foreground">
          Customer link: <a className="underline" href={shareUrl}>{shareUrl}</a>
        </p>
      </div>
    </Page>
  );
}

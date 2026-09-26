import { DownloadIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Shown after "Generate all pending": offers the zip of every PDF just created. */
export function BulkDownloadBanner({ ids }: { ids: string[] }) {
  const q = encodeURIComponent(ids.join(","));
  return (
    <Alert variant="success" className="mt-5">
      <CheckCircle2Icon />
      <AlertTitle>
        {ids.length} invoice{ids.length === 1 ? "" : "s"} generated
      </AlertTitle>
      <AlertDescription className="w-full">
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <a href={`/api/invoices/bulk.zip?ids=${q}&csv=1`}>
              <DownloadIcon /> Download all PDFs + CSVs (.zip)
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`/api/invoices/bulk.zip?ids=${q}&variant=print`}>Print-ready zip</a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

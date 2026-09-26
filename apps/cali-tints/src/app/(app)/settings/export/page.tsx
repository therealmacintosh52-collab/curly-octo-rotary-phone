import type { Metadata } from "next";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Export" };

const EXPORTS = [
  { key: "jobs", title: "Jobs", desc: "Every job (including soft-deleted) with vehicle, detailer, dealership, invoice number and total. One row per job." },
  { key: "job-services", title: "Job service lines", desc: "One row per service on a job, with price and override reason. Join to jobs on job_id." },
  { key: "invoices", title: "Invoices", desc: "All invoices with period, totals, status, submitted/paid dates and amount paid." },
  { key: "invoice-items", title: "Invoice line items", desc: "Snapshot lines exactly as billed. Same columns as the per-invoice CSV; import-ready." },
  { key: "payments", title: "Payments", desc: "Every recorded payment with method, reference and invoice number." },
];

export default function ExportPage() {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Your data is yours. Each export is a UTF-8 CSV with a stable header row, suitable for Excel, Google Sheets or an accounting import. Column order never changes; new columns are only appended.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {EXPORTS.map((e) => (
          <Card key={e.key}>
            <CardHeader>
              <CardTitle>{e.title}</CardTitle>
              <CardDescription>{e.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <a href={`/api/export/${e.key}.csv`}>
                  <DownloadIcon /> Download {e.title.toLowerCase()} CSV
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

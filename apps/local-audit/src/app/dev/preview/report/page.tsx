import { ClientReportView } from "@/components/report/client-report-view";
import type { ClientReport } from "@/lib/reports/client-report";

const report: ClientReport = {
  audit: { id: "30000000-0000-4000-8000-000000000001", status: "succeeded", progress_pct: 100, finished_at: "2026-09-28T00:00:00Z", scores: {}, revenue_model: {}, version: 1 },
  business: { name: "Test Plumbing", canonical_domain: "testplumbing.example", primary_category: "Plumber", address: "1 Main St, Sacramento, CA 95814" },
  findings: [
    { id: "f1", category: "identity_nap", severity: "high", title: "Different phone numbers across your listings", plain_english: "Google and AI assistants treat a consistent phone number as proof that the listings are the same business; a mismatch costs ranking trust and sends some callers to the wrong number. Right now your website, your Google Business Profile do not agree." },
    { id: "f2", category: "conversion", severity: "high", title: "Your phone number cannot be tapped on mobile", plain_english: "The number is on the page as plain text, so on a phone a visitor has to remember or copy it. A tap-to-call link turns that into one tap." },
  ],
  solutions: [],
  solution_counts: { revealed: 0, total: 2 },
  competitors: [],
  ai_visibility: [],
  rank_grid: [],
  citations: [],
  social_profiles: [],
  backlink_metrics: [],
  brand_mentions: [],
  evidence: [],
  share: { expires_at: null, view_count: 3 },
};

export default function PreviewReport() {
  return <ClientReportView report={report} />;
}

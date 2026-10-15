import { templateCsv } from '@/lib/dealers/csv';

export const dynamic = 'force-static';

export function GET() {
  return new Response(templateCsv(), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="916-dealer-vehicles-template.csv"', 'Cache-Control': 'public, max-age=3600' },
  });
}

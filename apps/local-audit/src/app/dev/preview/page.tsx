import Link from "next/link";
import { Page, PageHeader } from "@/components/app/page-header";

export default function PreviewIndex() {
  const links = [
    ["/dev/preview/new-audit", "New audit form"],
    ["/dev/preview/audit", "Audit detail (resolver run on fixtures)"],
    ["/dev/preview/audit?scenario=mismatch", "Audit detail with a phone mismatch"],
    ["/dev/preview/audit?scenario=unavailable", "Audit detail with Google unavailable"],
    ["/dev/preview/audit?scenario=crawl", "Audit detail after a website crawl (flawed demo site, PageSpeed fixture)"],
    ["/dev/preview/report", "Client report shell"],
  ];
  return (
    <Page narrow>
      <PageHeader title="Previews" description="Rendered from fixtures; no Supabase, no API keys." />
      <ul className="mt-6 flex flex-col gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link className="text-primary underline-offset-4 hover:underline" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

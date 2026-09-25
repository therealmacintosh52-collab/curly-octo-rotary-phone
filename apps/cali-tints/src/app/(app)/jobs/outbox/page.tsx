import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/app/page-header";
import { OutboxList } from "@/components/offline/outbox-list";

export const metadata: Metadata = { title: "Sync queue" };

export default function OutboxPage() {
  return (
    <Page narrow>
      <PageHeader title="Sync queue" description="Jobs saved on this phone that are waiting to reach the server." />
      <div className="mt-5">
        <OutboxList />
      </div>
    </Page>
  );
}

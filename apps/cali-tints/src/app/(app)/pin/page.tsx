import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/app/page-header";
import { MyPinCard } from "@/components/jobs/my-pin-card";

export const metadata: Metadata = { title: "Approval PIN" };

/** Managers, admins and the owner keep a PIN that approves a detailer's edit or delete of a job. */
export default async function PinPage() {
  await getSession();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_pin_status");
  return (
    <Page narrow>
      <PageHeader title="Approval PIN" description="A detailer needs a manager's PIN to edit or delete a job. You type yours on their phone." />
      <div className="mt-5">
        <MyPinCard canHavePin={!!data?.can_have_pin} hasPin={!!data?.has_pin} setAt={data?.set_at ?? null} />
      </div>
    </Page>
  );
}

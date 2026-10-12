import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/retail/email";
import { AppointmentDetail } from "@/components/retail/appointment-detail";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage(props: PageProps<"/retail/appointments/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();
  const { data: a, error } = await supabase.rpc("appointment_detail", { p_id: id });
  if (error || !a) notFound();
  let publicUrl: string | null = null;
  if (session.isAdmin) {
    const { data: token } = await supabase.rpc("appointment_link", { p_id: id });
    if (token) publicUrl = `${appUrl() ?? ""}/a/${token}`;
  }
  return <AppointmentDetail a={a} showMoney={session.canPrices} publicUrl={publicUrl} />;
}

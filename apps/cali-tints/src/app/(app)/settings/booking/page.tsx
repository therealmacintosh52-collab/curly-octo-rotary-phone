import type { Metadata } from "next";
import { requireOwnerAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BookingSettings } from "@/components/settings/booking-settings";

export const metadata: Metadata = { title: "Booking" };

/** Booking policy, hours, bays/lifts/techs, days off and customer emails. Owner and admin. */
export default async function BookingSettingsPage() {
  await requireOwnerAdmin();
  const supabase = await createClient();
  const [{ data, error }, { data: people }] = await Promise.all([supabase.rpc("retail_catalog"), supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")]);
  if (error || !data || !data.settings) throw new Error(error?.message ?? "Could not load booking settings");
  return <BookingSettings data={{ settings: data.settings, hours: data.hours, resources: data.resources, blackouts: data.blackouts, timeOff: data.time_off, people: people ?? [] }} />;
}

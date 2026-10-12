import { notFound, redirect } from "next/navigation";
import { Page } from "@/components/shell/page";
import { FixForm } from "@/components/fixes/fix-form";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "Edit fix" };

export default async function EditFixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: fix } = await supabase.from("fixes").select("*, fix_dtcs(code), fix_parts(*), fix_media(storage_path, caption)").eq("id", id).maybeSingle();
  if (!fix || !profile) notFound();
  if (fix.author_id !== profile.id && profile.role !== "admin") redirect(`/fixes/${id}`);
  return (
    <Page title="Edit fix" subtitle={`Version ${fix.version}. Changes are kept in the edit history.`}>
      <FixForm
        vehicles={[]}
        fixId={fix.id}
        initial={{
          vehicle_id: fix.vehicle_id,
          title: fix.title,
          year: fix.year,
          make: fix.make,
          model: fix.model,
          engine: fix.engine,
          mileage: fix.mileage,
          symptoms: fix.symptoms,
          codes: fix.fix_dtcs.map((d) => d.code),
          freeze_frame_notes: fix.freeze_frame_notes,
          tests_performed: (fix.tests_performed as { test: string; result: string }[]) ?? [],
          root_cause: fix.root_cause,
          fix_description: fix.fix_description,
          parts: fix.fix_parts.sort((a, b) => a.sort - b.sort).map((p) => ({ name: p.name, part_number: p.part_number, quantity: Number(p.quantity), unit_price: p.unit_price == null ? null : Number(p.unit_price) })),
          labor_hours: fix.labor_hours == null ? null : Number(fix.labor_hours),
          media: fix.fix_media,
        }}
      />
    </Page>
  );
}

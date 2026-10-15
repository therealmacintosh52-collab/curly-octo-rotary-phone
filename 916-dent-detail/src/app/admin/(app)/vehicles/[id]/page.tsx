import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sizeClasses } from '@/config/booking';
import { vehicleLabel } from '@/lib/admin/format';
import { repo } from '@/lib/db';
import { requireStaff } from '@/lib/auth/server';
import { saveVehicleAction } from '../../../_actions/crm';
import { ActionForm } from '../../../_ui/forms';
import { Field, PageHeader, Section } from '../../../_ui';
import { NoteForm, NoteList } from '../../../_ui/parts';

export const metadata: Metadata = { title: 'Vehicle' };
export const dynamic = 'force-dynamic';

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ customer?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { customer } = await searchParams;
  const isNew = id === 'new';
  const v = isNew ? null : await repo().vehicles.get(id);
  if (!isNew && !v) notFound();
  const customerId = v?.customer_id ?? customer;
  if (!customerId) notFound();
  const notes = v ? await repo().notes.list({ where: { entity_type: 'vehicle', entity_id: v.id }, orderBy: 'created_at', desc: true }) : [];
  return (
    <>
      <PageHeader title={v ? vehicleLabel(v) : 'Add vehicle'} eyebrow="Vehicle" back={{ href: `/admin/customers/${customerId}`, label: 'Customer' }} />
      <Section>
        <ActionForm action={saveVehicleAction} submit="Save vehicle">
          <input type="hidden" name="customerId" value={customerId} />
          {v && <input type="hidden" name="id" value={v.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" htmlFor="year"><input id="year" name="year" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={v?.year ?? ''} className="adm-input" /></Field>
            <Field label="Color" htmlFor="color"><input id="color" name="color" defaultValue={v?.color ?? ''} className="adm-input" /></Field>
          </div>
          <Field label="Make" htmlFor="make"><input id="make" name="make" defaultValue={v?.make ?? ''} className="adm-input" /></Field>
          <Field label="Model" htmlFor="model"><input id="model" name="model" defaultValue={v?.model ?? ''} className="adm-input" /></Field>
          <Field label="Size class" htmlFor="sizeClass"><select id="sizeClass" name="sizeClass" defaultValue={v?.size_class ?? ''} className="adm-input"><option value="">Not set</option>{sizeClasses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="VIN" htmlFor="vin"><input id="vin" name="vin" defaultValue={v?.vin ?? ''} className="adm-input" autoCapitalize="characters" /></Field>
        </ActionForm>
      </Section>
      {v && <Section title="Notes"><NoteList notes={notes} /><div className="mt-3"><NoteForm entityType="vehicle" entityId={v.id} path={`/admin/vehicles/${v.id}`} /></div></Section>}
    </>
  );
}

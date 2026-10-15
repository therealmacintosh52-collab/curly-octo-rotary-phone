import type { Metadata } from 'next';
import { SERVICE_IDS, SIZE_CLASS_IDS, bookingConfig, serviceById, sizeClasses, durations, dentMinutes, multiServiceSavingsMin } from '@/config/booking';
import { addDays, formatLocal } from '@/lib/availability/tz';
import { bookingsAffectedByWeather } from '@/lib/admin/schedule';
import { fmtDateTime, fmtTime, localToday } from '@/lib/admin/format';
import { loadOverrides, mergeSettings } from '@/lib/admin/settings';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { addBlackoutAction, addBlockAction, deleteRowAction, resetSettingsAction, saveSettingsAction, toggleWeatherAction } from '../../../_actions/schedule';
import { ActionButton, ActionForm } from '../../../_ui/forms';
import { Badge, Card, Empty, Field, PageHeader, Row, Section } from '../../../_ui';

export const metadata: Metadata = { title: 'Schedule settings' };
export const dynamic = 'force-dynamic';

export default async function ScheduleSettings() {
  await requireStaff();
  const db = repo();
  const today = localToday();
  const [techs, blocks, blackouts, weather, overrides, affected] = await Promise.all([
    db.techs.list({ where: { active: true }, orderBy: 'name' }), db.admin_blocks.list({ ranges: [{ col: 'ends_at', gt: new Date().toISOString() }], orderBy: 'starts_at' }),
    db.blackout_dates.list({ ranges: [{ col: 'date', gte: today }], orderBy: 'date' }), db.weather_flags.list(), loadOverrides(), bookingsAffectedByWeather(),
  ]);
  const eff = mergeSettings(overrides);
  const wf = new Map(weather.map((w) => [w.date, w.reason]));
  const next14 = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const tname = (id: string | null | undefined) => (id ? techs.find((t) => t.id === id)?.name.replace('[OWNER] ', '') ?? 'one tech' : 'Everyone');
  const dl = (date: string) => formatLocal(Date.parse(`${date}T12:00:00Z`), { weekday: 'short', month: 'short', day: 'numeric' }, 'UTC');
  const changed = (a: number, b: number) => (a !== b ? 'border-gold' : '');
  return (
    <>
      <PageHeader title="Schedule settings" back={{ href: '/admin/schedule', label: 'Schedule' }} />

      <Section title="Weather hold (exterior work)">
        <p className="mb-2 text-sm text-[#b9bcc3]">Turn a day on to hide exterior-work slots (dent, polish, coating). Interior-only jobs stay bookable.</p>
        {affected.length > 0 && <p role="alert" className="mb-3 rounded-xl border border-[#6d5622] bg-[#1f1a0e] px-3 py-2 text-sm text-gold-light">{affected.length} existing booking(s) fall on a weather-hold day and include exterior work. Reschedule them from the Schedule tab.</p>}
        <Card>
          {next14.map((d) => {
            const on = wf.has(d);
            return (
              <div key={d} className="adm-row">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{dl(d)}</span>{on && <span className="text-sm text-[#a9cbf2]">Hold on: {wf.get(d)}</span>}</span>
                <ActionForm action={toggleWeatherAction} className="flex items-center gap-2" submit={on ? 'Clear' : 'Hold'} submitClass={on ? 'adm-btn adm-btn-line' : 'adm-btn adm-btn-line'}>
                  <input type="hidden" name="date" value={d} />
                  {!on && <><label htmlFor={`wr-${d}`} className="sr-only">Reason for {dl(d)}</label><select id={`wr-${d}`} name="reason" className="adm-input !min-h-11 !w-28"><option value="rain">Rain</option><option value="heat">Heat</option><option value="wind">Wind</option><option value="smoke">Smoke</option></select></>}
                </ActionForm>
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title="Close a whole day">
        <ActionForm action={addBlackoutAction} submit="Close day" className="space-y-3">
          <Field label="Date" htmlFor="bo-date"><input id="bo-date" name="date" type="date" required min={today} className="adm-input" /></Field>
          <Field label="Who" htmlFor="bo-tech"><select id="bo-tech" name="techId" className="adm-input"><option value="">Everyone</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Reason" htmlFor="bo-reason"><input id="bo-reason" name="reason" maxLength={120} className="adm-input" placeholder="Holiday, trade show…" /></Field>
        </ActionForm>
        <div className="mt-3">{blackouts.length === 0 ? <Empty>No closed days coming up.</Empty> : (
          <Card>{blackouts.map((b) => (
            <div key={b.id} className="adm-row"><span className="flex-1"><span className="block font-semibold">{dl(b.date)}</span><span className="text-sm text-[#a9acb3]">{tname(b.tech_id)}{b.reason ? ` · ${b.reason}` : ''}</span></span>
              <ActionForm action={deleteRowAction} submit="Remove" submitClass="adm-btn adm-btn-line" className="contents"><input type="hidden" name="table" value="blackout_dates" /><input type="hidden" name="id" value={b.id} /></ActionForm></div>
          ))}</Card>
        )}</div>
      </Section>

      <Section title="Block time (appointment, errand)">
        <ActionForm action={addBlockAction} submit="Block time" className="space-y-3">
          <Field label="Who" htmlFor="bl-tech"><select id="bl-tech" name="techId" className="adm-input"><option value="">Everyone</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="bl-start"><input id="bl-start" name="start" type="datetime-local" required className="adm-input" /></Field>
            <Field label="To" htmlFor="bl-end"><input id="bl-end" name="end" type="datetime-local" required className="adm-input" /></Field>
          </div>
          <Field label="Reason" htmlFor="bl-reason"><input id="bl-reason" name="reason" maxLength={120} className="adm-input" /></Field>
        </ActionForm>
        <div className="mt-3">{blocks.length === 0 ? <Empty>No blocks.</Empty> : (
          <Card>{blocks.map((b) => (
            <div key={b.id} className="adm-row"><span className="flex-1"><span className="block font-semibold">{fmtDateTime(b.starts_at)} – {fmtTime(b.ends_at)}</span><span className="text-sm text-[#a9acb3]">{tname(b.tech_id)}{b.reason ? ` · ${b.reason}` : ''}</span></span>
              <ActionForm action={deleteRowAction} submit="Remove" submitClass="adm-btn adm-btn-line" className="contents"><input type="hidden" name="table" value="admin_blocks" /><input type="hidden" name="id" value={b.id} /></ActionForm></div>
          ))}</Card>
        )}</div>
      </Section>

      <Section title="Durations and buffers">
        <p className="mb-3 text-sm text-[#b9bcc3]">Saved values override <code>config/booking.ts</code>; anything you leave at the default keeps following the config. A gold outline means it differs from config.</p>
        <ActionForm action={saveSettingsAction} submit="Save settings" className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buffer between jobs (min)" htmlFor="bufferMin" help={`Config: ${bookingConfig.bufferMin}`}><input id="bufferMin" name="bufferMin" type="number" min={0} max={120} defaultValue={eff.bufferMin} className={`adm-input ${changed(eff.bufferMin, bookingConfig.bufferMin)}`} /></Field>
            <Field label="Max jobs per tech per day" htmlFor="maxJobsPerTechPerDay" help={`Config: ${bookingConfig.maxJobsPerTechPerDay}`}><input id="maxJobsPerTechPerDay" name="maxJobsPerTechPerDay" type="number" min={1} max={12} defaultValue={eff.maxJobsPerTechPerDay} className={`adm-input ${changed(eff.maxJobsPerTechPerDay, bookingConfig.maxJobsPerTechPerDay)}`} /></Field>
            <Field label="Minimum notice (hours)" htmlFor="minLeadHours" help={`Config: ${bookingConfig.minLeadHours}`}><input id="minLeadHours" name="minLeadHours" type="number" min={0} max={168} defaultValue={eff.minLeadHours} className={`adm-input ${changed(eff.minLeadHours, bookingConfig.minLeadHours)}`} /></Field>
            <Field label="Start-time step (min)" htmlFor="slotStepMin" help={`Config: ${bookingConfig.slotStepMin}`}><select id="slotStepMin" name="slotStepMin" defaultValue={String(eff.slotStepMin)} className="adm-input"><option value="15">15</option><option value="30">30</option><option value="60">60</option></select></Field>
            <Field label="Time saved per extra service (min)" htmlFor="multiServiceSavingsMin" help={`Config: ${multiServiceSavingsMin}`}><input id="multiServiceSavingsMin" name="multiServiceSavingsMin" type="number" min={0} max={120} defaultValue={eff.multiServiceSavingsMin} className={`adm-input ${changed(eff.multiServiceSavingsMin, multiServiceSavingsMin)}`} /></Field>
            <div className="grid grid-cols-2 gap-3 col-span-2">
              <Field label="Dent setup (min)" htmlFor="dent.setup" help={`Config: ${dentMinutes.setup}`}><input id="dent.setup" name="dent.setup" type="number" min={0} max={240} defaultValue={eff.dentMinutes.setup} className={`adm-input ${changed(eff.dentMinutes.setup, dentMinutes.setup)}`} /></Field>
              <Field label="Per dented panel (min)" htmlFor="dent.perPanel" help={`Config: ${dentMinutes.perPanel}`}><input id="dent.perPanel" name="dent.perPanel" type="number" min={5} max={240} defaultValue={eff.dentMinutes.perPanel} className={`adm-input ${changed(eff.dentMinutes.perPanel, dentMinutes.perPanel)}`} /></Field>
            </div>
          </div>
          <div className="space-y-4">
            {SERVICE_IDS.map((sv) => (
              <fieldset key={sv} className="adm-card p-4">
                <legend className="px-1 text-sm font-semibold text-gold-light">{serviceById(sv)?.plain} (minutes)</legend>
                <div className="grid grid-cols-5 gap-2">
                  {SIZE_CLASS_IDS.map((sz) => (
                    <div key={sz}><label htmlFor={`d.${sv}.${sz}`} className="mb-1 block text-center text-[0.7rem] text-[#a9acb3]">{sizeClasses.find((s) => s.id === sz)?.label.split(' ')[0]}</label>
                      <input id={`d.${sv}.${sz}`} name={`d.${sv}.${sz}`} type="number" min={15} max={720} step={5} defaultValue={eff.durations[sv][sz]} className={`adm-input !px-2 text-center ${changed(eff.durations[sv][sz], durations[sv][sz])}`} /></div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </ActionForm>
        <div className="mt-3 flex items-center gap-3">
          <ActionButton action={resetSettingsAction} confirm="Reset every duration and buffer to the config defaults?">Reset to config</ActionButton>
          {overrides && Object.keys(overrides).length > 0 ? <Badge tone="gold">Overrides active</Badge> : <Badge>Using config</Badge>}
        </div>
      </Section>
    </>
  );
}

import Link from 'next/link';
import { bookingServices, sizeClasses } from '@/config/booking';
import type { TimelineEntry } from '@/lib/admin/customers';
import { ago, fmtPhone } from '@/lib/admin/format';
import { smsUrl, telUrl } from '@/lib/admin/links';
import type { Note } from '@/lib/db';
import { addNoteAction } from '../_actions/crm';
import { ActionForm } from './forms';
import { Badge, Card, Empty, Field } from './index';

export function ContactButtons({ phone, email }: { phone?: string | null; email?: string | null }) {
  if (!phone && !email) return <p className="px-4 pb-3 text-sm text-[#a9acb3]">No phone or email on file.</p>;
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-4">
      {phone && <a className="adm-btn adm-btn-line flex-1" href={telUrl(phone)} aria-label={`Call ${fmtPhone(phone)}`}>Call {fmtPhone(phone)}</a>}
      {phone && <a className="adm-btn adm-btn-line flex-1" href={smsUrl(phone)} aria-label={`Text ${fmtPhone(phone)}`}>Text</a>}
      {email && <a className="adm-btn adm-btn-line flex-1" href={`mailto:${email}`}>Email</a>}
    </div>
  );
}

export function NoteForm({ entityType, entityId, path }: { entityType: 'customer' | 'lead' | 'vehicle' | 'booking' | 'job'; entityId: string; path: string }) {
  return (
    <ActionForm action={addNoteAction} submit="Add note" className="space-y-3">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="path" value={path} />
      <Field label="New note" htmlFor={`note-${entityId}`}><textarea id={`note-${entityId}`} name="body" required maxLength={2000} className="adm-input" placeholder="Gate code, pet at home, prefers texts…" /></Field>
    </ActionForm>
  );
}

export function NoteList({ notes }: { notes: Note[] }) {
  if (!notes.length) return <p className="text-sm text-[#a9acb3]">No notes yet.</p>;
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl border border-line bg-[#101113] px-3 py-2">
          <p className="whitespace-pre-wrap text-sm text-ivory">{n.body}</p>
          <p className="mt-1 text-xs text-[#8c8f96]">{ago(n.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}

const KIND_TONE: Record<string, 'neutral' | 'gold' | 'green' | 'blue' | 'red'> = { message: 'blue', booking: 'gold', payment: 'green', invoice: 'green', note: 'neutral', lead: 'neutral', quote: 'gold', job: 'blue', pipeline: 'neutral' };

export function Timeline({ entries, limit = 40 }: { entries: TimelineEntry[]; limit?: number }) {
  if (!entries.length) return <Empty>No activity yet.</Empty>;
  return (
    <Card>
      <ol>
        {entries.slice(0, limit).map((e, i) => {
          const body = (
            <>
              <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{e.kind}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ivory">{e.title}</span>
                {e.detail && <span className="block whitespace-pre-wrap break-words text-sm text-[#b9bcc3]">{e.detail}</span>}
              </span>
              <span className="shrink-0 text-xs text-[#8c8f96]">{ago(e.at)}</span>
            </>
          );
          return <li key={`${e.at}-${i}`}>{e.href ? <Link href={e.href} className="adm-row items-start">{body}</Link> : <div className="adm-row items-start">{body}</div>}</li>;
        })}
      </ol>
    </Card>
  );
}

export function ServiceChecks({ selected = [] }: { selected?: string[] }) {
  return (
    <fieldset>
      <legend className="adm-label">Services</legend>
      <div className="grid gap-2">
        {bookingServices.map((s) => (
          <label key={s.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-[#101113] px-3">
            <input type="checkbox" name="services" value={s.id} defaultChecked={selected.includes(s.id)} className="h-5 w-5 accent-[#c9a24a]" />
            <span className="text-sm">{s.plain}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SizeSelect({ id = 'sizeClass', value = 'sedan' }: { id?: string; value?: string }) {
  return (
    <Field label="Vehicle size" htmlFor={id}>
      <select id={id} name="sizeClass" defaultValue={value} className="adm-input">{sizeClasses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
    </Field>
  );
}

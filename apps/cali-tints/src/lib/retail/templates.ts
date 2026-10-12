/**
 * Customer email templates. Each is `{subject, body}` with `{{placeholders}}`;
 * the owner edits them in Settings → Booking. These defaults match what
 * migration 0038 seeds, and are what "Reset" restores.
 */
export type TemplateKey = "estimate_sent" | "hold_created" | "hold_expiring" | "booking_confirmed" | "reminder" | "receipt" | "abandoned" | "cancelled";

export interface Template {
  subject: string;
  body: string;
}

export const TEMPLATE_META: { key: TemplateKey; label: string; when: string; vars: string[] }[] = [
  { key: "estimate_sent", label: "Estimate sent", when: "When you send a quote", vars: ["first_name", "vehicle", "estimate_url", "expires", "company"] },
  { key: "hold_created", label: "Spot held", when: "A customer starts booking online", vars: ["first_name", "vehicle", "starts_at", "hold_minutes", "booking_url", "company"] },
  { key: "hold_expiring", label: "Hold expiring", when: "10 minutes before the hold is released", vars: ["first_name", "vehicle", "starts_at", "booking_url", "company"] },
  { key: "booking_confirmed", label: "Booked", when: "The deposit is paid or you confirm", vars: ["first_name", "vehicle", "starts_at", "address", "manage_url", "company"] },
  { key: "reminder", label: "Reminder", when: "Before the appointment (24 h and 2 h by default)", vars: ["first_name", "vehicle", "starts_at", "manage_url", "company"] },
  { key: "receipt", label: "Receipt", when: "After the job is paid", vars: ["first_name", "vehicle", "receipt_url", "company"] },
  { key: "abandoned", label: "Abandoned booking", when: "A hold expired without a booking", vars: ["first_name", "vehicle", "services", "booking_url", "company"] },
  { key: "cancelled", label: "Cancelled", when: "An appointment is cancelled", vars: ["first_name", "starts_at", "book_url", "company"] },
];

export const DEFAULT_TEMPLATES: Record<TemplateKey, Template> = {
  estimate_sent: { subject: "Your estimate from {{company}}", body: "Hi {{first_name}},\n\nHere is your estimate for the {{vehicle}}: {{estimate_url}}\n\nPick the option you want and approve it there. It is good until {{expires}}.\n\n{{company}}" },
  hold_created: { subject: "Holding your spot for {{hold_minutes}} minutes", body: "Hi {{first_name}},\n\nWe are holding {{starts_at}} for the {{vehicle}}. Finish here within {{hold_minutes}} minutes to keep it: {{booking_url}}\n\n{{company}}" },
  hold_expiring: { subject: "Still holding your spot for 10 more minutes", body: "Hi {{first_name}},\n\nYour {{starts_at}} spot for the {{vehicle}} is held for 10 more minutes: {{booking_url}}\n\n{{company}}" },
  booking_confirmed: { subject: "You are booked: {{starts_at}}", body: "Hi {{first_name}},\n\nThe {{vehicle}} is booked for {{starts_at}} at {{company}}, {{address}}.\n\nNeed to change it? {{manage_url}}\n\n{{company}}" },
  reminder: { subject: "Reminder: {{starts_at}}", body: "Hi {{first_name}},\n\nSee you {{starts_at}} with the {{vehicle}}. Change or cancel here: {{manage_url}}\n\n{{company}}" },
  receipt: { subject: "Your receipt from {{company}}", body: "Hi {{first_name}},\n\nThanks for coming in. Your receipt for the {{vehicle}}: {{receipt_url}}\n\n{{company}}" },
  abandoned: { subject: "Still want that spot?", body: "Hi {{first_name}},\n\nYou started booking the {{vehicle}} for {{services}}. Pick it back up here: {{booking_url}}\n\n{{company}}" },
  cancelled: { subject: "Cancelled: {{starts_at}}", body: "Hi {{first_name}},\n\nYour {{starts_at}} appointment is cancelled. Book again any time: {{book_url}}\n\n{{company}}" },
};

/** Replace `{{name}}` with the value; unknown names are left blank, never leaked as braces. */
export function renderTemplate(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** The template to use: the owner's edit when present and non-empty, else the default. */
export function templateFor(key: TemplateKey, edited: Partial<Record<string, Partial<Template>>> | null | undefined): Template {
  const d = DEFAULT_TEMPLATES[key];
  const e = edited?.[key];
  return { subject: e?.subject?.trim() || d.subject, body: e?.body?.trim() || d.body };
}

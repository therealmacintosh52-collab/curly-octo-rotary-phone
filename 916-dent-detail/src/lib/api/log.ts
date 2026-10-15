// Structured logging with PII redaction. Never log request bodies, names, phones, emails or addresses.
const PII_KEYS = /^(name|full_?name|first_?name|phone|email|address|address_?line|street|notes|customer_?notes|body|text|message|vin|photo|photos|base64|token|secret|authorization|sms_?consent_?text)$/i;

export function redact(v: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 12)}…[${v.length}]` : v;
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => redact(x, depth + 1));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, PII_KEYS.test(k) ? '[redacted]' : redact(val, depth + 1)]));
  }
  return v;
}

export const maskPhone = (p?: string | null) => (p ? `***${p.slice(-4)}` : '');

export function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ level, event, ...(redact(fields) as object) });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

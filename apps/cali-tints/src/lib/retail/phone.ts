/**
 * Phone numbers as the shop types them. Digits are what we match on (mirrors
 * public.phone_digits() in migration 0037); the display form is for screens.
 */

/** Digits only; a leading US country code is dropped. Null when there are none. */
export function phoneDigits(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d || null;
}

/** (916) 555-0100 for ten digits; anything else is returned as typed. */
export function formatPhone(input: string | null | undefined): string {
  if (!input) return "";
  const d = phoneDigits(input);
  if (d && d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return input.trim();
}

/** A phone the database accepts: at least seven digits. */
export function isPhoneShape(input: string | null | undefined): boolean {
  const d = phoneDigits(input);
  return !!d && d.length >= 7 && d.length <= 15;
}

/** tel: link for tap-to-call. */
export function telHref(input: string | null | undefined): string | null {
  const d = phoneDigits(input);
  return d ? `tel:${d.length === 10 ? "+1" + d : d}` : null;
}

/**
 * sms: deep link that opens the phone's own texting app with the number and a
 * prefilled message. iOS wants `&body=` after the number, Android `?body=`.
 */
export function smsHref(input: string | null | undefined, body: string, platform: "ios" | "android" | "unknown" = "unknown"): string | null {
  const d = phoneDigits(input);
  if (!d) return null;
  const to = d.length === 10 ? "+1" + d : d;
  const sep = platform === "ios" ? "&" : "?";
  return body ? `sms:${to}${sep}body=${encodeURIComponent(body)}` : `sms:${to}`;
}

export function detectPlatform(userAgent: string | undefined): "ios" | "android" | "unknown" {
  if (!userAgent) return "unknown";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "unknown";
}

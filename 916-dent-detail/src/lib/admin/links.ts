// Tap-to-act links for the tech view (pure). Phones open these in Maps / Phone / Messages.
export function addressOf(b: { address_line?: string | null; city?: string | null; zip?: string | null }): string {
  return [b.address_line, b.city, b.city || b.address_line ? 'CA' : '', b.zip].filter(Boolean).join(', ').replace(/, CA, (\d{5})$/, ', CA $1');
}
/** Universal https link: opens Google Maps app/web on Android, iOS offers its choice; directions from "current location". */
export const mapsUrl = (addr: string): string => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(addr)}`;
/** Android geo: intent (opens the default map app). */
export const geoUrl = (addr: string): string => `geo:0,0?q=${encodeURIComponent(addr)}`;
export const appleMapsUrl = (addr: string): string => `https://maps.apple.com/?daddr=${encodeURIComponent(addr)}&dirflg=d`;
export const telUrl = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const smsUrl = (phone: string, body?: string): string => `sms:${phone.replace(/[^\d+]/g, '')}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;

/** Postal address lines for a company or dealership; shared by server renderers and public pages. */
export function formatAddress(a: { address_line1: string | null; address_line2?: string | null; city: string | null; state: string | null; postal_code: string | null }): string[] {
  const lines: string[] = [];
  if (a.address_line1) lines.push(a.address_line1);
  if (a.address_line2) lines.push(a.address_line2);
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

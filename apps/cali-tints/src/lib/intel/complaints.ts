import type { Complaint } from "./types";

export interface ComponentGroup {
  component: string;
  count: number;
  crashes: number;
  fires: number;
  injuries: number;
  complaints: Complaint[];
}

/** Groups complaints by their primary NHTSA component (first listed). */
export function groupByComponent(complaints: Complaint[]): ComponentGroup[] {
  const map = new Map<string, ComponentGroup>();
  for (const c of complaints) {
    const primary = (c.components[0] ?? "UNKNOWN").toUpperCase();
    let g = map.get(primary);
    if (!g) {
      g = { component: primary, count: 0, crashes: 0, fires: 0, injuries: 0, complaints: [] };
      map.set(primary, g);
    }
    g.count += 1;
    if (c.crash) g.crashes += 1;
    if (c.fire) g.fires += 1;
    g.injuries += c.injuries;
    g.complaints.push(c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.component.localeCompare(b.component));
}

export interface TrendPoint {
  year: number;
  count: number;
}

/** Complaints per calendar year (by filing date, falling back to incident date), gaps filled. */
export function trendByYear(complaints: Complaint[]): TrendPoint[] {
  const counts = new Map<number, number>();
  for (const c of complaints) {
    const d = c.dateComplaintFiled ?? c.dateOfIncident;
    if (!d) continue;
    const y = Number(d.slice(0, 4));
    if (!Number.isFinite(y) || y < 1990) continue;
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const years = [...counts.keys()].sort((a, b) => a - b);
  if (!years.length) return [];
  const out: TrendPoint[] = [];
  for (let y = years[0]; y <= years[years.length - 1]; y++) out.push({ year: y, count: counts.get(y) ?? 0 });
  return out;
}

/** Complaints whose NHTSA component matches a trouble-code system (see dtc-systems.ts). */
export function complaintsForComponents(complaints: Complaint[], componentPatterns: RegExp[]): Complaint[] {
  if (!componentPatterns.length) return [];
  return complaints.filter((c) => c.components.some((comp) => componentPatterns.some((p) => p.test(comp))));
}

export function searchComplaints(complaints: Complaint[], terms: string[]): Complaint[] {
  const t = terms.map((s) => s.toLowerCase()).filter(Boolean);
  if (!t.length) return [];
  return complaints.filter((c) => {
    const text = c.summary.toLowerCase();
    return t.some((term) => text.includes(term));
  });
}

/** The complaints that touch a code's system: by summary keywords first, then by component; deduplicated, capped. */
export function relatedComplaints(complaints: Complaint[], componentPatterns: RegExp[], terms: string[], limit = 25): Complaint[] {
  const byTerm = searchComplaints(complaints, terms);
  const byComponent = complaintsForComponents(complaints, componentPatterns);
  const seen = new Set<string>();
  return [...byTerm, ...byComponent].filter((c) => (seen.has(c.odiNumber) ? false : (seen.add(c.odiNumber), true))).slice(0, limit);
}

/**
 * An estimate's lines are itemized under Diagnosis and Repairs (diagnosis
 * first). The views show a small heading where the section changes, and only
 * when there is a diagnosis to separate from the repairs.
 */
export function sectionHeading(lines: { section?: string }[], i: number): string | null {
  if (!lines.some((l) => l.section === "diagnosis")) return null;
  const of = (l: { section?: string }) => (l.section === "diagnosis" ? "diagnosis" : "repair");
  const cur = of(lines[i]);
  const prev = i > 0 ? of(lines[i - 1]) : null;
  if (cur === prev) return null;
  return cur === "diagnosis" ? "Diagnosis" : "Repairs";
}

/** Diagnosis lines first, otherwise the order they were added in. */
export function diagnosisFirst<T extends { section?: string }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => (a.section === "diagnosis" ? 0 : 1) - (b.section === "diagnosis" ? 0 : 1));
}

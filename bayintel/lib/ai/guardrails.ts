import { NOT_IN_DATABASE } from "@/lib/config";

/**
 * Output guardrails. The model is told never to produce torque specs, fluid
 * capacities, wiring pinouts, connector IDs or calibration values; this scrubs
 * anything that slips through so the UI never shows an invented number.
 */

const NUM = "\\d+(?:[.,]\\d+)?";
const RANGE = `${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?`;

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "torque spec", re: new RegExp(`\\b${RANGE}\\s*(?:ft[-\\s.·]?lbs?|lb[-\\s.·]?ft|in[-\\s.·]?lbs?|lb[-\\s.·]?in|n[·.-]?m\\b|newton[-\\s]?met(?:er|re)s?)\\b`, "gi") },
  { label: "torque spec", re: /\b(?:torque(?:d)?\s+(?:to|spec(?:ification)?)[:\s]+)\d[^.;\n]*/gi },
  { label: "fluid capacity", re: new RegExp(`\\b${RANGE}\\s*(?:quarts?|qts?|liters?|litres?|gallons?|gal|m[lL]|fl\\.?\\s*oz|ounces?)\\b(?:\\s+of\\s+[a-z]+)?`, "gi") },
  { label: "fluid capacity", re: /\bcapacity\s*(?:is|of|:)\s*\d[^.;\n]*/gi },
  { label: "wiring pinout", re: /\b(?:pin|terminal|cavity)\s*#?\s*[A-Z]?\d{1,3}\b/gi },
  { label: "connector id", re: /\bconnector\s+[A-Z]{1,2}\d{2,4}[A-Z]?\b/gi },
  { label: "connector id", re: /\b[CX]\d{3,4}(?:-\d+)?\b(?=[^\w]|$)/g },
  { label: "wire color code", re: /\b(?:wire\s+colou?r|colou?r\s+code)[:\s]+[A-Z]{2,3}(?:\/[A-Z]{2,3})?\b/gi },
  { label: "calibration value", re: new RegExp(`\\b(?:gap|clearance|lash|preload|end[-\\s]?play|runout)\\s*(?:of|is|should\\s+be|spec(?:ification)?s?)?[:\\s]*${RANGE}\\s*(?:in(?:ch(?:es)?)?|"|mm|thou|mils?)\\b`, "gi") },
  { label: "pressure spec", re: new RegExp(`\\b(?:should\\s+(?:be|read)|spec(?:ification)?s?\\s*(?:is|of|:)?|within|between)\\s*${RANGE}\\s*(?:psi|kpa|bar|in[-\\s]?hg)\\b`, "gi") },
  { label: "resistance/voltage spec", re: new RegExp(`\\b(?:should\\s+(?:be|read|measure)|spec(?:ification)?s?\\s*(?:is|of|:)?|within|between)\\s*${RANGE}\\s*(?:ohms?|Ω|k\\s?ohms?|kΩ|volts?|v\\b|mv\\b|amps?|ma\\b)`, "gi") },
];

export interface ScrubResult {
  text: string;
  redactions: string[];
}

export function scrubSpecValues(text: string, allowLicensed = false): ScrubResult {
  if (allowLicensed) return { text, redactions: [] };
  const redactions: string[] = [];
  let out = text;
  for (const { label, re } of PATTERNS) {
    out = out.replace(re, (m) => {
      redactions.push(`${label}: "${m.trim()}"`);
      return `[${NOT_IN_DATABASE}]`;
    });
  }
  return { text: out, redactions };
}

/** Walks a diagnosis object and scrubs every free-text field. */
export function scrubDiagnosis<T>(value: T, redactions: string[] = []): { value: T; redactions: string[] } {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = scrubSpecValues(v);
      redactions.push(...r.redactions);
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "citations" ? x : walk(x)]));
    return v;
  };
  return { value: walk(value) as T, redactions };
}

const SAFETY_TERMS: { system: string; re: RegExp; note: string }[] = [
  { system: "Brakes", re: /\b(brake|abs\b|master cylinder|caliper|rotor|brake pad|hydraulic)/i, note: "Brake system involved. Verify repair procedures in OEM service information and road-test in a safe area before return." },
  { system: "SRS / airbag", re: /\b(srs|airbag|air bag|pretensioner|occupant|clockspring|restraint)/i, note: "Supplemental restraint system. Follow OEM disable and wait procedures before working near SRS components." },
  { system: "Steering", re: /\b(steering|eps\b|power steering|tie rod|rack and pinion|steering angle)/i, note: "Steering system involved. Verify alignment and OEM procedures; a steering fault affects vehicle control." },
  { system: "EV high voltage", re: /\b(high[-\s]?voltage|hv battery|hybrid battery|battery pack|inverter|orange cable|traction battery|p0a[0-9a-f]{2}|ev\b|plug-in)/i, note: "High-voltage system. Only trained technicians with HV PPE and OEM de-energize/verify procedures should proceed." },
  { system: "Fuel system", re: /\b(fuel (?:line|rail|pump|injector|pressure|leak)|gasoline leak)/i, note: "Fuel under pressure. Relieve pressure per OEM procedure, no ignition sources, verify for leaks before return." },
];

export function detectSafetyFlags(texts: string[]): { system: string; note: string }[] {
  const joined = texts.join("\n");
  return SAFETY_TERMS.filter((t) => t.re.test(joined)).map(({ system, note }) => ({ system, note }));
}

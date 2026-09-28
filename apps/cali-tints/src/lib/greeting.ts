/** Hour of the day (0–23) in a timezone; the local hour when the zone is unknown. */
export function hourIn(tz: string, now: Date = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)) % 24;
  } catch {
    return now.getHours();
  }
}

/** Morning until noon, afternoon until 5 pm, evening after. */
export function dayPart(tz: string, now: Date = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = hourIn(tz, now);
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Good morning, Mike." from the hour in the company timezone and the signed-in person's first name. */
export function greetingFor(fullName: string, tz: string, now: Date = new Date()): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  const part = dayPart(tz, now);
  return first ? `${part}, ${first}.` : `${part}.`;
}

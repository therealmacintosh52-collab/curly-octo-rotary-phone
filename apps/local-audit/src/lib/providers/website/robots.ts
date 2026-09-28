/**
 * Minimal robots.txt: user-agent groups with Allow/Disallow, longest-match
 * precedence (the Google/RFC 9309 reading). We never fetch a path the file
 * forbids for our agent token or for `*`.
 */
export interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && value === "") continue; // "Disallow:" = allow all
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  return groups;
}

function matches(rulePath: string, path: string): boolean {
  // Support the two common wildcards: * and trailing $.
  const anchored = rulePath.endsWith("$");
  const body = anchored ? rulePath.slice(0, -1) : rulePath;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

export function isAllowed(groups: RobotsGroup[], userAgentToken: string, path: string): boolean {
  const token = userAgentToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; length: number } | null = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (!matches(r.path, path)) continue;
      const length = r.path.length;
      if (!best || length > best.length || (length === best.length && r.allow && !best.allow)) best = { allow: r.allow, length };
    }
  }
  return best ? best.allow : true;
}

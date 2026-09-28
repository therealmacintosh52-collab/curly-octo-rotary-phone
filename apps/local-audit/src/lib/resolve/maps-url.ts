/**
 * Google Maps URL understanding. Google never documents these shapes; each
 * parser here is best-effort and everything it finds is confirmed against the
 * Places API before it is trusted.
 */
export interface MapsUrlInfo {
  /** From /maps/place/<name>/ or ?q= */
  name?: string;
  lat?: number;
  lng?: number;
  /** ChIJ… when the URL carries one (`?q=place_id:` or `!1sChIJ…`). */
  placeId?: string;
  /** Legacy numeric id (`?cid=`). */
  cid?: string;
  /** Feature id `0x…:0x…` from `!1s`. */
  ftid?: string;
  /** Knowledge graph id `/g/…` or `/m/…` from `!16s`. */
  kgId?: string;
  /** Free-text query when the URL is a search rather than a place. */
  query?: string;
}

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co", "g.page"]);

export function isMapsShortLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  return SHORT_HOSTS.has(host);
}

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseMapsUrl(url: URL): MapsUrlInfo | null {
  const host = url.hostname.toLowerCase();
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(host);
  if (!isGoogle) return null;
  const path = decodeURIComponent(url.pathname);
  const info: MapsUrlInfo = {};

  const place = path.match(/\/maps\/place\/([^/]+)/);
  if (place) info.name = place[1]!.replace(/\+/g, " ").trim();

  const at = path.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    info.lat = num(at[1]);
    info.lng = num(at[2]);
  }

  // The data= blob carries the precise pin and the ids.
  const data = url.searchParams.get("data") ?? path.match(/\/data=(.+)$/)?.[1] ?? "";
  const d3 = data.match(/!3d(-?\d+(?:\.\d+)?)/);
  const d4 = data.match(/!4d(-?\d+(?:\.\d+)?)/);
  if (d3 && d4) {
    info.lat = num(d3[1]);
    info.lng = num(d4[1]);
  }
  const ftid = data.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (ftid) info.ftid = ftid[1];
  const pid = data.match(/!1s(ChIJ[A-Za-z0-9_-]+)/) ?? data.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
  if (pid) info.placeId = pid[1];
  const kg = data.match(/!16s(\/[gm]\/[A-Za-z0-9_]+)/);
  if (kg) info.kgId = kg[1];

  const q = url.searchParams.get("q") ?? url.searchParams.get("query");
  if (q) {
    const m = q.match(/^place_id:(ChIJ[A-Za-z0-9_-]+)$/);
    if (m) info.placeId = m[1];
    else {
      const coords = q.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
      if (coords) {
        info.lat = num(coords[1]);
        info.lng = num(coords[2]);
      } else info.query = q.replace(/\+/g, " ").trim();
    }
  }
  const qpid = url.searchParams.get("query_place_id") ?? url.searchParams.get("place_id");
  if (qpid) info.placeId = qpid;
  const cid = url.searchParams.get("cid") ?? url.searchParams.get("ludocid");
  if (cid) info.cid = cid;

  const search = path.match(/\/maps\/search\/([^/]+)/);
  if (search && !info.query) info.query = search[1]!.replace(/\+/g, " ").trim();

  if (!info.name && !info.placeId && !info.cid && !info.ftid && !info.query && info.lat === undefined) {
    // A generic /maps URL with nothing to go on.
    return url.pathname.startsWith("/maps") ? {} : null;
  }
  return info;
}

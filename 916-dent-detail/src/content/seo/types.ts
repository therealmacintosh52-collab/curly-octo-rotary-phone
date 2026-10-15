// Typed content shapes for Phase 6 pages. Content files import only types from here (type-only
// imports are erased), so scripts/check-similarity.mjs can load them with Node's type stripping.

export type Faq = { q: string; a: string };
export type Step = { title: string; body: string };

/** One titled block of a service page. `kind` only changes styling (limits = honesty card). */
export type Section = {
  id: string;
  kind?: 'plain' | 'steps' | 'limits';
  h2: string;
  paras?: string[];
  bullets?: string[];
  steps?: Step[];
  after?: string[]; // paragraphs rendered after bullets/steps
};

export type ServiceIconName = 'dent' | 'hail' | 'swirl' | 'shield' | 'clay' | 'seat';

export type ServiceDoc = {
  slug: string;
  plain: string; // customer-facing name (plain-language rule)
  term: string; // real trade term (H2, schema, FAQ)
  title: string; // <title>, full string, leads with service + Sacramento
  description: string; // meta description, <=155 chars
  h1: string;
  lede: string;
  icon: ServiceIconName;
  /** key into serviceFromPrice (src/config/pricing.ts) or null when the service has no config price */
  priceKey: string | null;
  priceNote: string; // shown when the config price is empty / not applicable
  typicalTime: string; // hedged, general
  sections: Section[];
  faqs: Faq[];
  related: string[]; // service slugs
  blogs: string[]; // blog slugs
  cities: string[]; // city slugs to link
};

export type CityPlace = { name: string; note?: string; sourced: boolean };

export type CityDoc = {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  /** qualitative travel band from the base ZIP; never a number we cannot back */
  distance: 'home-base' | 'near' | 'mid' | 'far';
  driveNote: string;
  places: CityPlace[]; // sourced:false items are listed in TODO "[OWNER] map-check"
  sections: { id: string; h2: string; paras: string[]; bullets?: string[] }[];
  jobs: { job: string; service: string; why: string }[]; // service = service slug
  faqs: Faq[];
  neighbors: string[]; // city slugs
  blogs: string[];
  services: string[]; // service slugs to emphasise
};

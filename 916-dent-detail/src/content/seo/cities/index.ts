import type { CityDoc } from '../types';
import { sacramento, elkGrove, roseville } from './core.ts';
import { folsom, ranchoCordova, citrusHeights, natomas } from './east.ts';
import { westSacramento, davis, carmichael, graniteBay } from './outer.ts';
import { elDoradoHills, lincoln, rocklin } from './far.ts';

// Order matches the spec list.
export const cityDocs: CityDoc[] = [
  sacramento, elkGrove, roseville, folsom, ranchoCordova, citrusHeights, natomas,
  westSacramento, davis, carmichael, graniteBay, elDoradoHills, lincoln, rocklin,
];

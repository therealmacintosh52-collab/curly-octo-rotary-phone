import type { ServiceDoc } from '../types';
import { paintlessDentRepair } from './paintless-dent-repair.ts';
import { doorDingRepair } from './door-ding-repair.ts';
import { hailDamageRepair } from './hail-damage-repair.ts';
import { mobileDetailing } from './mobile-detailing.ts';
import { interiorDetailing } from './interior-detailing.ts';
import { paintCorrection } from './paint-correction.ts';
import { ceramicCoating } from './ceramic-coating.ts';
import { headlightRestoration } from './headlight-restoration.ts';
import { dealershipRecon } from './dealership-recon.ts';

export const serviceDocs: ServiceDoc[] = [
  paintlessDentRepair,
  doorDingRepair,
  hailDamageRepair,
  mobileDetailing,
  interiorDetailing,
  paintCorrection,
  ceramicCoating,
  headlightRestoration,
  dealershipRecon,
];

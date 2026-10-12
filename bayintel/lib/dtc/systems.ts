/**
 * Maps the seeded dtc_codes.system buckets to NHTSA complaint component names,
 * so a DTC lookup can surface the owner complaints that touch the same system.
 */
export const DTC_SYSTEM_LABELS: Record<string, string> = {
  fuel_air: "Fuel & air metering",
  ignition_misfire: "Ignition & misfire",
  emissions: "Emissions (EVAP, O2, catalyst, EGR)",
  vvt: "Variable valve timing",
  cooling: "Cooling",
  lubrication: "Lubrication",
  charging: "Charging & voltage",
  transmission: "Transmission",
  speed_idle: "Speed & idle control",
  computer: "Control module",
  hybrid_ev: "Hybrid / EV high voltage",
  body: "Body / restraints",
  chassis: "Chassis / ABS / steering",
  network: "Network communication",
};

export const DTC_SYSTEM_COMPONENTS: Record<string, RegExp[]> = {
  fuel_air: [/FUEL/i, /ENGINE/i, /AIR/i],
  ignition_misfire: [/ENGINE/i, /ELECTRICAL/i],
  emissions: [/EXHAUST/i, /FUEL/i, /ENGINE/i],
  vvt: [/ENGINE/i],
  cooling: [/ENGINE.*COOLING/i, /COOLING/i, /ENGINE/i],
  lubrication: [/ENGINE/i],
  charging: [/ELECTRICAL/i],
  transmission: [/POWER TRAIN/i, /TRANSMISSION/i],
  speed_idle: [/ENGINE/i, /VEHICLE SPEED/i],
  computer: [/ELECTRICAL/i, /ENGINE/i],
  hybrid_ev: [/ELECTRICAL/i, /HYBRID/i, /BATTERY/i, /PROPULSION/i],
  body: [/AIR BAG/i, /SEAT BELT/i, /STRUCTURE/i, /ELECTRICAL/i],
  chassis: [/BRAKES/i, /STEERING/i, /SUSPENSION/i, /WHEELS/i, /TRACTION/i, /STABILITY/i],
  network: [/ELECTRICAL/i],
};

/** Keyword hints that should also pull complaints by summary text. */
export const DTC_SYSTEM_TERMS: Record<string, string[]> = {
  fuel_air: ["lean", "stall", "hesitat", "fuel pump", "throttle"],
  ignition_misfire: ["misfire", "shak", "rough idle", "stall", "coil", "spark"],
  emissions: ["check engine", "evap", "catalytic", "oxygen", "o2 sensor", "emission"],
  vvt: ["rattle", "timing chain", "phaser", "tick"],
  cooling: ["overheat", "coolant", "thermostat", "temperature"],
  lubrication: ["oil pressure", "oil consumption", "lifter", "tick"],
  charging: ["battery", "alternator", "dead", "won't start", "no start"],
  transmission: ["transmission", "shudder", "slip", "jerk", "cvt", "shift"],
  speed_idle: ["idle", "surge", "stall"],
  computer: ["module", "computer", "stall"],
  hybrid_ev: ["hybrid", "high voltage", "battery", "propulsion"],
  body: ["air bag", "airbag", "seat belt", "srs"],
  chassis: ["brake", "abs", "steering", "pull", "wheel speed"],
  network: ["warning lights", "dash lights", "communication", "module"],
};

export const SAFETY_FLAG_LABELS: Record<string, { label: string; note: string }> = {
  brakes: { label: "Brake system", note: "Brake work affects stopping. Verify procedures in OEM service information and road-test safely." },
  srs: { label: "SRS / airbag", note: "Supplemental restraint components can deploy unexpectedly. Follow OEM disable procedures before service." },
  steering: { label: "Steering", note: "Steering faults affect vehicle control. Verify in OEM service information before returning the vehicle." },
  ev_high_voltage: { label: "EV high voltage", note: "High-voltage system. Only trained technicians with proper PPE and OEM de-energize procedures should proceed." },
};

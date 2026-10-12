import type {
  LaborProvider,
  LaborTime,
  MaintenanceItem,
  MaintenanceProvider,
  RepairArticle,
  RepairInfoProvider,
  VehicleKey,
} from "./types";

/**
 * Stub adapters. They return clearly labeled SAMPLE data so the UI, estimate
 * flow and AI retrieval have something to render until a licensed provider
 * (MOTOR, CarMD, ...) is wired in behind the same interface.
 */

const SAMPLE_LABOR: Record<string, number> = {
  "spark plugs": 1.2,
  "ignition coil": 0.5,
  "oxygen sensor": 0.6,
  "thermostat": 1.3,
  "pcv valve": 0.5,
  "purge valve": 0.6,
  "vent solenoid": 0.7,
  "mass airflow sensor": 0.4,
  "crankshaft position sensor": 1.0,
  "camshaft position sensor": 0.6,
  "catalytic converter": 1.8,
  "torque converter": 6.0,
  "afm lifters": 11.0,
  "vct phasers": 7.5,
  "oil change": 0.4,
  "brake pads and rotors (front)": 1.4,
  "brake pads and rotors (rear)": 1.4,
  "battery": 0.3,
  "alternator": 1.5,
  "water pump": 2.5,
  "serpentine belt": 0.5,
};

export const sampleLaborProvider: LaborProvider = {
  name: "Sample Labor Guide",
  source: "SAMPLE",
  async getLaborTime(_key: VehicleKey, operation: string): Promise<LaborTime | null> {
    const op = operation.trim().toLowerCase();
    const match = Object.keys(SAMPLE_LABOR).find((k) => op.includes(k) || k.includes(op));
    if (!match) return null;
    return { source: "SAMPLE", operation: match, hours: SAMPLE_LABOR[match], notes: "Sample value for layout only. Enter actual time." };
  },
  async searchOperations(_key: VehicleKey, query: string): Promise<LaborTime[]> {
    const q = query.trim().toLowerCase();
    return Object.entries(SAMPLE_LABOR)
      .filter(([k]) => !q || k.includes(q))
      .slice(0, 10)
      .map(([operation, hours]) => ({ source: "SAMPLE", operation, hours, notes: "Sample value for layout only." }));
  },
};

export const sampleRepairInfoProvider: RepairInfoProvider = {
  name: "Sample Repair Info",
  source: "SAMPLE",
  async search(key: VehicleKey, opts): Promise<RepairArticle[]> {
    const dtcs = (opts.dtcs ?? []).map((d) => d.toUpperCase());
    const articles: RepairArticle[] = [
      {
        source: "SAMPLE",
        id: "sample-tsb-1",
        kind: "tsb",
        title: `[SAMPLE] Placeholder bulletin for ${key.year} ${key.make} ${key.model}`,
        summary:
          "This is a sample placeholder showing where licensed technical service bulletins will appear. No OEM content is reproduced.",
        systems: ["engine"],
        dtcs: dtcs.slice(0, 2),
      },
    ];
    return articles;
  },
};

export const sampleMaintenanceProvider: MaintenanceProvider = {
  name: "Sample Maintenance Schedule",
  source: "SAMPLE",
  async getSchedule(): Promise<MaintenanceItem[]> {
    return [
      { source: "SAMPLE", intervalMiles: 5000, intervalMonths: 6, service: "Engine oil and filter", notes: "Sample interval. Verify in owner's manual." },
      { source: "SAMPLE", intervalMiles: 15000, intervalMonths: 12, service: "Engine air filter, cabin filter" },
      { source: "SAMPLE", intervalMiles: 30000, intervalMonths: 24, service: "Brake fluid, inspect brakes" },
      { source: "SAMPLE", intervalMiles: 60000, intervalMonths: 48, service: "Spark plugs (conventional), transmission fluid" },
      { source: "SAMPLE", intervalMiles: 100000, intervalMonths: 84, service: "Spark plugs (iridium), coolant" },
    ];
  },
};

import "server-only";
import { nhtsaProvider } from "./nhtsa";
import { sampleLaborProvider, sampleMaintenanceProvider, sampleRepairInfoProvider } from "./stubs";
import type { LaborProvider, MaintenanceProvider, RepairInfoProvider, VehicleDataProvider } from "./types";

/**
 * Provider registry. Swap an entry here (or branch on env) to bring a licensed
 * provider online; the UI only ever sees the interfaces.
 */
export interface Providers {
  vehicle: VehicleDataProvider;
  labor: LaborProvider;
  repairInfo: RepairInfoProvider;
  maintenance: MaintenanceProvider;
}

export function getProviders(): Providers {
  return {
    vehicle: nhtsaProvider,
    labor: sampleLaborProvider,
    repairInfo: sampleRepairInfoProvider,
    maintenance: sampleMaintenanceProvider,
  };
}

export * from "./types";

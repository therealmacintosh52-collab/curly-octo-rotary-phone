/**
 * Pricing size classes for retail work. A car is priced by how big it is, not
 * by its badge: compact / sedan / SUV-truck / XL. The class is auto-assigned
 * from the NHTSA vPIC "Body Class" the VIN decode returns and stays editable
 * on the vehicle. Mirrors public.size_class_for_body() in migration 0037;
 * keep the two in step (both are tested).
 */
export type VehicleSize = "compact" | "sedan" | "suv_truck" | "xl";

export const SIZE_CLASSES: { value: VehicleSize; label: string; hint: string }[] = [
  { value: "compact", label: "Compact", hint: "Hatchback, coupe, convertible" },
  { value: "sedan", label: "Sedan", hint: "Sedan, wagon" },
  { value: "suv_truck", label: "SUV / truck", hint: "SUV, crossover, pickup" },
  { value: "xl", label: "XL", hint: "Van, 3-row, cargo, heavy" },
];

export const SIZE_LABEL: Record<VehicleSize, string> = { compact: "Compact", sedan: "Sedan", suv_truck: "SUV / truck", xl: "XL" };

export function sizeClassForBody(body: string | null | undefined): VehicleSize {
  if (!body) return "sedan";
  const b = body.toLowerCase();
  if (/(bus|motorhome|cargo|step van|cutaway|chassis|incomplete|heavy|limousine)/.test(b)) return "xl";
  if (/(^van|\bvan\b|minivan)/.test(b)) return "xl";
  if (/(sport utility|suv|crossover|cuv|pickup|truck|off-road)/.test(b)) return "suv_truck";
  if (/(hatchback|liftback|coupe|convertible|cabriolet|roadster|targa)/.test(b)) return "compact";
  return "sedan";
}

export function isVehicleSize(v: unknown): v is VehicleSize {
  return v === "compact" || v === "sedan" || v === "suv_truck" || v === "xl";
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, parseBody, requireUser } from "@/lib/api";
import { getProviders } from "@/lib/providers";
import { decodeIsUsable } from "@/lib/providers/nhtsa-parse";
import { isValidVinFormat, vinCheckDigitOk } from "@/lib/vin";
import { normalizeVin } from "@/lib/utils";

const Body = z.object({ vin: z.string().min(11).max(20) });

export async function POST(req: Request) {
  try {
    await requireUser();
    const { vin: raw } = await parseBody(req, Body);
    const vin = normalizeVin(raw);
    if (!isValidVinFormat(vin)) return NextResponse.json({ error: "A VIN is 17 characters and never contains I, O or Q." }, { status: 400 });
    const decoded = await getProviders().vehicle.decodeVin(vin);
    const usable = decodeIsUsable(decoded);
    return NextResponse.json({ decoded, usable, checkDigitOk: vinCheckDigitOk(vin) });
  } catch (e) {
    return handleError(e);
  }
}

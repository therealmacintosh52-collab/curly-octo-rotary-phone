"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, SearchIcon } from "lucide-react";
import type { RecentLookup } from "@/lib/db/types";
import { parseDtcList } from "@/lib/intel/dtc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface VehicleOption {
  id: string;
  label: string;
}

/** The Codes screen's form: codes (space or comma separated) and an optional car to rank against. */
export function DtcLookup({ vehicles, initialCodes, initialVehicle, recent }: { vehicles: VehicleOption[]; initialCodes: string; initialVehicle: string; recent?: RecentLookup[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [vehicle, setVehicle] = useState(initialVehicle);
  const parsed = parseDtcList(codes);
  const go = (list: string[], veh: string) => {
    const sp = new URLSearchParams();
    if (list.length) sp.set("codes", list.join(","));
    if (veh) sp.set("vehicle", veh);
    router.push(`/intel/dtc?${sp.toString()}`);
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed.length) go(parsed, vehicle);
          }}
          data-testid="dtc-form"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dtc-codes">Trouble codes</Label>
              <Input id="dtc-codes" value={codes} onChange={(e) => setCodes(e.target.value.toUpperCase())} placeholder="P0300 P0171 U0100" className="h-11 font-mono uppercase" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search" data-testid="dtc-codes" />
              <p className="mt-1 text-caption text-muted-foreground">Spaces or commas between codes.</p>
            </div>
            <div>
              <Label htmlFor="dtc-vehicle">Car (optional: ranks the shop&apos;s fixes and pulls its complaints)</Label>
              <Select value={vehicle || "any"} onValueChange={(v) => setVehicle(v === "any" ? "" : v)}>
                <SelectTrigger id="dtc-vehicle" className="h-11" data-testid="dtc-vehicle">
                  <SelectValue placeholder="Any car" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any car</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="h-11" disabled={!parsed.length} data-testid="dtc-submit">
            <SearchIcon /> Look up
          </Button>
        </form>
        {recent && recent.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5" data-testid="intel-recent">
            <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
              <ClockIcon className="size-3.5" /> Recent
            </span>
            {recent.map((r) => (
              <Link
                key={`${r.kind}:${r.query}`}
                href={r.kind === "code" ? `/intel/dtc?codes=${encodeURIComponent(r.query)}` : `/intel/garage?vin=${encodeURIComponent(r.query)}`}
                className="inline-flex h-8 items-center rounded-full border border-border px-3 font-mono text-caption hover:bg-accent"
              >
                {r.query}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

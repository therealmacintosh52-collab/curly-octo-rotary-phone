"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { parseDtcList } from "@/lib/utils";

export interface GarageOption {
  id: string;
  label: string;
}

export function DtcForm({ vehicles, initialCodes, initialVehicle }: { vehicles: GarageOption[]; initialCodes: string; initialVehicle: string }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [vehicle, setVehicle] = useState(initialVehicle);
  const parsed = parseDtcList(codes);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams();
        if (parsed.length) sp.set("codes", parsed.join(","));
        if (vehicle) sp.set("vehicle", vehicle);
        router.push(`/dtc?${sp.toString()}`);
      }}
    >
      <div>
        <Label htmlFor="codes">Trouble codes</Label>
        <div className="flex gap-2">
          <Input
            id="codes"
            value={codes}
            onChange={(e) => setCodes(e.target.value.toUpperCase())}
            placeholder="P0300 P0171 U0100"
            className="font-mono uppercase"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <Button type="submit" size="icon" aria-label="Look up" disabled={!parsed.length}>
            <Search />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Separate multiple codes with spaces or commas.</p>
      </div>
      <div>
        <Label htmlFor="vehicle">Vehicle (optional, ranks fixes for that YMME)</Label>
        <Select id="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
    </form>
  );
}

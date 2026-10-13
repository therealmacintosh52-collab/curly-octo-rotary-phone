"use client";

import { useState } from "react";
import { ScanSearchIcon, SearchIcon } from "lucide-react";
import { openRetail } from "@/lib/intel/bridge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** "P0300", "p0300 c1234" → the codes; a 17-character VIN → the VIN; anything else → the garage. */
export function intelPathFor(raw: string): string {
  const q = raw.trim().toUpperCase();
  if (!q) return "/garage";
  const codes = q.split(/[\s,;]+/).filter((c) => /^[PBCU][0-9A-F]{4}$/.test(c));
  if (codes.length) return `/dtc?codes=${encodeURIComponent(codes.join(","))}`;
  const vin = q.replace(/[^A-Z0-9]/g, "");
  if (vin.length === 17 && !/[IOQ]/.test(vin)) return `/garage?vin=${vin}`;
  return "/garage";
}

/**
 * The shop's door into BayIntel on the home dashboard and on Retail → Today:
 * a lookup box (a VIN or trouble codes) and the garage. It sits apart from the
 * dealership numbers on purpose; BayIntel is the shop's tool.
 */
export function IntelCard({ className, eyebrow = "The shop" }: { className?: string; eyebrow?: string }) {
  const [q, setQ] = useState("");
  const go = (path: string) => {
    openRetail(path);
  };
  return (
    <Card className={cn("border-primary/30", className)} data-testid="intel-card">
      <CardHeader>
        <div className="text-label text-subtle">{eyebrow}</div>
        <CardTitle className="flex items-center gap-2">
          <ScanSearchIcon className="size-4 text-primary" /> BayIntel
        </CardTitle>
        <p className="text-sm text-muted-foreground">Repair intelligence for the shop&apos;s cars: trouble codes, confirmed fixes, recalls and the garage. Opens here in a window; it has its own sign-in.</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            go(intelPathFor(q));
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="VIN or a code, e.g. P0300" aria-label="VIN or trouble code" className="h-11 font-mono sm:flex-1" data-testid="intel-card-query" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 flex-1 sm:flex-none" data-testid="intel-card-lookup">
              <SearchIcon /> Look up
            </Button>
            <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => go("/garage")} data-testid="intel-card-open">
              <ScanSearchIcon /> Open the garage
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

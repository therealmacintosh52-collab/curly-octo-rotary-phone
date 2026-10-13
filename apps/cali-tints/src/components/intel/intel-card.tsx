"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanSearchIcon, SearchIcon } from "lucide-react";
import { intelPathFor } from "@/lib/intel/dtc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The shop's door into Intel on the home dashboard and on Retail → Today:
 * a lookup box (a VIN or trouble codes) and the garage. It sits apart from
 * the dealership numbers on purpose; Intel is the shop's tool.
 */
export function IntelCard({ className, eyebrow = "The shop" }: { className?: string; eyebrow?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <Card className={cn("border-primary/30", className)} data-testid="intel-card">
      <CardHeader>
        <div className="text-label text-subtle">{eyebrow}</div>
        <CardTitle className="flex items-center gap-2">
          <ScanSearchIcon className="size-4 text-primary" /> Intel
        </CardTitle>
        <p className="text-sm text-muted-foreground">Repair intelligence for the shop&apos;s cars: trouble codes with their usual causes, recalls and owner complaints from NHTSA, the garage.</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(intelPathFor(q));
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="VIN or a code, e.g. P0300" aria-label="VIN or trouble code" className="h-11 font-mono sm:flex-1" data-testid="intel-card-query" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 flex-1 sm:flex-none" data-testid="intel-card-lookup">
              <SearchIcon /> Look up
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
              <Link href="/intel/garage" data-testid="intel-card-open">
                <ScanSearchIcon /> Open the garage
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

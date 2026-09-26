"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Page } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page narrow>
      <EmptyState
        icon={AlertTriangleIcon}
        tone="error"
        title="Something went wrong"
        description={error.digest ? `Reference ${error.digest}. Nothing you logged has been lost; queued jobs stay on this phone.` : "Nothing you logged has been lost; queued jobs stay on this phone."}
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/jobs/new">Log a job</Link>
            </Button>
          </div>
        }
      />
    </Page>
  );
}

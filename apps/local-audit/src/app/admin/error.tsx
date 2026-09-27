"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Page } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page narrow>
      <EmptyState
        icon={AlertTriangleIcon}
        tone="error"
        title="Something went wrong"
        description={error.digest ? `Reference ${error.digest}.` : undefined}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Page>
  );
}

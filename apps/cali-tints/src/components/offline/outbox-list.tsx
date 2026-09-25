"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, CloudUploadIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import type { OutboxItem } from "@/lib/offline/db";
import { listOutbox, OUTBOX_EVENT, removeOutboxItem, updateOutboxItem } from "@/lib/offline/outbox";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSync } from "./sync-provider";

export function OutboxList() {
  const [items, setItems] = useState<OutboxItem[] | null>(null);
  const { online, syncing, syncNow } = useSync();

  useEffect(() => {
    let alive = true;
    const load = () => listOutbox().then((i) => alive && setItems(i)).catch(() => alive && setItems([]));
    const t = setTimeout(load, 0);
    window.addEventListener(OUTBOX_EVENT, load);
    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener(OUTBOX_EVENT, load);
    };
  }, []);

  if (items === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
        <CheckCircle2Icon className="size-8 text-success" />
        <p className="text-sm text-muted-foreground">Everything is synced.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{online ? "Online" : "Offline — will sync when signal returns"}</p>
        <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => syncNow()}>
          <RefreshCwIcon className={syncing ? "animate-spin" : ""} /> Sync now
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.client_id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.summary.tag_number}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {[item.summary.model, item.summary.dealership_name].filter(Boolean).join(" · ")} · {formatMoney(item.summary.total)}
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(new Date(item.created_at))}</div>
                {item.status === "error" && item.last_error && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" /> {item.last_error}
                  </p>
                )}
              </div>
              {item.status !== "done" && (
                <div className="flex shrink-0 gap-1">
                  {item.status === "error" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Retry"
                      onClick={async () => {
                        await updateOutboxItem(item.client_id, { status: "pending", attempts: 0, last_error: null });
                      }}
                    >
                      <CloudUploadIcon />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Discard"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`Discard the queued job for ${item.summary.tag_number}? It was never saved to the server.`)) return;
                      await removeOutboxItem(item.client_id);
                      toast("Discarded");
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: OutboxItem["status"] }) {
  switch (status) {
    case "done":
      return <Badge variant="success">Synced</Badge>;
    case "syncing":
      return <Badge variant="info">Syncing</Badge>;
    case "error":
      return <Badge variant="destructive">Needs attention</Badge>;
    default:
      return <Badge variant="warning">Queued</Badge>;
  }
}

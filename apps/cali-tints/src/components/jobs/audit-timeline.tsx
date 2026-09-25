import type { AuditLog } from "@/lib/db/types";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const HIDDEN = new Set(["id", "company_id", "job_id", "client_id", "created_at", "updated_at", "created_by", "updated_by", "deleted_by"]);
const LABELS: Record<string, string> = {
  tag_number: "Tag",
  vin: "VIN",
  year: "Year",
  make: "Make",
  model: "Model",
  color: "Color",
  performed_at: "Date",
  ro_po_number: "RO/PO",
  notes: "Notes",
  dealership_id: "Dealership",
  detailer_id: "Detailer",
  invoice_id: "Invoice",
  status: "Status",
  deleted_at: "Deleted",
  delete_reason: "Delete reason",
  price: "Price",
  override_reason: "Override reason",
  service_id: "Service",
};

function fmt(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "performed_at" || key === "deleted_at") return formatDateTime(String(v));
  if (key === "price") return formatMoney(Number(v));
  if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v)) return v.slice(0, 8) + "…";
  return String(v);
}

/** Who changed what, when. Reads the audit_log rows for a job and its service lines. */
export function AuditTimeline({ entries, actorNames }: { entries: AuditLog[]; actorNames: Record<string, string> }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;

  return (
    <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
      {entries.map((e) => {
        const who = (e.actor_id && actorNames[e.actor_id]) || "System";
        const isService = e.table_name === "job_services";
        const newData = (e.new_data ?? {}) as Record<string, unknown>;
        const oldData = (e.old_data ?? {}) as Record<string, unknown>;
        const changed = (e.changed ?? []).filter((c) => !HIDDEN.has(c));

        let title: string;
        if (e.action === "insert") title = isService ? `Added service line · ${formatMoney(Number(newData.price))}` : "Logged job";
        else if (e.action === "delete") title = isService ? "Removed service line" : "Deleted";
        else if (changed.includes("deleted_at") && newData.deleted_at) title = "Soft-deleted job";
        else if (changed.includes("deleted_at") && !newData.deleted_at) title = "Restored job";
        else if (changed.includes("invoice_id") && newData.invoice_id) title = "Added to invoice";
        else if (changed.includes("invoice_id") && !newData.invoice_id) title = "Removed from invoice (voided)";
        else title = isService ? "Changed service line" : "Edited job";

        return (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">
              {who} · {formatDateTime(e.created_at)}
            </div>
            {e.action === "update" && changed.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
                {changed.map((c) => (
                  <li key={c} className="text-muted-foreground">
                    <span className="text-foreground">{LABELS[c] ?? c}</span>: {fmt(c, oldData[c])} <span className="opacity-60">→</span> {fmt(c, newData[c])}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

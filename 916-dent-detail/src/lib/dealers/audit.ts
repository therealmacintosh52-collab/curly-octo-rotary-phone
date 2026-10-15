// Audit trail for dealer actions. One row per event in `events` (entity_type "dealer_vehicle" | "dealer" | "dealer_invoice").
// `data` never carries PII: ids, statuses, amounts only.
import { repo } from '@/lib/db';
import type { EventRow } from '@/lib/db/types';

export type Actor = `dealer:${string}` | 'owner' | 'tech' | 'system';

export async function audit(type: string, entityType: 'dealer_vehicle' | 'dealer' | 'dealer_invoice' | 'dealer_statement', entityId: string, actor: Actor, data: Record<string, unknown> = {}): Promise<void> {
  await repo().events.insert({ type, entity_type: entityType, entity_id: entityId, actor, data });
}

export async function trail(entityType: string, entityId: string): Promise<EventRow[]> {
  // ascending then reversed: events written in the same millisecond keep their real order (newest first)
  const rows = await repo().events.list({ where: { entity_type: entityType, entity_id: entityId }, orderBy: 'created_at' });
  return rows.reverse().slice(0, 100);
}

// Dealer vehicle status machine. Dealer-facing labels follow the spec: Submitted -> Scheduled/On-lot -> In progress ->
// Done/Frontline-ready. Pure (no I/O) so it is unit-tested and shared by the portal and the owner screens.
import type { DealerVehicle, Job } from '@/lib/db/types';

export type VehicleStatus = DealerVehicle['status'];

export const STATUS_ORDER: VehicleStatus[] = ['submitted', 'scheduled', 'in_progress', 'done', 'invoiced'];

const T: Record<VehicleStatus, VehicleStatus[]> = {
  submitted: ['scheduled', 'cancelled'],
  quoted: ['approved', 'scheduled', 'cancelled'], // legacy 0001 values: let them flow into the new chain
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'submitted', 'cancelled'],
  in_progress: ['done', 'scheduled'],
  done: ['invoiced', 'in_progress'], // back to in_progress = rework; blocked once billed
  invoiced: [],
  cancelled: ['submitted'],
};

export class StatusError extends Error {
  constructor(public from: VehicleStatus, public to: VehicleStatus, msg?: string) { super(msg ?? `A vehicle cannot move from ${from} to ${to}.`); this.name = 'StatusError'; }
}

export const nextStatuses = (from: VehicleStatus): VehicleStatus[] => T[from] ?? [];
export const canTransition = (from: VehicleStatus, to: VehicleStatus): boolean => (T[from] ?? []).includes(to);
export function assertTransition(from: VehicleStatus, to: VehicleStatus, opts: { billed?: boolean } = {}): void {
  if (!canTransition(from, to)) throw new StatusError(from, to);
  if (opts.billed && from === 'done' && to === 'in_progress') throw new StatusError(from, to, 'This vehicle is already on a statement; ask us to reopen it.');
}

export const OPEN_STATUSES: VehicleStatus[] = ['submitted', 'quoted', 'approved', 'scheduled', 'in_progress'];
export const isOpen = (s: VehicleStatus) => OPEN_STATUSES.includes(s);
export const isFinished = (s: VehicleStatus) => s === 'done' || s === 'invoiced';

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  submitted: 'Submitted',
  quoted: 'Submitted',
  approved: 'Submitted',
  scheduled: 'Scheduled / on-lot',
  in_progress: 'In progress',
  done: 'Frontline-ready',
  invoiced: 'Frontline-ready (billed)',
  cancelled: 'Cancelled',
};

/** Board columns shown to dealers (legacy values fold into Submitted, billed folds into Frontline-ready). */
export const BOARD_COLUMNS: { key: 'submitted' | 'scheduled' | 'in_progress' | 'done'; label: string; statuses: VehicleStatus[] }[] = [
  { key: 'submitted', label: 'Submitted', statuses: ['submitted', 'quoted', 'approved'] },
  { key: 'scheduled', label: 'Scheduled / on-lot', statuses: ['scheduled'] },
  { key: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
  { key: 'done', label: 'Frontline-ready', statuses: ['done', 'invoiced'] },
];

/** Linked job stage for a vehicle status (jobs.stage: new | quoted | booked | in_progress | done | reviewed). */
export function jobStageFor(s: VehicleStatus): Job['stage'] {
  switch (s) {
    case 'submitted': case 'cancelled': return 'new';
    case 'quoted': return 'quoted';
    case 'approved': case 'scheduled': return 'booked';
    case 'in_progress': return 'in_progress';
    case 'done': case 'invoiced': return 'done';
  }
}

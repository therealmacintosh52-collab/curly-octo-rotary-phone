// Authorization helpers shared by pages and API routes: which jobs/bookings/photos a session may touch.
import { HttpError, forbidden, notFound } from './api';
import type { Session } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/roles';
import { repo, type BookingRow, type Job } from '@/lib/db';

export const canAccessTech = (s: Pick<Session, 'role' | 'techId'>, techId: string | null | undefined): boolean => isStaff(s.role) || (!!s.techId && techId === s.techId);

export async function jobForSession(s: Session, jobId: string): Promise<Job> {
  const job = await repo().jobs.get(jobId);
  if (!job) throw notFound('Job');
  // A tech who is not assigned must not even learn whether the job exists.
  if (!canAccessTech(s, job.tech_id)) throw notFound('Job');
  return job;
}

export async function bookingForSession(s: Session, bookingId: string): Promise<BookingRow> {
  const b = await repo().bookings.get(bookingId);
  if (!b || !canAccessTech(s, b.tech_id)) throw notFound('Booking');
  return b;
}

/** May this session read the image at `path`? Staff: any known path. Tech: only images of their own jobs / quotes. */
export async function mayViewImage(s: Session, path: string): Promise<boolean> {
  if (isStaff(s.role)) return true;
  const db = repo();
  const m = /^(jobs|signatures)\/([0-9a-f-]{36})\//.exec(path);
  if (m) { const job = await db.jobs.get(m[2]!); return !!job && canAccessTech(s, job.tech_id); }
  if (path.startsWith('quotes/')) {
    const mine = await db.bookings.list({ where: { tech_id: s.techId ?? '__none__' } });
    const quotes = await Promise.all(mine.filter((b) => b.quote_id).map((b) => db.quotes.get(b.quote_id!)));
    if (quotes.some((q) => q?.photo_paths.includes(path))) return true;
    // photos sent with the booking itself are stored on the quote created at booking time; also allow job_photos rows
    return false;
  }
  return false;
}

export { HttpError, forbidden };

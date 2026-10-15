# RLS intent: who may touch what (owner vs tech vs anon)

SQL is NOT executed in the build environment (no Postgres), so this is a reviewed statement of intent plus
`tests/unit/rls-intent.test.ts`, which statically checks the migration text. Run the SQL checks at the bottom in the
Supabase SQL editor after applying 0001 and 0002.

Important: the Next.js server uses the SERVICE ROLE (bypasses RLS) after verifying the signed admin session
(`src/lib/auth`). RLS is defence in depth for any direct client access and for dashboard users.

| Table | anon | tech (own tech_id) | owner / admin | notes |
|---|---|---|---|---|
| services | read active | read active | all | only anon-readable table |
| profiles | none | own row (read) | all | role cannot be self-edited (no update policy) |
| techs, tech_availability | none | own row (read) | all | |
| bookings | none | read own; UPDATE own but trigger limits to `status` in on_the_way/in_progress/completed/no_show | all | `limit_tech_columns` (0002) blocks price/customer/tech edits |
| jobs | none | read own; UPDATE only stage/started/finished/summary/signature/line_items/on_my_way/eta | all | final_price, tech_id, customer_id are staff/server only |
| job_photos | none | read/write on own jobs | all | |
| customers, vehicles | none | read only those on own bookings | all | |
| payments, invoices | none | read own bookings' payments / own jobs' invoices; no writes | all | tech records payments through the server API |
| notes | none | read + insert on own jobs/bookings (author = self) | all | cannot edit/delete |
| leads, quotes, memberships, membership_visits, referral_*, ad_spend, events, notification_queue, stripe_events, conversations, messages | none | none | all | staff only |
| settings | none | read (buffers) | all | |
| dealers, dealer_users, dealer_vehicles, dealer_statements | none | none | all | dealers see only their own rows (Phase 5) |
| invoice_counters | none | none | none (service role only) | RLS on, no policies |
| functions next_invoice_number, merge_customers | no | no | no (service_role only) | EXECUTE revoked from public/anon/authenticated |

## Known gaps to review
- 0001 `bookings_tech_update` / `jobs_tech_update` let a tech update any column; 0002 adds the column-limiting trigger. Verify with the SQL below.
- The trigger relies on `auth.uid()` being null for the service role; do not call it from a security-definer function that sets a uid.
- Customers have no accounts: all customer access is by signed token in the API layer (Phase 2), never by RLS.

## SQL checks (run as each role in the Supabase SQL editor)
```sql
-- anon: expect only active services
set role anon; select count(*) from public.services; select count(*) from public.customers; -- 2nd must error or return 0
-- tech: set request.jwt.claims to a tech's uid, role authenticated
set role authenticated; select set_config('request.jwt.claims', '{"sub":"<tech profile uuid>"}', true);
select count(*) from public.bookings;                       -- only own
update public.bookings set price_low = 1 where id = '<own booking>';   -- must raise (trigger)
update public.bookings set status = 'in_progress' where id = '<own booking>';  -- ok
select count(*) from public.leads;                          -- 0
select public.merge_customers('<a>', '<b>');                -- permission denied
```

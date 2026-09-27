-- =============================================================================
-- 0012 — One-tap billing
--   * invoice_job(): invoice exactly one job by id (the "Save & charge" path:
--     log the car → invoice → charge it on the Terminal)
--   * companies.clover_verified_at: set when "Test connection" succeeds, used
--     by the Clover setup checklist
-- Re-runnable: every statement is guarded.
-- =============================================================================

alter table public.companies add column if not exists clover_verified_at timestamptz;

-- Invoice a single job. Admin only; the job must be the caller's, not deleted
-- and not invoiced yet. Period = the job's date in the company timezone.
create or replace function public.invoice_job(p_job_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_job     public.jobs;
  v_tz      text;
  v_day     date;
begin
  perform public.assert_admin();
  select * into v_job from public.jobs where id = p_job_id and company_id = v_company for update;
  if not found or v_job.deleted_at is not null then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  if v_job.invoice_id is not null then
    raise exception 'This job is already on an invoice' using errcode = '22023';
  end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_day := (v_job.performed_at at time zone v_tz)::date;
  return public._create_invoice_from_jobs(v_company, v_job.dealership_id, array[v_job.id], v_day, v_day, v_job.ro_po_number, p_notes);
end $$;
grant execute on function public.invoice_job(uuid, text) to authenticated;

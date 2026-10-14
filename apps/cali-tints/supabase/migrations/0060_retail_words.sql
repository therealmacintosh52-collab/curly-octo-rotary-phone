-- =============================================================================
-- 0060 — Retail speaks the shop's words again (repair order / RO / job), and the
--        list rows carry the work order number
--   * undoes the message rewording of 0057 for the messages a Retail screen can show
--   * estimates_filtered rows gain ro_number (the work order number once approved)
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name order by p.oid desc limit 1;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

select public._patch_function('_convert_estimate_core', 'That repair order is closed', 'That estimate is closed to changes', 'That repair order is closed');
select public._patch_function('add_finding_lines', 'There is no open estimate or repair order for this finding', 'There is no open estimate for this finding', 'There is no open estimate or repair order for this finding');
select public._patch_function('check_in_appointment', 'The repair order was not opened', 'The estimate was not opened', 'The repair order was not opened');
select public._patch_function('close_ro', 'This job is already closed', 'This estimate is already closed', 'This job is already closed');
select public._patch_function('close_ro', 'Not a retail repair order', 'Not a retail estimate', 'Not a retail repair order');
select public._patch_function('close_ro', 'This job is deleted', 'This estimate is deleted', 'This job is deleted');
select public._patch_function('complete_ro_work', 'Some work on this RO is not authorized yet; get the approval first', 'Some items are not approved yet; get the approval first', 'Some work on this RO is not authorized yet; get the approval first');
select public._patch_function('complete_ro_work', 'Not a retail repair order', 'Not a retail estimate', 'Not a retail repair order');
select public._patch_function('complete_ro_work', 'This repair order is closed to changes', 'This estimate is closed to changes', 'This repair order is closed to changes');
select public._patch_function('convert_ro_to_invoice', 'Only the owner, an admin or an advisor converts a repair order to an invoice', 'Only the owner, an admin or an advisor makes the invoice', 'Only the owner, an admin or an advisor converts a repair order to an invoice');
select public._patch_function('convert_ro_to_invoice', 'The RO no longer matches what was approved; review the lines', 'The estimate no longer matches what was approved; review the lines', 'The RO no longer matches what was approved; review the lines');
select public._patch_function('convert_ro_to_invoice', 'There is no approved work on this repair order', 'There is nothing approved on this estimate', 'There is no approved work on this repair order');
select public._patch_function('convert_ro_to_invoice', 'That repair order was deleted', 'That estimate was deleted', 'That repair order was deleted');
select public._patch_function('convert_ro_to_invoice', 'Not a retail repair order', 'Not a retail estimate', 'Not a retail repair order');
select public._patch_function('job_receipt', 'Job not found', 'Not found', 'Job not found');
select public._patch_function('quality_check_ro', 'This repair order is closed to changes', 'This estimate is closed to changes', 'This repair order is closed to changes');
select public._patch_function('record_retail_payment', 'Job not found', 'Not found', 'Job not found');
select public._patch_function('record_retail_payment', 'Convert the repair order to an invoice first', 'Make the invoice first', 'Convert the repair order to an invoice first');
select public._patch_function('retail_charge', 'This job is deleted', 'This estimate is deleted', 'This job is deleted');
select public._patch_function('retail_charge', 'Job not found', 'Not found', 'Job not found');
select public._patch_function('sign_receipt', 'Job not found', 'Not found', 'Job not found');

update public.automation_rules set name = 'Receipt after a paid job' where key = 'payment_receipt' and name = 'Receipt after an invoice is paid';

-- the list rows say which work order a visit became
select public._patch_function('estimates_filtered', 'ro_number',
  $a$'advisor', public._initials((select p.full_name from public.profiles p where p.id = b.created_by)),$a$,
  $a$'ro_number', coalesce((select j.ro_number from public.jobs j where j.id = b.job_id), b.ro_number),
               'advisor', public._initials((select p.full_name from public.profiles p where p.id = b.created_by)),$a$);

drop function public._patch_function(text, text, text, text);

-- =============================================================================
-- 0053 — What the tech writes on the side, and what the advisor does with it
--   * job_findings.recommendation: what we recommend for a finding — replace,
--     diagnose or monitor (null = nothing said). Shown as RECOMMEND REPLACE /
--     DIAG / MONITOR on the card, the customer's page and the PDFs.
--   * add_finding_lines(finding, lines): price a finding in place (labor hours ×
--     rate, parts, fees) and put the lines on ONE estimate — the finding's own
--     estimate while it is open, else an open supplement draft on its repair
--     order (created when there is none). The lines carry finding_id, so the
--     finding turns "quoted" exactly as it does from the builder.
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

alter table public.job_findings add column if not exists recommendation text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_findings_recommendation_check') then
    alter table public.job_findings add constraint job_findings_recommendation_check check (recommendation is null or recommendation in ('replace', 'diagnose', 'monitor'));
  end if;
end $$;

do $$
begin
  perform public._patch_function('add_finding', 'recommendation',
    'recommended_service_id, customer_visible, created_by)',
    'recommended_service_id, customer_visible, created_by, recommendation)');
  perform public._patch_function('add_finding', 'v_rec',
    '  v_visible boolean := coalesce((p ->> ''customer_visible'')::boolean, true);',
    '  v_visible boolean := coalesce((p ->> ''customer_visible'')::boolean, true);
  v_rec text := nullif(p ->> ''recommendation'', '''');');
  perform public._patch_function('add_finding', 'v_rec not in',
    '  if v_svc is not null and not exists',
    '  if v_rec is not null and v_rec not in (''replace'', ''diagnose'', ''monitor'') then
    raise exception ''Recommendation must be replace, diagnose or monitor'' using errcode = ''22023'';
  end if;
  if v_svc is not null and not exists');
  perform public._patch_function('add_finding', 'v_visible, auth.uid(), case',
    'v_svc, v_visible, auth.uid())',
    'v_svc, v_visible, auth.uid(), case when v_kind = ''note'' then null else v_rec end)');
  perform public._patch_function('update_finding', 'recommendation',
    '    recommended_service_id = case when p ? ''recommended_service_id''',
    '    recommendation = case when p ? ''recommendation'' then (case when nullif(p ->> ''recommendation'', '''') in (''replace'', ''diagnose'', ''monitor'') then p ->> ''recommendation'' else null end) else recommendation end,
    recommended_service_id = case when p ? ''recommended_service_id''');
  perform public._patch_function('_finding_json', '''recommendation''',
    '''recommended_service_id'', f.recommended_service_id,',
    '''recommendation'', f.recommendation, ''recommended_service_id'', f.recommended_service_id,');
end $$;

-- ---------------------------------------------------------------------------
-- Price a finding in place. p_lines: [{line_type labor|part|fee|sublet, label, hours?, rate?, qty?, price?, part_number?, vendor?, cost?, taxable?}]
-- Returns {estimate_id, display_number, job_id, subtotal, tax, total, line_ids[]} (owner, admin, advisor).
-- ---------------------------------------------------------------------------
create or replace function public.add_finding_lines(p_finding uuid, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f        public.job_findings;
  e        public.estimates;
  v_job    uuid;
  v_opt    uuid;
  v_line   jsonb;
  v_ql     jsonb;
  v_t      jsonb;
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_sort   integer;
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor prices a finding' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 30 then
    raise exception 'Too many lines' using errcode = '22023';
  end if;
  select * into f from public.job_findings where id = p_finding and company_id = public.current_company_id();
  if f.id is null then raise exception 'Finding not found' using errcode = 'P0002'; end if;
  if f.kind <> 'finding' then raise exception 'Only a finding is quoted, not a note' using errcode = '22023'; end if;
  if f.status in ('done', 'approved') then raise exception 'That finding is already done' using errcode = 'P0001'; end if;

  -- the finding's own estimate while it is still open
  if f.estimate_id is not null then
    select * into e from public.estimates where id = f.estimate_id and status in ('draft', 'sent', 'viewed');
  end if;
  if e.id is null then
    v_job := f.job_id;
    if v_job is null then raise exception 'There is no open estimate or repair order for this finding' using errcode = 'P0001'; end if;
    select * into e from public.estimates where job_id = v_job and kind = 'supplement' and status = 'draft' and company_id = f.company_id order by created_at desc limit 1;
    if e.id is null then
      e := public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'While it is here', 'recommended', true, 'lines', '[]'::jsonb))));
    end if;
  end if;

  select id into v_opt from public.estimate_options where estimate_id = e.id order by recommended desc, sort_order limit 1;
  if v_opt is null then raise exception 'The estimate has no option to add to' using errcode = 'P0001'; end if;
  select coalesce(max(sort_order), 0) into v_sort from public.estimate_lines where option_id = v_opt;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if coalesce(v_line ->> 'line_type', '') not in ('labor', 'part', 'fee', 'sublet') then
      raise exception 'A finding is priced with labor, parts, fees or a sublet' using errcode = '22023';
    end if;
    v_sort := v_sort + 1;
    v_ql := public._estimate_price_line(e.company_id, e.size_class, v_line || jsonb_build_object('finding_id', f.id));
    insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order,
                                       line_type, hours, rate, part_number, vendor, cost, finding_id, section)
    values (e.company_id, e.id, v_opt, null, v_ql ->> 'name', null, (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
            '[]'::jsonb, (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, true, v_sort,
            v_ql ->> 'line_type', nullif(v_ql ->> 'hours', '')::numeric, nullif(v_ql ->> 'rate', '')::numeric, v_ql ->> 'part_number', v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric, f.id,
            case when v_line ->> 'section' = 'diagnosis' then 'diagnosis' else 'repair' end)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  -- the finding rides on the first new line, and turns "quoted"
  update public.job_findings set estimate_line_id = v_ids[1], status = case when status in ('open', 'declined', 'quoted') then 'quoted' else status end where id = f.id;

  v_t := public._estimate_option_totals(e.id, v_opt, false);
  update public.estimate_options set subtotal = (v_t ->> 'subtotal')::numeric, labor_subtotal = (v_t ->> 'labor_subtotal')::numeric, shop_supplies = (v_t ->> 'shop_supplies')::numeric,
                                     tax = (v_t ->> 'tax')::numeric, total = (v_t ->> 'total')::numeric, duration_minutes = (v_t ->> 'duration_minutes')::int
   where id = v_opt;
  -- an edited estimate that was already out goes back to draft until it is sent again
  update public.estimates set status = 'draft' where id = e.id and status in ('sent', 'viewed');
  perform public._estimate_recompute(e.id);
  select * into e from public.estimates where id = e.id;
  return jsonb_build_object('estimate_id', e.id, 'display_number', e.display_number, 'job_id', e.job_id, 'subtotal', e.subtotal, 'shop_supplies', e.shop_supplies, 'tax', e.tax, 'total', e.total, 'line_ids', to_jsonb(v_ids));
end $$;
revoke execute on function public.add_finding_lines(uuid, jsonb) from public, anon;
grant execute on function public.add_finding_lines(uuid, jsonb) to authenticated;

drop function public._patch_function(text, text, text, text);

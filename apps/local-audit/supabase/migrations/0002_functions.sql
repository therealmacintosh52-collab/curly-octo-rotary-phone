-- =============================================================================
-- 0002_functions.sql — RPCs
--
-- get_client_report() is the ONLY path by which an anonymous share-link
-- viewer reads an audit. It is SECURITY DEFINER, projects an explicit column
-- list, and filters solutions to is_revealed = true in exactly one place.
-- No table in this schema is readable by the anon role (see 0003).
-- =============================================================================

-- Valid (unexpired) share link id for a token, or null.
create or replace function public.share_link_id_for_token(p_token text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.share_links
   where token = p_token and (expires_at is null or expires_at > now())
$$;

-- The client report. Bumps view_count / last_viewed_at as a side effect, so it
-- is VOLATILE on purpose. Returns null for an unknown or expired token.
create or replace function public.get_client_report(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_link     public.share_links;
  v_audit    public.audits;
  v_business public.businesses;
begin
  select * into v_link from public.share_links
   where token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;

  update public.share_links
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_link.id
   returning * into v_link;

  select * into v_audit from public.audits where id = v_link.audit_id;
  select * into v_business from public.businesses where id = v_audit.business_id;

  return jsonb_build_object(
    'audit', jsonb_build_object(
      'id', v_audit.id,
      'status', v_audit.status,
      'progress_pct', v_audit.progress_pct,
      'finished_at', v_audit.finished_at,
      'scores', v_audit.scores,
      'revenue_model', v_audit.revenue_model,
      'version', v_audit.version),
    'business', jsonb_build_object(
      'name', v_business.name,
      'canonical_domain', v_business.canonical_domain,
      'primary_category', v_business.primary_category,
      'address', v_business.address),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(f) - 'audit_id' order by f.severity, f.impact_score desc nulls last, f.created_at)
        from public.findings f where f.audit_id = v_audit.id), '[]'::jsonb),
    -- Revealed solutions only, explicit columns: never the whole row.
    'solutions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'finding_id', s.finding_id,
               'steps', s.steps,
               'assets', s.assets,
               'code_snippets', s.code_snippets,
               'time_estimate_hrs', s.time_estimate_hrs,
               'suggested_price', s.suggested_price,
               'priority_rank', s.priority_rank,
               'roadmap_phase', s.roadmap_phase,
               'revealed_at', s.revealed_at) order by s.priority_rank nulls last, s.created_at)
        from public.solutions s where s.audit_id = v_audit.id and s.is_revealed), '[]'::jsonb),
    'solution_counts', jsonb_build_object(
      'revealed', (select count(*) from public.solutions where audit_id = v_audit.id and is_revealed),
      'total',    (select count(*) from public.solutions where audit_id = v_audit.id)),
    'competitors', coalesce((
      select jsonb_agg(to_jsonb(c) - 'audit_id' order by c.map_rank_avg nulls last, c.name)
        from public.competitors c where c.audit_id = v_audit.id), '[]'::jsonb),
    'ai_visibility', coalesce((
      select jsonb_agg(to_jsonb(a) - 'audit_id' order by a.engine, a.prompt)
        from public.ai_visibility a where a.audit_id = v_audit.id), '[]'::jsonb),
    'rank_grid', coalesce((
      select jsonb_agg(to_jsonb(r) - 'audit_id' order by r.keyword)
        from public.rank_grid r where r.audit_id = v_audit.id), '[]'::jsonb),
    'citations', coalesce((
      select jsonb_agg(to_jsonb(x) - 'audit_id' order by x.directory)
        from public.citations x where x.audit_id = v_audit.id), '[]'::jsonb),
    'social_profiles', coalesce((
      select jsonb_agg(to_jsonb(x) - 'audit_id' order by x.network)
        from public.social_profiles x where x.audit_id = v_audit.id), '[]'::jsonb),
    'backlink_metrics', coalesce((
      select jsonb_agg(to_jsonb(x) - 'audit_id' order by x.subject, x.domain)
        from public.backlink_metrics x where x.audit_id = v_audit.id), '[]'::jsonb),
    'brand_mentions', coalesce((
      select jsonb_agg(to_jsonb(x) - 'audit_id' order by x.captured_at desc)
        from public.brand_mentions x where x.audit_id = v_audit.id), '[]'::jsonb),
    -- Evidence without storage paths: files are served through signed URLs later.
    'evidence', coalesce((
      select jsonb_agg(to_jsonb(e) - 'audit_id' - 'storage_path' order by e.captured_at)
        from public.evidence e where e.audit_id = v_audit.id), '[]'::jsonb),
    'share', jsonb_build_object('expires_at', v_link.expires_at, 'view_count', v_link.view_count)
  );
end $$;

-- Engagement tracking from the report page (anon). Silently ignores bad tokens.
create or replace function public.record_report_view(p_token text, p_section text, p_duration_sec integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.share_link_id_for_token(p_token);
  if v_id is null then
    return;
  end if;
  insert into public.report_views (share_link_id, section, duration_sec)
  values (v_id, left(p_section, 80), greatest(coalesce(p_duration_sec, 0), 0));
end $$;

-- Admin unlock, one solution.
create or replace function public.reveal_solution(p_solution_id uuid, p_revealed boolean)
returns public.solutions language plpgsql security definer set search_path = public as $$
declare v_row public.solutions;
begin
  perform public.assert_admin();
  update public.solutions set is_revealed = p_revealed where id = p_solution_id returning * into v_row;
  if not found then
    raise exception 'Solution not found' using errcode = '22023';
  end if;
  return v_row;
end $$;

-- Admin unlock in bulk: every solution of an audit, optionally one category.
create or replace function public.reveal_audit_solutions(p_audit_id uuid, p_revealed boolean, p_category text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.assert_admin();
  update public.solutions s
     set is_revealed = p_revealed
    from public.findings f
   where s.finding_id = f.id and s.audit_id = p_audit_id
     and (p_category is null or f.category = p_category);
  get diagnostics n = row_count;
  return n;
end $$;

-- Exact cost of an audit from its snapshots (audits.total_cost_usd is the
-- trigger-maintained running total of the same thing).
create or replace function public.audit_cost_usd(p_audit_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0)::numeric from public.raw_snapshots where audit_id = p_audit_id
$$;

-- ---------------------------------------------------------------------------
-- Function grants. Anonymous callers get exactly the report entry points.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.get_client_report(text) to anon;
grant execute on function public.record_report_view(text, text, integer) to anon;
grant execute on function public.share_link_id_for_token(text) to anon;

-- Row-level security. Service role bypasses everything (used only by server routes).

alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.dtc_codes enable row level security;
alter table public.fixes enable row level security;
alter table public.fix_dtcs enable row level security;
alter table public.fix_parts enable row level security;
alter table public.fix_confirmations enable row level security;
alter table public.fix_media enable row level security;
alter table public.fix_revisions enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.repair_orders enable row level security;
alter table public.repair_order_media enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_lines enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.ai_messages enable row level security;
alter table public.provider_cache enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: public read (display name + reputation show on fixes), self/admin write
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and (role = (select role from public.profiles p where p.id = auth.uid()) or public.is_admin() or role <> 'admin'));
create policy profiles_update_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- shops
create policy shops_select on public.shops for select to authenticated
  using (owner_id = auth.uid() or id = public.my_shop_id() or public.is_admin());
create policy shops_insert on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy shops_update on public.shops for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy shops_delete on public.shops for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- vehicles: mine or my shop's
create policy vehicles_select on public.vehicles for select to authenticated
  using (owner_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (owner_id = auth.uid() and (shop_id is null or shop_id = public.my_shop_id()));
create policy vehicles_update on public.vehicles for update to authenticated
  using (owner_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (owner_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());

-- dtc codes: read-only reference data
create policy dtc_codes_select on public.dtc_codes for select to authenticated using (true);
create policy dtc_codes_admin on public.dtc_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- fixes
create policy fixes_select on public.fixes for select to authenticated
  using (status = 'approved' or author_id = auth.uid() or public.is_admin());
create policy fixes_insert on public.fixes for insert to authenticated
  with check (author_id = auth.uid() and source_label in ('COMMUNITY', 'OWNER'));
create policy fixes_update on public.fixes for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy fixes_delete on public.fixes for delete to authenticated using (public.is_admin());

create policy fix_dtcs_select on public.fix_dtcs for select to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id));
create policy fix_dtcs_write on public.fix_dtcs for all to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id and (f.author_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.fixes f where f.id = fix_id and (f.author_id = auth.uid() or public.is_admin())));

create policy fix_parts_select on public.fix_parts for select to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id));
create policy fix_parts_write on public.fix_parts for all to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id and (f.author_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.fixes f where f.id = fix_id and (f.author_id = auth.uid() or public.is_admin())));

create policy fix_media_select on public.fix_media for select to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id));
create policy fix_media_write on public.fix_media for all to authenticated
  using (uploaded_by = auth.uid() or public.is_admin())
  with check (uploaded_by = auth.uid() and exists (select 1 from public.fixes f where f.id = fix_id and f.author_id = auth.uid()) or public.is_admin());

create policy fix_confirmations_select on public.fix_confirmations for select to authenticated using (true);
create policy fix_confirmations_insert on public.fix_confirmations for insert to authenticated with check (user_id = auth.uid());
create policy fix_confirmations_update on public.fix_confirmations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fix_confirmations_delete on public.fix_confirmations for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy fix_revisions_select on public.fix_revisions for select to authenticated
  using (exists (select 1 from public.fixes f where f.id = fix_id));

-- moderation: anyone can report, only admins and reporters see entries
create policy moderation_select on public.moderation_queue for select to authenticated
  using (public.is_admin() or reported_by = auth.uid());
create policy moderation_insert on public.moderation_queue for insert to authenticated
  with check (reported_by = auth.uid() and kind = 'report');
create policy moderation_update on public.moderation_queue for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- repair orders: author or shop
create policy ro_select on public.repair_orders for select to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());
create policy ro_insert on public.repair_orders for insert to authenticated
  with check (author_id = auth.uid() and (shop_id is null or shop_id = public.my_shop_id()));
create policy ro_update on public.repair_orders for update to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()));
create policy ro_delete on public.repair_orders for delete to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()));

create policy ro_media_select on public.repair_order_media for select to authenticated
  using (exists (select 1 from public.repair_orders r where r.id = repair_order_id));
create policy ro_media_write on public.repair_order_media for all to authenticated
  using (exists (select 1 from public.repair_orders r where r.id = repair_order_id))
  with check (uploaded_by = auth.uid() and exists (select 1 from public.repair_orders r where r.id = repair_order_id));

-- estimates
create policy estimates_select on public.estimates for select to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());
create policy estimates_insert on public.estimates for insert to authenticated
  with check (author_id = auth.uid() and (shop_id is null or shop_id = public.my_shop_id()));
create policy estimates_update on public.estimates for update to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()));
create policy estimates_delete on public.estimates for delete to authenticated
  using (author_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()));

create policy estimate_lines_all on public.estimate_lines for all to authenticated
  using (exists (select 1 from public.estimates e where e.id = estimate_id))
  with check (exists (select 1 from public.estimates e where e.id = estimate_id));

-- AI sessions: strictly private
create policy ai_sessions_all on public.ai_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_all on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- provider_cache: service role only (no policies => denied for anon/authenticated)

-- subscriptions: read own; writes come from the Stripe webhook (service role)
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or (shop_id is not null and shop_id = public.my_shop_id()) or public.is_admin());

-- RPC grants
grant execute on function public.rank_fixes(text, text, integer, text, text[], integer) to authenticated;
grant execute on function public.search_fixes(text, text, text, integer) to authenticated;
grant execute on function public.consume_ai_query(integer) to authenticated;
grant execute on function public.redeem_free_month() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_shop_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.cleanup_provider_cache() from public, anon, authenticated;
revoke execute on function public.recompute_fix_score(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_reputation(uuid) from public, anon, authenticated;

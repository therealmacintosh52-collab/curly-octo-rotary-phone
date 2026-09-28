-- =============================================================================
-- 0025 — The Terminal is owner/admin only
--   Managers run invoicing but never take a payment: the terminal_sales
--   ledger (sales, refunds, receipts taken on the Terminal) moves from
--   is_admin() to is_owner_admin(). Invoice payments themselves stay
--   readable/recordable by managers (a check that arrived in the mail).
-- Re-runnable.
-- =============================================================================

drop policy if exists terminal_sales_admin on public.terminal_sales;
create policy terminal_sales_admin on public.terminal_sales for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());

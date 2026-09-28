-- =============================================================================
-- 0018 — Paint Correction is about $50, not $250
--   Corrects the seeded default and gives it a quoted range ($40–60) inside
--   which no override reason is needed. Only touches a row still at the old
--   seeded price, so a price the owner already changed by hand is left alone.
-- =============================================================================

update public.services
   set default_price = 50.00, price_min = 40.00, price_max = 60.00,
       description = 'Single-stage machine polish; about $50'
 where name = 'Paint Correction (1-step)' and default_price = 250.00;

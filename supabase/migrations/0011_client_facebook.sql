-- =========================================================
-- PRETTY CHIC — CLIENT "Facebook" FIELD
-- The `emergency_contact` column is actually used to store the client's
-- Facebook reference. This adds a dedicated `facebook` column and migrates
-- existing values across. NON-DESTRUCTIVE: emergency_contact is kept as a
-- backup so nothing breaks if app code still references it.
-- Safe to re-run.
-- =========================================================

alter table public.clients
  add column if not exists facebook text;

-- Migrate existing emergency_contact values into facebook (only where facebook
-- hasn't been set yet — safe to run multiple times).
update public.clients
  set facebook = emergency_contact
  where facebook is null
    and emergency_contact is not null;

-- Refresh PostgREST schema cache so the new column is visible.
notify pgrst, 'reload schema';

-- =========================================================
-- OPTIONAL — once you've confirmed `facebook` is populated and the app has been
-- deployed, you may drop the old column. Only run this AFTER verifying:
--   -- alter table public.clients drop column emergency_contact;
-- =========================================================

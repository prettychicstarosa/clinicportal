-- -------------------------------------------------------------
-- Soft-delete support for staff accounts
-- -------------------------------------------------------------
-- Hard-deleting a profile row fails whenever the profile is still
-- referenced as created_by / updated_by / actor_id / performed_by on
-- another table (those FKs are RESTRICT). That left "deleted" staff
-- visible in Settings -> Staff Accounts. Instead we soft-delete:
-- mark the profile inactive, stamp deleted_at, and filter it out.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

-- Speeds up the Staff Accounts query (is_active = true, newest first).
create index if not exists profiles_active_created_idx
  on public.profiles (is_active, created_at desc);

notify pgrst, 'reload schema';

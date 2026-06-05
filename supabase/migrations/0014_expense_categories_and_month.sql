-- =========================================================
-- PRETTY CHIC — EXPENSE CATEGORIES
-- Widens the category CHECK constraint to include "Maintenance".
-- (The app groups expenses by month using the existing `due_date`
-- column, so no extra date column is required.)
-- Safe to re-run (idempotent).
-- =========================================================

-- 1. Allow the "Maintenance" category (keep all existing ones).
alter table public.expenses
  drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check
  check (category in ('Rent','Salary','Supplies','Marketing','Utilities','Maintenance','Other'));

-- 2. Drop the obsolete staff_permissions.payments column (Payments module
--    has been removed). Guarded so it is safe whether or not the column /
--    table exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_permissions'
      and column_name = 'payments'
  ) then
    alter table public.staff_permissions drop column payments;
  end if;
end $$;

notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

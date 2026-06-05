-- =========================================================
-- PRETTY CHIC — EXPENSE CATEGORIES + MONTHLY GROUPING
-- Adds the "Maintenance" category and a dedicated expense_date so
-- expenses can be filtered / grouped by month and category.
-- Safe to re-run (idempotent).
-- =========================================================

-- 1. Allow the new "Maintenance" category (keep existing ones).
alter table public.expenses
  drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check
  check (category in ('Rent','Salary','Supplies','Marketing','Utilities','Maintenance','Other'));

-- 2. Dedicated expense date used for monthly reporting.
alter table public.expenses
  add column if not exists expense_date date;

-- Backfill from the most meaningful existing date.
update public.expenses
  set expense_date = coalesce(due_date, created_at::date)
  where expense_date is null;

alter table public.expenses
  alter column expense_date set default current_date;

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date);

-- 3. Drop the obsolete staff_permissions.payments column (Payments module
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

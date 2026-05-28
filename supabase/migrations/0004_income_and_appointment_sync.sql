-- =========================================================
-- PRETTY CHIC — INCOME TRACKING + APPOINTMENT SYNC PATCH
-- Safe to re-run.
-- =========================================================

-- 1. APPOINTMENTS — ensure auto-generation columns exist.
-- -------------------------------------------------------------
alter table public.appointments
  add column if not exists package_id uuid references public.packages(id) on delete set null;

alter table public.appointments
  add column if not exists package_name text;

alter table public.appointments
  add column if not exists generated_from_package boolean default false;

alter table public.appointments
  add column if not exists session_index int;

create index if not exists appointments_package_idx on public.appointments(package_id);
create index if not exists appointments_generated_idx on public.appointments(generated_from_package);

-- 2. INCOME — weekly manual income per month/year.
-- -------------------------------------------------------------
create table if not exists public.income (
  id          uuid primary key default gen_random_uuid(),
  month       int  not null check (month between 1 and 12),
  year        int  not null check (year between 2000 and 2100),
  week1       numeric(12,2) not null default 0,
  week2       numeric(12,2) not null default 0,
  week3       numeric(12,2) not null default 0,
  week4       numeric(12,2) not null default 0,
  week5       numeric(12,2) not null default 0,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists income_month_year_unique
  on public.income (year, month);

create index if not exists income_year_idx on public.income (year);

-- Auto-touch updated_at
create or replace function public.touch_income_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_income_updated_at on public.income;
create trigger trg_income_updated_at
  before update on public.income
  for each row execute function public.touch_income_updated_at();

-- 3. RLS — owner/admin manage; staff can read.
-- -------------------------------------------------------------
alter table public.income enable row level security;

drop policy if exists income_select on public.income;
create policy income_select on public.income
  for select using (auth.uid() is not null);

drop policy if exists income_insert on public.income;
create policy income_insert on public.income
  for insert with check (public.is_admin());

drop policy if exists income_update on public.income;
create policy income_update on public.income
  for update using (public.is_admin())
                with check (public.is_admin());

drop policy if exists income_delete on public.income;
create policy income_delete on public.income
  for delete using (public.is_admin());

-- 4. REFRESH PostgREST schema cache so the table is visible.
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

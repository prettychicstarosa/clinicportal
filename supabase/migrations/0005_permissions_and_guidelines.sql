-- =========================================================
-- PRETTY CHIC — STAFF PERMISSIONS + GUIDELINES + RE-SYNC
-- Safe to re-run.
-- =========================================================

-- 1. INCOME (in case 0004 was not applied)
-- ---------------------------------------------------------
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

-- 2. APPOINTMENTS — ensure required columns exist
-- ---------------------------------------------------------
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

-- 3. STAFF PERMISSIONS — per-staff tab visibility
-- ---------------------------------------------------------
create table if not exists public.staff_permissions (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  dashboard     boolean not null default true,
  clients       boolean not null default true,
  appointments  boolean not null default true,
  packages      boolean not null default true,
  payments      boolean not null default true,
  expenses      boolean not null default false,
  inventory     boolean not null default true,
  income        boolean not null default false,
  reports       boolean not null default false,
  settings      boolean not null default false,
  guidelines    boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);

create or replace function public.touch_staff_permissions_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_staff_permissions_updated_at on public.staff_permissions;
create trigger trg_staff_permissions_updated_at
  before update on public.staff_permissions
  for each row execute function public.touch_staff_permissions_updated_at();

alter table public.staff_permissions enable row level security;

-- Each user can read their own row; owner/admin can read all
drop policy if exists staff_permissions_select on public.staff_permissions;
create policy staff_permissions_select on public.staff_permissions
  for select using (public.is_admin() or auth.uid() = profile_id);

drop policy if exists staff_permissions_insert on public.staff_permissions;
create policy staff_permissions_insert on public.staff_permissions
  for insert with check (public.is_admin());

drop policy if exists staff_permissions_update on public.staff_permissions;
create policy staff_permissions_update on public.staff_permissions
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_permissions_delete on public.staff_permissions;
create policy staff_permissions_delete on public.staff_permissions
  for delete using (public.is_admin());

-- Seed a default permissions row for every existing profile that doesn't have one
insert into public.staff_permissions (profile_id)
select p.id from public.profiles p
where not exists (
  select 1 from public.staff_permissions sp where sp.profile_id = p.id
);

-- Auto-create a default permissions row for any new profile
create or replace function public.ensure_staff_permissions()
returns trigger as $$
begin
  insert into public.staff_permissions (profile_id)
  values (NEW.id)
  on conflict (profile_id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ensure_staff_permissions on public.profiles;
create trigger trg_ensure_staff_permissions
  after insert on public.profiles
  for each row execute function public.ensure_staff_permissions();

-- 4. GUIDELINES — categories + items
-- ---------------------------------------------------------
create table if not exists public.guideline_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists guideline_categories_name_unique
  on public.guideline_categories (lower(name));

create table if not exists public.guideline_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.guideline_categories(id) on delete cascade,
  name          text not null,
  time          text,
  procedure     text,
  internal_cost numeric(12,2) not null default 0,
  sort_order    int not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists guideline_items_category_idx
  on public.guideline_items (category_id);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_guideline_categories_updated_at on public.guideline_categories;
create trigger trg_guideline_categories_updated_at
  before update on public.guideline_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_guideline_items_updated_at on public.guideline_items;
create trigger trg_guideline_items_updated_at
  before update on public.guideline_items
  for each row execute function public.touch_updated_at();

alter table public.guideline_categories enable row level security;
alter table public.guideline_items      enable row level security;

-- Helper: does the current user have the "guidelines" tab on?
create or replace function public.can_view_guidelines() returns boolean as $$
  select coalesce(
    (select sp.guidelines from public.staff_permissions sp where sp.profile_id = auth.uid()),
    true
  ) and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  );
$$ language sql stable security definer;

drop policy if exists guideline_categories_select on public.guideline_categories;
create policy guideline_categories_select on public.guideline_categories
  for select using (public.is_admin() or public.can_view_guidelines());

drop policy if exists guideline_categories_insert on public.guideline_categories;
create policy guideline_categories_insert on public.guideline_categories
  for insert with check (public.is_admin());

drop policy if exists guideline_categories_update on public.guideline_categories;
create policy guideline_categories_update on public.guideline_categories
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists guideline_categories_delete on public.guideline_categories;
create policy guideline_categories_delete on public.guideline_categories
  for delete using (public.is_admin());

drop policy if exists guideline_items_select on public.guideline_items;
create policy guideline_items_select on public.guideline_items
  for select using (public.is_admin() or public.can_view_guidelines());

drop policy if exists guideline_items_insert on public.guideline_items;
create policy guideline_items_insert on public.guideline_items
  for insert with check (public.is_admin());

drop policy if exists guideline_items_update on public.guideline_items;
create policy guideline_items_update on public.guideline_items
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists guideline_items_delete on public.guideline_items;
create policy guideline_items_delete on public.guideline_items
  for delete using (public.is_admin());

-- 5. REFRESH PostgREST schema cache
-- ---------------------------------------------------------
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

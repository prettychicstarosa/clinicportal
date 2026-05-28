-- =========================================================
-- PRETTY CHIC — GUIDELINES MODULE PATCH
-- Adds guideline_categories + guideline_items with RLS.
-- Safe to re-run (idempotent).
-- =========================================================

-- 1. GUIDELINE CATEGORIES
-- -------------------------------------------------------------
create table if not exists public.guideline_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists guideline_categories_name_unique
  on public.guideline_categories (lower(name));

create index if not exists guideline_categories_sort_idx
  on public.guideline_categories (sort_order, name);

-- 2. GUIDELINE ITEMS
-- -------------------------------------------------------------
create table if not exists public.guideline_items (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.guideline_categories(id) on delete cascade,
  name              text not null,
  medicine_used     text,
  syringe_quantity  text,
  time              text,
  intensity         text,
  internal_cost     numeric(12,2) not null default 0,
  procedure         text,
  notes             text,
  sort_order        int  not null default 0,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Add columns if the table already existed from a previous partial install.
alter table public.guideline_items
  add column if not exists medicine_used     text,
  add column if not exists syringe_quantity  text,
  add column if not exists intensity         text,
  add column if not exists notes             text,
  add column if not exists sort_order        int not null default 0,
  add column if not exists updated_at        timestamptz not null default now();

create index if not exists guideline_items_category_idx
  on public.guideline_items (category_id);

create index if not exists guideline_items_sort_idx
  on public.guideline_items (category_id, sort_order, name);

-- 3. AUTO-TOUCH updated_at
-- -------------------------------------------------------------
create or replace function public.touch_guideline_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_guideline_categories_updated_at on public.guideline_categories;
create trigger trg_guideline_categories_updated_at
  before update on public.guideline_categories
  for each row execute function public.touch_guideline_updated_at();

drop trigger if exists trg_guideline_items_updated_at on public.guideline_items;
create trigger trg_guideline_items_updated_at
  before update on public.guideline_items
  for each row execute function public.touch_guideline_updated_at();

-- 4. RLS — active authenticated users read; owner/admin write.
-- -------------------------------------------------------------
alter table public.guideline_categories enable row level security;
alter table public.guideline_items      enable row level security;

-- Categories
drop policy if exists guideline_categories_select on public.guideline_categories;
create policy guideline_categories_select on public.guideline_categories
  for select using (auth.uid() is not null);

drop policy if exists guideline_categories_insert on public.guideline_categories;
create policy guideline_categories_insert on public.guideline_categories
  for insert with check (public.is_admin());

drop policy if exists guideline_categories_update on public.guideline_categories;
create policy guideline_categories_update on public.guideline_categories
  for update using (public.is_admin())
                with check (public.is_admin());

drop policy if exists guideline_categories_delete on public.guideline_categories;
create policy guideline_categories_delete on public.guideline_categories
  for delete using (public.is_admin());

-- Items
drop policy if exists guideline_items_select on public.guideline_items;
create policy guideline_items_select on public.guideline_items
  for select using (auth.uid() is not null);

drop policy if exists guideline_items_insert on public.guideline_items;
create policy guideline_items_insert on public.guideline_items
  for insert with check (public.is_admin());

drop policy if exists guideline_items_update on public.guideline_items;
create policy guideline_items_update on public.guideline_items
  for update using (public.is_admin())
                with check (public.is_admin());

drop policy if exists guideline_items_delete on public.guideline_items;
create policy guideline_items_delete on public.guideline_items
  for delete using (public.is_admin());

-- 5. REFRESH PostgREST schema cache.
-- -------------------------------------------------------------
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

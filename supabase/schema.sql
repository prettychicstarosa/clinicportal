-- =============================================================
-- Pretty Chic Aesthetics Clinic Portal - Database Schema
-- Run this in Supabase SQL Editor.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. PROFILES (mirrors auth.users; one row per Supabase user)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  email        text not null,
  role         text not null default 'staff' check (role in ('admin','staff')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. EMPLOYEES (extra HR metadata, links to profile)
-- -------------------------------------------------------------
create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null unique references public.profiles(id) on delete cascade,
  username     text unique,
  position     text,
  phone        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

-- -------------------------------------------------------------
-- 3. CLIENTS
-- -------------------------------------------------------------
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  mobile                text,
  age                   int,
  birthday              date,
  treatment_interested  text,
  package_availed       text,
  total_sessions        int not null default 0,
  remaining_sessions    int not null default 0,
  valid_until           date,
  balance               numeric(12,2) not null default 0,
  payment_status        text not null default 'Unpaid' check (payment_status in ('Paid','Partial','Unpaid')),
  registration_date     date not null default current_date,
  signed_consent        boolean not null default false,
  notes                 text,
  allergies             text,
  created_by            uuid references public.profiles(id),
  updated_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (lower(full_name));

-- -------------------------------------------------------------
-- 4. PACKAGES
-- -------------------------------------------------------------
create table if not exists public.packages (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,
  total_sessions  int not null default 1,
  used_sessions   int not null default 0,
  price           numeric(12,2) not null default 0,
  valid_until     date,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

-- -------------------------------------------------------------
-- 5. APPOINTMENTS
-- -------------------------------------------------------------
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  date        date not null,
  time        time not null,
  treatment   text,
  status      text not null default 'Scheduled' check (status in ('Scheduled','Done','No Show','Cancelled','Rescheduled')),
  notes       text,
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists appointments_date_idx on public.appointments (date);

-- -------------------------------------------------------------
-- 6. SESSIONS
-- -------------------------------------------------------------
create table if not exists public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  package_id          uuid references public.packages(id) on delete set null,
  first_session_date  date,
  session_date        date,
  session_time        time,
  amount_paid         numeric(12,2) not null default 0,
  balance             numeric(12,2) not null default 0,
  interval_days       int,
  expiry_date         date,
  status              text not null default 'Scheduled' check (status in ('Scheduled','Completed','Cancelled')),
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 7. EXPENSES
-- -------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null check (category in ('Rent','Salary','Supplies','Marketing','Utilities','Other')),
  amount       numeric(12,2) not null default 0,
  due_date     date,
  paid_status  text not null default 'Unpaid' check (paid_status in ('Paid','Unpaid','Partial')),
  paid_amount  numeric(12,2) not null default 0,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 8. INVENTORY
-- -------------------------------------------------------------
create table if not exists public.inventory (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  item_type        text not null check (item_type in ('Medicine','Tool','Kit','Consumable')),
  unit             text not null,
  remaining_stock  numeric(12,2) not null default 0,
  low_stock_alert  numeric(12,2) not null default 5,
  stock_status     text not null default 'Available' check (stock_status in ('Available','Low Stock','Out of Stock')),
  updated_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-maintain stock_status on insert/update
create or replace function public.update_stock_status() returns trigger as $$
begin
  if NEW.remaining_stock <= 0 then
    NEW.stock_status := 'Out of Stock';
  elsif NEW.remaining_stock <= NEW.low_stock_alert then
    NEW.stock_status := 'Low Stock';
  else
    NEW.stock_status := 'Available';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_inventory_status on public.inventory;
create trigger trg_inventory_status
before insert or update of remaining_stock, low_stock_alert on public.inventory
for each row execute function public.update_stock_status();

-- -------------------------------------------------------------
-- 9. INVENTORY LOGS
-- -------------------------------------------------------------
create table if not exists public.inventory_logs (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.inventory(id) on delete cascade,
  action        text not null check (action in ('add','consume','update','create')),
  quantity      numeric(12,2) not null default 0,
  performed_by  uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 10. PAYMENTS
-- -------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  amount      numeric(12,2) not null default 0,
  method      text,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 11. CONSENT FORMS
-- -------------------------------------------------------------
create table if not exists public.consent_forms (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  file_url    text,
  signed_at   timestamptz not null default now(),
  created_by  uuid references public.profiles(id)
);

-- -------------------------------------------------------------
-- 12. ACTIVITY LOGS
-- -------------------------------------------------------------
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  actor_name  text,
  action      text not null,
  entity      text,
  entity_id   uuid,
  details     text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- Auto-fill actor_name if the client didn't provide one
create or replace function public.fill_activity_actor_name() returns trigger as $$
begin
  if NEW.actor_name is null and NEW.actor_id is not null then
    select coalesce(p.full_name, p.email)
      into NEW.actor_name
      from public.profiles p
      where p.id = NEW.actor_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_activity_actor_name on public.activity_logs;
create trigger trg_activity_actor_name
before insert on public.activity_logs
for each row execute function public.fill_activity_actor_name();

-- -------------------------------------------------------------
-- 13. SETTINGS (singleton row)
-- -------------------------------------------------------------
create table if not exists public.settings (
  id                 uuid primary key default gen_random_uuid(),
  clinic_name        text not null default 'Pretty Chic Aesthetics',
  logo_url           text,
  theme_color        text not null default '#503626',
  sidebar_color      text not null default '#2B1C13',
  low_stock_default  int not null default 5,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id)
);
insert into public.settings (clinic_name) select 'Pretty Chic Aesthetics'
  where not exists (select 1 from public.settings);

-- -------------------------------------------------------------
-- AUTO PROFILE CREATION ON SIGNUP
-- -------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger as $$
declare
  v_role text;
  v_name text;
begin
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'staff');
  v_name := coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  insert into public.profiles (id, full_name, email, role)
  values (NEW.id, v_name, NEW.email, v_role)
  on conflict (id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- HELPER: is_admin()
-- -------------------------------------------------------------
create or replace function public.is_admin() returns boolean as $$
  select exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin' and p.is_active);
$$ language sql stable security definer;

create or replace function public.is_authenticated_active() returns boolean as $$
  select exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.is_active);
$$ language sql stable security definer;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table public.profiles       enable row level security;
alter table public.employees      enable row level security;
alter table public.clients        enable row level security;
alter table public.packages       enable row level security;
alter table public.appointments   enable row level security;
alter table public.sessions       enable row level security;
alter table public.expenses       enable row level security;
alter table public.inventory      enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.payments       enable row level security;
alter table public.consent_forms  enable row level security;
alter table public.activity_logs  enable row level security;
alter table public.settings       enable row level security;

-- Profiles: read self + everyone if admin; admin can update any; user can update own basics.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_admin() or auth.uid() = id)
  with check (public.is_admin() or auth.uid() = id);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (true); -- handled by trigger / admin service role

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.is_admin());

-- Generic helper macros: any active user can SELECT/INSERT/UPDATE most tables; only admin can DELETE.
do $$
declare
  t text;
  tables text[] := array[
    'employees','clients','packages','appointments','sessions',
    'expenses','inventory','inventory_logs','payments','consent_forms'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format($p$create policy %I_select on public.%I for select using (public.is_authenticated_active());$p$, t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format($p$create policy %I_insert on public.%I for insert with check (public.is_authenticated_active());$p$, t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format($p$create policy %I_update on public.%I for update using (public.is_authenticated_active());$p$, t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format($p$create policy %I_delete on public.%I for delete using (public.is_admin());$p$, t, t);
  end loop;
end $$;

-- Activity logs: everyone can read, all authenticated can insert, no updates/deletes.
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select
  using (public.is_authenticated_active());
drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs for insert
  with check (public.is_authenticated_active());

-- Settings: everyone reads, only admin writes.
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select
  using (true);
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings for insert
  with check (public.is_admin());

-- -------------------------------------------------------------
-- STORAGE: clinic-assets bucket (logos, consent files)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do nothing;

drop policy if exists "clinic_assets_read" on storage.objects;
create policy "clinic_assets_read" on storage.objects for select
  using (bucket_id = 'clinic-assets');

drop policy if exists "clinic_assets_write" on storage.objects;
create policy "clinic_assets_write" on storage.objects for insert
  with check (bucket_id = 'clinic-assets' and public.is_authenticated_active());

drop policy if exists "clinic_assets_update" on storage.objects;
create policy "clinic_assets_update" on storage.objects for update
  using (bucket_id = 'clinic-assets' and public.is_authenticated_active());

drop policy if exists "clinic_assets_delete" on storage.objects;
create policy "clinic_assets_delete" on storage.objects for delete
  using (bucket_id = 'clinic-assets' and public.is_admin());

-- =============================================================
-- Pretty Chic Aesthetics — Business Logic Enhancement Migration
-- Run this in Supabase SQL Editor AFTER 0001 / schema.sql.
-- Safe to re-run (idempotent).
-- =============================================================

-- 1. Owner role
-- -------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner','admin','staff'));

-- Prevent demoting / disabling / deleting an owner.
create or replace function public.protect_owner_profile()
returns trigger as $$
declare
  v_role text;
begin
  -- on UPDATE
  if tg_op = 'UPDATE' then
    if OLD.role = 'owner' and NEW.role <> 'owner' then
      raise exception 'Owner role cannot be downgraded.';
    end if;
    if OLD.role = 'owner' and NEW.is_active = false then
      raise exception 'Owner account cannot be disabled.';
    end if;
    return NEW;
  end if;
  -- on DELETE
  if tg_op = 'DELETE' then
    if OLD.role = 'owner' then
      raise exception 'Owner account cannot be deleted.';
    end if;
    return OLD;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_owner_update on public.profiles;
create trigger trg_protect_owner_update
before update on public.profiles
for each row execute function public.protect_owner_profile();

drop trigger if exists trg_protect_owner_delete on public.profiles;
create trigger trg_protect_owner_delete
before delete on public.profiles
for each row execute function public.protect_owner_profile();

-- Helper used by RLS — owner OR admin.
create or replace function public.is_owner_or_admin() returns boolean as $$
  select exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('owner','admin') and p.is_active);
$$ language sql stable security definer;

create or replace function public.is_owner() returns boolean as $$
  select exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'owner' and p.is_active);
$$ language sql stable security definer;

-- Upgrade is_admin so existing policies treat owner as admin.
create or replace function public.is_admin() returns boolean as $$
  select exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('owner','admin') and p.is_active);
$$ language sql stable security definer;


-- 2. Clients: nothing new structurally; data fits existing columns.
-- -------------------------------------------------------------


-- 3. Packages: enrich to drive the new business logic.
-- -------------------------------------------------------------
alter table public.packages
  add column if not exists amount_paid     numeric(12,2) not null default 0,
  add column if not exists balance         numeric(12,2) not null default 0,
  add column if not exists payment_status  text not null default 'Unpaid',
  add column if not exists start_date      date,
  add column if not exists interval_days   int,
  add column if not exists interval_label  text,
  add column if not exists status          text not null default 'Active';

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='packages' and constraint_name='packages_payment_status_check'
  ) then
    alter table public.packages
      add constraint packages_payment_status_check
      check (payment_status in ('Paid','Partial','Unpaid'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='packages' and constraint_name='packages_status_check'
  ) then
    alter table public.packages
      add constraint packages_status_check
      check (status in ('Active','Completed','Cancelled','Expired'));
  end if;
end $$;

-- 4. Appointments: link to package + record price.
-- -------------------------------------------------------------
alter table public.appointments
  add column if not exists package_id uuid references public.packages(id) on delete set null,
  add column if not exists session_index int;
create index if not exists appointments_package_idx on public.appointments(package_id);


-- 5. Inventory: vial/box/bottle/tube container support + per-container volume.
-- -------------------------------------------------------------
alter table public.inventory
  add column if not exists container_type text default 'unit',
  add column if not exists container_size numeric(12,3),
  add column if not exists container_unit text default 'ml',
  add column if not exists containers     numeric(12,3) not null default 0,
  add column if not exists consume_unit   text;

-- container_type: 'unit' (no conversion), 'vial', 'box', 'bottle', 'tube'
-- container_size: e.g. 10 (each vial holds 10 ml)
-- container_unit: ml / mg
-- containers: total containers in stock
-- remaining_stock: stays as the "usable amount" expressed in container_unit (e.g. total ml)
-- consume_unit: 'ml' | 'mg' | 'vial' | 'box' | 'tube' | 'bottle' | 'piece'


-- 6. Inventory logs: record who consumed, for which client/appointment.
-- -------------------------------------------------------------
alter table public.inventory_logs
  add column if not exists client_id      uuid references public.clients(id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists unit           text,
  add column if not exists note           text;

-- Allow the new container action types.
alter table public.inventory_logs
  drop constraint if exists inventory_logs_action_check;
alter table public.inventory_logs
  add constraint inventory_logs_action_check
  check (action in ('add','consume','update','create','adjust'));


-- 7. Payments: link to a package so the package balance auto-updates.
-- -------------------------------------------------------------
alter table public.payments
  add column if not exists package_id uuid references public.packages(id) on delete set null;
create index if not exists payments_package_idx on public.payments(package_id);


-- =============================================================
-- 8. AUTO-UPDATE TRIGGERS
-- =============================================================

-- A. Refresh package payment_status from amount_paid / price.
create or replace function public.refresh_package_payment()
returns trigger as $$
begin
  NEW.balance := greatest(0, coalesce(NEW.price, 0) - coalesce(NEW.amount_paid, 0));
  if coalesce(NEW.price,0) <= 0 then
    NEW.payment_status := 'Unpaid';
  elsif NEW.amount_paid >= NEW.price then
    NEW.payment_status := 'Paid';
  elsif NEW.amount_paid > 0 then
    NEW.payment_status := 'Partial';
  else
    NEW.payment_status := 'Unpaid';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_packages_payment on public.packages;
create trigger trg_packages_payment
before insert or update of price, amount_paid on public.packages
for each row execute function public.refresh_package_payment();


-- B. When a payment is recorded, increment the package and recompute client balance.
create or replace function public.apply_payment_to_package_and_client()
returns trigger as $$
declare
  v_remaining_balance numeric(12,2);
  v_client_status     text;
begin
  -- bump package amount_paid (triggers refresh_package_payment in turn)
  if NEW.package_id is not null then
    update public.packages
      set amount_paid = coalesce(amount_paid,0) + NEW.amount
      where id = NEW.package_id;
  end if;

  -- recompute client outstanding balance = sum of all package balances - already-paid not yet posted
  select coalesce(sum(balance), 0)
    into v_remaining_balance
    from public.packages
    where client_id = NEW.client_id;

  if v_remaining_balance <= 0 then
    v_client_status := 'Paid';
  elsif v_remaining_balance < (
    select coalesce(sum(price),0) from public.packages where client_id = NEW.client_id
  ) then
    v_client_status := 'Partial';
  else
    v_client_status := 'Unpaid';
  end if;

  update public.clients
    set balance = v_remaining_balance,
        payment_status = v_client_status
    where id = NEW.client_id;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_payments_apply on public.payments;
create trigger trg_payments_apply
after insert on public.payments
for each row execute function public.apply_payment_to_package_and_client();


-- C. Auto stock_status now considers low_stock_alert in the same usable-quantity column.
-- (already exists from 0001 — re-create to be safe and correct ordering with new fields)
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
before insert or update of remaining_stock, low_stock_alert, containers on public.inventory
for each row execute function public.update_stock_status();


-- D. When an appointment is marked Done, decrement the package's used_sessions
--    and the client's remaining_sessions.
create or replace function public.handle_appointment_status_change()
returns trigger as $$
declare
  v_total      int;
  v_used       int;
  v_remaining  int;
begin
  if tg_op = 'UPDATE' and OLD.status <> 'Done' and NEW.status = 'Done' then
    if NEW.package_id is not null then
      update public.packages
        set used_sessions = coalesce(used_sessions,0) + 1
        where id = NEW.package_id
        returning total_sessions, used_sessions into v_total, v_used;
      v_remaining := greatest(0, coalesce(v_total,0) - coalesce(v_used,0));
      -- if package fully used, mark Completed (but don't override Cancelled)
      if v_used >= v_total then
        update public.packages set status = 'Completed' where id = NEW.package_id and status = 'Active';
      end if;
    end if;
    -- decrement client remaining_sessions (clamped at 0)
    update public.clients
      set remaining_sessions = greatest(0, coalesce(remaining_sessions,0) - 1)
      where id = NEW.client_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_appointment_done on public.appointments;
create trigger trg_appointment_done
after update of status on public.appointments
for each row execute function public.handle_appointment_status_change();


-- =============================================================
-- 9. RLS — owners have the same write access as admins; profiles management.
-- =============================================================

-- Profiles: owners can do anything; admins still manage staff (but cannot touch owners — protected by trigger).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (auth.uid() = id or public.is_owner_or_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_owner_or_admin() or auth.uid() = id)
  with check (public.is_owner_or_admin() or auth.uid() = id);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.is_owner());

-- The generic-table policies are already keyed off is_admin(), which now includes owners.
-- Re-run them so policies are present even on a fresh enhancement install.
do $$
declare
  t text;
  tables text[] := array[
    'employees','clients','packages','appointments','sessions',
    'expenses','inventory','inventory_logs','payments','consent_forms'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format($p$create policy %I_delete on public.%I for delete using (public.is_owner_or_admin());$p$, t, t);
  end loop;
end $$;

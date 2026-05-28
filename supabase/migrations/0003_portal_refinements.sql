-- =============================================================
-- Pretty Chic Aesthetics — Portal Refinements Patch (cumulative)
-- Paste into Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Brings the database up to date with the current portal code:
--   - clients.emergency_contact
--   - profiles.username  (mirrors local-part of internal email when set)
--   - settings columns (logo_url already present from 0001 — re-checked)
--   - packages: amount_paid, balance, payment_status, used_sessions,
--     remaining_sessions, start_date, valid_until,
--     interval_days, interval_label, status, notes
--   - appointments: package_id, treatment, status, date, time, session_index
--   - inventory: containers, container_type, container_size,
--     container_unit, consume_unit, measurement_unit, total_usable_quantity
--   - inventory_logs: client_id, appointment_id, unit, note
-- =============================================================

-- 1. CLIENTS — emergency contact (form field)
alter table public.clients
  add column if not exists emergency_contact text;


-- 2. PROFILES — username column for username-based staff login
alter table public.profiles
  add column if not exists username text;

-- Backfill from internal e-mail (`username@prettychic.local`)
update public.profiles
  set username = split_part(email, '@', 1)
  where username is null
    and email like '%@prettychic.local';

create unique index if not exists profiles_username_idx
  on public.profiles (lower(username))
  where username is not null;


-- 3. SETTINGS — verify logo_url + add updated_by if missing
alter table public.settings
  add column if not exists logo_url    text,
  add column if not exists updated_by  uuid references public.profiles(id);


-- 4. PACKAGES — full set of columns used by Packages UI
alter table public.packages
  add column if not exists amount_paid      numeric(12,2) not null default 0,
  add column if not exists balance          numeric(12,2) not null default 0,
  add column if not exists payment_status   text not null default 'Unpaid',
  add column if not exists used_sessions    int  not null default 0,
  add column if not exists remaining_sessions int generated always as
       (greatest(0, coalesce(total_sessions,0) - coalesce(used_sessions,0))) stored,
  add column if not exists start_date       date,
  add column if not exists interval_days    int,
  add column if not exists interval_label   text,
  add column if not exists status           text not null default 'Active',
  add column if not exists notes            text;

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


-- 5. APPOINTMENTS — link to package + session number + status/date/time
alter table public.appointments
  add column if not exists package_id     uuid references public.packages(id) on delete set null,
  add column if not exists session_index  int,
  add column if not exists treatment      text;

create index if not exists appointments_package_idx on public.appointments(package_id);
create index if not exists appointments_date_idx    on public.appointments(date);


-- 6. INVENTORY — container model + measurement unit + total usable quantity
alter table public.inventory
  add column if not exists container_type        text default 'unit',
  add column if not exists container_size        numeric(12,3),
  add column if not exists container_unit        text default 'ml',
  add column if not exists containers            numeric(12,3) not null default 0,
  add column if not exists consume_unit          text,
  add column if not exists measurement_unit      text,
  add column if not exists total_usable_quantity numeric(14,3)
       generated always as (
         case
           when container_type is null or container_type = 'unit' then remaining_stock
           else coalesce(remaining_stock, coalesce(containers,0) * coalesce(container_size,0))
         end
       ) stored;


-- 7. INVENTORY LOGS — enrich consume rows
alter table public.inventory_logs
  add column if not exists client_id      uuid references public.clients(id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists unit           text,
  add column if not exists note           text;

alter table public.inventory_logs
  drop constraint if exists inventory_logs_action_check;
alter table public.inventory_logs
  add constraint inventory_logs_action_check
  check (action in ('add','consume','update','create','adjust'));


-- 8. TRIGGERS — keep package balance/payment_status, client roll-up, and
--    appointment->session deduction in sync (idempotent recreate).
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


create or replace function public.apply_payment_to_package_and_client()
returns trigger as $$
declare
  v_remaining_balance numeric(12,2);
  v_client_status     text;
begin
  if NEW.package_id is not null then
    update public.packages
      set amount_paid = coalesce(amount_paid,0) + NEW.amount
      where id = NEW.package_id;
  end if;

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


create or replace function public.handle_appointment_status_change()
returns trigger as $$
declare
  v_total      int;
  v_used       int;
begin
  if tg_op = 'UPDATE' and OLD.status <> 'Done' and NEW.status = 'Done' then
    if NEW.package_id is not null then
      update public.packages
        set used_sessions = coalesce(used_sessions,0) + 1
        where id = NEW.package_id
        returning total_sessions, used_sessions into v_total, v_used;
      if v_used >= v_total then
        update public.packages
          set status = 'Completed'
          where id = NEW.package_id and status = 'Active';
      end if;
    end if;
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


-- 9. STORAGE — make sure the clinic-assets bucket is public so logos render.
insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do update set public = excluded.public;

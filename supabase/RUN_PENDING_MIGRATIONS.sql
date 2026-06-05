-- =========================================================
-- PRETTY CHIC — PENDING MIGRATIONS BUNDLE (0012 + 0013 + 0014 + 0015)
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Every statement is idempotent / safe to re-run.
--
-- 0012 — Session sync + client financials rollup
--        * Fixes duplicate session deduction.
--        * used_sessions / remaining_sessions derived from the real
--          appointment schedule (idempotent — no double deduction on edit).
--        * Client balance + payment status rolled up from packages
--          (so they stay correct without the removed Payments module).
-- 0013 — Deleted Schedules audit log (who/what/when/why).
-- 0014 — Expense "Maintenance" category + expense_date for monthly views.
-- 0015 — Structured audit trail (old_value / new_value on activity_logs).
-- =========================================================


-- =========================================================
-- 0012 — SESSION SYNC + CLIENT FINANCIALS ROLLUP
-- =========================================================
drop trigger if exists trg_appointment_done on public.appointments;
drop trigger if exists trg_update_remaining_sessions on public.appointments;
drop function if exists public.handle_appointment_status_change() cascade;
drop function if exists public.update_remaining_sessions() cascade;

alter table public.packages
  add column if not exists used_sessions      integer not null default 0,
  add column if not exists remaining_sessions integer not null default 0;

create or replace function public.refresh_package_sessions()
returns trigger as $$
begin
  NEW.used_sessions := greatest(0, coalesce(NEW.used_sessions, 0));
  NEW.remaining_sessions := greatest(0, coalesce(NEW.total_sessions, 0) - NEW.used_sessions);
  if coalesce(NEW.total_sessions, 0) > 0 and NEW.used_sessions >= NEW.total_sessions then
    if NEW.status = 'Active' then NEW.status := 'Completed'; end if;
  elsif NEW.status = 'Completed' and NEW.used_sessions < coalesce(NEW.total_sessions, 0) then
    NEW.status := 'Active';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_package_sessions on public.packages;
create trigger trg_package_sessions
before insert or update of total_sessions, used_sessions on public.packages
for each row execute function public.refresh_package_sessions();

create or replace function public.recompute_package_used(p_pkg uuid)
returns void as $$
declare
  v_done int;
begin
  if p_pkg is null then return; end if;
  select count(*) into v_done
    from public.appointments
    where package_id = p_pkg and status = 'Done';
  update public.packages set used_sessions = v_done where id = p_pkg;
end;
$$ language plpgsql;

create or replace function public.rollup_client_from_packages()
returns trigger as $$
declare
  v_client    uuid;
  v_count     int;
  v_balance   numeric(12,2);
  v_paid      numeric(12,2);
  v_total     int;
  v_remaining int;
  v_status    text;
begin
  v_client := coalesce(NEW.client_id, OLD.client_id);
  if v_client is null then return coalesce(NEW, OLD); end if;

  select count(*),
         coalesce(sum(balance), 0),
         coalesce(sum(amount_paid), 0),
         coalesce(sum(total_sessions), 0),
         coalesce(sum(greatest(0, coalesce(total_sessions, 0) - coalesce(used_sessions, 0))), 0)
    into v_count, v_balance, v_paid, v_total, v_remaining
    from public.packages
    where client_id = v_client;

  if v_count = 0 then
    update public.clients set balance = 0, payment_status = 'Paid' where id = v_client;
    return coalesce(NEW, OLD);
  end if;

  if v_balance <= 0 then
    v_status := 'Paid';
  elsif v_paid > 0 then
    v_status := 'Partial';
  else
    v_status := 'Unpaid';
  end if;

  update public.clients set
    balance            = v_balance,
    payment_status     = v_status,
    total_sessions     = v_total,
    remaining_sessions = v_remaining
    where id = v_client;

  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

drop trigger if exists trg_rollup_client on public.packages;
create trigger trg_rollup_client
after insert or update or delete on public.packages
for each row execute function public.rollup_client_from_packages();

create or replace function public.sync_package_from_appointment()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_package_used(NEW.package_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_package_used(OLD.package_id);
  else
    perform public.recompute_package_used(NEW.package_id);
    if OLD.package_id is distinct from NEW.package_id then
      perform public.recompute_package_used(OLD.package_id);
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

drop trigger if exists trg_appt_sync_package on public.appointments;
create trigger trg_appt_sync_package
after insert or update or delete on public.appointments
for each row execute function public.sync_package_from_appointment();

update public.packages p set used_sessions = (
  select count(*) from public.appointments a
  where a.package_id = p.id and a.status = 'Done'
);
update public.packages set used_sessions = used_sessions;


-- =========================================================
-- 0013 — DELETED SCHEDULES (AUDIT LOG)
-- =========================================================
create table if not exists public.deleted_appointments (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid,
  client_id        uuid,
  client_name      text,
  package_id       uuid,
  package_name     text,
  treatment        text,
  original_date    date,
  original_time    time,
  status           text,
  notes            text,
  reason           text,
  deleted_by       uuid references public.profiles(id) on delete set null,
  deleted_by_name  text,
  deleted_at       timestamptz not null default now()
);

create index if not exists deleted_appts_deleted_at_idx
  on public.deleted_appointments (deleted_at desc);
create index if not exists deleted_appts_client_idx
  on public.deleted_appointments (client_id);

create or replace function public.fill_deleted_appt_actor() returns trigger as $$
begin
  if NEW.deleted_by_name is null and NEW.deleted_by is not null then
    select coalesce(p.full_name, p.email)
      into NEW.deleted_by_name
      from public.profiles p
      where p.id = NEW.deleted_by;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_deleted_appt_actor on public.deleted_appointments;
create trigger trg_deleted_appt_actor
before insert on public.deleted_appointments
for each row execute function public.fill_deleted_appt_actor();

alter table public.deleted_appointments enable row level security;

drop policy if exists deleted_appts_select on public.deleted_appointments;
create policy deleted_appts_select on public.deleted_appointments
  for select using (public.is_admin());

drop policy if exists deleted_appts_insert on public.deleted_appointments;
create policy deleted_appts_insert on public.deleted_appointments
  for insert with check (public.is_authenticated_active());


-- =========================================================
-- 0014 — EXPENSE CATEGORIES + MONTHLY GROUPING
-- =========================================================
alter table public.expenses
  drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check
  check (category in ('Rent','Salary','Supplies','Marketing','Utilities','Maintenance','Other'));

alter table public.expenses
  add column if not exists expense_date date;
update public.expenses
  set expense_date = coalesce(due_date, created_at::date)
  where expense_date is null;
alter table public.expenses
  alter column expense_date set default current_date;
create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date);

-- Drop the obsolete staff_permissions.payments column (Payments module removed).
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


-- =========================================================
-- 0015 — STRUCTURED AUDIT TRAIL (old_value / new_value)
-- =========================================================
alter table public.activity_logs
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

create index if not exists activity_logs_entity_idx
  on public.activity_logs (entity, created_at desc);


-- =========================================================
-- Refresh PostgREST schema cache.
-- =========================================================
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

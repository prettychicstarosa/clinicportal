-- =========================================================
-- PRETTY CHIC — SESSION SYNC + CLIENT FINANCIALS ROLLUP
-- Safe to re-run (idempotent).
--
-- Fixes:
--   1. Duplicate session deduction. Two old triggers
--      (trg_appointment_done + trg_update_remaining_sessions) each
--      incremented used_sessions when an appointment was marked Done,
--      so every completion deducted TWO sessions. They also never
--      restored a session when an appointment was un-marked, deleted,
--      or rescheduled.
--   2. used_sessions / remaining_sessions are now DERIVED from the
--      actual saved appointments (count of 'Done' appointments per
--      package). Editing the same appointment is idempotent — it can
--      never double-deduct, and the remaining count always reflects
--      the real schedule.
--   3. Client balance + payment status are now rolled up directly from
--      packages, so they stay correct even though the Payments module
--      has been removed.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Remove the old increment-based triggers/functions.
-- ---------------------------------------------------------
drop trigger if exists trg_appointment_done on public.appointments;
drop trigger if exists trg_update_remaining_sessions on public.appointments;
drop function if exists public.handle_appointment_status_change() cascade;
drop function if exists public.update_remaining_sessions() cascade;

-- Make sure the package session columns exist.
alter table public.packages
  add column if not exists used_sessions      integer not null default 0,
  add column if not exists remaining_sessions integer not null default 0;

-- ---------------------------------------------------------
-- 1. Keep a package row's remaining_sessions + status in sync
--    with its total/used counts (row-local, no recursion).
-- ---------------------------------------------------------
create or replace function public.refresh_package_sessions()
returns trigger as $$
begin
  NEW.used_sessions := greatest(0, coalesce(NEW.used_sessions, 0));
  NEW.remaining_sessions := greatest(0, coalesce(NEW.total_sessions, 0) - NEW.used_sessions);

  -- Auto-complete / re-open based on usage, but never override a
  -- manually Cancelled / Expired package.
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

-- ---------------------------------------------------------
-- 2. Recompute a package's used_sessions from the real schedule.
--    used = number of linked appointments that are marked 'Done'.
-- ---------------------------------------------------------
create or replace function public.recompute_package_used(p_pkg uuid)
returns void as $$
declare
  v_done int;
begin
  if p_pkg is null then return; end if;
  select count(*) into v_done
    from public.appointments
    where package_id = p_pkg and status = 'Done';
  -- Triggers refresh_package_sessions (remaining/status) + the client
  -- rollup below.
  update public.packages set used_sessions = v_done where id = p_pkg;
end;
$$ language plpgsql;

-- ---------------------------------------------------------
-- 3. Roll the client's balance / payment status / session counters
--    up from ALL of that client's packages.
-- ---------------------------------------------------------
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
    -- No packages left for this client — nothing package-derived to owe.
    update public.clients
      set balance = 0, payment_status = 'Paid'
      where id = v_client;
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

-- ---------------------------------------------------------
-- 4. Whenever an appointment changes, re-derive its package's usage.
--    Handles insert, status change, reschedule (no-op for counts),
--    re-linking to a different package, and deletion.
-- ---------------------------------------------------------
create or replace function public.sync_package_from_appointment()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_package_used(NEW.package_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_package_used(OLD.package_id);
  else -- UPDATE
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

-- ---------------------------------------------------------
-- 5. Backfill existing data so saved rows pick up the new rules.
--    Recomputing used_sessions fires the row-local + rollup triggers.
-- ---------------------------------------------------------
update public.packages p set used_sessions = (
  select count(*) from public.appointments a
  where a.package_id = p.id and a.status = 'Done'
);

-- Nudge packages with no appointments so the client rollup still runs.
update public.packages set used_sessions = used_sessions;

notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

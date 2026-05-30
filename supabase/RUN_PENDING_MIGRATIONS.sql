-- =========================================================
-- PRETTY CHIC — PENDING MIGRATIONS BUNDLE (0008 + 0009 + 0010)
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Every statement is idempotent / safe to re-run.
-- =========================================================


-- =========================================================
-- 0008 — PACKAGE PAYMENT ROUNDING FIX
-- Balance under ₱1 (rounding noise, e.g. price 3998 / paid 3998
-- leaving 0.01) counts as fully Paid and is zeroed to display ₱0.00.
-- =========================================================

create or replace function public.refresh_package_payment()
returns trigger as $$
begin
  NEW.balance := greatest(0, coalesce(NEW.price, 0) - coalesce(NEW.amount_paid, 0));

  if coalesce(NEW.price, 0) <= 0 then
    NEW.payment_status := 'Unpaid';
  elsif NEW.balance <= 0.99 then
    -- Within rounding tolerance → fully paid.
    NEW.balance := 0;
    NEW.payment_status := 'Paid';
  elsif coalesce(NEW.amount_paid, 0) > 0 then
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

-- Backfill existing rows so already-saved packages pick up the new rule.
-- Re-assigning amount_paid keeps it in the trigger's "update of" column list,
-- which re-runs refresh_package_payment() and recomputes balance + status.
update public.packages set amount_paid = amount_paid;


-- =========================================================
-- 0009 — ADD "Pending" APPOINTMENT STATUS
-- Allowed: Scheduled, Pending, Done, No Show, Cancelled
-- ("Rescheduled" kept so any legacy rows remain valid.)
-- =========================================================

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('Scheduled','Pending','Done','No Show','Cancelled','Rescheduled'));

-- Auto-generated package appointments keep defaulting to 'Scheduled'.
alter table public.appointments
  alter column status set default 'Scheduled';


-- =========================================================
-- 0010 — ASSIGNED PRACTITIONER ON APPOINTMENTS
-- staff_id = staff assigned to perform the appointment
-- (distinct from created_by, who booked the record).
-- =========================================================

alter table public.appointments
  add column if not exists staff_id uuid references public.profiles(id) on delete set null;

create index if not exists appointments_staff_idx on public.appointments(staff_id);

-- Backfill: assign existing appointments to whoever booked them (created_by),
-- but only when that profile still exists. Leaves staff_id null otherwise.
update public.appointments a
  set staff_id = a.created_by
  where a.staff_id is null
    and a.created_by is not null
    and exists (select 1 from public.profiles p where p.id = a.created_by);


-- =========================================================
-- Refresh PostgREST schema cache so new columns are visible.
-- =========================================================
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

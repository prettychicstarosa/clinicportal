-- =========================================================
-- PRETTY CHIC — ADD "Pending" APPOINTMENT STATUS
-- Allowed statuses: Scheduled, Pending, Done, No Show, Cancelled
-- ("Rescheduled" kept so any legacy rows remain valid.)
-- Safe to re-run.
-- =========================================================

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('Scheduled','Pending','Done','No Show','Cancelled','Rescheduled'));

-- Auto-generated package appointments keep defaulting to 'Scheduled'.
alter table public.appointments
  alter column status set default 'Scheduled';

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

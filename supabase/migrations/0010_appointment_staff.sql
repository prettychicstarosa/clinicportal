-- =========================================================
-- PRETTY CHIC — ASSIGNED PRACTITIONER ON APPOINTMENTS
-- staff_id = the staff member assigned to perform the appointment
-- (distinct from created_by, which is whoever booked the record).
-- Safe to re-run.
-- =========================================================

alter table public.appointments
  add column if not exists staff_id uuid references public.profiles(id) on delete set null;

create index if not exists appointments_staff_idx on public.appointments(staff_id);

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

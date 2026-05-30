-- =========================================================
-- PRETTY CHIC — ASSIGNED PRACTITIONER ON APPOINTMENTS
-- staff_id = the staff member assigned to perform the appointment
-- (distinct from created_by, which is whoever booked the record).
-- Safe to re-run.
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

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

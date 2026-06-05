-- =========================================================
-- PRETTY CHIC — DELETED SCHEDULES (AUDIT LOG)
-- A durable snapshot of every appointment/schedule that gets deleted,
-- so the admin panel can show what was removed, for whom, by whom,
-- when, and why.
-- Safe to re-run (idempotent).
-- =========================================================

create table if not exists public.deleted_appointments (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid,                       -- original appointment id (not an FK; row may be gone)
  client_id        uuid,
  client_name      text,
  package_id       uuid,
  package_name     text,
  treatment        text,
  original_date    date,
  original_time    time,
  status           text,                       -- status the appointment had when deleted
  notes            text,
  reason           text,                       -- optional reason supplied at delete time
  deleted_by       uuid references public.profiles(id) on delete set null,
  deleted_by_name  text,
  deleted_at       timestamptz not null default now()
);

create index if not exists deleted_appts_deleted_at_idx
  on public.deleted_appointments (deleted_at desc);
create index if not exists deleted_appts_client_idx
  on public.deleted_appointments (client_id);

-- Auto-fill the deleter's display name if the app didn't provide one.
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

-- RLS: any active user can log a deletion; managers (owner/admin) can read.
alter table public.deleted_appointments enable row level security;

drop policy if exists deleted_appts_select on public.deleted_appointments;
create policy deleted_appts_select on public.deleted_appointments
  for select using (public.is_admin());

drop policy if exists deleted_appts_insert on public.deleted_appointments;
create policy deleted_appts_insert on public.deleted_appointments
  for insert with check (public.is_authenticated_active());

notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

-- =========================================================
-- PRETTY CHIC — STRUCTURED AUDIT TRAIL
-- Adds before/after snapshots to the activity log so the admin can
-- review exactly what changed (old value -> new value) for schedules,
-- expenses, inventory deductions, and package/session updates.
-- Safe to re-run (idempotent).
-- =========================================================

alter table public.activity_logs
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

-- Helpful for filtering the audit trail by entity type.
create index if not exists activity_logs_entity_idx
  on public.activity_logs (entity, created_at desc);

notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================

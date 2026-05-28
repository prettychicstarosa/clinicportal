-- =============================================================
-- Pretty Chic Aesthetics — Portal Refinements Migration
-- Adds emergency_contact to clients; old columns are kept untouched.
-- Safe to re-run (idempotent).
-- =============================================================

-- 1. Clients: emergency_contact (other client columns kept for historical data)
alter table public.clients
  add column if not exists emergency_contact text;

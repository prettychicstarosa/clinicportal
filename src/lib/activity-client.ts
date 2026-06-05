"use client";
import { createSupabaseBrowserClient } from "./supabase/client";

type LogOpts = {
  action: string;
  entity?: string;
  entity_id?: string | null;
  details?: string;
  /** Structured "before" snapshot (audit trail). */
  oldValue?: Record<string, any> | null;
  /** Structured "after" snapshot (audit trail). */
  newValue?: Record<string, any> | null;
};

/**
 * Insert an activity-log entry from the browser, including optional
 * before/after value snapshots for the audit trail. If the old_value /
 * new_value columns aren't present yet (migration 0015 not applied), it
 * transparently retries without them so logging never breaks the action.
 */
export async function logActivity(opts: LogOpts) {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  const base = {
    actor_id: user?.id ?? null,
    action: opts.action,
    entity: opts.entity ?? null,
    entity_id: opts.entity_id ?? null,
    details: opts.details ?? null
  };

  const hasValues = opts.oldValue !== undefined || opts.newValue !== undefined;
  if (!hasValues) {
    await supabase.from("activity_logs").insert(base);
    return;
  }

  const res = await supabase.from("activity_logs").insert({
    ...base,
    old_value: opts.oldValue ?? null,
    new_value: opts.newValue ?? null
  });
  // Columns may not exist yet → fall back to a plain log.
  if (res.error) {
    await supabase.from("activity_logs").insert(base);
  }
}

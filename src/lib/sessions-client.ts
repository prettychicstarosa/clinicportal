"use client";
import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Recalculate a package's session usage from the REAL saved appointments
 * and persist the result. This is the single source of truth for session
 * counts and is safe to call after any appointment change (create, edit,
 * reschedule, status change, delete) or package edit.
 *
 *   completed_sessions = number of linked appointments with status 'Done'
 *   remaining_sessions = max(0, total_sessions - completed_sessions)
 *
 * Because it COUNTS completed sessions (instead of incrementing), it is
 * idempotent — editing or rescheduling the same session never deducts
 * twice, and only 'Done' sessions count as used. Cancelled / rescheduled /
 * deleted sessions automatically drop out of the count.
 *
 * It runs entirely against the current schema (packages.used_sessions /
 * remaining_sessions / total_sessions / status), so it does not depend on
 * any database trigger or migration. If the optional triggers are present
 * they compute the same value, so this stays correct either way.
 */
export async function recalcPackageSessions(packageId: string | null | undefined) {
  if (!packageId) return;
  const supabase = createSupabaseBrowserClient();

  const [{ data: appts }, { data: pkg }] = await Promise.all([
    supabase.from("appointments").select("status").eq("package_id", packageId),
    supabase.from("packages").select("total_sessions, status").eq("id", packageId).single()
  ]);

  const completed = (appts ?? []).filter((a: any) => a.status === "Done").length;
  const total = Math.max(0, Number(pkg?.total_sessions ?? 0));
  const remaining = Math.max(0, total - completed);

  const update: any = { used_sessions: completed, remaining_sessions: remaining };

  // Keep the lifecycle status roughly in sync without clobbering a manual
  // Cancelled / Expired status.
  if (total > 0 && completed >= total && pkg?.status === "Active") {
    update.status = "Completed";
  } else if (pkg?.status === "Completed" && completed < total) {
    update.status = "Active";
  }

  const res = await supabase.from("packages").update(update).eq("id", packageId);
  if (res.error) {
    // Very old schema without remaining_sessions → at least fix used_sessions
    // (the UI derives remaining as total - used as a fallback).
    await supabase.from("packages").update({ used_sessions: completed }).eq("id", packageId);
  }
}

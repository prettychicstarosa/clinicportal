"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-client";
import { recalcPackageSessions } from "@/lib/sessions-client";
import { formatDate } from "@/lib/utils";

const STATUSES = ["Scheduled", "Pending", "Done", "No Show", "Cancelled"] as const;

export default function AppointmentRow({ appt, isAdmin }: { appt: any; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeStatus(status: string) {
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const prevStatus = appt.status;
      const { error } = await supabase.from("appointments")
        .update({ status, updated_by: user?.id }).eq("id", appt.id);
      if (error) { alert(error.message); return; }
      // Re-derive the package's session counts from the real schedule.
      await recalcPackageSessions(appt.package_id);
      await logActivity({
        action: `marked appointment ${status.toLowerCase()}`,
        entity: "appointment", entity_id: appt.id,
        details: `${appt.clients?.full_name ?? ""} · ${formatDate(appt.date)} · ${prevStatus} → ${status}`,
        oldValue: { status: prevStatus },
        newValue: { status }
      });
      router.refresh();
    });
  }
  function onDelete() {
    if (!confirm("Delete this appointment?")) return;
    const reason = window.prompt(
      "Reason for deleting this schedule? (optional — kept in the Deleted Schedules log)"
    );
    if (reason === null) return; // Cancelled the prompt → abort delete.
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Snapshot the schedule into the Deleted Schedules audit log BEFORE deleting.
      await supabase.from("deleted_appointments").insert({
        appointment_id: appt.id,
        client_id: appt.client_id ?? null,
        client_name: appt.clients?.full_name ?? null,
        package_id: appt.package_id ?? null,
        package_name: appt.packages?.name ?? appt.package_name ?? null,
        treatment: appt.treatment ?? null,
        original_date: appt.date ?? null,
        original_time: appt.time ?? null,
        status: appt.status ?? null,
        notes: appt.notes ?? null,
        reason: reason.trim() || null,
        deleted_by: user?.id ?? null
      });

      const { error } = await supabase.from("appointments").delete().eq("id", appt.id);
      if (error) { alert(error.message); return; }
      // A deleted 'Done' session must free its slot back to the package.
      await recalcPackageSessions(appt.package_id);
      const pkgName = appt.packages?.name ?? appt.package_name ?? null;
      const timeStr = appt.time ? String(appt.time).slice(0, 5) : "";
      await logActivity({
        action: "deleted appointment", entity: "appointment",
        entity_id: appt.id,
        // Rich, human-readable detail so the Deleted Schedules log is complete
        // even on databases without the structured deleted_appointments table.
        details: [
          appt.clients?.full_name ?? "Unknown client",
          `${formatDate(appt.date)}${timeStr ? " " + timeStr : ""}`,
          pkgName ? `Package: ${pkgName}` : (appt.treatment ? `Treatment: ${appt.treatment}` : null),
          `Status: ${appt.status ?? "—"}`,
          reason.trim() ? `Reason: ${reason.trim()}` : null
        ].filter(Boolean).join(" · "),
        oldValue: {
          client: appt.clients?.full_name ?? null,
          date: appt.date ?? null,
          time: appt.time ?? null,
          treatment: appt.treatment ?? null,
          package: pkgName,
          status: appt.status ?? null
        },
        newValue: { reason: reason.trim() || null }
      });
      router.refresh();
    });
  }

  const badgeCls =
    appt.status === "Done" ? "badge-green" :
    appt.status === "Cancelled" ? "badge-red" :
    appt.status === "No Show" ? "badge-amber" :
    appt.status === "Pending" ? "badge-amber" : "badge-blue";

  return (
    <tr>
      <td className="table-td">
        <Link href={`/clients/${appt.client_id}`} className="underline font-medium">
          {appt.clients?.full_name}
        </Link>
      </td>
      <td className="table-td">
        {appt.packages?.name ?? <span style={{ color: "var(--color-muted)" }}>—</span>}
        {appt.session_index && appt.packages?.name && (
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
            Session {appt.session_index}
          </div>
        )}
      </td>
      <td className="table-td">{formatDate(appt.date)}</td>
      <td className="table-td">{appt.time?.slice(0, 5)}</td>
      <td className="table-td">
        {appt.assigned?.full_name ?? <span style={{ color: "var(--color-muted)" }}>— Unassigned —</span>}
      </td>
      <td className="table-td">
        <select
          disabled={pending}
          className={"input !py-1 !text-xs"}
          value={appt.status}
          onChange={e => changeStatus(e.target.value)}
        >
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className={"hidden md:inline-block ml-2 badge " + badgeCls}>{appt.status}</span>
      </td>
      <td className="table-td max-w-[200px] truncate" title={appt.notes ?? ""}>{appt.notes ?? "—"}</td>
      <td className="table-td text-right">
        <div className="flex gap-2 justify-end">
          <Link href={`/appointments/${appt.id}/edit`} className="text-xs underline">Edit</Link>
          {isAdmin && <button onClick={onDelete} className="text-xs text-red-700 underline">Delete</button>}
        </div>
      </td>
    </tr>
  );
}

"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

const STATUSES = ["Scheduled","Done","No Show","Cancelled","Rescheduled"] as const;

export default function AppointmentRow({ appt, isAdmin }: { appt: any; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeStatus(status: string) {
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointments").update({ status, updated_by: user?.id }).eq("id", appt.id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: `marked appointment ${status.toLowerCase()}`,
        entity: "appointment", entity_id: appt.id,
        details: `${appt.clients?.full_name ?? ""} · ${formatDate(appt.date)}`
      });
      router.refresh();
    });
  }
  function onDelete() {
    if (!confirm("Delete this appointment?")) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointments").delete().eq("id", appt.id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "deleted appointment", entity: "appointment"
      });
      router.refresh();
    });
  }
  return (
    <tr>
      <td className="table-td">{formatDate(appt.date)}</td>
      <td className="table-td">{appt.time?.slice(0,5)}</td>
      <td className="table-td"><Link href={`/clients/${appt.client_id}`} className="underline">{appt.clients?.full_name}</Link></td>
      <td className="table-td">{appt.treatment ?? "—"}</td>
      <td className="table-td">
        <select disabled={pending} className="input !py-1 !text-xs" value={appt.status} onChange={e => changeStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
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

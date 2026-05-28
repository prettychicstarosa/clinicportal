"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUSES = ["Scheduled","Completed","Cancelled"] as const;

export default function SessionRow({ s }: { s: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeStatus(status: string) {
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const wasCompleted = s.status === "Completed";
      const becomesCompleted = status === "Completed";
      const { error } = await supabase.from("sessions").update({ status }).eq("id", s.id);
      if (error) { alert(error.message); return; }

      if (!wasCompleted && becomesCompleted) {
        const remaining = Math.max(0, (s.clients?.remaining_sessions ?? 0) - 1);
        await supabase.from("clients").update({ remaining_sessions: remaining }).eq("id", s.client_id);
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "completed session", entity: "session", entity_id: s.id,
          details: `${s.clients?.full_name} · remaining ${remaining}`
        });
      } else {
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: `marked session ${status.toLowerCase()}`,
          entity: "session", entity_id: s.id
        });
      }
      router.refresh();
    });
  }

  return (
    <tr>
      <td className="table-td"><Link href={`/clients/${s.client_id}`} className="underline">{s.clients?.full_name}</Link></td>
      <td className="table-td">{formatDate(s.session_date)}</td>
      <td className="table-td">{s.session_time?.slice(0,5) ?? "—"}</td>
      <td className="table-td">{formatCurrency(s.amount_paid)}</td>
      <td className="table-td">{formatCurrency(s.balance)}</td>
      <td className="table-td">{formatDate(s.expiry_date)}</td>
      <td className="table-td">
        <select disabled={pending} className="input !py-1 !text-xs" value={s.status} onChange={e => changeStatus(e.target.value)}>
          {STATUSES.map(x => <option key={x}>{x}</option>)}
        </select>
      </td>
      <td className="table-td text-right">
        <Link href={`/clients/${s.client_id}`} className="text-xs underline">Client</Link>
      </td>
    </tr>
  );
}

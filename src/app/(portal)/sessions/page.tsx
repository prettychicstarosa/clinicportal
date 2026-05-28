import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import SessionRow from "./SessionRow";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const supabase = createSupabaseServerClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*, clients(full_name, remaining_sessions, total_sessions)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Sessions"
        subtitle="Track sessions against client packages"
        action={<Link href="/sessions/new" className="btn-primary"><Plus size={16}/> New Session</Link>}
      />
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Client</th><th className="table-th">Session Date</th>
                <th className="table-th">Time</th><th className="table-th">Amount</th>
                <th className="table-th">Balance</th><th className="table-th">Expiry</th>
                <th className="table-th">Status</th><th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s:any) => <SessionRow key={s.id} s={s} />)}
              {(!sessions || sessions.length===0) && (
                <tr><td colSpan={8} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No sessions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

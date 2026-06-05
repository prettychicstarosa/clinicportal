import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DeletedSchedulesPage() {
  // Manager-only audit view.
  await requireAdmin();
  const supabase = createSupabaseServerClient();

  // Preferred source: the structured deleted_appointments table (present once
  // the optional migration is applied).
  const structured = await supabase
    .from("deleted_appointments")
    .select("*")
    .order("deleted_at", { ascending: false })
    .limit(500);

  const hasStructured = !structured.error && (structured.data?.length ?? 0) > 0;

  // Fallback that always works on the current schema: the activity log already
  // records every appointment deletion (who, when, and a full detail string).
  const fallback = await supabase
    .from("activity_logs")
    .select("*")
    .eq("entity", "appointment")
    .eq("action", "deleted appointment")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <PageHeader
        title="Deleted Schedules"
        subtitle="Audit trail of every appointment/schedule that was removed"
        action={<Link href="/reports" className="btn-ghost">Back to Reports</Link>}
      />

      {hasStructured ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige-100">
                <tr>
                  <th className="table-th">Client</th>
                  <th className="table-th">Treatment / Package</th>
                  <th className="table-th">Original Date &amp; Time</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Reason / Notes</th>
                  <th className="table-th">Deleted By</th>
                  <th className="table-th">Deleted At</th>
                </tr>
              </thead>
              <tbody>
                {structured.data!.map((r: any) => (
                  <tr key={r.id}>
                    <td className="table-td font-medium">
                      {r.client_id ? (
                        <Link href={`/clients/${r.client_id}`} className="underline">{r.client_name ?? "—"}</Link>
                      ) : (r.client_name ?? "—")}
                    </td>
                    <td className="table-td">
                      {r.treatment ?? r.package_name ?? "—"}
                      {r.package_name && r.treatment && (
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>{r.package_name}</div>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      {formatDate(r.original_date)}
                      {r.original_time && (
                        <span style={{ color: "var(--color-muted)" }}> · {String(r.original_time).slice(0, 5)}</span>
                      )}
                    </td>
                    <td className="table-td"><span className="badge badge-gray">{r.status ?? "—"}</span></td>
                    <td className="table-td max-w-[260px]">
                      {r.reason ? <div>{r.reason}</div> : null}
                      {r.notes ? <div className="text-xs" style={{ color: "var(--color-muted)" }}>{r.notes}</div> : null}
                      {!r.reason && !r.notes ? "—" : null}
                    </td>
                    <td className="table-td">{r.deleted_by_name ?? "—"}</td>
                    <td className="table-td whitespace-nowrap">{formatDateTime(r.deleted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige-100">
                <tr>
                  <th className="table-th">Deleted Schedule</th>
                  <th className="table-th">Deleted By</th>
                  <th className="table-th">Deleted At</th>
                </tr>
              </thead>
              <tbody>
                {(fallback.data ?? []).map((l: any) => (
                  <tr key={l.id}>
                    <td className="table-td">{l.details ?? "—"}</td>
                    <td className="table-td">{l.actor_name ?? "—"}</td>
                    <td className="table-td whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
                {(!fallback.data || fallback.data.length === 0) && (
                  <tr>
                    <td colSpan={3} className="table-td text-center" style={{ color: "var(--color-muted)" }}>
                      No deleted schedules recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

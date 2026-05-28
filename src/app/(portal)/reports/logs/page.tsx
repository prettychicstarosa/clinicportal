import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const supabase = createSupabaseServerClient();
  const { data: logs } = await supabase
    .from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500);
  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Audit trail for all important actions" />
      <div className="card">
        {(logs ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No activity logged yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {logs!.map((l: any) => (
              <li key={l.id} className="py-3 flex items-start justify-between gap-4 text-sm">
                <div>
                  <p><b>{l.actor_name ?? "System"}</b> {l.action}{l.details ? <> — <span style={{ color: "var(--color-muted)" }}>{l.details}</span></> : null}</p>
                  {l.entity && <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>entity: {l.entity}</p>}
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

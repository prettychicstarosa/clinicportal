import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtVal(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// Build a compact list of changed fields from old/new snapshots.
function diffRows(oldVal: any, newVal: any): { key: string; from: string; to: string }[] {
  if (!oldVal && !newVal) return [];
  const keys = new Set<string>([
    ...(oldVal ? Object.keys(oldVal) : []),
    ...(newVal ? Object.keys(newVal) : [])
  ]);
  const rows: { key: string; from: string; to: string }[] = [];
  for (const k of keys) {
    const from = oldVal ? oldVal[k] : undefined;
    const to = newVal ? newVal[k] : undefined;
    // When both snapshots exist, only show fields that actually changed.
    if (oldVal && newVal && String(from ?? "") === String(to ?? "")) continue;
    rows.push({ key: k, from: fmtVal(from), to: fmtVal(to) });
  }
  return rows;
}

export default async function LogsPage() {
  const supabase = createSupabaseServerClient();
  const { data: logs } = await supabase
    .from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500);

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Complete audit trail of all important actions" />
      <div className="card">
        {(logs ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No activity logged yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {logs!.map((l: any) => {
              const rows = diffRows(l.old_value, l.new_value);
              const isEdit = l.old_value && l.new_value;
              return (
                <li key={l.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p>
                        <b>{l.actor_name ?? "System"}</b> {l.action}
                        {l.details ? <> — <span style={{ color: "var(--color-muted)" }}>{l.details}</span></> : null}
                      </p>
                      {l.entity && <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>entity: {l.entity}</p>}

                      {rows.length > 0 && (
                        <div className="mt-2 rounded-lg border bg-beige-50 px-3 py-2 text-xs" style={{ borderColor: "var(--color-border)" }}>
                          {rows.map(r => (
                            <div key={r.key} className="flex flex-wrap gap-1 py-0.5">
                              <span className="font-medium">{r.key}:</span>
                              {isEdit ? (
                                <>
                                  <span style={{ color: "var(--color-muted)" }}>{r.from}</span>
                                  <span>→</span>
                                  <span style={{ color: "var(--color-primary)" }}>{r.to}</span>
                                </>
                              ) : (
                                <span style={{ color: "var(--color-primary)" }}>{l.old_value ? r.from : r.to}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

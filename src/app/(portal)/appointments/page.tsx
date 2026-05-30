import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import AppointmentsList from "./AppointmentsList";
import { getCurrentProfile, isManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams: { view?: string; status?: string; filter?: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const view = searchParams.view ?? "list";

  // NOTE: do NOT embed `assigned:staff_id(...)` here. If the staff_id column/FK
  // isn't present yet, PostgREST rejects the WHOLE query and every appointment
  // vanishes. Select plainly (LEFT-joining only the always-present relations)
  // and resolve the assigned practitioner name separately below.
  const { data: appts, error } = await supabase
    .from("appointments")
    .select("*, clients(full_name, mobile), packages(name)")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1000);

  if (error) console.error("appointments query error", error);

  // Resolve assigned-staff names without depending on the staff_id FK embed.
  const staffIds = Array.from(
    new Set((appts ?? []).map((a: any) => a.staff_id).filter(Boolean))
  );
  const staffMap: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", staffIds);
    for (const s of staff ?? []) staffMap[s.id] = s.full_name;
  }

  const rows = (appts ?? []).map((a: any) => ({
    ...a,
    assigned: a.staff_id ? { full_name: staffMap[a.staff_id] ?? null } : null
  }));

  console.log("appointments loaded", rows.length, rows);

  const groups = new Map<string, any[]>();
  for (const a of rows) {
    const key = a.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Schedule, reschedule, and track attendance"
        action={
          <div className="flex gap-2">
            <Link href="/appointments?view=list" className={`btn-ghost ${view === "list" ? "!bg-beige-100" : ""}`}>List</Link>
            <Link href="/appointments?view=calendar" className={`btn-ghost ${view === "calendar" ? "!bg-beige-100" : ""}`}>Calendar</Link>
            <Link href="/appointments/new" className="btn-primary"><Plus size={16} /> New</Link>
          </div>
        }
      />

      {view === "calendar" ? (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([date, items]) => (
            <div key={date} className="card">
              <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>{formatDate(date)}</h3>
              <ul className="space-y-2">
                {items.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span>
                      {a.time?.slice(0, 5)} —{" "}
                      <Link href={`/clients/${a.client_id}`} className="underline">{a.clients?.full_name}</Link>
                      {" · "}
                      {a.treatment ?? a.packages?.name ?? "—"}
                    </span>
                    <span className="badge badge-gray">{a.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.size === 0 && <p className="text-sm" style={{ color: "var(--color-muted)" }}>No appointments yet.</p>}
        </div>
      ) : (
        <AppointmentsList
          appts={rows}
          isAdmin={isManager(profile.role)}
          initialStatus={searchParams.status ?? ""}
          initialFilter={searchParams.filter ?? "All"}
        />
      )}
    </div>
  );
}

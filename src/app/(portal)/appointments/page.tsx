import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import AppointmentsList from "./AppointmentsList";
import { getCurrentProfile, isManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const view = searchParams.view ?? "list";
  const { data: appts } = await supabase
    .from("appointments")
    .select("*, clients(full_name, mobile), packages(name), assigned:staff_id(full_name)")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(500);

  const groups = new Map<string, any[]>();
  for (const a of appts ?? []) {
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
        <AppointmentsList appts={appts ?? []} isAdmin={isManager(profile.role)} />
      )}
    </div>
  );
}

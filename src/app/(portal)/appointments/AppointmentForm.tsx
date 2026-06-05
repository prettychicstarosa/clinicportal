"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-client";
import { recalcPackageSessions } from "@/lib/sessions-client";

type Props = {
  mode: "create" | "edit";
  initial?: any;
  clients: { id: string; full_name: string }[];
  packages?: { id: string; name: string; client_id: string; total_sessions: number; used_sessions: number }[];
  staff?: { id: string; full_name: string }[];
};

const STATUSES = ["Scheduled", "Pending", "Done", "No Show", "Cancelled"];

export default function AppointmentForm({ mode, initial = {}, clients, packages = [], staff = [] }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initial.client_id ?? "",
    package_id: initial.package_id ?? "",
    staff_id: initial.staff_id ?? "",
    date: initial.date ?? new Date().toISOString().split("T")[0],
    time: initial.time ?? "10:00",
    treatment: initial.treatment ?? "",
    status: initial.status ?? "Scheduled",
    notes: initial.notes ?? ""
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));

  const clientPackages = packages.filter(p => p.client_id === f.client_id);

  // If client changes and selected package no longer belongs to client, clear it.
  useEffect(() => {
    if (f.package_id && !clientPackages.find(p => p.id === f.package_id)) {
      setF(prev => ({ ...prev, package_id: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.client_id]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Please select a client."); return; }
    const clientName = clients.find(c => c.id === f.client_id)?.full_name ?? "";
    const snapshot = (src: any) => ({
      date: src.date ?? null,
      time: src.time ?? null,
      treatment: src.treatment ?? null,
      status: src.status ?? null,
      package_id: src.package_id || null,
      staff_id: src.staff_id || null
    });
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      // Base payload without staff_id, plus the staff_id we'd like to save.
      const base = {
        client_id: f.client_id,
        package_id: f.package_id || null,
        date: f.date,
        time: f.time,
        treatment: f.treatment,
        status: f.status,
        notes: f.notes
      };
      const payload = { ...base, staff_id: f.staff_id || null };

      // The staff_id column may not exist yet (migration 0010 not applied).
      // If a write fails because of it, retry once without staff_id so the
      // appointment still saves.
      const isMissingStaffId = (e: any) =>
        !!e && (e.code === "PGRST204" || e.code === "42703" ||
          (typeof e.message === "string" && e.message.toLowerCase().includes("staff_id")));

      if (mode === "create") {
        let res = await supabase
          .from("appointments")
          .insert({ ...payload, created_by: user?.id })
          .select("id").single();
        if (res.error && isMissingStaffId(res.error)) {
          res = await supabase
            .from("appointments")
            .insert({ ...base, created_by: user?.id })
            .select("id").single();
        }
        if (res.error) { setErr(res.error.message); return; }
        await recalcPackageSessions(f.package_id || null);
        await logActivity({
          action: "scheduled appointment",
          entity: "appointment", entity_id: res.data!.id,
          details: `${clientName} · ${f.date} ${f.time}`,
          newValue: snapshot(f)
        });
      } else {
        let res = await supabase
          .from("appointments")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", initial.id);
        if (res.error && isMissingStaffId(res.error)) {
          res = await supabase
            .from("appointments")
            .update({ ...base, updated_by: user?.id })
            .eq("id", initial.id);
        }
        if (res.error) { setErr(res.error.message); return; }
        // Re-derive counts for the current package, and for the previous one
        // if the appointment was moved to a different package.
        await recalcPackageSessions(f.package_id || null);
        if (initial.package_id && initial.package_id !== (f.package_id || null)) {
          await recalcPackageSessions(initial.package_id);
        }
        await logActivity({
          action: "updated appointment",
          entity: "appointment", entity_id: initial.id,
          details: `${clientName} · ${initial.date ?? ""} ${initial.time ?? ""} → ${f.date} ${f.time}`,
          oldValue: snapshot(initial),
          newValue: snapshot(f)
        });
      }
      router.push("/appointments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="label">Client *</label>
        <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="label">Package (optional)</label>
        <select
          className="input"
          value={f.package_id}
          onChange={e => set("package_id", e.target.value)}
          disabled={!f.client_id}
        >
          <option value="">— No package linked —</option>
          {clientPackages.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({Math.max(0, p.total_sessions - p.used_sessions)}/{p.total_sessions} left)
            </option>
          ))}
        </select>
        {f.client_id && clientPackages.length === 0 && (
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            No active packages for this client.
          </p>
        )}
      </div>

      <div><label className="label">Date</label>
        <input type="date" className="input" value={f.date} onChange={e => set("date", e.target.value)} /></div>
      <div><label className="label">Time</label>
        <input type="time" className="input" value={f.time} onChange={e => set("time", e.target.value)} /></div>
      <div className="md:col-span-2">
        <label className="label">Treatment / Notes</label>
        <input className="input" placeholder="e.g. Facial Session #2" value={f.treatment} onChange={e => set("treatment", e.target.value)} />
      </div>
      <div>
        <label className="label">Assigned Practitioner</label>
        <select className="input" value={f.staff_id} onChange={e => set("staff_id", e.target.value)}>
          <option value="">— Unassigned —</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={f.status} onChange={e => set("status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} />
      </div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

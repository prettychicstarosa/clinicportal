"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  mode: "create" | "edit";
  initial?: any;
  clients: { id: string; full_name: string }[];
  packages?: { id: string; name: string; client_id: string; total_sessions: number; used_sessions: number }[];
};

const STATUSES = ["Scheduled", "Done", "Cancelled", "No Show"];

export default function AppointmentForm({ mode, initial = {}, clients, packages = [] }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initial.client_id ?? "",
    package_id: initial.package_id ?? "",
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
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        client_id: f.client_id,
        package_id: f.package_id || null,
        date: f.date,
        time: f.time,
        treatment: f.treatment,
        status: f.status,
        notes: f.notes
      };
      if (mode === "create") {
        const { data, error } = await supabase
          .from("appointments")
          .insert({ ...payload, created_by: user?.id })
          .select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "scheduled appointment",
          entity: "appointment", entity_id: data!.id
        });
      } else {
        const { error } = await supabase
          .from("appointments")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "updated appointment",
          entity: "appointment", entity_id: initial.id
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

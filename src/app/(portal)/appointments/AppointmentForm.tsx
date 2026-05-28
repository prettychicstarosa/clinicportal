"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  mode: "create" | "edit";
  initial?: any;
  clients: { id: string; full_name: string }[];
};

const STATUSES = ["Scheduled","Done","No Show","Cancelled","Rescheduled"];

export default function AppointmentForm({ mode, initial = {}, clients }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initial.client_id ?? "",
    date: initial.date ?? new Date().toISOString().split("T")[0],
    time: initial.time ?? "10:00",
    treatment: initial.treatment ?? "",
    status: initial.status ?? "Scheduled",
    notes: initial.notes ?? ""
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Please select a client."); return; }
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (mode === "create") {
        const { data, error } = await supabase.from("appointments").insert({ ...f, created_by: user?.id }).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "scheduled appointment", entity: "appointment", entity_id: data!.id
        });
      } else {
        const { error } = await supabase.from("appointments").update({ ...f, updated_by: user?.id }).eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "updated appointment", entity: "appointment", entity_id: initial.id
        });
      }
      router.push("/appointments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Client *</label>
        <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select></div>
      <div><label className="label">Date</label>
        <input type="date" className="input" value={f.date} onChange={e => set("date", e.target.value)} /></div>
      <div><label className="label">Time</label>
        <input type="time" className="input" value={f.time} onChange={e => set("time", e.target.value)} /></div>
      <div className="md:col-span-2"><label className="label">Treatment</label>
        <input className="input" value={f.treatment} onChange={e => set("treatment", e.target.value)} /></div>
      <div><label className="label">Status</label>
        <select className="input" value={f.status} onChange={e => set("status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select></div>
      <div className="md:col-span-2"><label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

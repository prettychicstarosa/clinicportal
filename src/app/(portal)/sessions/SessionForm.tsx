"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ClientLite = { id: string; full_name: string; remaining_sessions: number; total_sessions: number; balance: number; valid_until: string | null };

export default function SessionForm({ clients, initialClientId }: { clients: ClientLite[]; initialClientId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initialClientId ?? "",
    first_session_date: "",
    session_date: new Date().toISOString().split("T")[0],
    session_time: "10:00",
    amount_paid: 0,
    balance: 0,
    interval_days: 14,
    expiry_date: "",
    status: "Scheduled" as "Scheduled"|"Completed"|"Cancelled",
    notes: ""
  });
  const selected = clients.find(c => c.id === f.client_id);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Please select a client."); return; }
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        client_id: f.client_id,
        first_session_date: f.first_session_date || null,
        session_date: f.session_date || null,
        session_time: f.session_time || null,
        amount_paid: Number(f.amount_paid) || 0,
        balance: Number(f.balance) || 0,
        interval_days: f.interval_days ? Number(f.interval_days) : null,
        expiry_date: f.expiry_date || null,
        status: f.status,
        notes: f.notes,
        created_by: user?.id ?? null
      };
      const { data, error } = await supabase.from("sessions").insert(payload).select("id").single();
      if (error) { setErr(error.message); return; }

      if (f.status === "Completed" && selected) {
        const remaining = Math.max(0, selected.remaining_sessions - 1);
        await supabase.from("clients").update({ remaining_sessions: remaining }).eq("id", selected.id);
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "completed session", entity: "session", entity_id: data!.id,
          details: `${selected.full_name} · remaining ${remaining}`
        });
      } else {
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added session", entity: "session", entity_id: data!.id,
          details: selected?.full_name
        });
      }
      router.push("/sessions");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Client *</label>
        <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.remaining_sessions}/{c.total_sessions} left)</option>)}
        </select></div>

      <div><label className="label">First Session Date</label>
        <input type="date" className="input" value={f.first_session_date} onChange={e => set("first_session_date", e.target.value)} /></div>
      <div><label className="label">Session Date</label>
        <input type="date" className="input" value={f.session_date} onChange={e => set("session_date", e.target.value)} /></div>
      <div><label className="label">Session Time</label>
        <input type="time" className="input" value={f.session_time} onChange={e => set("session_time", e.target.value)} /></div>
      <div><label className="label">Interval (days)</label>
        <input type="number" className="input" value={f.interval_days} onChange={e => set("interval_days", e.target.value)} /></div>
      <div><label className="label">Amount Paid</label>
        <input type="number" step="0.01" className="input" value={f.amount_paid} onChange={e => set("amount_paid", e.target.value)} /></div>
      <div><label className="label">Balance</label>
        <input type="number" step="0.01" className="input" value={f.balance} onChange={e => set("balance", e.target.value)} /></div>
      <div><label className="label">Expiry Date</label>
        <input type="date" className="input" value={f.expiry_date} onChange={e => set("expiry_date", e.target.value)} /></div>
      <div><label className="label">Status</label>
        <select className="input" value={f.status} onChange={e => set("status", e.target.value)}>
          <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
        </select></div>
      <div className="md:col-span-2"><label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>

      {selected && (
        <p className="md:col-span-2 text-xs" style={{ color: "var(--color-muted)" }}>
          Marking <b>Completed</b> will deduct 1 from {selected.full_name}'s remaining sessions
          (currently {selected.remaining_sessions}).
        </p>
      )}

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save Session"}</button>
      </div>
    </form>
  );
}

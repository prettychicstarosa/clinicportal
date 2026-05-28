"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

type Props = { mode: "create" | "edit"; initial?: Partial<Client> };

export default function ClientForm({ mode, initial = {} }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<any>({
    full_name: initial.full_name ?? "",
    mobile: initial.mobile ?? "",
    age: initial.age ?? "",
    birthday: initial.birthday ?? "",
    treatment_interested: initial.treatment_interested ?? "",
    package_availed: initial.package_availed ?? "",
    total_sessions: initial.total_sessions ?? 0,
    remaining_sessions: initial.remaining_sessions ?? 0,
    valid_until: initial.valid_until ?? "",
    balance: initial.balance ?? 0,
    payment_status: initial.payment_status ?? "Unpaid",
    registration_date: initial.registration_date ?? new Date().toISOString().split("T")[0],
    signed_consent: initial.signed_consent ?? false,
    notes: initial.notes ?? "",
    allergies: initial.allergies ?? ""
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        ...f,
        age: f.age === "" ? null : Number(f.age),
        total_sessions: Number(f.total_sessions) || 0,
        remaining_sessions: Number(f.remaining_sessions) || 0,
        balance: Number(f.balance) || 0,
        birthday: f.birthday || null,
        valid_until: f.valid_until || null,
        updated_by: user?.id ?? null
      };
      if (mode === "create") {
        payload.created_by = user?.id ?? null;
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added new client " + f.full_name,
          entity: "client", entity_id: data!.id
        });
        router.push(`/clients/${data!.id}`);
      } else {
        const id = (initial as Client).id;
        const { error } = await supabase.from("clients").update(payload).eq("id", id);
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "edited client " + f.full_name,
          entity: "client", entity_id: id
        });
        router.push(`/clients/${id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="label">Full Name *</label>
        <input required className="input" value={f.full_name} onChange={e => set("full_name", e.target.value)} />
      </div>
      <div><label className="label">Mobile Number</label>
        <input className="input" value={f.mobile} onChange={e => set("mobile", e.target.value)} /></div>
      <div><label className="label">Age</label>
        <input type="number" className="input" value={f.age} onChange={e => set("age", e.target.value)} /></div>
      <div><label className="label">Birthday</label>
        <input type="date" className="input" value={f.birthday ?? ""} onChange={e => set("birthday", e.target.value)} /></div>
      <div><label className="label">Treatment Interested</label>
        <input className="input" value={f.treatment_interested} onChange={e => set("treatment_interested", e.target.value)} /></div>
      <div><label className="label">Package Availed</label>
        <input className="input" value={f.package_availed} onChange={e => set("package_availed", e.target.value)} /></div>
      <div><label className="label">Total Sessions</label>
        <input type="number" className="input" value={f.total_sessions} onChange={e => set("total_sessions", e.target.value)} /></div>
      <div><label className="label">Remaining Sessions</label>
        <input type="number" className="input" value={f.remaining_sessions} onChange={e => set("remaining_sessions", e.target.value)} /></div>
      <div><label className="label">Valid Until</label>
        <input type="date" className="input" value={f.valid_until ?? ""} onChange={e => set("valid_until", e.target.value)} /></div>
      <div><label className="label">Balance</label>
        <input type="number" step="0.01" className="input" value={f.balance} onChange={e => set("balance", e.target.value)} /></div>
      <div><label className="label">Payment Status</label>
        <select className="input" value={f.payment_status} onChange={e => set("payment_status", e.target.value)}>
          <option>Paid</option><option>Partial</option><option>Unpaid</option>
        </select></div>
      <div><label className="label">Registration Date</label>
        <input type="date" className="input" value={f.registration_date} onChange={e => set("registration_date", e.target.value)} /></div>
      <div className="flex items-center gap-2 mt-6">
        <input id="consent" type="checkbox" checked={!!f.signed_consent} onChange={e => set("signed_consent", e.target.checked)} />
        <label htmlFor="consent" className="text-sm">Signed Consent Form</label>
      </div>
      <div className="md:col-span-2"><label className="label">Allergies</label>
        <textarea className="input" rows={2} value={f.allergies} onChange={e => set("allergies", e.target.value)} /></div>
      <div className="md:col-span-2"><label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save Client"}</button>
      </div>
    </form>
  );
}

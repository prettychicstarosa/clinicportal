"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CATEGORIES = ["Rent","Salary","Supplies","Marketing","Utilities","Other"];
const STATUSES = ["Paid","Unpaid","Partial"];

export default function ExpenseForm({ mode, initial = {} as any }: { mode: "create"|"edit"; initial?: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    title: initial.title ?? "",
    category: initial.category ?? "Supplies",
    amount: initial.amount ?? 0,
    due_date: initial.due_date ?? "",
    paid_status: initial.paid_status ?? "Unpaid",
    paid_amount: initial.paid_amount ?? 0,
    notes: initial.notes ?? ""
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
        amount: Number(f.amount) || 0,
        paid_amount: Number(f.paid_amount) || 0,
        due_date: f.due_date || null
      };
      if (mode === "create") {
        payload.created_by = user?.id ?? null;
        const { data, error } = await supabase.from("expenses").insert(payload).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added expense " + f.title, entity: "expense", entity_id: data!.id
        });
      } else {
        const { error } = await supabase.from("expenses").update(payload).eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "updated expense " + f.title, entity: "expense", entity_id: initial.id
        });
      }
      router.push("/expenses");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Title *</label>
        <input required className="input" value={f.title} onChange={e => set("title", e.target.value)} /></div>
      <div><label className="label">Category</label>
        <select className="input" value={f.category} onChange={e => set("category", e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select></div>
      <div><label className="label">Amount</label>
        <input type="number" step="0.01" className="input" value={f.amount} onChange={e => set("amount", e.target.value)} /></div>
      <div><label className="label">Due Date</label>
        <input type="date" className="input" value={f.due_date ?? ""} onChange={e => set("due_date", e.target.value)} /></div>
      <div><label className="label">Paid Status</label>
        <select className="input" value={f.paid_status} onChange={e => set("paid_status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select></div>
      <div><label className="label">Paid Amount</label>
        <input type="number" step="0.01" className="input" value={f.paid_amount} onChange={e => set("paid_amount", e.target.value)} /></div>
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

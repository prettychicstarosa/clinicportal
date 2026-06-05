"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-client";

const CATEGORIES = ["Rent","Salary","Supplies","Utilities","Marketing","Maintenance","Other"];
const STATUSES = ["Paid","Unpaid","Partial"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function ExpenseForm({ mode, initial = {} as any }: { mode: "create"|"edit"; initial?: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    title: initial.title ?? "",
    category: initial.category ?? "Supplies",
    amount: initial.amount ?? 0,
    // `due_date` is the expense's date (used for monthly grouping).
    due_date: initial.due_date ?? todayStr(),
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
        title: f.title,
        category: f.category,
        amount: Number(f.amount) || 0,
        paid_status: f.paid_status,
        paid_amount: Number(f.paid_amount) || 0,
        notes: f.notes,
        due_date: f.due_date || todayStr()
      };

      const snap = (src: any) => ({
        title: src.title ?? null,
        category: src.category ?? null,
        amount: Number(src.amount) || 0,
        date: src.due_date ?? null,
        paid_status: src.paid_status ?? null,
        paid_amount: Number(src.paid_amount) || 0
      });

      // Friendly message if the database's category CHECK constraint hasn't
      // been widened to include this category yet.
      const isCategoryConstraint = (e: any) =>
        !!e && (e.code === "23514" ||
          (typeof e.message === "string" && e.message.toLowerCase().includes("category_check")));

      if (mode === "create") {
        payload.created_by = user?.id ?? null;
        const { data, error } = await supabase.from("expenses").insert(payload).select("id").single();
        if (error) {
          setErr(isCategoryConstraint(error)
            ? `Your database doesn't allow the "${f.category}" category yet. Pick another category, or apply supabase/RUN_PENDING_MIGRATIONS.sql to enable it.`
            : error.message);
          return;
        }
        await logActivity({
          action: "added expense " + f.title, entity: "expense", entity_id: data!.id,
          details: `${f.category} · ${f.title}`,
          newValue: snap(f)
        });
      } else {
        const { error } = await supabase.from("expenses").update(payload).eq("id", initial.id);
        if (error) {
          setErr(isCategoryConstraint(error)
            ? `Your database doesn't allow the "${f.category}" category yet. Pick another category, or apply supabase/RUN_PENDING_MIGRATIONS.sql to enable it.`
            : error.message);
          return;
        }
        await logActivity({
          action: "updated expense " + f.title, entity: "expense", entity_id: initial.id,
          details: `${f.category} · ${f.title}`,
          oldValue: snap(initial),
          newValue: snap(f)
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
      <div><label className="label">Expense Date</label>
        <input type="date" className="input" value={f.due_date ?? ""} onChange={e => set("due_date", e.target.value)} />
        <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>Used for monthly totals and reports.</p></div>
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

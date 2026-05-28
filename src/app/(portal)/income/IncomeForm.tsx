"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function IncomeForm({ mode, initial = {} as any }: { mode: "create" | "edit"; initial?: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();

  const [f, setF] = useState({
    month: initial.month ?? (now.getMonth() + 1),
    year: initial.year ?? now.getFullYear(),
    week1: initial.week1 ?? 0,
    week2: initial.week2 ?? 0,
    week3: initial.week3 ?? 0,
    week4: initial.week4 ?? 0,
    week5: initial.week5 ?? 0,
    notes: initial.notes ?? ""
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const total = useMemo(
    () =>
      Number(f.week1 || 0) +
      Number(f.week2 || 0) +
      Number(f.week3 || 0) +
      Number(f.week4 || 0) +
      Number(f.week5 || 0),
    [f.week1, f.week2, f.week3, f.week4, f.week5]
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        month: Number(f.month),
        year: Number(f.year),
        week1: Number(f.week1) || 0,
        week2: Number(f.week2) || 0,
        week3: Number(f.week3) || 0,
        week4: Number(f.week4) || 0,
        week5: Number(f.week5) || 0,
        notes: f.notes || null
      };
      if (mode === "create") {
        payload.created_by = user?.id ?? null;
        const { data, error } = await supabase
          .from("income").insert(payload).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id,
          action: "added income",
          entity: "income",
          entity_id: data!.id,
          details: `${MONTHS[payload.month - 1]} ${payload.year}: ${formatCurrency(total)}`
        });
      } else {
        payload.updated_by = user?.id ?? null;
        const { error } = await supabase
          .from("income").update(payload).eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id,
          action: "updated income",
          entity: "income",
          entity_id: initial.id,
          details: `${MONTHS[payload.month - 1]} ${payload.year}: ${formatCurrency(total)}`
        });
      }
      router.push("/income");
      router.refresh();
    });
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="label">Month *</label>
        <select className="input" value={f.month} onChange={(e) => set("month", e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Year *</label>
        <select className="input" value={f.year} onChange={(e) => set("year", e.target.value)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Week 1</label>
        <input type="number" step="0.01" min="0" className="input" value={f.week1} onChange={(e) => set("week1", e.target.value)} />
      </div>
      <div>
        <label className="label">Week 2</label>
        <input type="number" step="0.01" min="0" className="input" value={f.week2} onChange={(e) => set("week2", e.target.value)} />
      </div>
      <div>
        <label className="label">Week 3</label>
        <input type="number" step="0.01" min="0" className="input" value={f.week3} onChange={(e) => set("week3", e.target.value)} />
      </div>
      <div>
        <label className="label">Week 4</label>
        <input type="number" step="0.01" min="0" className="input" value={f.week4} onChange={(e) => set("week4", e.target.value)} />
      </div>
      <div>
        <label className="label">Week 5</label>
        <input type="number" step="0.01" min="0" className="input" value={f.week5} onChange={(e) => set("week5", e.target.value)} />
      </div>

      <div className="rounded-xl border bg-white/50 p-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Monthly Total</div>
        <div className="mt-1 font-medium" style={{ color: "var(--color-primary)" }}>{formatCurrency(total)}</div>
      </div>

      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

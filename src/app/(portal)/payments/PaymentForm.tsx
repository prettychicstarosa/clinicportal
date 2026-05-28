"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type ClientLite = { id: string; full_name: string; balance: number };

export default function PaymentForm({ clients, initialClientId }: { clients: ClientLite[]; initialClientId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initialClientId ?? "",
    amount: 0,
    method: "Cash",
    notes: "",
    apply_to_balance: true
  });
  const selected = clients.find(c => c.id === f.client_id);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Select a client"); return; }
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { setErr("Enter a positive amount"); return; }
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("payments").insert({
        client_id: f.client_id, amount, method: f.method, notes: f.notes, created_by: user?.id
      }).select("id").single();
      if (error) { setErr(error.message); return; }

      if (f.apply_to_balance && selected) {
        const newBalance = Math.max(0, Number(selected.balance) - amount);
        const newStatus = newBalance === 0 ? "Paid" : "Partial";
        await supabase.from("clients").update({ balance: newBalance, payment_status: newStatus }).eq("id", selected.id);
      }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "recorded payment", entity: "payment", entity_id: data!.id,
        details: `${selected?.full_name ?? ""} · ${formatCurrency(amount)}`
      });
      router.push("/payments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Client *</label>
        <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} — balance {formatCurrency(c.balance)}</option>)}
        </select></div>
      <div><label className="label">Amount</label>
        <input type="number" step="0.01" className="input" value={f.amount} onChange={e => set("amount", e.target.value)} /></div>
      <div><label className="label">Method</label>
        <select className="input" value={f.method} onChange={e => set("method", e.target.value)}>
          <option>Cash</option><option>GCash</option><option>Card</option><option>Bank Transfer</option><option>Other</option>
        </select></div>
      <div className="md:col-span-2"><label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
      <div className="md:col-span-2 flex items-center gap-2">
        <input id="bal" type="checkbox" checked={f.apply_to_balance} onChange={e => set("apply_to_balance", e.target.checked)} />
        <label htmlFor="bal" className="text-sm">Subtract from client's outstanding balance</label>
      </div>
      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const TYPES = ["Medicine","Tool","Kit","Consumable"];
const UNITS = ["per ml","per vial","per box","per tube","per bottle","per piece","per syringe"];

export default function InventoryForm({
  mode, initial = {} as any, defaultAlert = 5
}: { mode: "create"|"edit"; initial?: any; defaultAlert?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    name: initial.name ?? "",
    item_type: initial.item_type ?? "Medicine",
    unit: initial.unit ?? UNITS[0],
    remaining_stock: initial.remaining_stock ?? 0,
    low_stock_alert: initial.low_stock_alert ?? defaultAlert
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
        remaining_stock: Number(f.remaining_stock) || 0,
        low_stock_alert: Number(f.low_stock_alert) || 0,
        updated_by: user?.id ?? null
      };
      if (mode === "create") {
        const { data, error } = await supabase.from("inventory").insert(payload).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("inventory_logs").insert({
          item_id: data!.id, action: "create", quantity: Number(f.remaining_stock) || 0, performed_by: user?.id
        });
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added inventory item " + f.name, entity: "inventory", entity_id: data!.id
        });
      } else {
        const { error } = await supabase.from("inventory").update(payload).eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("inventory_logs").insert({
          item_id: initial.id, action: "update", quantity: 0, performed_by: user?.id
        });
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "edited inventory item " + f.name, entity: "inventory", entity_id: initial.id
        });
      }
      router.push("/inventory");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Medicine / Kit Name *</label>
        <input required className="input" value={f.name} onChange={e => set("name", e.target.value)} /></div>
      <div><label className="label">Item Type</label>
        <select className="input" value={f.item_type} onChange={e => set("item_type", e.target.value)}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select></div>
      <div><label className="label">Unit</label>
        <select className="input" value={f.unit} onChange={e => set("unit", e.target.value)}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select></div>
      <div><label className="label">Remaining Stock</label>
        <input type="number" step="0.01" className="input" value={f.remaining_stock} onChange={e => set("remaining_stock", e.target.value)} /></div>
      <div><label className="label">Low Stock Alert At</label>
        <input type="number" step="0.01" className="input" value={f.low_stock_alert} onChange={e => set("low_stock_alert", e.target.value)} /></div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

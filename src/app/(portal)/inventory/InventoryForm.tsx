"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const TYPES = ["Medicine", "Tool", "Kit", "Consumable"];
const CONTAINER_TYPES = ["unit", "vial", "box", "bottle", "tube"] as const;
const CONTAINER_UNITS = ["ml", "mg"] as const;
const CONSUME_UNITS = [
  "ml", "mg", "vial", "box", "bottle", "tube", "piece",
  "syringe", "ampoule", "capsule", "tablet", "pack", "kit",
  "session use", "custom"
] as const;

export default function InventoryForm({
  mode, initial = {} as any, defaultAlert = 5
}: { mode: "create" | "edit"; initial?: any; defaultAlert?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const isUnit = (initial.container_type ?? "unit") === "unit";

  const [f, setF] = useState({
    name: initial.name ?? "",
    item_type: initial.item_type ?? "Medicine",
    container_type: (initial.container_type ?? "unit") as typeof CONTAINER_TYPES[number],
    container_size: initial.container_size ?? "",
    container_unit: (initial.container_unit ?? "ml") as typeof CONTAINER_UNITS[number],
    containers: initial.containers ?? 0,
    remaining_stock: initial.remaining_stock ?? 0,
    low_stock_alert: initial.low_stock_alert ?? defaultAlert,
    consume_unit: (initial.consume_unit ?? (isUnit ? "piece" : "ml")) as typeof CONSUME_UNITS[number],
    // Legacy display unit (e.g. "per ml") — keep filled for backward compat.
    unit: initial.unit ?? "per piece"
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));

  const containerized = f.container_type !== "unit";
  const size = Number(f.container_size) || 0;
  const containers = Number(f.containers) || 0;
  const remainingFromContainers = containerized ? containers * size : Number(f.remaining_stock);
  const usableUnit = containerized ? f.container_unit : "pcs";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const remaining_stock = containerized
        ? containers * size
        : Number(f.remaining_stock) || 0;

      const unitLabel = containerized
        ? `per ${f.container_type} (${size}${f.container_unit})`
        : "per piece";

      const payload: any = {
        name: f.name,
        item_type: f.item_type,
        container_type: f.container_type,
        container_size: containerized ? size || null : null,
        container_unit: containerized ? f.container_unit : null,
        containers: containerized ? containers : 0,
        remaining_stock,
        low_stock_alert: Number(f.low_stock_alert) || 0,
        consume_unit: f.consume_unit,
        unit: unitLabel,
        updated_by: user?.id ?? null
      };

      if (mode === "create") {
        const { data, error } = await supabase.from("inventory").insert(payload).select("id").single();
        if (error) { setErr(error.message); return; }
        await supabase.from("inventory_logs").insert({
          item_id: data!.id, action: "create",
          quantity: remaining_stock, unit: usableUnit,
          performed_by: user?.id
        });
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added inventory item " + f.name,
          entity: "inventory", entity_id: data!.id
        });
      } else {
        const { error } = await supabase.from("inventory").update(payload).eq("id", initial.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("inventory_logs").insert({
          item_id: initial.id, action: "update", quantity: 0, performed_by: user?.id
        });
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "edited inventory item " + f.name,
          entity: "inventory", entity_id: initial.id
        });
      }
      router.push("/inventory");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Item">
        <div className="md:col-span-2">
          <label className="label">Item Name *</label>
          <input required className="input" placeholder="e.g. Botox 100u" value={f.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Item Type</label>
          <select className="input" value={f.item_type} onChange={e => set("item_type", e.target.value)}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Container Type</label>
          <select className="input" value={f.container_type} onChange={e => set("container_type", e.target.value as any)}>
            {CONTAINER_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Pick &quot;unit&quot; for items counted whole (tubes, masks, syringes).
          </p>
        </div>
      </Section>

      {containerized ? (
        <Section title={`Stock (${f.container_type})`}>
          <div>
            <label className="label">Each {f.container_type} holds</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" min="0" className="input" value={f.container_size} onChange={e => set("container_size", e.target.value)} />
              <select className="input max-w-[110px]" value={f.container_unit} onChange={e => set("container_unit", e.target.value as any)}>
                {CONTAINER_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Total {f.container_type}s in stock</label>
            <input type="number" step="0.01" min="0" className="input" value={f.containers} onChange={e => set("containers", e.target.value)} />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <Stat label={`Total ${f.container_unit} available`} value={`${remainingFromContainers.toLocaleString()} ${f.container_unit}`} />
            <Stat label={`Each ${f.container_type}`} value={size ? `${size} ${f.container_unit}` : "—"} />
          </div>
          <div>
            <label className="label">Default consume unit</label>
            <select className="input" value={f.consume_unit} onChange={e => set("consume_unit", e.target.value as any)}>
              {CONSUME_UNITS.filter(u => u !== "piece").map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Low Stock Alert at ({f.container_unit})</label>
            <input type="number" step="0.01" min="0" className="input" value={f.low_stock_alert} onChange={e => set("low_stock_alert", e.target.value)} />
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              Alert when total {f.container_unit} drops at or below this number.
            </p>
          </div>
        </Section>
      ) : (
        <Section title="Stock (pieces)">
          <div>
            <label className="label">Pieces in Stock</label>
            <input type="number" step="1" min="0" className="input" value={f.remaining_stock} onChange={e => set("remaining_stock", e.target.value)} />
          </div>
          <div>
            <label className="label">Low Stock Alert at (pieces)</label>
            <input type="number" step="1" min="0" className="input" value={f.low_stock_alert} onChange={e => set("low_stock_alert", e.target.value)} />
          </div>
          <input type="hidden" value="piece" />
        </Section>
      )}

      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-base mb-3" style={{ color: "var(--color-primary)" }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white/50 p-3" style={{ borderColor: "var(--color-border)" }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="mt-1 font-medium" style={{ color: "var(--color-primary)" }}>{value}</div>
    </div>
  );
}

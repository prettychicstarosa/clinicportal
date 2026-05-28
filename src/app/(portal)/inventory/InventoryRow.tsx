"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

type ClientLite = { id: string; full_name: string };

const ALL_UNITS = ["ml", "mg", "vial", "box", "bottle", "tube", "piece"] as const;

export default function InventoryRow({
  item,
  isAdmin,
  clients
}: {
  item: any;
  isAdmin: boolean;
  clients: ClientLite[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<null | "add" | "consume">(null);
  const [qty, setQty] = useState<string>("");
  const containerized = item.container_type && item.container_type !== "unit";
  const [unit, setUnit] = useState<string>(
    item.consume_unit ?? (containerized ? item.container_unit ?? "ml" : "piece")
  );
  const [clientId, setClientId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  function reset() {
    setOpen(null); setQty(""); setClientId(""); setNote("");
    setUnit(item.consume_unit ?? (containerized ? item.container_unit ?? "ml" : "piece"));
  }

  // How much of remaining_stock does `qty` of `unit` represent?
  function toBaseDelta(): number {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return NaN;
    if (!containerized) return n;
    // Containerized: remaining_stock is in container_unit (ml or mg).
    if (unit === item.container_unit) return n;
    if (unit === item.container_type) return n * Number(item.container_size || 0);
    // Different sub-unit (ml vs mg) — fall back to direct (treat as same magnitude).
    return n;
  }

  function submit() {
    const delta = toBaseDelta();
    if (!Number.isFinite(delta) || delta <= 0) { alert("Enter a positive quantity"); return; }

    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const signed = open === "add" ? delta : -delta;
      const newStock = Number(item.remaining_stock) + signed;
      if (newStock < 0) { alert("Cannot consume more than current stock."); return; }

      const update: any = { remaining_stock: newStock, updated_by: user?.id };
      if (containerized && Number(item.container_size) > 0) {
        update.containers = Math.max(0, newStock / Number(item.container_size));
      }
      const { error } = await supabase.from("inventory").update(update).eq("id", item.id);
      if (error) { alert(error.message); return; }

      await supabase.from("inventory_logs").insert({
        item_id: item.id,
        action: open,
        quantity: Number(qty),
        unit,
        client_id: clientId || null,
        note: note || null,
        performed_by: user?.id
      });

      const clientName = clientId ? clients.find(c => c.id === clientId)?.full_name : null;
      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: open === "add" ? "added stock" : "consumed stock",
        entity: "inventory", entity_id: item.id,
        details: `${qty} ${unit} ${item.name}${clientName ? ` · for ${clientName}` : ""}`
      });

      reset();
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Delete item ${item.name}?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("inventory").delete().eq("id", item.id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "deleted inventory item " + item.name, entity: "inventory"
      });
      router.refresh();
    });
  }

  const statusClass =
    item.stock_status === "Available" ? "badge-green" :
    item.stock_status === "Low Stock" ? "badge-amber" : "badge-red";

  const stockDisplay = containerized
    ? (
      <div>
        <div className="font-medium">
          {Number(item.containers || 0).toFixed(Number.isInteger(Number(item.containers)) ? 0 : 1)} {item.container_type}{Number(item.containers) === 1 ? "" : "s"}
        </div>
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          {Number(item.remaining_stock).toLocaleString()} {item.container_unit} total
        </div>
      </div>
    )
    : <span>{Number(item.remaining_stock)} pcs</span>;

  // Unit options shown in the consume/add modal.
  const unitOptions = containerized
    ? [item.container_unit, item.container_type].filter(Boolean)
    : ["piece"];

  return (
    <>
      <tr>
        <td className="table-td font-medium">{item.name}</td>
        <td className="table-td">{item.item_type}</td>
        <td className="table-td">{stockDisplay}</td>
        <td className="table-td">
          {containerized
            ? `${item.container_size ?? "—"} ${item.container_unit ?? ""}`
            : "—"}
        </td>
        <td className="table-td">
          {item.low_stock_alert} {containerized ? item.container_unit : "pcs"}
        </td>
        <td className="table-td"><span className={"badge " + statusClass}>{item.stock_status}</span></td>
        <td className="table-td">
          <div>{formatDateTime(item.updated_at)}</div>
          {item.profiles?.full_name && (
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>by {item.profiles.full_name}</div>
          )}
        </td>
        <td className="table-td text-right">
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOpen("add")} className="text-xs underline">Add</button>
            <button onClick={() => setOpen("consume")} className="text-xs underline">Consume</button>
            <Link href={`/inventory/${item.id}/edit`} className="text-xs underline">Edit</Link>
            {isAdmin && <button onClick={onDelete} className="text-xs text-red-700 underline">Delete</button>}
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="px-4 pb-4">
            <div className="rounded-2xl border p-4 bg-white" style={{ borderColor: "var(--color-border)" }}>
              <div className="font-medium mb-3">
                {open === "add" ? `Add stock to ${item.name}` : `Record consumption of ${item.name}`}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input
                    autoFocus type="number" step="0.01" min="0"
                    className="input"
                    value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {open === "consume" && (
                  <div className="md:col-span-2">
                    <label className="label">For Client (optional)</label>
                    <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
                      <option value="">— No client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div className="md:col-span-4">
                  <label className="label">Note</label>
                  <input
                    className="input"
                    value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Optional note"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={reset} className="btn-ghost">Cancel</button>
                <button onClick={submit} disabled={pending} className="btn-primary">
                  {pending ? "Saving..." : (open === "add" ? "Add Stock" : "Record Consumption")}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

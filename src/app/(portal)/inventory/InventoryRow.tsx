"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

export default function InventoryRow({ item, isAdmin }: { item: any; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<null | "add" | "consume">(null);
  const [qty, setQty] = useState<string>("");

  function close() { setOpen(null); setQty(""); }

  function submit() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) { alert("Enter a positive quantity"); return; }
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const delta = open === "add" ? n : -n;
      const newStock = Number(item.remaining_stock) + delta;
      if (newStock < 0) { alert("Cannot consume more than current stock."); return; }
      const { error } = await supabase.from("inventory")
        .update({ remaining_stock: newStock, updated_by: user?.id }).eq("id", item.id);
      if (error) { alert(error.message); return; }
      await supabase.from("inventory_logs").insert({
        item_id: item.id, action: open, quantity: n, performed_by: user?.id
      });
      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: open === "add" ? "added stock" : "consumed",
        entity: "inventory", entity_id: item.id,
        details: `${n} ${item.unit} ${item.name}`
      });
      close();
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

  const statusClass = item.stock_status === "Available" ? "badge-green"
    : item.stock_status === "Low Stock" ? "badge-amber" : "badge-red";

  return (
    <>
      <tr>
        <td className="table-td font-medium">{item.name}</td>
        <td className="table-td">{item.item_type}</td>
        <td className="table-td">{item.unit}</td>
        <td className="table-td">{item.remaining_stock}</td>
        <td className="table-td">{item.low_stock_alert}</td>
        <td className="table-td"><span className={"badge " + statusClass}>{item.stock_status}</span></td>
        <td className="table-td">
          <div>{formatDateTime(item.updated_at)}</div>
          {item.profiles?.full_name && <div className="text-xs" style={{ color: "var(--color-muted)" }}>by {item.profiles.full_name}</div>}
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
            <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--color-border)" }}>
              <div className="font-medium mb-2">
                {open === "add" ? `Add stock to ${item.name}` : `How much was consumed of ${item.name}?`}
              </div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus type="number" step="0.01" min="0"
                  className="input max-w-[160px]"
                  value={qty} onChange={e => setQty(e.target.value)}
                  placeholder={`e.g. 2 ${item.unit}`}
                />
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>{item.unit}</span>
                <button onClick={submit} disabled={pending} className="btn-primary">
                  {pending ? "Saving..." : (open === "add" ? "Add" : "Consume")}
                </button>
                <button onClick={close} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

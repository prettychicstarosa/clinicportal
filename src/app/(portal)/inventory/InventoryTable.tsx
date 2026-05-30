"use client";
import { useMemo, useState } from "react";
import InventoryRow from "./InventoryRow";

type ClientLite = { id: string; full_name: string };

const NAMED = ["Medicine", "Kit", "Consumable"] as const;
const FILTERS = ["All", "Medicine", "Kit", "Consumable", "Others"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(type: string | null | undefined, filter: Filter): boolean {
  if (filter === "All") return true;
  if (filter === "Others") return !NAMED.includes(type as any);
  return type === filter;
}

export default function InventoryTable({
  items,
  isAdmin,
  clients
}: {
  items: any[];
  isAdmin: boolean;
  clients: ClientLite[];
}) {
  const [filter, setFilter] = useState<Filter>("All");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: items.length, Medicine: 0, Kit: 0, Consumable: 0, Others: 0 };
    for (const it of items) {
      if (NAMED.includes(it.item_type)) c[it.item_type as Filter]++;
      else c.Others++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () => items.filter(it => matchesFilter(it.item_type, filter)),
    [items, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`btn-ghost !py-1 !px-3 !text-sm ${filter === f ? "!bg-beige-100 !font-semibold" : ""}`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Type</th>
                <th className="table-th">Stock</th>
                <th className="table-th">Status</th>
                <th className="table-th">Last Updated</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it: any) => (
                <InventoryRow key={it.id} item={it} isAdmin={isAdmin} clients={clients} />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="table-td text-center" style={{ color: "var(--color-muted)" }}>
                  {items.length === 0 ? "No inventory items yet." : "No items in this category."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
import { formatCurrency } from "@/lib/utils";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

export default function GuidelinesViewer({
  categories,
  items
}: {
  categories: GuidelineCategory[];
  items: GuidelineItem[];
}) {
  if (categories.length === 0) {
    return (
      <div className="card">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          No guidelines have been published yet.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id);
        return (
          <div key={cat.id} className="card">
            <h3 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>{cat.name}</h3>
            {cat.description && (
              <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>{cat.description}</p>
            )}
            {catItems.length === 0 ? (
              <p className="text-sm mt-3" style={{ color: "var(--color-muted)" }}>No items yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-beige-100">
                    <tr>
                      <th className="table-th">Name</th>
                      <th className="table-th">Time</th>
                      <th className="table-th">Procedure</th>
                      <th className="table-th">Internal Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map(it => (
                      <tr key={it.id}>
                        <td className="table-td font-medium">{it.name}</td>
                        <td className="table-td">{it.time ?? "—"}</td>
                        <td className="table-td whitespace-pre-line">{it.procedure ?? "—"}</td>
                        <td className="table-td">{formatCurrency(it.internal_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, FileText } from "lucide-react";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

export default function GuidelinesViewer({
  categories,
  items
}: {
  categories: GuidelineCategory[];
  items: GuidelineItem[];
}) {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    categories[0]?.id ?? null
  );

  useEffect(() => {
    if (!selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    } else if (selectedCatId && !categories.some(c => c.id === selectedCatId)) {
      setSelectedCatId(categories[0]?.id ?? null);
    }
  }, [categories, selectedCatId]);

  const selectedCat = useMemo(
    () => categories.find(c => c.id === selectedCatId) ?? null,
    [categories, selectedCatId]
  );
  const catItems = useMemo(
    () => items.filter(i => i.category_id === selectedCatId),
    [items, selectedCatId]
  );

  if (categories.length === 0) {
    return (
      <div className="card text-center py-10">
        <FileText size={28} className="mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
        <p className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>
          No guidelines yet
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          Your administrator hasn&apos;t published any guidelines.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <aside className="space-y-2">
        <div className="hidden lg:block">
          <ul className="space-y-2">
            {categories.map((c) => {
              const active = c.id === selectedCatId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-2xl border p-3 transition"
                    style={{
                      background: active ? "var(--color-surface-2)" : "var(--color-surface)",
                      borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                      boxShadow: active ? "0 4px 14px -8px rgba(80,54,38,0.25)" : "none"
                    }}
                    onClick={() => setSelectedCatId(c.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className="font-serif text-sm md:text-base truncate"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {c.name}
                        </div>
                        {c.description && (
                          <div
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "var(--color-muted)" }}
                          >
                            {c.description}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        style={{ color: active ? "var(--color-accent)" : "var(--color-muted)" }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="lg:hidden">
          <label className="label">Category</label>
          <select
            className="input"
            value={selectedCatId ?? ""}
            onChange={(e) => setSelectedCatId(e.target.value || null)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </aside>

      <section>
        {selectedCat ? (
          <div className="card">
            <div className="mb-4">
              <h3 className="font-serif text-xl" style={{ color: "var(--color-primary)" }}>
                {selectedCat.name}
              </h3>
              {selectedCat.description && (
                <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                  {selectedCat.description}
                </p>
              )}
            </div>

            {catItems.length === 0 ? (
              <div
                className="rounded-2xl border-2 border-dashed text-center py-8 px-4 text-sm"
                style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}
              >
                No procedures published in this category yet.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-beige-100">
                      <tr>
                        <th className="table-th">Service / Procedure</th>
                        <th className="table-th">Medicine / Product</th>
                        <th className="table-th">Syringe / Qty</th>
                        <th className="table-th">Time</th>
                        <th className="table-th">Intensity</th>
                        <th className="table-th">Internal Cost</th>
                        <th className="table-th">Procedure</th>
                        <th className="table-th">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((it) => (
                        <tr key={it.id}>
                          <td className="table-td font-medium whitespace-pre-line">{it.name}</td>
                          <td className="table-td">{it.medicine_used ?? "—"}</td>
                          <td className="table-td">{it.syringe_quantity ?? "—"}</td>
                          <td className="table-td">{it.time ?? "—"}</td>
                          <td className="table-td">{it.intensity ?? "—"}</td>
                          <td className="table-td">{formatCurrency(it.internal_cost)}</td>
                          <td className="table-td whitespace-pre-line max-w-xs">{it.procedure ?? "—"}</td>
                          <td className="table-td whitespace-pre-line max-w-xs">{it.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden space-y-3">
                  {catItems.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-2xl border p-3"
                      style={{ borderColor: "var(--color-border)", background: "rgba(255,255,255,0.6)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-serif text-base" style={{ color: "var(--color-primary)" }}>
                          {it.name}
                        </div>
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {formatCurrency(it.internal_cost)}
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3">
                        <Detail label="Medicine" value={it.medicine_used} />
                        <Detail label="Syringe / Qty" value={it.syringe_quantity} />
                        <Detail label="Time" value={it.time} />
                        <Detail label="Intensity" value={it.intensity} />
                      </dl>
                      {it.procedure && (
                        <div className="mt-3">
                          <div className="label">Procedure</div>
                          <p className="text-xs whitespace-pre-line" style={{ color: "var(--color-text)" }}>
                            {it.procedure}
                          </p>
                        </div>
                      )}
                      {it.notes && (
                        <div className="mt-3">
                          <div className="label">Notes</div>
                          <p className="text-xs whitespace-pre-line" style={{ color: "var(--color-text)" }}>
                            {it.notes}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="card text-sm" style={{ color: "var(--color-muted)" }}>
            Select a category to view its procedures.
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="font-medium uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--color-text)" }}>{value || "—"}</dd>
    </>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

type CatDraft = { id?: string; name: string; description: string };
type ItemDraft = {
  id?: string;
  category_id: string;
  name: string;
  time: string;
  procedure: string;
  internal_cost: string;
};

const EMPTY_CAT: CatDraft = { name: "", description: "" };
const emptyItem = (category_id: string): ItemDraft => ({
  category_id, name: "", time: "", procedure: "", internal_cost: "0"
});

export default function GuidelinesManager({
  categories,
  items
}: {
  categories: GuidelineCategory[];
  items: GuidelineItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [catDraft, setCatDraft] = useState<CatDraft>(EMPTY_CAT);
  const [itemDraftCat, setItemDraftCat] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);

  function startNewCategory() {
    setErr(null);
    setCatDraft(EMPTY_CAT);
    setShowCat(true);
  }
  function startEditCategory(cat: GuidelineCategory) {
    setErr(null);
    setCatDraft({ id: cat.id, name: cat.name, description: cat.description ?? "" });
    setShowCat(true);
  }
  function startNewItem(catId: string) {
    setErr(null);
    setItemDraftCat(catId);
    setItemDraft(emptyItem(catId));
  }
  function startEditItem(it: GuidelineItem) {
    setErr(null);
    setItemDraftCat(it.category_id);
    setItemDraft({
      id: it.id,
      category_id: it.category_id,
      name: it.name,
      time: it.time ?? "",
      procedure: it.procedure ?? "",
      internal_cost: String(it.internal_cost ?? 0)
    });
  }

  function saveCategory() {
    if (!catDraft.name.trim()) { setErr("Category name is required."); return; }
    start(async () => {
      setErr(null);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        name: catDraft.name.trim(),
        description: catDraft.description.trim() || null
      };
      if (catDraft.id) {
        const { error } = await supabase.from("guideline_categories").update(payload).eq("id", catDraft.id);
        if (error) { setErr(error.message); return; }
      } else {
        const { error } = await supabase.from("guideline_categories").insert({
          ...payload, created_by: user?.id ?? null
        });
        if (error) { setErr(error.message); return; }
      }
      setShowCat(false);
      setCatDraft(EMPTY_CAT);
      router.refresh();
    });
  }

  function deleteCategory(cat: GuidelineCategory) {
    if (!confirm(`Delete category "${cat.name}" and all its items?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("guideline_categories").delete().eq("id", cat.id);
      if (error) { setErr(error.message); return; }
      router.refresh();
    });
  }

  function saveItem() {
    if (!itemDraft) return;
    if (!itemDraft.name.trim()) { setErr("Item name is required."); return; }
    start(async () => {
      setErr(null);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        category_id: itemDraft.category_id,
        name: itemDraft.name.trim(),
        time: itemDraft.time.trim() || null,
        procedure: itemDraft.procedure.trim() || null,
        internal_cost: Number(itemDraft.internal_cost) || 0
      };
      if (itemDraft.id) {
        const { error } = await supabase.from("guideline_items").update(payload).eq("id", itemDraft.id);
        if (error) { setErr(error.message); return; }
      } else {
        const { error } = await supabase.from("guideline_items").insert({
          ...payload, created_by: user?.id ?? null
        });
        if (error) { setErr(error.message); return; }
      }
      setItemDraft(null); setItemDraftCat(null);
      router.refresh();
    });
  }

  function deleteItem(it: GuidelineItem) {
    if (!confirm(`Delete "${it.name}"?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("guideline_items").delete().eq("id", it.id);
      if (error) { setErr(error.message); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Group guideline items into categories. Staff see what their access toggle allows.
        </p>
        <button className="btn-primary" onClick={startNewCategory}>
          <Plus size={16} /> New Category
        </button>
      </div>

      {showCat && (
        <div className="card space-y-3">
          <h3 className="font-serif text-base" style={{ color: "var(--color-primary)" }}>
            {catDraft.id ? "Edit Category" : "New Category"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input
                className="input" value={catDraft.name}
                onChange={e => setCatDraft(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input" value={catDraft.description}
                onChange={e => setCatDraft(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setShowCat(false)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={pending} onClick={saveCategory}>
              {pending ? "Saving..." : "Save Category"}
            </button>
          </div>
        </div>
      )}

      {err && <p className="text-sm text-red-700">{err}</p>}

      {categories.length === 0 && !showCat && (
        <div className="card">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            No categories yet. Click <b>New Category</b> to get started.
          </p>
        </div>
      )}

      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id);
        const editingItem = itemDraft?.category_id === cat.id ? itemDraft : null;
        return (
          <div key={cat.id} className="card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>{cat.name}</h3>
                {cat.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>{cat.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost !text-xs" onClick={() => startEditCategory(cat)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn-ghost !text-xs text-red-700" onClick={() => deleteCategory(cat)}>
                  <Trash2 size={14} /> Delete
                </button>
                <button className="btn-primary !text-xs" onClick={() => startNewItem(cat.id)}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
            </div>

            {catItems.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>No items yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-beige-100">
                    <tr>
                      <th className="table-th">Name</th>
                      <th className="table-th">Time</th>
                      <th className="table-th">Procedure</th>
                      <th className="table-th">Internal Cost</th>
                      <th className="table-th text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map(it => (
                      <tr key={it.id}>
                        <td className="table-td font-medium">{it.name}</td>
                        <td className="table-td">{it.time ?? "—"}</td>
                        <td className="table-td whitespace-pre-line max-w-md">{it.procedure ?? "—"}</td>
                        <td className="table-td">{formatCurrency(it.internal_cost)}</td>
                        <td className="table-td text-right">
                          <div className="flex gap-2 justify-end">
                            <button className="text-xs underline" onClick={() => startEditItem(it)}>Edit</button>
                            <button className="text-xs text-red-700 underline" onClick={() => deleteItem(it)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {itemDraftCat === cat.id && editingItem && (
              <div className="mt-4 rounded-2xl border bg-white/60 p-4" style={{ borderColor: "var(--color-border)" }}>
                <h4 className="font-serif text-base mb-3" style={{ color: "var(--color-primary)" }}>
                  {editingItem.id ? "Edit Item" : "New Item"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Name *</label>
                    <input className="input" value={editingItem.name}
                      onChange={e => setItemDraft(p => p ? { ...p, name: e.target.value } : p)} />
                  </div>
                  <div>
                    <label className="label">Time</label>
                    <input className="input" placeholder="e.g. 45 minutes" value={editingItem.time}
                      onChange={e => setItemDraft(p => p ? { ...p, time: e.target.value } : p)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Procedure</label>
                    <textarea className="input" rows={4} value={editingItem.procedure}
                      onChange={e => setItemDraft(p => p ? { ...p, procedure: e.target.value } : p)} />
                  </div>
                  <div>
                    <label className="label">Internal Cost</label>
                    <input type="number" step="0.01" min="0" className="input" value={editingItem.internal_cost}
                      onChange={e => setItemDraft(p => p ? { ...p, internal_cost: e.target.value } : p)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" className="btn-ghost" disabled={pending}
                    onClick={() => { setItemDraft(null); setItemDraftCat(null); }}>Cancel</button>
                  <button type="button" className="btn-primary" disabled={pending} onClick={saveItem}>
                    {pending ? "Saving..." : "Save Item"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

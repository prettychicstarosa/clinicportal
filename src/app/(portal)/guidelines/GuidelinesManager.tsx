"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, X, ChevronRight, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

type CatDraft = { id?: string; name: string; description: string };
type ItemDraft = {
  id?: string;
  category_id: string;
  name: string;
  medicine_used: string;
  syringe_quantity: string;
  time: string;
  intensity: string;
  internal_cost: string;
  procedure: string;
  notes: string;
};

const EMPTY_CAT: CatDraft = { name: "", description: "" };
const emptyItem = (category_id: string): ItemDraft => ({
  category_id,
  name: "",
  medicine_used: "",
  syringe_quantity: "",
  time: "",
  intensity: "",
  internal_cost: "0",
  procedure: "",
  notes: ""
});

type PgErrLike = { code?: string; message?: string; details?: string; hint?: string };

function describeError(e: PgErrLike | null | undefined): string {
  if (!e) return "Unknown error.";
  const code = e.code ?? "";
  const msg = e.message ?? "";
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return "The guidelines tables do not exist yet. Please run the 0006_guidelines.sql patch in Supabase, then refresh.";
  }
  if (code === "42703" || /column .* does not exist/i.test(msg)) {
    return `Schema mismatch: ${msg}. Re-run the latest 0006_guidelines.sql patch in Supabase to add the missing columns.`;
  }
  if (code === "42501" || /permission denied|row[- ]level security|rls/i.test(msg)) {
    return "Permission denied. Only owner or admin can edit guidelines. Make sure you are signed in as an owner/admin and that RLS policies for guideline_categories / guideline_items are installed.";
  }
  if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
    return "That name is already in use. Please pick a different one.";
  }
  if (code === "23503" || /foreign key/i.test(msg)) {
    return "Linked record missing. Please reload the page and try again.";
  }
  return msg || "Could not save. Please try again.";
}

function sortCats(a: GuidelineCategory, b: GuidelineCategory) {
  if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }
  return (a.name ?? "").localeCompare(b.name ?? "");
}
function sortItems(a: GuidelineItem, b: GuidelineItem) {
  if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }
  return (a.name ?? "").localeCompare(b.name ?? "");
}

export default function GuidelinesManager({
  initialCategories,
  initialItems
}: {
  initialCategories: GuidelineCategory[];
  initialItems: GuidelineItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // IMPORTANT: props are used ONLY as the initial seed. After mount we own
  // the state. Never re-sync from props — otherwise a stale server fetch from
  // router.refresh() can wipe out a freshly-inserted row.
  const [categories, setCategories] = useState<GuidelineCategory[]>(() => [...initialCategories].sort(sortCats));
  const [items, setItems] = useState<GuidelineItem[]>(() => [...initialItems].sort(sortItems));
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null
  );

  const [catDraft, setCatDraft] = useState<CatDraft | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [itemErr, setItemErr] = useState<string | null>(null);
  const [pageErr, setPageErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [justCreatedCatId, setJustCreatedCatId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    } else if (selectedCatId && !categories.some(c => c.id === selectedCatId)) {
      setSelectedCatId(categories[0]?.id ?? null);
    }
  }, [categories, selectedCatId]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const selectedCat = useMemo(
    () => categories.find(c => c.id === selectedCatId) ?? null,
    [categories, selectedCatId]
  );
  const catItems = useMemo(
    () => items.filter(i => i.category_id === selectedCatId).sort(sortItems),
    [items, selectedCatId]
  );

  // Refetch the truth from Supabase via the browser client. Used after every
  // mutation and once on mount to make sure we are in sync.
  const reloadAll = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabase = createSupabaseBrowserClient();
      const [catsRes, itemsRes] = await Promise.all([
        supabase
          .from("guideline_categories")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("guideline_items")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      ]);
      if (catsRes.error) {
        console.error("[guidelines] reload categories failed", catsRes.error);
        return { ok: false, error: describeError(catsRes.error) };
      }
      if (itemsRes.error) {
        console.error("[guidelines] reload items failed", itemsRes.error);
        return { ok: false, error: describeError(itemsRes.error) };
      }
      const cats = ((catsRes.data ?? []) as GuidelineCategory[]).slice().sort(sortCats);
      const its  = ((itemsRes.data ?? []) as GuidelineItem[]).slice().sort(sortItems);
      console.info("[guidelines] reload ok — categories:", cats.length, "items:", its.length);
      setCategories(cats);
      setItems(its);
      return { ok: true };
    } catch (e: unknown) {
      console.error("[guidelines] reload threw", e);
      return { ok: false, error: e instanceof Error ? e.message : "Reload failed." };
    }
  }, []);

  // One reload on mount to defeat any stale SSR / cache state.
  const didInitialReload = useRef(false);
  useEffect(() => {
    if (didInitialReload.current) return;
    didInitialReload.current = true;
    reloadAll();
  }, [reloadAll]);

  function startNewCategory() {
    setCatErr(null);
    setCatDraft({ ...EMPTY_CAT });
  }
  function startEditCategory(cat: GuidelineCategory) {
    setCatErr(null);
    setCatDraft({ id: cat.id, name: cat.name, description: cat.description ?? "" });
  }
  function startNewItem(categoryId?: string) {
    const target = categoryId ?? selectedCatId;
    if (!target) return;
    setItemErr(null);
    setItemDraft(emptyItem(target));
  }
  function startEditItem(it: GuidelineItem) {
    setItemErr(null);
    setItemDraft({
      id: it.id,
      category_id: it.category_id,
      name: it.name,
      medicine_used: it.medicine_used ?? "",
      syringe_quantity: it.syringe_quantity ?? "",
      time: it.time ?? "",
      intensity: it.intensity ?? "",
      internal_cost: String(it.internal_cost ?? 0),
      procedure: it.procedure ?? "",
      notes: it.notes ?? ""
    });
  }

  function saveCategory() {
    if (!catDraft) return;
    const name = catDraft.name.trim();
    if (!name) { setCatErr("Category name is required."); return; }

    start(async () => {
      setCatErr(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          console.error("[guidelines] auth check failed", authErr);
          setCatErr("You are not signed in. Please log in again.");
          return;
        }

        if (catDraft.id) {
          const payload = {
            name,
            description: catDraft.description.trim() || null
          };
          console.info("[guidelines] updating category", catDraft.id, payload);
          const { data, error } = await supabase
            .from("guideline_categories")
            .update(payload)
            .eq("id", catDraft.id)
            .select()
            .single();
          if (error || !data) {
            console.error("[guidelines] update category failed", error);
            setCatErr(describeError(error));
            return;
          }
          const updated = data as GuidelineCategory;
          setCategories(prev => prev.map(c => (c.id === updated.id ? updated : c)).sort(sortCats));
          setCatDraft(null);
          setSuccessMsg(`Category "${updated.name}" updated.`);
        } else {
          // Insert ONLY the fields the spec asks for. All other columns have
          // safe defaults in the DB (sort_order default 0, timestamps default now()).
          const payload = {
            name,
            description: catDraft.description.trim() || null,
            created_by: user.id,
            sort_order: 0
          };
          console.info("[guidelines] inserting category", payload);
          const { data, error } = await supabase
            .from("guideline_categories")
            .insert(payload)
            .select()
            .single();
          if (error || !data) {
            console.error("[guidelines] insert category failed", error);
            setCatErr(describeError(error));
            return;
          }
          const inserted = data as GuidelineCategory;
          console.info("[guidelines] insert category ok", inserted);
          setCategories(prev => {
            const next = prev.some(c => c.id === inserted.id)
              ? prev.map(c => (c.id === inserted.id ? inserted : c))
              : [...prev, inserted];
            return next.sort(sortCats);
          });
          setSelectedCatId(inserted.id);
          setJustCreatedCatId(inserted.id);
          setCatDraft(null);
          setSuccessMsg(`Category "${inserted.name}" added. Now add your first procedure below.`);
        }

        // Authoritative refetch — guarantees the list matches the DB.
        const r = await reloadAll();
        if (!r.ok && r.error) setPageErr(r.error);
        router.refresh();
      } catch (e: unknown) {
        console.error("[guidelines] saveCategory threw", e);
        setCatErr(e instanceof Error ? e.message : "Unexpected error while saving category.");
      }
    });
  }

  function deleteCategory(cat: GuidelineCategory) {
    if (!confirm(`Delete category "${cat.name}" and all its procedures?`)) return;
    start(async () => {
      setPageErr(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
          .from("guideline_categories")
          .delete()
          .eq("id", cat.id);
        if (error) {
          console.error("[guidelines] delete category failed", error);
          setPageErr(describeError(error));
          return;
        }
        setCategories(prev => prev.filter(c => c.id !== cat.id));
        setItems(prev => prev.filter(i => i.category_id !== cat.id));
        if (selectedCatId === cat.id) setSelectedCatId(null);
        if (justCreatedCatId === cat.id) setJustCreatedCatId(null);
        setSuccessMsg(`Category "${cat.name}" deleted.`);
        await reloadAll();
        router.refresh();
      } catch (e: unknown) {
        console.error("[guidelines] deleteCategory threw", e);
        setPageErr(e instanceof Error ? e.message : "Unexpected error while deleting category.");
      }
    });
  }

  function saveItem() {
    if (!itemDraft) return;
    const name = itemDraft.name.trim();
    if (!name) { setItemErr("Service / procedure name is required."); return; }
    if (!itemDraft.category_id) { setItemErr("Please select a category first."); return; }

    start(async () => {
      setItemErr(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          console.error("[guidelines] auth check failed", authErr);
          setItemErr("You are not signed in. Please log in again.");
          return;
        }

        const basePayload = {
          category_id: itemDraft.category_id,
          name,
          medicine_used: itemDraft.medicine_used.trim() || null,
          syringe_quantity: itemDraft.syringe_quantity.trim() || null,
          time: itemDraft.time.trim() || null,
          intensity: itemDraft.intensity.trim() || null,
          internal_cost: Number(itemDraft.internal_cost) || 0,
          procedure: itemDraft.procedure.trim() || null,
          notes: itemDraft.notes.trim() || null
        };

        if (itemDraft.id) {
          console.info("[guidelines] updating item", itemDraft.id, basePayload);
          const { data, error } = await supabase
            .from("guideline_items")
            .update(basePayload)
            .eq("id", itemDraft.id)
            .select()
            .single();
          if (error || !data) {
            console.error("[guidelines] update item failed", error);
            setItemErr(describeError(error));
            return;
          }
          const updated = data as GuidelineItem;
          setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)).sort(sortItems));
          setItemDraft(null);
          setSuccessMsg(`Procedure "${updated.name}" updated.`);
        } else {
          const insertPayload = { ...basePayload, created_by: user.id };
          console.info("[guidelines] inserting item", insertPayload);
          const { data, error } = await supabase
            .from("guideline_items")
            .insert(insertPayload)
            .select()
            .single();
          if (error || !data) {
            console.error("[guidelines] insert item failed", error);
            setItemErr(describeError(error));
            return;
          }
          const inserted = data as GuidelineItem;
          console.info("[guidelines] insert item ok", inserted);
          setItems(prev => {
            const next = prev.some(i => i.id === inserted.id)
              ? prev.map(i => (i.id === inserted.id ? inserted : i))
              : [...prev, inserted];
            return next.sort(sortItems);
          });
          if (justCreatedCatId === inserted.category_id) setJustCreatedCatId(null);
          setItemDraft(null);
          setSuccessMsg(`Procedure "${inserted.name}" saved.`);
        }

        const r = await reloadAll();
        if (!r.ok && r.error) setPageErr(r.error);
        router.refresh();
      } catch (e: unknown) {
        console.error("[guidelines] saveItem threw", e);
        setItemErr(e instanceof Error ? e.message : "Unexpected error while saving procedure.");
      }
    });
  }

  function deleteItem(it: GuidelineItem) {
    if (!confirm(`Delete "${it.name}"?`)) return;
    start(async () => {
      setPageErr(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
          .from("guideline_items")
          .delete()
          .eq("id", it.id);
        if (error) {
          console.error("[guidelines] delete item failed", error);
          setPageErr(describeError(error));
          return;
        }
        setItems(prev => prev.filter(i => i.id !== it.id));
        setSuccessMsg(`Procedure "${it.name}" deleted.`);
        await reloadAll();
        router.refresh();
      } catch (e: unknown) {
        console.error("[guidelines] deleteItem threw", e);
        setPageErr(e instanceof Error ? e.message : "Unexpected error while deleting procedure.");
      }
    });
  }

  const showJustCreatedPrompt =
    !!justCreatedCatId && justCreatedCatId === selectedCatId && catItems.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Organize service guidelines by category. Staff with access can view; only owner / admin can edit.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={startNewCategory}
          disabled={pending}
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      {successMsg && (
        <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}
      {pageErr && <ErrorBanner message={pageErr} onDismiss={() => setPageErr(null)} />}

      {categories.length === 0 ? (
        <div className="card text-center py-10">
          <FileText size={28} className="mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <p className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>
            No categories yet
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Start by adding a category — e.g. Facial, Injectables, Laser, Slimming.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={startNewCategory}>
            <Plus size={16} /> Add your first category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[170px_1fr] gap-4 max-w-full">
          <aside className="space-y-2 min-w-0">
            <div className="hidden lg:block">
              <CategoryList
                categories={categories}
                selectedId={selectedCatId}
                onSelect={(id) => { setSelectedCatId(id); setJustCreatedCatId(null); }}
                onEdit={startEditCategory}
                onDelete={deleteCategory}
                canManage
              />
            </div>
            <div className="lg:hidden">
              <label className="label">Category</label>
              <select
                className="input"
                value={selectedCatId ?? ""}
                onChange={(e) => { setSelectedCatId(e.target.value || null); setJustCreatedCatId(null); }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedCat && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    className="btn-ghost !text-xs flex-1"
                    onClick={() => startEditCategory(selectedCat)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !text-xs flex-1 text-red-700"
                    onClick={() => deleteCategory(selectedCat)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-3 min-w-0">
            {selectedCat ? (
              <>
                {showJustCreatedPrompt && (
                  <NextStepPrompt
                    categoryName={selectedCat.name}
                    onAdd={() => startNewItem(selectedCat.id)}
                    onDismiss={() => setJustCreatedCatId(null)}
                  />
                )}
                <CategoryDetail
                  category={selectedCat}
                  items={catItems}
                  canManage
                  onAddItem={() => startNewItem(selectedCat.id)}
                  onEditItem={startEditItem}
                  onDeleteItem={deleteItem}
                />
              </>
            ) : (
              <div className="card text-sm" style={{ color: "var(--color-muted)" }}>
                Select a category to view its procedures.
              </div>
            )}
          </section>
        </div>
      )}

      {catDraft && (
        <Modal
          title={catDraft.id ? "Edit Category" : "New Category"}
          onClose={() => { setCatDraft(null); setCatErr(null); }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); saveCategory(); }}
            className="space-y-3"
          >
            {catErr && <ErrorBanner message={catErr} />}
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={catDraft.name}
                placeholder="e.g. Injectables"
                onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={catDraft.description}
                placeholder="Optional short description"
                onChange={(e) => setCatDraft({ ...catDraft, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => { setCatDraft(null); setCatErr(null); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {itemDraft && (
        <Modal
          title={itemDraft.id ? "Edit Procedure" : "New Procedure"}
          subtitle={categories.find(c => c.id === itemDraft.category_id)?.name ?? selectedCat?.name}
          wide
          onClose={() => { setItemDraft(null); setItemErr(null); }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); saveItem(); }}
            className="space-y-3"
          >
            {itemErr && <ErrorBanner message={itemErr} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="label">Service / Procedure Name *</label>
                <input
                  className="input"
                  value={itemDraft.name}
                  placeholder="e.g. Botox forehead"
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label">Medicine / Product Used</label>
                <input
                  className="input"
                  value={itemDraft.medicine_used}
                  placeholder="e.g. Botulinum toxin"
                  onChange={(e) => setItemDraft({ ...itemDraft, medicine_used: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Syringe / Quantity</label>
                <input
                  className="input"
                  value={itemDraft.syringe_quantity}
                  placeholder="e.g. 1 syringe / 1ml"
                  onChange={(e) => setItemDraft({ ...itemDraft, syringe_quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Time</label>
                <input
                  className="input"
                  value={itemDraft.time}
                  placeholder="e.g. 30 minutes"
                  onChange={(e) => setItemDraft({ ...itemDraft, time: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Intensity / Settings</label>
                <input
                  className="input"
                  value={itemDraft.intensity}
                  placeholder="e.g. Level 3 / 1.5 J"
                  onChange={(e) => setItemDraft({ ...itemDraft, intensity: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Internal Cost</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={itemDraft.internal_cost}
                  onChange={(e) => setItemDraft({ ...itemDraft, internal_cost: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Procedure / Steps</label>
                <textarea
                  className="input"
                  rows={4}
                  value={itemDraft.procedure}
                  placeholder="Step-by-step procedure"
                  onChange={(e) => setItemDraft({ ...itemDraft, procedure: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={itemDraft.notes}
                  placeholder="Internal notes, contraindications, reminders"
                  onChange={(e) => setItemDraft({ ...itemDraft, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => { setItemDraft(null); setItemErr(null); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Saving..." : "Save Procedure"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function NextStepPrompt({
  categoryName,
  onAdd,
  onDismiss
}: {
  categoryName: string;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="relative rounded-2xl border p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      style={{
        background: "linear-gradient(135deg, var(--color-surface-2) 0%, var(--color-surface) 100%)",
        borderColor: "var(--color-accent)"
      }}
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute top-2 right-2 rounded-full p-1 hover:bg-black/5 transition"
        onClick={onDismiss}
      >
        <X size={14} style={{ color: "var(--color-muted)" }} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <Sparkles size={18} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div>
          <p className="font-serif text-base" style={{ color: "var(--color-primary)" }}>
            What procedure / service do you want to add under {categoryName}?
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Add at least one procedure so staff can reference it. You can add more anytime.
          </p>
        </div>
      </div>
      <button type="button" className="btn-primary self-start md:self-auto" onClick={onAdd}>
        <Plus size={16} /> Add Procedure
      </button>
    </div>
  );
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
      style={{ background: "#E8F5EE", borderColor: "#B5DCC6", color: "#1F6E3D" }}
      role="status"
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 size={16} className="mt-0.5" />
        <span className="whitespace-pre-line">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm text-red-800"
      style={{ background: "#FDECEC", borderColor: "#F5C2C2" }}
      role="alert"
    >
      <span className="whitespace-pre-line">{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          className="text-red-800/70 hover:text-red-800"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function CategoryList({
  categories,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  canManage
}: {
  categories: GuidelineCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit?: (cat: GuidelineCategory) => void;
  onDelete?: (cat: GuidelineCategory) => void;
  canManage?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {categories.map((c) => {
        const active = c.id === selectedId;
        return (
          <li key={c.id}>
            <div
              className="rounded-2xl border p-3 transition cursor-pointer"
              style={{
                background: active ? "var(--color-surface-2)" : "var(--color-surface)",
                borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                boxShadow: active ? "0 4px 14px -8px rgba(80,54,38,0.25)" : "none"
              }}
              onClick={() => onSelect(c.id)}
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
              {canManage && active && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    className="text-xs underline"
                    style={{ color: "var(--color-primary-soft)" }}
                    onClick={(e) => { e.stopPropagation(); onEdit?.(c); }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs underline text-red-700"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(c); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryDetail({
  category,
  items,
  canManage,
  onAddItem,
  onEditItem,
  onDeleteItem
}: {
  category: GuidelineCategory;
  items: GuidelineItem[];
  canManage?: boolean;
  onAddItem?: () => void;
  onEditItem?: (it: GuidelineItem) => void;
  onDeleteItem?: (it: GuidelineItem) => void;
}) {
  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-xl" style={{ color: "var(--color-primary)" }}>
            {category.name}
          </h3>
          {category.description && (
            <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
              {category.description}
            </p>
          )}
        </div>
        {canManage && (
          <button type="button" className="btn-primary self-start md:self-auto" onClick={onAddItem}>
            <Plus size={16} /> Add Procedure
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed text-center py-8 px-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            No procedures in this category yet.
          </p>
          {canManage && (
            <button type="button" className="btn-ghost mt-3 !text-xs" onClick={onAddItem}>
              <Plus size={14} /> Add the first procedure
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="hidden md:block max-w-full overflow-x-auto rounded-xl border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                {canManage && <col style={{ width: "9%" }} />}
              </colgroup>
              <thead className="bg-beige-100">
                <tr>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Service / Procedure</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Medicine / Product</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Syringe / Qty</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Time</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Intensity</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Internal Cost</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Procedure</th>
                  <th className="table-th !px-1.5 !py-1.5 !text-[10px]">Notes</th>
                  {canManage && <th className="table-th !px-1.5 !py-1.5 !text-[10px] text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] font-medium whitespace-pre-line break-words">{it.name}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] break-words">{it.medicine_used ?? "—"}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] break-words">{it.syringe_quantity ?? "—"}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] break-words">{it.time ?? "—"}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] break-words">{it.intensity ?? "—"}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] whitespace-nowrap">{formatCurrency(it.internal_cost)}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] whitespace-pre-line break-words">{it.procedure ?? "—"}</td>
                    <td className="table-td !px-1.5 !py-1.5 !text-[11px] whitespace-pre-line break-words">{it.notes ?? "—"}</td>
                    {canManage && (
                      <td className="table-td !px-1.5 !py-1.5 !text-[11px] text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="text-xs underline"
                            style={{ color: "var(--color-primary-soft)" }}
                            onClick={() => onEditItem?.(it)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs underline text-red-700"
                            onClick={() => onDeleteItem?.(it)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-3">
            {items.map((it) => (
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
                {canManage && (
                  <div className="flex gap-3 mt-3">
                    <button
                      type="button"
                      className="text-xs underline"
                      style={{ color: "var(--color-primary-soft)" }}
                      onClick={() => onEditItem?.(it)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs underline text-red-700"
                      onClick={() => onDeleteItem?.(it)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
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

function Modal({
  title,
  subtitle,
  wide,
  onClose,
  children
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-2 md:p-6"
      style={{ background: "rgba(43,28,19,0.45)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-2xl shadow-xl border overflow-hidden`}
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <h3 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>{title}</h3>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full p-1 hover:bg-black/5 transition"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} style={{ color: "var(--color-muted)" }} />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-client";

export default function DeleteExpenseButton({
  id,
  title,
  expense
}: {
  id: string;
  title: string;
  expense?: { category?: string; amount?: number; expense_date?: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onDelete() {
    if (!confirm(`Delete expense "${title}"?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) { alert(error.message); return; }
      await logActivity({
        action: "deleted expense " + title, entity: "expense", entity_id: id,
        details: expense?.category ? `${expense.category} · ${title}` : title,
        oldValue: {
          title,
          category: expense?.category ?? null,
          amount: expense?.amount ?? null,
          expense_date: expense?.expense_date ?? null
        }
      });
      router.refresh();
    });
  }
  return <button onClick={onDelete} disabled={pending} className="text-xs text-red-700 underline">Delete</button>;
}

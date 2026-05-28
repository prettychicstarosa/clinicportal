"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DeleteExpenseButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onDelete() {
    if (!confirm(`Delete expense "${title}"?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "deleted expense " + title, entity: "expense"
      });
      router.refresh();
    });
  }
  return <button onClick={onDelete} disabled={pending} className="text-xs text-red-700 underline">Delete</button>;
}

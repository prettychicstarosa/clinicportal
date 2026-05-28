"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DeleteIncomeButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onDelete() {
    if (!confirm(`Delete income record for ${label}?`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("income").delete().eq("id", id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: "deleted income",
        entity: "income",
        details: label
      });
      router.refresh();
    });
  }
  return (
    <button
      onClick={onDelete}
      disabled={pending}
      className="text-xs text-red-700 underline"
    >
      Delete
    </button>
  );
}

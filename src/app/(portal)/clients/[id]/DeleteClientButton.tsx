"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onDelete() {
    if (!confirm(`Delete client ${name}? This cannot be undone.`)) return;
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) { alert(error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "deleted client " + name, entity: "client"
      });
      router.push("/clients");
      router.refresh();
    });
  }
  return <button onClick={onDelete} disabled={pending} className="btn-danger">{pending ? "Deleting..." : "Delete"}</button>;
}

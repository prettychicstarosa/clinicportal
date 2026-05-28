import { createSupabaseServerClient } from "./supabase/server";

export async function logActivity(args: {
  action: string;
  entity?: string;
  entity_id?: string | null;
  details?: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let actor_name: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).single();
    actor_name = profile?.full_name ?? user.email ?? null;
  }
  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    actor_name,
    action: args.action,
    entity: args.entity ?? null,
    entity_id: args.entity_id ?? null,
    details: args.details ?? null
  });
}

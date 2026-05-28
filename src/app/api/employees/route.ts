import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdminUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", status: 401 } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return { error: "Admin only", status: 403 } as const;
  }
  return { user, profile } as const;
}

async function logAdminAction(action: string, details?: string, entity_id?: string) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    actor_name: profile?.full_name ?? user?.email ?? null,
    action, entity: "employee", entity_id: entity_id ?? null, details: details ?? null
  });
}

export async function POST(req: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const admin = createSupabaseAdminClient();

  try {
    if (action === "create") {
      const { full_name, email, password, role } = body;
      if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, role }
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      // ensure profile row matches (handle_new_user trigger creates it)
      await admin.from("profiles").upsert({
        id: data.user!.id, full_name: full_name ?? "", email, role: role ?? "staff", is_active: true
      });
      await logAdminAction("created employee account", `${email} (${role})`, data.user!.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle_active") {
      const { user_id, is_active } = body;
      const { error } = await admin.from("profiles").update({ is_active: !!is_active }).eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(is_active ? "enabled employee" : "disabled employee", undefined, user_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "change_role") {
      const { user_id, role } = body;
      if (!["admin","staff"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      const { error } = await admin.from("profiles").update({ role }).eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.auth.admin.updateUserById(user_id, { user_metadata: { role } });
      await logAdminAction("changed employee role", `role=${role}`, user_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

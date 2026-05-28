import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireManager() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", status: 401 } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.is_active || (profile.role !== "owner" && profile.role !== "admin")) {
    return { error: "Manager access required", status: 403 } as const;
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
  const auth = await requireManager();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const admin = createSupabaseAdminClient();
  const actorRole = auth.profile.role;

  try {
    if (action === "create") {
      const { full_name, username, password, is_active } = body;
      let { role } = body as { role: string };
      const rawUsername = (username ?? "").toString().trim().toLowerCase();
      if (!rawUsername || !password) {
        return NextResponse.json({ error: "Username and password required" }, { status: 400 });
      }
      if (!/^[a-z0-9._-]+$/.test(rawUsername)) {
        return NextResponse.json(
          { error: "Username may only contain letters, numbers, dots, dashes, and underscores" },
          { status: 400 }
        );
      }
      const email = rawUsername.includes("@") ? rawUsername : `${rawUsername}@prettychic.local`;
      // Only an owner can mint another owner. Admins create staff/admin only.
      if (role === "owner" && actorRole !== "owner") {
        return NextResponse.json({ error: "Only the owner can create another owner account" }, { status: 403 });
      }
      if (!["owner", "admin", "staff"].includes(role)) role = "staff";
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, role, username: rawUsername }
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.from("profiles").upsert({
        id: data.user!.id,
        full_name: full_name ?? "",
        email,
        role,
        is_active: is_active === false ? false : true
      });
      await logAdminAction("created staff account", `${rawUsername} (${role})`, data.user!.id);
      return NextResponse.json({ ok: true, username: rawUsername, email });
    }

    if (action === "toggle_active") {
      const { user_id, is_active } = body;
      const { data: target } = await admin.from("profiles").select("role").eq("id", user_id).single();
      if (target?.role === "owner" && !is_active) {
        return NextResponse.json({ error: "Owner account cannot be disabled" }, { status: 400 });
      }
      const { error } = await admin.from("profiles").update({ is_active: !!is_active }).eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(is_active ? "enabled staff" : "disabled staff", undefined, user_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "change_role") {
      const { user_id, role } = body;
      if (!["owner", "admin", "staff"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      const { data: target } = await admin.from("profiles").select("role").eq("id", user_id).single();
      if (target?.role === "owner" && role !== "owner") {
        return NextResponse.json({ error: "Owner role cannot be downgraded" }, { status: 400 });
      }
      if (role === "owner" && actorRole !== "owner") {
        return NextResponse.json({ error: "Only the owner can promote to owner" }, { status: 403 });
      }
      const { error } = await admin.from("profiles").update({ role }).eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.auth.admin.updateUserById(user_id, { user_metadata: { role } });
      await logAdminAction("changed staff role", `role=${role}`, user_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction("reset staff password", undefined, user_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "update_profile") {
      const { user_id, full_name } = body;
      if (typeof full_name !== "string" || !full_name.trim()) {
        return NextResponse.json({ error: "Full name required" }, { status: 400 });
      }
      const { error } = await admin.from("profiles")
        .update({ full_name: full_name.trim() })
        .eq("id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.auth.admin.updateUserById(user_id, {
        user_metadata: { full_name: full_name.trim() }
      });
      await logAdminAction("updated staff profile", `name=${full_name.trim()}`, user_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      const { data: target } = await admin.from("profiles").select("role").eq("id", user_id).single();
      if (target?.role === "owner") {
        return NextResponse.json({ error: "Owner account cannot be deleted" }, { status: 400 });
      }
      const { error: delAuthErr } = await admin.auth.admin.deleteUser(user_id);
      if (delAuthErr) return NextResponse.json({ error: delAuthErr.message }, { status: 400 });
      await logAdminAction("deleted staff account", undefined, user_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

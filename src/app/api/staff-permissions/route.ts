import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PERMISSIONS, PERMISSION_TABS } from "@/lib/permissions-shared";
import type { PermissionKey } from "@/lib/types";

async function requireManager() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", status: 401 } as const;
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.is_active || (profile.role !== "owner" && profile.role !== "admin")) {
    return { error: "Manager access required", status: 403 } as const;
  }
  return { user, profile } as const;
}

const ALLOWED_KEYS: PermissionKey[] = PERMISSION_TABS.map(t => t.key);

export async function GET(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("staff_permissions").select("*").eq("profile_id", profileId).maybeSingle();
  if (data) return NextResponse.json({ permissions: data });
  return NextResponse.json({ permissions: { profile_id: profileId, ...DEFAULT_PERMISSIONS } });
}

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({} as any));
  const { profile_id, permissions } = body as {
    profile_id?: string;
    permissions?: Partial<Record<PermissionKey, boolean>>;
  };
  if (!profile_id || !permissions) {
    return NextResponse.json({ error: "profile_id and permissions required" }, { status: 400 });
  }

  const cleaned: Record<string, any> = { profile_id };
  for (const k of ALLOWED_KEYS) {
    if (k in permissions) cleaned[k] = Boolean((permissions as any)[k]);
  }
  cleaned.updated_by = auth.user.id;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("staff_permissions").upsert(cleaned, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("activity_logs").insert({
    actor_id: auth.user.id,
    action: "updated staff permissions",
    entity: "staff_permissions",
    entity_id: profile_id,
    details: Object.entries(cleaned)
      .filter(([k]) => ALLOWED_KEYS.includes(k as PermissionKey))
      .map(([k, v]) => `${k}=${v ? "on" : "off"}`)
      .join(", ")
  });

  return NextResponse.json({ ok: true });
}

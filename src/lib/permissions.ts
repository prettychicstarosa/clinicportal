import { createSupabaseServerClient } from "./supabase/server";
import type { Profile, StaffPermissions } from "./types";
import { isManager } from "./auth";
import { PERMISSION_TABS, DEFAULT_PERMISSIONS } from "./permissions-shared";
import type { PermissionKey } from "./types";

export { PERMISSION_TABS, DEFAULT_PERMISSIONS };

export async function getPermissionsForProfile(profileId: string): Promise<StaffPermissions> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("staff_permissions")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (data) return data as StaffPermissions;
  return { profile_id: profileId, ...DEFAULT_PERMISSIONS };
}

export function effectivePermissions(profile: Profile, perms: StaffPermissions): Record<PermissionKey, boolean> {
  const isMgr = isManager(profile.role);
  const out = {} as Record<PermissionKey, boolean>;
  for (const t of PERMISSION_TABS) {
    out[t.key] = isMgr ? true : Boolean((perms as any)[t.key]);
  }
  return out;
}

export async function canAccess(key: PermissionKey, profile: Profile): Promise<boolean> {
  if (isManager(profile.role)) return true;
  const p = await getPermissionsForProfile(profile.id);
  return Boolean((p as any)[key]);
}

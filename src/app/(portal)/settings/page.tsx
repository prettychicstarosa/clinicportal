import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getCurrentProfile, isManager } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import { unstable_noStore as noStore } from "next/cache";
import SettingsForm from "./SettingsForm";
import EmployeeManager from "./EmployeeManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  // Never serve a cached render of this page — the staff list must always
  // reflect the latest profiles after a create/delete/disable.
  noStore();

  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const isMgr = isManager(profile.role);
  const isOwner = profile.role === "owner";

  // Only owners see staff management; admin/staff don't.
  // Staff Accounts must show ONLY active, non-deleted profiles.
  let employees: any[] | null = null;
  if (isOwner) {
    console.log("[StaffAccounts] loading staff list from table: public.profiles (is_active = true, order created_at desc)");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) console.error("[StaffAccounts] profiles query failed:", error.message);
    // Defensive: drop any soft-deleted row even if it somehow stayed active.
    // (Safe when the deleted_at column isn't present yet — the field is undefined.)
    employees = (data ?? []).filter((e: any) => !e.deleted_at);
    console.log(`[StaffAccounts] returning ${employees.length} active profile(s)`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Customize your clinic portal" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-serif text-lg mb-4" style={{ color: "var(--color-primary)" }}>Clinic Branding</h3>
          {!isMgr && (
            <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>
              Only the owner or an admin can change branding. Reach out to your manager to update these.
            </p>
          )}
          <SettingsForm settings={settings} disabled={!isMgr} />
        </div>

        <div className="card flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Logo Preview</div>
          <Logo src={settings.logo_url ?? null} name={settings.clinic_name} size={120} />
          <div className="font-serif" style={{ color: "var(--color-primary)" }}>{settings.clinic_name}</div>
          <div className="text-xs px-3" style={{ color: "var(--color-muted)" }}>
            Signed in as <b>{profile.full_name || profile.email}</b> · {profile.role}
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="card">
          <h3 className="font-serif text-lg mb-4" style={{ color: "var(--color-primary)" }}>Staff Accounts</h3>
          <EmployeeManager
            employees={(employees ?? []) as any}
            currentUserId={profile.id}
            currentUserRole={profile.role as any}
          />
        </div>
      )}

      {!isOwner && (
        <div className="card">
          <h3 className="font-serif text-lg mb-2" style={{ color: "var(--color-primary)" }}>Staff Accounts</h3>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Staff account management is restricted to the clinic owner.
          </p>
        </div>
      )}
    </div>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getCurrentProfile } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import SettingsForm from "./SettingsForm";
import EmployeeManager from "./EmployeeManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const isAdmin = profile.role === "admin";

  const { data: employees } = isAdmin
    ? await supabase.from("profiles").select("*").order("full_name")
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Customize your clinic portal" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-serif text-lg mb-4" style={{ color: "var(--color-primary)" }}>Clinic Branding</h3>
          {!isAdmin && (
            <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>
              Only the owner/admin can change branding. Reach out to your admin to update these.
            </p>
          )}
          <SettingsForm settings={settings} disabled={!isAdmin} />
        </div>

        <div className="card flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Logo Preview</div>
          <Logo src={settings.logo_url ?? null} name={settings.clinic_name} size={120} />
          <div className="font-serif" style={{ color: "var(--color-primary)" }}>{settings.clinic_name}</div>
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h3 className="font-serif text-lg mb-4" style={{ color: "var(--color-primary)" }}>Manage Employees</h3>
          <EmployeeManager employees={employees ?? []} currentUserId={profile.id} />
        </div>
      )}
    </div>
  );
}

import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileNav } from "@/components/MobileNav";
import { getCurrentProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { effectivePermissions, getPermissionsForProfile } from "@/lib/permissions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const perms = await getPermissionsForProfile(profile.id);
  const allowed = effectivePermissions(profile, perms);
  return (
    <div className="min-h-screen flex">
      <Sidebar
        clinicName={settings.clinic_name}
        logoUrl={settings.logo_url ?? null}
        userName={profile.full_name || profile.email}
        role={profile.role}
        allowed={allowed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar clinicName={settings.clinic_name} logoUrl={settings.logo_url ?? null} />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
        <MobileNav allowed={allowed} />
      </div>
    </div>
  );
}

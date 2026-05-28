import { getSettings } from "@/lib/settings";
import LoginForm from "./LoginForm";
import { Logo } from "@/components/Logo";

export default async function LoginPage() {
  const settings = await getSettings().catch(() => null);
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-beige-50">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo src={settings?.logo_url ?? null} name={settings?.clinic_name} size={88} />
          <h1 className="font-serif text-2xl mt-2" style={{ color: "var(--color-primary)" }}>
            {settings?.clinic_name ?? "Pretty Chic Aesthetics"}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Clinic Portal Login</p>
        </div>
        <div className="card">
          <LoginForm />
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "var(--color-muted)" }}>
          Need an account? Ask the clinic owner to create one for you.
        </p>
      </div>
    </div>
  );
}

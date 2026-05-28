import { Logo } from "./Logo";

export function LoadingScreen({ logoUrl, name }: { logoUrl?: string | null; name?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-beige-50 gap-4">
      <Logo src={logoUrl} name={name} size={96} />
      <div className="spinner mt-4" />
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>Loading clinic portal...</p>
    </div>
  );
}

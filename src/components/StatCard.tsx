import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, icon: Icon, accent
}: { label: string; value: string | number; icon?: LucideIcon; accent?: string }) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          {label}
        </div>
        <div className="mt-2 text-2xl font-serif" style={{ color: "var(--color-primary)" }}>
          {value}
        </div>
      </div>
      {Icon && (
        <div className="rounded-xl p-2"
             style={{ background: accent ?? "rgba(193,139,123,0.15)", color: "var(--color-primary)" }}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

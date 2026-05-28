export function PageHeader({
  title, subtitle, action
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6 pb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
      <div>
        <h1 className="font-serif text-2xl md:text-3xl tracking-tight" style={{ color: "var(--color-primary)" }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

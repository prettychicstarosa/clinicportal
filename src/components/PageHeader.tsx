export function PageHeader({
  title, subtitle, action
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl" style={{ color: "var(--color-primary)" }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

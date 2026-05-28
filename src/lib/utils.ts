export function formatCurrency(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(v);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

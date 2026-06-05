import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { Users, Sparkles, CalendarDays, Receipt, CreditCard, Package, Activity, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// "2026-06" -> "June 2026"
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_LABELS[idx] ?? m} ${y}`;
}

// Month key (YYYY-MM) for an expense, preferring expense_date then created_at.
function expenseMonth(e: any): string {
  const d = (e.expense_date as string | null) ?? (e.created_at as string | null) ?? "";
  return d.slice(0, 7);
}

export default async function ReportsPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createSupabaseServerClient();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [
    clients, packagesAll, appts,
    receivable, lowStockItems, paidVsUnpaid, packageSales,
    inventoryConsumption, expensesAll, staffActivity
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("packages").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("balance"),
    supabase.from("inventory").select("id, name, container_type, container_unit, remaining_stock, low_stock_alert, stock_status").in("stock_status", ["Low Stock", "Out of Stock"]).order("name"),
    supabase.from("clients").select("payment_status"),
    supabase.from("packages").select("name, price, amount_paid, balance, payment_status").order("created_at", { ascending: false }).limit(200),
    supabase.from("inventory_logs").select("quantity, unit, action, created_at, inventory(name), profiles:performed_by(full_name), clients(full_name)").eq("action", "consume").order("created_at", { ascending: false }).limit(50),
    supabase.from("expenses").select("category, amount, expense_date, created_at").limit(5000),
    supabase.from("activity_logs").select("actor_name, action, entity, created_at").order("created_at", { ascending: false }).limit(50)
  ]);

  const expenses = expensesAll.data ?? [];

  // Distinct months present in the data (plus the current month), newest first.
  const monthsSet = new Set<string>([currentMonth]);
  for (const e of expenses) {
    const ym = expenseMonth(e);
    if (ym) monthsSet.add(ym);
  }
  const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  const selectedMonth = searchParams.month && monthsSet.has(searchParams.month)
    ? searchParams.month
    : currentMonth;

  // Expenses for the selected month, grouped by category.
  const monthExpenses = expenses.filter(e => expenseMonth(e) === selectedMonth);
  const monthExpenseTotal = monthExpenses.reduce((a, e: any) => a + Number(e.amount || 0), 0);
  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: monthExpenses
      .filter((e: any) => e.category === cat)
      .reduce((a: number, e: any) => a + Number(e.amount || 0), 0)
  }));

  // Expense totals per month (for the trend table), newest first.
  const monthTotals = new Map<string, number>();
  for (const e of expenses) {
    const ym = expenseMonth(e);
    if (!ym) continue;
    monthTotals.set(ym, (monthTotals.get(ym) ?? 0) + Number(e.amount || 0));
  }
  const monthlyRows = Array.from(monthTotals.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);

  const rec = (receivable.data ?? []).reduce((a, b) => a + Number(b.balance || 0), 0);

  // Paid vs unpaid clients
  const pvu = (paidVsUnpaid.data ?? []).reduce((acc, c: any) => {
    const k = c.payment_status as string;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Performance and operational snapshots" action={
        <div className="flex gap-2">
          <Link href="/reports/deleted-schedules" className="btn-ghost">Deleted Schedules</Link>
          <Link href="/reports/logs" className="btn-ghost">View Full Activity Log</Link>
        </div>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clients"             value={clients.count ?? 0}        icon={Users} />
        <StatCard label="Active Packages"     value={packagesAll.count ?? 0}    icon={Sparkles} />
        <StatCard label="Appointments"        value={appts.count ?? 0}          icon={CalendarDays} />
        <StatCard label="Low / Out of Stock"  value={lowStockItems.data?.length ?? 0}       icon={Package} />
        <StatCard label={`Expenses · ${monthLabel(selectedMonth)}`} value={formatCurrency(monthExpenseTotal)} icon={Receipt} />
        <StatCard label="Amount Receivable"   value={formatCurrency(rec)}       icon={CreditCard} />
        <StatCard label="Activity Events"     value={staffActivity.data?.length ?? 0}       icon={Activity} />
      </div>

      {/* Month filter for expense reporting */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Expense month:</span>
        {months.map(m => (
          <Link
            key={m}
            href={`/reports?month=${m}`}
            className={`btn-ghost !py-1 !text-xs ${m === selectedMonth ? "!bg-beige-100 !font-semibold" : ""}`}
          >
            {monthLabel(m)}
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>
            Expenses by Category · {monthLabel(selectedMonth)}
          </h3>
          {monthExpenseTotal === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No expenses recorded for this month.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {byCategory.filter(r => r.total > 0).map(r => (
                  <tr key={r.cat} className="border-b" style={{ borderColor: "var(--color-border)" }}>
                    <td className="py-2">{r.cat}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold">Total</td>
                  <td className="py-2 text-right font-semibold" style={{ color: "var(--color-primary)" }}>{formatCurrency(monthExpenseTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Monthly Expenses</h3>
          {monthlyRows.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No expenses yet.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {monthlyRows.map(([ym, total]) => (
                <li key={ym} className="flex justify-between py-2 text-sm">
                  <Link href={`/reports?month=${ym}`} className={ym === selectedMonth ? "font-semibold underline" : "underline"}>
                    {monthLabel(ym)}
                  </Link>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Paid vs Unpaid Clients</h3>
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            <li className="flex justify-between py-2 text-sm">
              <span className="badge badge-green">Paid</span>
              <span className="font-medium">{pvu.Paid ?? 0}</span>
            </li>
            <li className="flex justify-between py-2 text-sm">
              <span className="badge badge-amber">Partial</span>
              <span className="font-medium">{pvu.Partial ?? 0}</span>
            </li>
            <li className="flex justify-between py-2 text-sm">
              <span className="badge badge-red">Unpaid</span>
              <span className="font-medium">{pvu.Unpaid ?? 0}</span>
            </li>
          </ul>
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <AlertTriangle size={16} /> Low Stock
          </h3>
          {(lowStockItems.data ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>All items are well-stocked.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {lowStockItems.data!.map((i: any) => (
                <li key={i.id} className="py-2 text-sm flex justify-between">
                  <span>
                    <b>{i.name}</b>{" "}
                    <span className={"ml-2 badge " + (i.stock_status === "Out of Stock" ? "badge-red" : "badge-amber")}>{i.stock_status}</span>
                  </span>
                  <span>
                    {Number(i.remaining_stock)} {i.container_unit ?? "pcs"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card md:col-span-2">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Package Sales</h3>
          {(packageSales.data ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No packages yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-beige-100">
                  <tr>
                    <th className="table-th">Package</th>
                    <th className="table-th">Price</th>
                    <th className="table-th">Paid</th>
                    <th className="table-th">Balance</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {packageSales.data!.map((p: any, i: number) => {
                    const cls = p.payment_status === "Paid" ? "badge-green" : p.payment_status === "Partial" ? "badge-amber" : "badge-red";
                    return (
                      <tr key={i}>
                        <td className="table-td font-medium">{p.name}</td>
                        <td className="table-td">{formatCurrency(p.price)}</td>
                        <td className="table-td">{formatCurrency(p.amount_paid)}</td>
                        <td className="table-td">{formatCurrency(p.balance)}</td>
                        <td className="table-td"><span className={"badge " + cls}>{p.payment_status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Inventory Consumption</h3>
          {(inventoryConsumption.data ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No consumption recorded.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {inventoryConsumption.data!.slice(0, 15).map((l: any, i: number) => (
                <li key={i} className="py-2 text-sm">
                  <div>
                    <b>{l.inventory?.name}</b>: {l.quantity} {l.unit ?? ""}
                    {l.profiles?.full_name && <span style={{ color: "var(--color-muted)" }}> by {l.profiles.full_name}</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {formatDate(l.created_at)}{l.clients?.full_name ? ` · for ${l.clients.full_name}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Staff Activity</h3>
          {(staffActivity.data ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No staff activity yet.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {staffActivity.data!.slice(0, 15).map((l: any, i: number) => (
                <li key={i} className="py-2 text-sm">
                  <div><b>{l.actor_name ?? "System"}</b> {l.action}</div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

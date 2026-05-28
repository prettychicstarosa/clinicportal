import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import {
  Users, CalendarDays, Sparkles, Receipt, CreditCard, Package, TrendingUp, Clock
} from "lucide-react";
import { formatCurrency, formatDateTime, todayISO, startOfMonthISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const settings = await getSettings();
  const today = todayISO();
  const monthStart = startOfMonthISO();

  const [
    totalClients, todayAppts, activePackages,
    monthExpenses, receivable, lowStock,
    monthRevenue, recent
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today),
    supabase.from("packages").select("*", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("expenses").select("amount").gte("created_at", monthStart),
    supabase.from("clients").select("balance"),
    supabase.from("inventory").select("*", { count: "exact", head: true }).in("stock_status", ["Low Stock", "Out of Stock"]),
    supabase.from("payments").select("amount").gte("created_at", monthStart),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10)
  ]);

  const expensesSum = (monthExpenses.data ?? []).reduce((a, b) => a + Number(b.amount || 0), 0);
  const receivableSum = (receivable.data ?? []).reduce((a, b) => a + Number(b.balance || 0), 0);
  const revenueSum = (monthRevenue.data ?? []).reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 md:hidden mb-2">
        <Logo src={settings.logo_url ?? null} name={settings.clinic_name} size={72} />
        <div className="font-serif text-xl" style={{ color: "var(--color-primary)" }}>{settings.clinic_name}</div>
      </div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your clinic's day-to-day activity"
        action={
          <div className="hidden md:flex items-center gap-3">
            <Logo src={settings.logo_url ?? null} name={settings.clinic_name} size={48} />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"        value={totalClients.count ?? 0}            icon={Users} />
        <StatCard label="Today's Appointments" value={todayAppts.count ?? 0}              icon={CalendarDays} />
        <StatCard label="Active Packages"      value={activePackages.count ?? 0}          icon={Sparkles} />
        <StatCard label="Low Stock Items"      value={lowStock.count ?? 0}                icon={Package} />
        <StatCard label="Monthly Expenses"     value={formatCurrency(expensesSum)}        icon={Receipt} />
        <StatCard label="Amount Receivable"    value={formatCurrency(receivableSum)}      icon={CreditCard} />
        <StatCard label="Monthly Revenue"      value={formatCurrency(revenueSum)}         icon={TrendingUp} />
        <StatCard label="Net (Revenue − Exp.)" value={formatCurrency(revenueSum - expensesSum)} icon={TrendingUp} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>Recent Activity</h2>
          <Clock size={16} style={{ color: "var(--color-muted)" }} />
        </div>
        {(recent.data ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No activity yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {recent.data!.map((log: any) => (
              <li key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{log.actor_name ?? "System"}</span>{" "}
                    {log.action}
                    {log.details ? <> — <span style={{ color: "var(--color-muted)" }}>{log.details}</span></> : null}
                  </p>
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                  {formatDateTime(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import {
  Users, CalendarDays, Sparkles, Receipt, CreditCard, Package, TrendingUp, Wallet, Clock,
  CalendarRange, CalendarClock, UserX, CheckCircle2
} from "lucide-react";
import { formatCurrency, formatDateTime, todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const settings = await getSettings();
  const today = todayISO();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  // YYYY-MM for grouping this month's expenses by their date.
  const currentYM = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // Current week range (Monday → Sunday), matching the Appointments page filter.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const diffToMon = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - diffToMon);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const weekStart = fmt(monday);
  const weekEnd = fmt(sunday);

  const [
    totalClients, todayAppts, activePackages,
    monthExpenses, receivable, lowStock,
    monthIncome, recent,
    weekAppts, pendingAppts, noShowAppts, completedToday
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today),
    supabase.from("packages").select("*", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("expenses").select("amount, due_date, created_at").limit(5000),
    supabase.from("clients").select("balance"),
    supabase.from("inventory").select("*", { count: "exact", head: true }).in("stock_status", ["Low Stock", "Out of Stock"]),
    supabase.from("income").select("week1,week2,week3,week4,week5").eq("month", currentMonth).eq("year", currentYear).maybeSingle(),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("appointments").select("*", { count: "exact", head: true }).gte("date", weekStart).lte("date", weekEnd),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "Pending"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "No Show"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "Done").eq("date", today)
  ]);

  // Sum this month's expenses by their date (due_date, falling back to created_at).
  const expensesSum = (monthExpenses.data ?? [])
    .filter((b: any) => ((b.due_date ?? b.created_at ?? "") as string).slice(0, 7) === currentYM)
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const receivableSum = (receivable.data ?? []).reduce((a, b) => a + Number(b.balance || 0), 0);
  const inc = monthIncome.data as any | null;
  const manualIncomeSum = inc
    ? Number(inc.week1 || 0) + Number(inc.week2 || 0) + Number(inc.week3 || 0)
      + Number(inc.week4 || 0) + Number(inc.week5 || 0)
    : 0;
  const netIncome = manualIncomeSum - expensesSum;

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

      <div>
        <h2 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Appointments at a glance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Today's Appointments"   value={todayAppts.count ?? 0}     icon={CalendarDays}   href="/appointments?filter=Today" />
          <StatCard label="This Week Appointments" value={weekAppts.count ?? 0}      icon={CalendarRange}  href={`/appointments?filter=${encodeURIComponent("This Week")}`} />
          <StatCard label="Pending Appointments"   value={pendingAppts.count ?? 0}   icon={CalendarClock}  href="/appointments?status=Pending" />
          <StatCard label="No Show Count"          value={noShowAppts.count ?? 0}    icon={UserX}          href={`/appointments?status=${encodeURIComponent("No Show")}`} />
          <StatCard label="Completed Sessions Today" value={completedToday.count ?? 0} icon={CheckCircle2} href={`/appointments?status=Done&filter=Today`} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"        value={totalClients.count ?? 0}            icon={Users} />
        <StatCard label="Active Packages"      value={activePackages.count ?? 0}          icon={Sparkles} />
        <StatCard label="Low Stock Items"      value={lowStock.count ?? 0}                icon={Package} />
        <StatCard label="Monthly Income"       value={formatCurrency(manualIncomeSum)}    icon={Wallet} />
        <StatCard label="Monthly Expenses"     value={formatCurrency(expensesSum)}        icon={Receipt} />
        <StatCard label="Net Income"           value={formatCurrency(netIncome)}          icon={TrendingUp} />
        <StatCard label="Amount Receivable"    value={formatCurrency(receivableSum)}      icon={CreditCard} />
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

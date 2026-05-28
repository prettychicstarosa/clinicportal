import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { formatCurrency, startOfMonthISO } from "@/lib/utils";
import { Users, Sparkles, CalendarDays, Receipt, CreditCard, TrendingUp, Package, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createSupabaseServerClient();
  const monthStart = startOfMonthISO();

  const [clients, sessions, appts, expensesM, paymentsM, receivable, lowStock, logsCount] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("sessions").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
    supabase.from("expenses").select("amount").gte("created_at", monthStart),
    supabase.from("payments").select("amount").gte("created_at", monthStart),
    supabase.from("clients").select("balance"),
    supabase.from("inventory").select("*", { count: "exact", head: true }).in("stock_status", ["Low Stock","Out of Stock"]),
    supabase.from("activity_logs").select("*", { count: "exact", head: true }).gte("created_at", monthStart)
  ]);
  const exp = (expensesM.data ?? []).reduce((a, b) => a + Number(b.amount || 0), 0);
  const pay = (paymentsM.data ?? []).reduce((a, b) => a + Number(b.amount || 0), 0);
  const rec = (receivable.data ?? []).reduce((a, b) => a + Number(b.balance || 0), 0);

  return (
    <div>
      <PageHeader title="Reports" subtitle="At-a-glance performance for this month" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clients"            value={clients.count ?? 0}        icon={Users} />
        <StatCard label="Sessions (all-time)" value={sessions.count ?? 0}       icon={Sparkles} />
        <StatCard label="Appointments"        value={appts.count ?? 0}          icon={CalendarDays} />
        <StatCard label="Low / Out of Stock"  value={lowStock.count ?? 0}       icon={Package} />
        <StatCard label="Monthly Revenue"     value={formatCurrency(pay)}       icon={TrendingUp} />
        <StatCard label="Monthly Expenses"    value={formatCurrency(exp)}       icon={Receipt} />
        <StatCard label="Receivable Total"    value={formatCurrency(rec)}       icon={CreditCard} />
        <StatCard label="Activity Events"     value={logsCount.count ?? 0}      icon={Activity} />
      </div>
    </div>
  );
}

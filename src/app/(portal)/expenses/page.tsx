import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import DeleteExpenseButton from "./DeleteExpenseButton";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All", ...EXPENSE_CATEGORIES];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// "2026-06" -> "June 2026"
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? m} ${y}`;
}

// Month key (YYYY-MM), preferring expense_date then created_at.
function expMonth(e: any): string {
  const d = (e.expense_date as string | null) ?? (e.created_at as string | null) ?? "";
  return d.slice(0, 7);
}

export default async function ExpensesPage({ searchParams }: { searchParams: { cat?: string; month?: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const cat = searchParams.cat ?? "All";

  const { data: allExpenses } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  const expenses = allExpenses ?? [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Available months (newest first), plus "All" and the current month.
  const monthsSet = new Set<string>([currentMonth]);
  for (const e of expenses) {
    const ym = expMonth(e);
    if (ym) monthsSet.add(ym);
  }
  const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  const month = searchParams.month && (searchParams.month === "All" || monthsSet.has(searchParams.month))
    ? searchParams.month
    : "All";

  // Apply month + category filters for the detailed list.
  const filtered = expenses.filter((e: any) => {
    if (month !== "All" && expMonth(e) !== month) return false;
    if (cat !== "All" && e.category !== cat) return false;
    return true;
  });
  const total = filtered.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);

  // Category summary for the selected month (or all months if month === "All").
  const summaryScope = expenses.filter((e: any) => month === "All" || expMonth(e) === month);
  const byCategory = EXPENSE_CATEGORIES.map(c => ({
    cat: c,
    total: summaryScope
      .filter((e: any) => e.category === c)
      .reduce((a: number, e: any) => a + Number(e.amount || 0), 0)
  }));
  const summaryTotal = byCategory.reduce((a, r) => a + r.total, 0);

  const scopeLabel = month === "All" ? "All months" : monthLabel(month);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${scopeLabel}${cat !== "All" ? ` · ${cat}` : ""} — ${formatCurrency(total)}`}
        action={<Link href="/expenses/new" className="btn-primary"><Plus size={16}/> New Expense</Link>}
      />

      {/* Month filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Month:</span>
        <Link href={`/expenses?month=All${cat !== "All" ? `&cat=${cat}` : ""}`}
          className={`btn-ghost !py-1 !text-xs ${month === "All" ? "!bg-beige-100 !font-semibold" : ""}`}>All</Link>
        {months.map(m => (
          <Link key={m} href={`/expenses?month=${m}${cat !== "All" ? `&cat=${cat}` : ""}`}
            className={`btn-ghost !py-1 !text-xs ${month === m ? "!bg-beige-100 !font-semibold" : ""}`}>
            {monthLabel(m)}
          </Link>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Category:</span>
        {CATEGORIES.map(c => (
          <Link key={c} href={`/expenses?cat=${c}${month !== "All" ? `&month=${month}` : ""}`}
            className={`btn-ghost !py-1 !text-xs ${cat === c ? "!bg-beige-100 !font-semibold" : ""}`}>{c}</Link>
        ))}
      </div>

      {/* Monthly summary by category */}
      <div className="card mb-4">
        <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>
          Summary by Category · {scopeLabel}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {byCategory.map(r => (
            <Link
              key={r.cat}
              href={`/expenses?cat=${r.cat}${month !== "All" ? `&month=${month}` : ""}`}
              className="rounded-xl border bg-white/60 p-3 hover:bg-beige-50 transition"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{r.cat}</div>
              <div className="mt-1 font-medium" style={{ color: "var(--color-primary)" }}>{formatCurrency(r.total)}</div>
            </Link>
          ))}
          <div className="rounded-xl border p-3 bg-beige-100" style={{ borderColor: "var(--color-border)" }}>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Total</div>
            <div className="mt-1 font-semibold" style={{ color: "var(--color-primary)" }}>{formatCurrency(summaryTotal)}</div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Title</th><th className="table-th">Category</th>
                <th className="table-th">Amount</th><th className="table-th">Paid</th>
                <th className="table-th">Date</th><th className="table-th">Status</th>
                <th className="table-th">Notes</th><th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id}>
                  <td className="table-td font-medium">{e.title}</td>
                  <td className="table-td">{e.category}</td>
                  <td className="table-td">{formatCurrency(e.amount)}</td>
                  <td className="table-td">{formatCurrency(e.paid_amount)}</td>
                  <td className="table-td">{formatDate(e.expense_date ?? e.due_date ?? e.created_at)}</td>
                  <td className="table-td"><span className={"badge " + (e.paid_status==="Paid"?"badge-green":e.paid_status==="Partial"?"badge-amber":"badge-red")}>{e.paid_status}</span></td>
                  <td className="table-td max-w-[220px] truncate">{e.notes ?? "—"}</td>
                  <td className="table-td text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/expenses/${e.id}/edit`} className="text-xs underline">Edit</Link>
                      {profile.role === "admin" && <DeleteExpenseButton id={e.id} title={e.title} expense={{ category: e.category, amount: e.amount, expense_date: e.expense_date }} />}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No expenses recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

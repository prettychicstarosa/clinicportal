import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import DeleteExpenseButton from "./DeleteExpenseButton";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All","Rent","Salary","Supplies","Marketing","Utilities","Other"];

export default async function ExpensesPage({ searchParams }: { searchParams: { cat?: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const cat = searchParams.cat ?? "All";
  let q = supabase.from("expenses").select("*").order("created_at", { ascending: false });
  if (cat !== "All") q = q.eq("category", cat);
  const { data: expenses } = await q;
  const total = (expenses ?? []).reduce((a, b: any) => a + Number(b.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`Total: ${formatCurrency(total)}`}
        action={<Link href="/expenses/new" className="btn-primary"><Plus size={16}/> New Expense</Link>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(c => (
          <Link key={c} href={`/expenses?cat=${c}`} className={`btn-ghost !py-1 !text-xs ${cat===c?"!bg-beige-100":""}`}>{c}</Link>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Title</th><th className="table-th">Category</th>
                <th className="table-th">Amount</th><th className="table-th">Paid</th>
                <th className="table-th">Due</th><th className="table-th">Status</th>
                <th className="table-th">Notes</th><th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(expenses ?? []).map((e: any) => (
                <tr key={e.id}>
                  <td className="table-td font-medium">{e.title}</td>
                  <td className="table-td">{e.category}</td>
                  <td className="table-td">{formatCurrency(e.amount)}</td>
                  <td className="table-td">{formatCurrency(e.paid_amount)}</td>
                  <td className="table-td">{formatDate(e.due_date)}</td>
                  <td className="table-td"><span className={"badge " + (e.paid_status==="Paid"?"badge-green":e.paid_status==="Partial"?"badge-amber":"badge-red")}>{e.paid_status}</span></td>
                  <td className="table-td max-w-[220px] truncate">{e.notes ?? "—"}</td>
                  <td className="table-td text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/expenses/${e.id}/edit`} className="text-xs underline">Edit</Link>
                      {profile.role === "admin" && <DeleteExpenseButton id={e.id} title={e.title} />}
                    </div>
                  </td>
                </tr>
              ))}
              {(!expenses || expenses.length===0) && (
                <tr><td colSpan={8} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No expenses recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { getCurrentProfile, isManager } from "@/lib/auth";
import DeleteIncomeButton from "./DeleteIncomeButton";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function rowTotal(r: any): number {
  return Number(r.week1 || 0) + Number(r.week2 || 0) + Number(r.week3 || 0)
    + Number(r.week4 || 0) + Number(r.week5 || 0);
}

export default async function IncomePage({ searchParams }: { searchParams: { year?: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const currentYear = new Date().getFullYear();
  const yearFilter = Number(searchParams.year) || currentYear;

  const { data: rows } = await supabase
    .from("income")
    .select("*")
    .eq("year", yearFilter)
    .order("month", { ascending: true });

  const yearlyTotal = (rows ?? []).reduce((a, r) => a + rowTotal(r), 0);

  const { data: yearsRaw } = await supabase
    .from("income").select("year").order("year", { ascending: false });
  const years = Array.from(new Set((yearsRaw ?? []).map((r: any) => r.year)));
  if (!years.includes(currentYear)) years.unshift(currentYear);

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle={`Yearly Total (${yearFilter}): ${formatCurrency(yearlyTotal)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y}
                href={`/income?year=${y}`}
                className={`btn-ghost !py-1 !text-xs ${y === yearFilter ? "!bg-beige-100" : ""}`}
              >
                {y}
              </Link>
            ))}
            <Link href="/income/new" className="btn-primary"><Plus size={16} /> New Income</Link>
          </div>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Month</th>
                <th className="table-th">Year</th>
                <th className="table-th">Week 1</th>
                <th className="table-th">Week 2</th>
                <th className="table-th">Week 3</th>
                <th className="table-th">Week 4</th>
                <th className="table-th">Week 5</th>
                <th className="table-th">Monthly Total</th>
                <th className="table-th">Notes</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td className="table-td font-medium">{MONTHS[r.month - 1]}</td>
                  <td className="table-td">{r.year}</td>
                  <td className="table-td">{formatCurrency(r.week1)}</td>
                  <td className="table-td">{formatCurrency(r.week2)}</td>
                  <td className="table-td">{formatCurrency(r.week3)}</td>
                  <td className="table-td">{formatCurrency(r.week4)}</td>
                  <td className="table-td">{formatCurrency(r.week5)}</td>
                  <td className="table-td font-medium">{formatCurrency(rowTotal(r))}</td>
                  <td className="table-td max-w-[220px] truncate">{r.notes ?? "—"}</td>
                  <td className="table-td text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/income/${r.id}/edit`} className="text-xs underline">Edit</Link>
                      {isManager(profile.role) && (
                        <DeleteIncomeButton id={r.id} label={`${MONTHS[r.month - 1]} ${r.year}`} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={10} className="table-td text-center" style={{ color: "var(--color-muted)" }}>
                    No income records yet for {yearFilter}.
                  </td>
                </tr>
              )}
            </tbody>
            {(rows && rows.length > 0) && (
              <tfoot className="bg-beige-100">
                <tr>
                  <td colSpan={7} className="table-td text-right font-medium">Yearly Total</td>
                  <td className="table-td font-medium">{formatCurrency(yearlyTotal)}</td>
                  <td className="table-td" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

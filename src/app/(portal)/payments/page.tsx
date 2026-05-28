import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = createSupabaseServerClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("*, clients(full_name), packages(name), profiles:created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const total = (payments ?? []).reduce((a, b: any) => a + Number(b.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`Total recorded: ${formatCurrency(total)}`}
        action={<Link href="/payments/new" className="btn-primary"><Plus size={16}/> Record Payment</Link>}
      />
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Client</th>
                <th className="table-th">Package</th>
                <th className="table-th">Amount</th>
                <th className="table-th">Method</th>
                <th className="table-th">Notes</th>
                <th className="table-th">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="table-td">{formatDateTime(p.created_at)}</td>
                  <td className="table-td">
                    <Link href={`/clients/${p.client_id}`} className="underline">{p.clients?.full_name}</Link>
                  </td>
                  <td className="table-td">{p.packages?.name ?? "—"}</td>
                  <td className="table-td font-medium">{formatCurrency(p.amount)}</td>
                  <td className="table-td">{p.method ?? "—"}</td>
                  <td className="table-td max-w-[280px] truncate">{p.notes ?? "—"}</td>
                  <td className="table-td">{p.profiles?.full_name ?? "—"}</td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr><td colSpan={7} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No payments recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

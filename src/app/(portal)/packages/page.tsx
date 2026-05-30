import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const supabase = createSupabaseServerClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("*, clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Packages"
        subtitle="Each package tracks sessions, payment, and validity for a client"
        action={<Link href="/packages/new" className="btn-primary"><Plus size={16} /> New Package</Link>}
      />
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Client</th>
                <th className="table-th">Package</th>
                <th className="table-th">Sessions</th>
                <th className="table-th">Price</th>
                <th className="table-th">Paid</th>
                <th className="table-th">Balance</th>
                <th className="table-th">Payment</th>
                <th className="table-th">Status</th>
                <th className="table-th">Start</th>
                <th className="table-th">Valid Until</th>
                <th className="table-th">Interval</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(packages ?? []).map((p: any) => {
                const remaining = Math.max(0, (p.total_sessions ?? 0) - (p.used_sessions ?? 0));
                // Payment status with rounding tolerance: balance <= ₱0.99 counts as Paid.
                const price = Number(p.price ?? 0);
                const paid = Number(p.amount_paid ?? 0);
                const rawBalance = Math.max(0, price - paid);
                const isPaid = price > 0 && rawBalance <= 0.99;
                const paymentStatus = isPaid ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
                const displayBalance = isPaid ? 0 : rawBalance;
                const payCls =
                  paymentStatus === "Paid" ? "badge-green" :
                  paymentStatus === "Partial" ? "badge-amber" : "badge-red";
                const statCls =
                  p.status === "Active" ? "badge-blue" :
                  p.status === "Completed" ? "badge-green" :
                  p.status === "Cancelled" ? "badge-red" : "badge-gray";
                return (
                  <tr key={p.id}>
                    <td className="table-td font-medium">
                      <Link href={`/clients/${p.client_id}`} className="underline">{p.clients?.full_name}</Link>
                    </td>
                    <td className="table-td">{p.name}</td>
                    <td className="table-td font-semibold text-red-600">{remaining}/{p.total_sessions}</td>
                    <td className="table-td">{formatCurrency(price)}</td>
                    <td className="table-td">{formatCurrency(paid)}</td>
                    <td className="table-td">{formatCurrency(displayBalance)}</td>
                    <td className="table-td"><span className={"badge " + payCls}>{paymentStatus}</span></td>
                    <td className="table-td"><span className={"badge " + statCls}>{p.status}</span></td>
                    <td className="table-td">{formatDate(p.start_date)}</td>
                    <td className="table-td">{formatDate(p.valid_until)}</td>
                    <td className="table-td">{p.interval_label ?? (p.interval_days ? `${p.interval_days}d` : "—")}</td>
                    <td className="table-td text-right">
                      <Link href={`/packages/${p.id}/edit`} className="text-xs underline">Edit</Link>
                    </td>
                  </tr>
                );
              })}
              {(!packages || packages.length === 0) && (
                <tr><td colSpan={12} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No packages yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

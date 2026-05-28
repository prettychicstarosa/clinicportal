import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createSupabaseServerClient();
  const q = (searchParams.q ?? "").trim();
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (q) query = query.ilike("full_name", `%${q}%`);
  const { data: clients } = await query;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage clients, packages and history"
        action={
          <Link href="/clients/new" className="btn-primary"><Plus size={16}/> Add Client</Link>
        }
      />

      <form action="/clients" className="card mb-4 flex items-center gap-2">
        <Search size={16} style={{ color: "var(--color-muted)" }} />
        <input name="q" defaultValue={q} placeholder="Search by name..." className="input" />
        <button className="btn-ghost">Search</button>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Mobile</th>
                <th className="table-th">Treatment</th>
                <th className="table-th">Sessions</th>
                <th className="table-th">Balance</th>
                <th className="table-th">Status</th>
                <th className="table-th">Registered</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c: any) => (
                <tr key={c.id}>
                  <td className="table-td font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">{c.full_name}</Link>
                  </td>
                  <td className="table-td">{c.mobile ?? "—"}</td>
                  <td className="table-td">{c.treatment_interested ?? "—"}</td>
                  <td className="table-td">{c.remaining_sessions}/{c.total_sessions}</td>
                  <td className="table-td">{formatCurrency(c.balance)}</td>
                  <td className="table-td">
                    <span className={
                      "badge " +
                      (c.payment_status === "Paid"   ? "badge-green" :
                       c.payment_status === "Partial"? "badge-amber" : "badge-red")
                    }>{c.payment_status}</span>
                  </td>
                  <td className="table-td">{formatDate(c.registration_date)}</td>
                  <td className="table-td text-right">
                    <Link href={`/clients/${c.id}`} className="text-sm underline" style={{ color: "var(--color-primary)" }}>View</Link>
                  </td>
                </tr>
              ))}
              {(!clients || clients.length === 0) && (
                <tr><td colSpan={8} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No clients yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

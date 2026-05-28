import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import InventoryRow from "./InventoryRow";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const [{ data: items }, { data: logs }] = await Promise.all([
    supabase.from("inventory").select("*, profiles:updated_by(full_name)").order("name"),
    supabase.from("inventory_logs")
      .select("*, inventory(name), profiles:performed_by(full_name)")
      .order("created_at", { ascending: false }).limit(20)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meds & Kits Inventory"
        subtitle="Track stock, consume items, and review activity"
        action={<Link href="/inventory/new" className="btn-primary"><Plus size={16}/> Add Item</Link>}
      />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Name</th><th className="table-th">Type</th>
                <th className="table-th">Unit</th><th className="table-th">Stock</th>
                <th className="table-th">Alert at</th><th className="table-th">Status</th>
                <th className="table-th">Last Updated</th><th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it: any) => (
                <InventoryRow key={it.id} item={it} isAdmin={profile.role === "admin"} />
              ))}
              {(!items || items.length===0) && (
                <tr><td colSpan={8} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No inventory items yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Recent Inventory Activity</h3>
        {(logs ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No inventory activity yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {logs!.map((l: any) => (
              <li key={l.id} className="py-3 flex justify-between text-sm">
                <span>
                  <b>{l.profiles?.full_name ?? "Someone"}</b>{" "}
                  {l.action === "consume" ? "consumed" : l.action === "add" ? "added" : l.action}{" "}
                  {l.quantity} of {l.inventory?.name ?? "item"}
                </span>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

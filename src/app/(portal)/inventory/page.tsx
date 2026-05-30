import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import InventoryTable from "./InventoryTable";
import { getCurrentProfile, isManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const [{ data: items }, { data: logs }, { data: clients }] = await Promise.all([
    supabase.from("inventory")
      .select("*, profiles:updated_by(full_name)")
      .order("name"),
    supabase.from("inventory_logs")
      .select("*, inventory(name), profiles:performed_by(full_name), clients(full_name)")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("clients").select("id, full_name").order("full_name")
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Medicines and kits — track stock by vial, box, or piece"
        action={<Link href="/inventory/new" className="btn-primary"><Plus size={16}/> Add Item</Link>}
      />

      <InventoryTable items={items ?? []} isAdmin={isManager(profile.role)} clients={clients ?? []} />

      <div className="card">
        <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Recent Inventory Activity</h3>
        {(logs ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>No inventory activity yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {logs!.map((l: any) => (
              <li key={l.id} className="py-3 flex justify-between items-start gap-4 text-sm">
                <div>
                  <div>
                    <b>{l.profiles?.full_name ?? "Someone"}</b>{" "}
                    {l.action === "consume" ? "consumed" : l.action === "add" ? "added" : l.action}{" "}
                    {l.quantity} {l.unit ?? ""} of {l.inventory?.name ?? "item"}
                  </div>
                  {l.clients?.full_name && (
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                      for {l.clients.full_name}{l.note ? ` · ${l.note}` : ""}
                    </div>
                  )}
                  {!l.clients?.full_name && l.note && (
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{l.note}</div>
                  )}
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

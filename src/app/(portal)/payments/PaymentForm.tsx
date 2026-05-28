"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type ClientLite = { id: string; full_name: string; balance: number };
type PackageLite = {
  id: string;
  client_id: string;
  name: string;
  price: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
};

export default function PaymentForm({
  clients,
  packages,
  initialClientId
}: {
  clients: ClientLite[];
  packages: PackageLite[];
  initialClientId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: initialClientId ?? "",
    package_id: "",
    amount: "",
    method: "Cash",
    notes: ""
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));

  const clientPackages = packages.filter(p => p.client_id === f.client_id);
  const selectedClient = clients.find(c => c.id === f.client_id);
  const selectedPackage = clientPackages.find(p => p.id === f.package_id);

  // Auto-pick the first unpaid/partial package when client changes.
  useEffect(() => {
    if (!f.client_id) { setF(p => ({ ...p, package_id: "" })); return; }
    const auto = clientPackages.find(p => p.payment_status !== "Paid");
    setF(p => ({ ...p, package_id: auto?.id ?? "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.client_id]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Please select a client."); return; }
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { setErr("Enter a positive amount."); return; }

    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("payments").insert({
        client_id: f.client_id,
        package_id: f.package_id || null,
        amount,
        method: f.method,
        notes: f.notes,
        created_by: user?.id
      }).select("id").single();
      if (error) { setErr(error.message); return; }

      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: "recorded payment",
        entity: "payment",
        entity_id: data!.id,
        details: `${selectedClient?.full_name ?? ""} · ${formatCurrency(amount)}${selectedPackage ? ` · ${selectedPackage.name}` : ""}`
      });
      router.push("/payments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="label">Client *</label>
        <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
          <option value="">Select client...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.full_name} — balance {formatCurrency(c.balance)}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="label">Apply to Package</label>
        <select
          className="input"
          value={f.package_id}
          onChange={e => set("package_id", e.target.value)}
          disabled={!f.client_id}
        >
          <option value="">— No specific package —</option>
          {clientPackages.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} · balance {formatCurrency(p.balance)} ({p.payment_status})
            </option>
          ))}
        </select>
        {selectedPackage && (
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Outstanding on this package: <b>{formatCurrency(selectedPackage.balance)}</b>
          </p>
        )}
      </div>

      <div>
        <label className="label">Amount</label>
        <input type="number" step="0.01" min="0" className="input" value={f.amount}
               placeholder="e.g. 1500" onChange={e => set("amount", e.target.value)} />
      </div>
      <div>
        <label className="label">Method</label>
        <select className="input" value={f.method} onChange={e => set("method", e.target.value)}>
          <option>Cash</option><option>GCash</option><option>Card</option>
          <option>Bank Transfer</option><option>Other</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} />
      </div>
      <p className="md:col-span-2 text-xs" style={{ color: "var(--color-muted)" }}>
        The package balance, payment status, and client outstanding balance will update automatically.
      </p>
      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Record Payment"}</button>
      </div>
    </form>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import DeleteClientButton from "./DeleteClientButton";
import { getCurrentProfile, isManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientProfile({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.id).single();
  if (!client) notFound();

  const [{ data: appts }, { data: packages }, { data: payments }, { data: logs }] = await Promise.all([
    supabase.from("appointments")
      .select("*, packages(name)")
      .eq("client_id", params.id)
      .order("date", { ascending: false }).limit(50),
    supabase.from("packages")
      .select("*")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("payments")
      .select("*, profiles:created_by(full_name)")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("activity_logs")
      .select("*").eq("entity_id", params.id)
      .order("created_at", { ascending: false }).limit(20)
  ]);

  const statusClass =
    client.payment_status === "Paid" ? "badge-green" :
    client.payment_status === "Partial" ? "badge-amber" : "badge-red";

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.full_name}
        subtitle={`Registered ${formatDate(client.registration_date)}`}
        action={
          <div className="flex gap-2">
            <Link href={`/clients/${client.id}/edit`} className="btn-ghost">Edit</Link>
            {isManager(profile.role) && <DeleteClientButton id={client.id} name={client.full_name} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Outstanding Balance" value={formatCurrency(client.balance)} />
        <Stat label="Payment Status" value={<span className={"badge " + statusClass}>{client.payment_status}</span>} />
        <Stat label="Sessions" value={`${client.remaining_sessions}/${client.total_sessions}`} />
        <Stat label="Valid Until" value={formatDate(client.valid_until)} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card md:col-span-2">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Profile</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Mobile" value={client.mobile} />
            <Info label="Age" value={client.age} />
            <Info label="Birthday" value={formatDate(client.birthday)} />
            <Info label="Emergency Contact" value={client.emergency_contact} />
            <Info label="Consent Signed" value={client.signed_consent ? "Yes" : "No"} />
          </dl>
          {client.allergies && (
            <p className="mt-4 text-sm"><b>Allergies:</b> {client.allergies}</p>
          )}
          {client.notes && (
            <p className="mt-2 text-sm"><b>Notes:</b> {client.notes}</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Quick actions</h3>
          <div className="flex flex-col gap-2">
            <Link href={`/packages/new?client=${client.id}`} className="btn-primary">Add Package</Link>
            <Link href={`/appointments/new?client=${client.id}`} className="btn-ghost">Schedule appointment</Link>
            <Link href={`/payments/new?client=${client.id}`} className="btn-ghost">Record payment</Link>
          </div>
        </div>
      </div>

      <Panel title="Packages">
        {(packages ?? []).length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-beige-100">
                <tr>
                  <th className="table-th">Package</th>
                  <th className="table-th">Sessions</th>
                  <th className="table-th">Price</th>
                  <th className="table-th">Paid</th>
                  <th className="table-th">Balance</th>
                  <th className="table-th">Payment</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Valid Until</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {packages!.map((p: any) => {
                  const remaining = Math.max(0, (p.total_sessions ?? 0) - (p.used_sessions ?? 0));
                  const payCls = p.payment_status === "Paid" ? "badge-green" : p.payment_status === "Partial" ? "badge-amber" : "badge-red";
                  return (
                    <tr key={p.id}>
                      <td className="table-td font-medium">{p.name}</td>
                      <td className="table-td">{remaining}/{p.total_sessions}</td>
                      <td className="table-td">{formatCurrency(p.price)}</td>
                      <td className="table-td">{formatCurrency(p.amount_paid)}</td>
                      <td className="table-td">{formatCurrency(p.balance)}</td>
                      <td className="table-td"><span className={"badge " + payCls}>{p.payment_status}</span></td>
                      <td className="table-td"><span className="badge badge-gray">{p.status}</span></td>
                      <td className="table-td">{formatDate(p.valid_until)}</td>
                      <td className="table-td text-right">
                        <Link href={`/packages/${p.id}/edit`} className="text-xs underline">Edit</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Payment History">
          {(payments ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {payments!.map((p:any) => (
                  <li key={p.id} className="flex justify-between border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                      <div>{formatDateTime(p.created_at)} · {p.method ?? "—"}</div>
                      {p.profiles?.full_name && (
                        <div className="text-xs" style={{ color: "var(--color-muted)" }}>by {p.profiles.full_name}</div>
                      )}
                    </div>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
        <Panel title="Appointments">
          {(appts ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {appts!.map((a:any) => (
                  <li key={a.id} className="flex justify-between border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <span>{formatDate(a.date)} · {a.time?.slice(0,5)} — {a.treatment ?? a.packages?.name ?? "—"}</span>
                    <span className="badge badge-gray">{a.status}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
      </div>

      <Panel title="History">
        {(logs ?? []).length === 0
          ? <Empty />
          : <ul className="space-y-2 text-sm">
              {logs!.map((l:any) => (
                <li key={l.id} className="border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                  <div>{l.actor_name ?? "System"} {l.action}{l.details ? <> — <span style={{ color: "var(--color-muted)" }}>{l.details}</span></> : null}</div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</div>
                </li>
              ))}
            </ul>}
      </Panel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>{title}</h3>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="mt-2 text-xl font-serif" style={{ color: "var(--color-primary)" }}>{value}</div>
    </div>
  );
}
function Empty() { return <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nothing yet.</p>; }

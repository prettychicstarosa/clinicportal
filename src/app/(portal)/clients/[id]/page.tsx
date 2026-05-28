import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import DeleteClientButton from "./DeleteClientButton";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientProfile({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.id).single();
  if (!client) notFound();

  const [{ data: appts }, { data: sessions }, { data: payments }, { data: logs }] = await Promise.all([
    supabase.from("appointments").select("*").eq("client_id", params.id).order("date", { ascending: false }).limit(20),
    supabase.from("sessions").select("*").eq("client_id", params.id).order("session_date", { ascending: false }).limit(20),
    supabase.from("payments").select("*").eq("client_id", params.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("activity_logs").select("*").eq("entity_id", params.id).order("created_at", { ascending: false }).limit(20)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.full_name}
        subtitle={`Registered ${formatDate(client.registration_date)}`}
        action={
          <div className="flex gap-2">
            <Link href={`/clients/${client.id}/edit`} className="btn-ghost">Edit</Link>
            {profile.role === "admin" && <DeleteClientButton id={client.id} name={client.full_name} />}
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card md:col-span-2">
          <h3 className="font-serif text-lg mb-3" style={{ color: "var(--color-primary)" }}>Profile</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Mobile" value={client.mobile} />
            <Info label="Age" value={client.age} />
            <Info label="Birthday" value={formatDate(client.birthday)} />
            <Info label="Treatment" value={client.treatment_interested} />
            <Info label="Package" value={client.package_availed} />
            <Info label="Sessions" value={`${client.remaining_sessions}/${client.total_sessions}`} />
            <Info label="Valid Until" value={formatDate(client.valid_until)} />
            <Info label="Balance" value={formatCurrency(client.balance)} />
            <Info label="Payment Status" value={client.payment_status} />
            <Info label="Signed Consent" value={client.signed_consent ? "Yes" : "No"} />
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
            <Link href={`/appointments/new?client=${client.id}`} className="btn-ghost">Schedule appointment</Link>
            <Link href={`/sessions/new?client=${client.id}`} className="btn-ghost">Record session</Link>
            <Link href={`/payments/new?client=${client.id}`} className="btn-ghost">Record payment</Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Recent Appointments">
          {(appts ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {appts!.map((a:any) => (
                  <li key={a.id} className="flex justify-between border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <span>{formatDate(a.date)} · {a.time?.slice(0,5)} — {a.treatment ?? "—"}</span>
                    <span className="badge badge-gray">{a.status}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
        <Panel title="Recent Sessions">
          {(sessions ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {sessions!.map((s:any) => (
                  <li key={s.id} className="flex justify-between border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <span>{formatDate(s.session_date)} — {formatCurrency(s.amount_paid)}</span>
                    <span className="badge badge-gray">{s.status}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
        <Panel title="Payments">
          {(payments ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {payments!.map((p:any) => (
                  <li key={p.id} className="flex justify-between border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <span>{formatDateTime(p.created_at)} · {p.method ?? "—"}</span>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>}
        </Panel>
        <Panel title="History">
          {(logs ?? []).length === 0
            ? <Empty />
            : <ul className="space-y-2 text-sm">
                {logs!.map((l:any) => (
                  <li key={l.id} className="border-b py-2" style={{ borderColor: "var(--color-border)" }}>
                    <div>{l.actor_name ?? "System"} {l.action}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{formatDateTime(l.created_at)}</div>
                  </li>
                ))}
              </ul>}
        </Panel>
      </div>
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
function Empty() { return <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nothing yet.</p>; }

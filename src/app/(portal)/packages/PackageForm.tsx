"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type ClientLite = { id: string; full_name: string };

const INTERVAL_PRESETS: { label: string; days: number | "custom" }[] = [
  { label: "Weekly", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Custom", days: "custom" }
];

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function PackageForm({
  clients,
  initialClientId
}: {
  clients: ClientLite[];
  initialClientId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const [f, setF] = useState({
    client_id: initialClientId ?? "",
    name: "",
    total_sessions: 6,
    price: 0,
    amount_paid: 0,
    start_date: today,
    first_time: "10:00",
    valid_until: "",
    interval_label: "Weekly",
    interval_days: 7,
    generate_appointments: true,
    notes: ""
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  const balance = Math.max(0, Number(f.price) - Number(f.amount_paid));
  const status = balance === 0 && Number(f.price) > 0 ? "Paid"
    : Number(f.amount_paid) > 0 ? "Partial" : "Unpaid";

  // Preview of generated appointment dates
  const previewDates = useMemo(() => {
    if (!f.generate_appointments || !f.start_date || !f.total_sessions || f.total_sessions < 1) return [];
    const out: string[] = [];
    for (let i = 0; i < Math.min(Number(f.total_sessions), 12); i++) {
      out.push(addDaysISO(f.start_date, i * Number(f.interval_days || 0)));
    }
    return out;
  }, [f.start_date, f.total_sessions, f.interval_days, f.generate_appointments]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.client_id) { setErr("Please select a client."); return; }
    if (!f.name.trim()) { setErr("Package name is required."); return; }
    const sessions = Math.max(1, Math.floor(Number(f.total_sessions) || 0));
    const intervalDays = Math.max(0, Math.floor(Number(f.interval_days) || 0));

    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const pkgPayload: any = {
        client_id: f.client_id,
        name: f.name.trim(),
        total_sessions: sessions,
        used_sessions: 0,
        price: Number(f.price) || 0,
        amount_paid: Number(f.amount_paid) || 0,
        start_date: f.start_date || null,
        valid_until: f.valid_until || null,
        interval_days: intervalDays || null,
        interval_label: f.interval_label,
        status: "Active",
        created_by: user?.id ?? null
      };

      const { data: pkg, error: insertErr } = await supabase
        .from("packages").insert(pkgPayload).select("id").single();
      if (insertErr) { setErr(insertErr.message); return; }
      const pkgId = pkg!.id;

      // Mirror package summary on the client profile (handy for at-a-glance display).
      await supabase.from("clients").update({
        package_availed: f.name.trim(),
        total_sessions: sessions,
        remaining_sessions: sessions,
        valid_until: f.valid_until || null,
        updated_by: user?.id ?? null
      }).eq("id", f.client_id);

      // If there's a price and an initial amount_paid, record a payment row so history is consistent.
      if (Number(f.amount_paid) > 0) {
        await supabase.from("payments").insert({
          client_id: f.client_id,
          package_id: pkgId,
          amount: Number(f.amount_paid),
          method: "Initial Payment",
          notes: `Initial payment for package: ${f.name.trim()}`,
          created_by: user?.id ?? null
        });
      }

      // Auto-generate appointments
      if (f.generate_appointments && f.start_date && sessions >= 1) {
        const rows = [] as any[];
        for (let i = 0; i < sessions; i++) {
          rows.push({
            client_id: f.client_id,
            package_id: pkgId,
            date: addDaysISO(f.start_date, i * intervalDays),
            time: f.first_time || "10:00",
            treatment: `${f.name.trim()} — Session ${i + 1}/${sessions}`,
            status: "Scheduled",
            session_index: i + 1,
            created_by: user?.id ?? null
          });
        }
        const { error: apptErr } = await supabase.from("appointments").insert(rows);
        if (apptErr) {
          // Non-fatal: package is created already; surface but continue.
          setErr(`Package created, but auto-scheduling failed: ${apptErr.message}`);
        }
      }

      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: "created package",
        entity: "package",
        entity_id: pkgId,
        details: `${f.name.trim()} (${sessions} sessions, ${formatCurrency(Number(f.price) || 0)})`
      });

      router.push("/packages");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Client & Package">
        <div className="md:col-span-2">
          <label className="label">Client *</label>
          <select className="input" value={f.client_id} onChange={e => set("client_id", e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Package Name *</label>
          <input className="input" placeholder="e.g. Glow-Up 6-Session Bundle" value={f.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Total Sessions Included</label>
          <input type="number" min="1" className="input" value={f.total_sessions} onChange={e => set("total_sessions", e.target.value)} />
        </div>
        <div>
          <label className="label">Valid Until</label>
          <input type="date" className="input" value={f.valid_until} onChange={e => set("valid_until", e.target.value)} />
        </div>
      </Section>

      <Section title="Payment">
        <div>
          <label className="label">Package Price</label>
          <input type="number" step="0.01" min="0" className="input" value={f.price} onChange={e => set("price", e.target.value)} />
        </div>
        <div>
          <label className="label">Amount Paid Now</label>
          <input type="number" step="0.01" min="0" className="input" value={f.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <Stat label="Balance" value={formatCurrency(balance)} />
          <Stat label="Payment Status" value={status} />
        </div>
      </Section>

      <Section title="Schedule">
        <div>
          <label className="label">First Appointment Date</label>
          <input type="date" className="input" value={f.start_date} onChange={e => set("start_date", e.target.value)} />
        </div>
        <div>
          <label className="label">First Appointment Time</label>
          <input type="time" className="input" value={f.first_time} onChange={e => set("first_time", e.target.value)} />
        </div>
        <div>
          <label className="label">Interval</label>
          <select
            className="input"
            value={f.interval_label}
            onChange={e => {
              const v = e.target.value;
              const preset = INTERVAL_PRESETS.find(p => p.label === v);
              set("interval_label", v);
              if (preset && preset.days !== "custom") set("interval_days", preset.days);
            }}
          >
            {INTERVAL_PRESETS.map(p => <option key={p.label}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Interval (days)</label>
          <input
            type="number" min="0" className="input"
            value={f.interval_days}
            onChange={e => set("interval_days", e.target.value)}
            disabled={f.interval_label !== "Custom"}
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <input
            id="autogen" type="checkbox" className="h-4 w-4"
            checked={f.generate_appointments}
            onChange={e => set("generate_appointments", e.target.checked)}
          />
          <label htmlFor="autogen" className="text-sm">
            Auto-generate {f.total_sessions || 0} appointment{Number(f.total_sessions) === 1 ? "" : "s"} from the first appointment date
          </label>
        </div>
        {f.generate_appointments && previewDates.length > 0 && (
          <div className="md:col-span-2 text-xs rounded-xl border bg-white/50 p-3" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
            Preview:&nbsp;
            {previewDates.map((d, i) => <span key={i}>{i > 0 && " · "}{d}</span>)}
            {Number(f.total_sessions) > 12 && <span> · …</span>}
          </div>
        )}
      </Section>

      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Create Package"}</button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-base mb-3" style={{ color: "var(--color-primary)" }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white/50 p-3" style={{ borderColor: "var(--color-border)" }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="mt-1 font-medium" style={{ color: "var(--color-primary)" }}>{value}</div>
    </div>
  );
}

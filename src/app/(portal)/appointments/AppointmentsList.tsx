"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import AppointmentRow from "./AppointmentRow";

// Fixed display order — Scheduled is always first.
const STATUS_ORDER = ["Scheduled", "Pending", "Done", "No Show", "Cancelled"] as const;

const SECTION_BADGE: Record<string, string> = {
  Scheduled: "badge-blue",
  Pending: "badge-amber",
  Done: "badge-green",
  "No Show": "badge-amber",
  Cancelled: "badge-red"
};

export default function AppointmentsList({ appts, isAdmin }: { appts: any[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");

  // Distinct client names for the datalist (typeahead suggestions).
  const clientNames = useMemo(() => {
    const set = new Set<string>();
    for (const a of appts) {
      const n = a.clients?.full_name;
      if (n) set.add(n);
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [appts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return appts;
    return appts.filter(a => (a.clients?.full_name ?? "").toLowerCase().includes(q));
  }, [appts, query]);

  // Group into ordered status sections.
  const sections = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of filtered) {
      const key = STATUS_ORDER.includes(a.status) ? a.status : "Scheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return STATUS_ORDER
      .map(status => ({ status, items: map.get(status) ?? [] }))
      .filter(s => s.items.length > 0);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="card">
        <label className="label">Search by client name</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-muted)" }} />
          <input
            className="input !pl-9"
            list="appt-client-names"
            placeholder="Type or select a client to see their full history..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <datalist id="appt-client-names">
            {clientNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        {query.trim() && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
            Showing {filtered.length} appointment{filtered.length === 1 ? "" : "s"} for &ldquo;{query.trim()}&rdquo;
          </p>
        )}
      </div>

      {sections.map(({ status, items }) => (
        <div key={status} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>{status}</h3>
            <span className={"badge " + (SECTION_BADGE[status] ?? "badge-gray")}>{items.length}</span>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-beige-100">
                  <tr>
                    <th className="table-th">Client</th>
                    <th className="table-th">Package</th>
                    <th className="table-th">Date</th>
                    <th className="table-th">Time</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Notes</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a: any) => (
                    <AppointmentRow key={a.id} appt={a} isAdmin={isAdmin} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {sections.length === 0 && (
        <div className="card text-center text-sm" style={{ color: "var(--color-muted)" }}>
          {query.trim() ? "No appointments match that client." : "No appointments yet."}
        </div>
      )}
    </div>
  );
}

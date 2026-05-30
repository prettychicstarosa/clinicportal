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

const DATE_FILTERS = ["Today", "This Week", "This Month", "All"] as const;
type DateFilter = (typeof DATE_FILTERS)[number];

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString()).
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inRange(dateStr: string, filter: DateFilter): boolean {
  if (filter === "All" || !dateStr) return true;
  const now = new Date();
  const today = localISO(now);

  if (filter === "Today") return dateStr === today;

  if (filter === "This Week") {
    // Week runs Monday → Sunday.
    const day = now.getDay(); // 0 = Sun
    const diffToMon = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return dateStr >= localISO(monday) && dateStr <= localISO(sunday);
  }

  if (filter === "This Month") {
    return dateStr.slice(0, 7) === today.slice(0, 7);
  }
  return true;
}

export default function AppointmentsList({
  appts,
  isAdmin,
  initialStatus = "",
  initialFilter = "All"
}: {
  appts: any[];
  isAdmin: boolean;
  initialStatus?: string;
  initialFilter?: string;
}) {
  const [query, setQuery] = useState("");
  const validFilter = (DATE_FILTERS as readonly string[]).includes(initialFilter)
    ? (initialFilter as DateFilter)
    : "All";
  const validStatus = (STATUS_ORDER as readonly string[]).includes(initialStatus) ? initialStatus : "";
  const [dateFilter, setDateFilter] = useState<DateFilter>(validFilter);
  const [statusFilter, setStatusFilter] = useState<string>(validStatus);

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
    return appts.filter(a => {
      if (!inRange(a.date, dateFilter)) return false;
      if (!q) return true;
      const name = (a.clients?.full_name ?? "").toLowerCase();
      const mobile = (a.clients?.mobile ?? "").toLowerCase();
      return name.includes(q) || mobile.includes(q);
    });
  }, [appts, query, dateFilter]);

  // Group into ordered status sections (all sections always shown with counts).
  const sections = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of filtered) {
      const key = (STATUS_ORDER as readonly string[]).includes(a.status) ? a.status : "Scheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return STATUS_ORDER
      .filter(status => !statusFilter || status === statusFilter)
      .map(status => ({ status, items: map.get(status) ?? [] }));
  }, [filtered, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div>
          <label className="label">Search by client name or mobile number</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-muted)" }} />
            <input
              className="input !pl-9"
              list="appt-client-names"
              placeholder="Type a client name or mobile number to see full history..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <datalist id="appt-client-names">
              {clientNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Filter:</span>
          {DATE_FILTERS.map(df => (
            <button
              key={df}
              type="button"
              onClick={() => setDateFilter(df)}
              className={`btn-ghost !py-1 !px-3 !text-xs ${dateFilter === df ? "!bg-beige-100 !font-semibold" : ""}`}
            >
              {df}
            </button>
          ))}
          <span className="ml-auto text-xs" style={{ color: "var(--color-muted)" }}>
            {filtered.length} appointment{filtered.length === 1 ? "" : "s"}
            {query.trim() && <> for &ldquo;{query.trim()}&rdquo;</>}
          </span>
        </div>

        {statusFilter && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: "var(--color-muted)" }}>Showing only:</span>
            <span className={"badge " + (SECTION_BADGE[statusFilter] ?? "badge-gray")}>{statusFilter}</span>
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className="underline"
              style={{ color: "var(--color-primary)" }}
            >
              Show all statuses
            </button>
          </div>
        )}
      </div>

      {sections.map(({ status, items }) => (
        <div key={status} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg" style={{ color: "var(--color-primary)" }}>{status}</h3>
            <span className={"badge " + (SECTION_BADGE[status] ?? "badge-gray")}>{items.length}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-sm pl-1" style={{ color: "var(--color-muted)" }}>No appointments.</p>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-beige-100">
                    <tr>
                      <th className="table-th">Client</th>
                      <th className="table-th">Package</th>
                      <th className="table-th">Date</th>
                      <th className="table-th">Time</th>
                      <th className="table-th">Staff</th>
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
          )}
        </div>
      ))}
    </div>
  );
}

"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Check, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Parse a YYYY-MM-DD (or ISO) date string into [y, m, d] without timezone shifts.
function ymd(dateStr?: string | null): [number, number, number] | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return [y, m, d];
}

function ageFromBirthday(birthday?: string | null): string {
  const parts = ymd(birthday);
  if (!parts) return "-";
  const [y, m, d] = parts;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mo = now.getMonth() + 1;
  const day = now.getDate();
  if (mo < m || (mo === m && day < d)) age--;
  return age >= 0 && age < 150 ? String(age) : "-";
}

function formatBirthday(birthday?: string | null): string {
  const parts = ymd(birthday);
  if (!parts) return "-";
  const [y, m, d] = parts;
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

const FILTERS = [
  { key: "all", label: "All Clients" },
  { key: "signed", label: "Signed Consent" },
  { key: "missing", label: "Missing Consent" }
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default function ClientsTable({ clients }: { clients: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(c => {
      if (filter === "signed" && !c.signed_consent) return false;
      if (filter === "missing" && c.signed_consent) return false;
      if (!q) return true;
      const name = (c.full_name ?? "").toLowerCase();
      const mobile = (c.mobile ?? "").toLowerCase();
      return name.includes(q) || mobile.includes(q);
    });
  }, [clients, query, filter]);

  function toggleConsent(c: any) {
    setBusyId(c.id);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const next = !c.signed_consent;
      const { error } = await supabase
        .from("clients")
        .update({ signed_consent: next, updated_by: user?.id })
        .eq("id", c.id);
      if (error) { alert(error.message); setBusyId(null); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id,
        action: next ? "marked consent signed" : "marked consent not signed",
        entity: "client", entity_id: c.id, details: c.full_name
      });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-muted)" }} />
          <input
            className="input !pl-9"
            placeholder="Search by client name or mobile number..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(ch => (
            <button
              key={ch.key}
              type="button"
              onClick={() => setFilter(ch.key)}
              className={`btn-ghost !py-1 !px-3 !text-xs ${filter === ch.key ? "!bg-beige-100 !font-semibold" : ""}`}
            >
              {ch.label}
            </button>
          ))}
          <span className="ml-auto text-xs" style={{ color: "var(--color-muted)" }}>
            {filtered.length} client{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Mobile</th>
                <th className="table-th">Age</th>
                <th className="table-th">Birthday</th>
                <th className="table-th">Consent Form</th>
                <th className="table-th">Registered</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id}>
                  <td className="table-td font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">{c.full_name}</Link>
                  </td>
                  <td className="table-td">{c.mobile ?? "—"}</td>
                  <td className="table-td">{ageFromBirthday(c.birthday)}</td>
                  <td className="table-td">{formatBirthday(c.birthday)}</td>
                  <td className="table-td">
                    <button
                      type="button"
                      onClick={() => toggleConsent(c)}
                      disabled={pending && busyId === c.id}
                      title="Click to toggle consent"
                      className={"badge " + (c.signed_consent ? "badge-green" : "badge-red") +
                        " cursor-pointer disabled:opacity-50"}
                    >
                      {c.signed_consent
                        ? <><Check size={12} className="inline -mt-0.5" /> Signed</>
                        : <><X size={12} className="inline -mt-0.5" /> Not Signed</>}
                    </button>
                  </td>
                  <td className="table-td">{formatDate(c.registration_date)}</td>
                  <td className="table-td text-right">
                    <Link href={`/clients/${c.id}`} className="text-sm underline" style={{ color: "var(--color-primary)" }}>View</Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-td text-center" style={{ color: "var(--color-muted)" }}>
                  {clients.length === 0 ? "No clients yet." : "No clients match your search."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff";
  is_active: boolean;
};

export default function EmployeeManager({ employees, currentUserId }: { employees: Employee[]; currentUserId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "staff" as "admin"|"staff" });

  async function call(action: string, body: any) {
    setErr(null); setOk(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body })
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? "Something went wrong"); return false; }
    return true;
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const ok = await call("create", f);
      if (ok) {
        setOk(`Account created for ${f.email}`);
        setF({ full_name: "", email: "", password: "", role: "staff" });
        setShowNew(false);
        router.refresh();
      }
    });
  }
  function toggleActive(emp: Employee) {
    start(async () => {
      const ok = await call("toggle_active", { user_id: emp.id, is_active: !emp.is_active });
      if (ok) router.refresh();
    });
  }
  function changeRole(emp: Employee, role: "admin"|"staff") {
    start(async () => {
      const ok = await call("change_role", { user_id: emp.id, role });
      if (ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Close" : "+ New Employee"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
          <div><label className="label">Full Name</label>
            <input required className="input" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">Email</label>
            <input required type="email" className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          <div><label className="label">Password</label>
            <input required type="password" minLength={6} className="input" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value as any })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin / Owner</option>
            </select></div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>{pending ? "Creating..." : "Create account"}</button>
          </div>
        </form>
      )}

      {err && <p className="text-sm text-red-700">{err}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-beige-100">
            <tr>
              <th className="table-th">Name</th><th className="table-th">Email</th>
              <th className="table-th">Role</th><th className="table-th">Status</th><th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td className="table-td font-medium">{emp.full_name || "—"}</td>
                <td className="table-td">{emp.email}</td>
                <td className="table-td">
                  <select className="input !py-1 !text-xs" value={emp.role}
                          onChange={e => changeRole(emp, e.target.value as any)}
                          disabled={pending || emp.id === currentUserId}>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="table-td">
                  <span className={"badge " + (emp.is_active ? "badge-green" : "badge-red")}>{emp.is_active ? "Active" : "Disabled"}</span>
                </td>
                <td className="table-td text-right">
                  {emp.id !== currentUserId && (
                    <button onClick={() => toggleActive(emp)} disabled={pending} className="text-xs underline">
                      {emp.is_active ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={5} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No employees yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

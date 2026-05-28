"use client";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { PERMISSION_TABS, DEFAULT_PERMISSIONS } from "@/lib/permissions-shared";
import type { PermissionKey } from "@/lib/types";

type Role = "owner" | "admin" | "staff";
type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

function displayUsername(email: string) {
  if (!email) return "";
  return email.endsWith("@prettychic.local") ? email.split("@")[0] : email;
}

export default function EmployeeManager({
  employees,
  currentUserId,
  currentUserRole
}: {
  employees: Employee[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [permId, setPermId] = useState<string | null>(null);
  const [perms, setPerms] = useState<Record<PermissionKey, boolean> | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [f, setF] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "staff" as Role,
    is_active: true
  });

  const isOwner = currentUserRole === "owner";

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
      const success = await call("create", f);
      if (success) {
        setOk(`Account created for ${f.username}`);
        setF({ full_name: "", username: "", password: "", role: "staff", is_active: true });
        setShowNew(false);
        router.refresh();
      }
    });
  }
  function toggleActive(emp: Employee) {
    if (emp.role === "owner") return;
    start(async () => {
      const success = await call("toggle_active", { user_id: emp.id, is_active: !emp.is_active });
      if (success) router.refresh();
    });
  }
  function changeRole(emp: Employee, role: Role) {
    if (emp.role === "owner" && role !== "owner") return;
    start(async () => {
      const success = await call("change_role", { user_id: emp.id, role });
      if (success) router.refresh();
    });
  }
  function startEditName(emp: Employee) {
    setEditingId(emp.id);
    setEditName(emp.full_name ?? "");
  }
  function cancelEditName() {
    setEditingId(null);
    setEditName("");
  }
  function saveName(emp: Employee) {
    const next = editName.trim();
    if (!next) return;
    start(async () => {
      const success = await call("update_profile", { user_id: emp.id, full_name: next });
      if (success) {
        setOk(`Profile updated for ${displayUsername(emp.email)}`);
        cancelEditName();
        router.refresh();
      }
    });
  }
  function resetPassword(emp: Employee) {
    const pw = window.prompt(`Set a new password for ${displayUsername(emp.email)}\n(min 6 characters)`);
    if (!pw) return;
    start(async () => {
      const success = await call("reset_password", { user_id: emp.id, password: pw });
      if (success) setOk(`Password updated for ${displayUsername(emp.email)}`);
    });
  }
  function remove(emp: Employee) {
    if (emp.role === "owner") return;
    if (!confirm(`Delete account ${displayUsername(emp.email)}? This cannot be undone.`)) return;
    start(async () => {
      const success = await call("delete", { user_id: emp.id });
      if (success) router.refresh();
    });
  }

  async function openPermissions(emp: Employee) {
    setErr(null); setOk(null);
    if (permId === emp.id) {
      setPermId(null); setPerms(null);
      return;
    }
    setPermId(emp.id);
    setPerms(null);
    setPermLoading(true);
    try {
      const res = await fetch(`/api/staff-permissions?profile_id=${emp.id}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not load permissions");
        setPermLoading(false);
        return;
      }
      const p = data.permissions ?? { ...DEFAULT_PERMISSIONS };
      const next: Record<PermissionKey, boolean> = {} as any;
      for (const t of PERMISSION_TABS) next[t.key] = Boolean(p[t.key]);
      setPerms(next);
    } finally {
      setPermLoading(false);
    }
  }

  function togglePerm(key: PermissionKey) {
    setPerms(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
  }

  function savePerms(emp: Employee) {
    if (!perms) return;
    start(async () => {
      setErr(null); setOk(null);
      const res = await fetch("/api/staff-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: emp.id, permissions: perms })
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Could not save permissions"); return; }
      setOk(`Access updated for ${displayUsername(emp.email)}`);
      setPermId(null); setPerms(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Create staff accounts and manage access. Owner accounts are permanent and cannot be downgraded or disabled.
        </p>
        <button className="btn-primary" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Close" : "+ New Staff Account"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl border bg-white/60" style={{ borderColor: "var(--color-border)" }}>
          <div><label className="label">Full Name</label>
            <input required className="input" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">Username</label>
            <input
              required
              pattern="[A-Za-z0-9._-]+"
              className="input"
              placeholder="e.g. staff1"
              value={f.username}
              onChange={e => setF({ ...f, username: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              Letters, numbers, dots, dashes, and underscores only. No email needed.
            </p>
          </div>
          <div><label className="label">Password</label>
            <input required type="password" minLength={6} className="input" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              {isOwner && <option value="owner">Owner</option>}
            </select></div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              className="h-4 w-4"
              checked={f.is_active}
              onChange={e => setF({ ...f, is_active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm">Active</label>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={pending}>{pending ? "Creating..." : "Create account"}</button>
          </div>
        </form>
      )}

      {err && <p className="text-sm text-red-700">{err}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-beige-100">
              <tr>
                <th className="table-th">Full Name</th>
                <th className="table-th">Username</th>
                <th className="table-th">Role</th>
                <th className="table-th">Status</th>
                <th className="table-th">Created</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const isOwnerRow = emp.role === "owner";
                const isSelf = emp.id === currentUserId;
                const isEditing = editingId === emp.id;
                const permsOpen = permId === emp.id;
                return (
                  <Fragment key={emp.id}>
                  <tr>
                    <td className="table-td font-medium">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            className="input !py-1 !text-sm"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                          />
                          <button onClick={() => saveName(emp)} disabled={pending} className="text-xs underline">Save</button>
                          <button onClick={cancelEditName} disabled={pending} className="text-xs">Cancel</button>
                        </div>
                      ) : (
                        <>
                          {emp.full_name || "—"}
                          {isOwnerRow && <span className="ml-2 badge badge-blue">Owner</span>}
                        </>
                      )}
                    </td>
                    <td className="table-td">{displayUsername(emp.email)}</td>
                    <td className="table-td">
                      <select
                        className="input !py-1 !text-xs"
                        value={emp.role}
                        onChange={e => changeRole(emp, e.target.value as Role)}
                        disabled={pending || isSelf || isOwnerRow}
                      >
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                        {(isOwner || isOwnerRow) && <option value="owner">owner</option>}
                      </select>
                    </td>
                    <td className="table-td">
                      <span className={"badge " + (emp.is_active ? "badge-green" : "badge-red")}>
                        {emp.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="table-td">{formatDate(emp.created_at)}</td>
                    <td className="table-td">
                      <div className="flex gap-3 justify-end flex-wrap">
                        {!isEditing && (
                          <button onClick={() => startEditName(emp)} disabled={pending} className="text-xs underline">
                            Edit
                          </button>
                        )}
                        {!isOwnerRow && (
                          <button onClick={() => openPermissions(emp)} disabled={pending} className="text-xs underline">
                            {permsOpen ? "Close access" : "Access"}
                          </button>
                        )}
                        {!isSelf && (
                          <button onClick={() => resetPassword(emp)} disabled={pending} className="text-xs underline">
                            Reset password
                          </button>
                        )}
                        {!isSelf && !isOwnerRow && (
                          <button onClick={() => toggleActive(emp)} disabled={pending} className="text-xs underline">
                            {emp.is_active ? "Disable" : "Enable"}
                          </button>
                        )}
                        {!isSelf && !isOwnerRow && (
                          <button onClick={() => remove(emp)} disabled={pending} className="text-xs text-red-700 underline">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {permsOpen && (
                    <tr>
                      <td colSpan={6} className="bg-beige-50 px-4 py-4">
                        <div className="rounded-2xl border bg-white/70 p-4" style={{ borderColor: "var(--color-border)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-medium" style={{ color: "var(--color-primary)" }}>
                                Tab access for {emp.full_name || displayUsername(emp.email)}
                              </div>
                              <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                                Owners and admins see all tabs regardless of these toggles.
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-ghost !text-xs"
                                disabled={pending || !perms}
                                onClick={() => {
                                  setPermId(null); setPerms(null);
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn-primary !text-xs"
                                disabled={pending || !perms}
                                onClick={() => savePerms(emp)}
                              >
                                {pending ? "Saving..." : "Save access"}
                              </button>
                            </div>
                          </div>
                          {permLoading || !perms ? (
                            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Loading...</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {PERMISSION_TABS.map(t => (
                                <label
                                  key={t.key}
                                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border bg-white"
                                  style={{ borderColor: "var(--color-border)" }}
                                >
                                  <span className="text-sm">{t.label}</span>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={Boolean(perms[t.key])}
                                    onChange={() => togglePerm(t.key)}
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="table-td text-center" style={{ color: "var(--color-muted)" }}>No staff accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

type Props = { mode: "create" | "edit"; initial?: Partial<Client> };

export default function ClientForm({ mode, initial = {} }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<any>({
    full_name: initial.full_name ?? "",
    mobile: initial.mobile ?? "",
    age: initial.age ?? "",
    birthday: initial.birthday ?? "",
    registration_date: initial.registration_date ?? new Date().toISOString().split("T")[0],
    signed_consent: initial.signed_consent ?? false,
    notes: initial.notes ?? "",
    allergies: initial.allergies ?? "",
    facebook: (initial as any).facebook ?? initial.emergency_contact ?? ""
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      // Base fields, plus the facebook value written to BOTH `facebook` (new
      // canonical column) and `emergency_contact` (legacy backup) so no data is
      // lost regardless of which columns exist on the DB.
      const base: any = {
        full_name: f.full_name,
        mobile: f.mobile,
        age: f.age === "" ? null : Number(f.age),
        birthday: f.birthday || null,
        registration_date: f.registration_date,
        signed_consent: !!f.signed_consent,
        notes: f.notes,
        allergies: f.allergies,
        emergency_contact: f.facebook,
        updated_by: user?.id ?? null
      };
      const payload: any = { ...base, facebook: f.facebook };

      // The `facebook` column may not exist yet (migration 0011 not applied). If
      // a write fails because of it, retry once without `facebook` so the client
      // still saves (the value is preserved in emergency_contact).
      const isMissingFacebook = (e: any) =>
        !!e && (e.code === "PGRST204" || e.code === "42703" ||
          (typeof e.message === "string" && e.message.toLowerCase().includes("facebook")));

      if (mode === "create") {
        base.created_by = user?.id ?? null;
        payload.created_by = user?.id ?? null;
        let res = await supabase.from("clients").insert(payload).select("id").single();
        if (res.error && isMissingFacebook(res.error)) {
          res = await supabase.from("clients").insert(base).select("id").single();
        }
        if (res.error) { setErr(res.error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "added new client " + f.full_name,
          entity: "client", entity_id: res.data!.id
        });
        router.push(`/clients/${res.data!.id}`);
      } else {
        const id = (initial as Client).id;
        let res = await supabase.from("clients").update(payload).eq("id", id);
        if (res.error && isMissingFacebook(res.error)) {
          res = await supabase.from("clients").update(base).eq("id", id);
        }
        if (res.error) { setErr(res.error.message); return; }
        await supabase.from("activity_logs").insert({
          actor_id: user?.id, action: "edited client " + f.full_name,
          entity: "client", entity_id: id
        });
        router.push(`/clients/${id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Personal">
        <div className="md:col-span-2">
          <label className="label">Full Name *</label>
          <input required className="input" value={f.full_name} onChange={e => set("full_name", e.target.value)} />
        </div>
        <div><label className="label">Mobile Number</label>
          <input className="input" placeholder="+63..." value={f.mobile} onChange={e => set("mobile", e.target.value)} /></div>
        <div><label className="label">Age</label>
          <input type="number" min="0" className="input" value={f.age} onChange={e => set("age", e.target.value)} /></div>
        <div><label className="label">Birthday</label>
          <input type="date" className="input" value={f.birthday ?? ""} onChange={e => set("birthday", e.target.value)} /></div>
        <div><label className="label">Registration Date</label>
          <input type="date" className="input" value={f.registration_date} onChange={e => set("registration_date", e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">Facebook Profile</label>
          <input className="input" placeholder="FB: Dez Casino" value={f.facebook} onChange={e => set("facebook", e.target.value)} /></div>
        <p className="md:col-span-2 text-xs" style={{ color: "var(--color-muted)" }}>
          Packages, payments, and sessions are managed from the Packages module — no need to enter them here.
        </p>
      </Section>

      <Section title="Health & Consent">
        <div className="md:col-span-2"><label className="label">Allergies</label>
          <textarea className="input" rows={2} placeholder="Known allergies or sensitivities" value={f.allergies} onChange={e => set("allergies", e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">Notes</label>
          <textarea className="input" rows={3} placeholder="Anything relevant to treatment or follow-ups" value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
        <div className="md:col-span-2 flex items-center gap-2 mt-1">
          <input id="consent" type="checkbox" className="h-4 w-4" checked={!!f.signed_consent} onChange={e => set("signed_consent", e.target.checked)} />
          <label htmlFor="consent" className="text-sm">Consent form signed</label>
        </div>
      </Section>

      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save Client"}</button>
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

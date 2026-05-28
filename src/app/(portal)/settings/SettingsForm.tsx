"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";

export default function SettingsForm({ settings, disabled }: { settings: Settings; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({
    clinic_name: settings.clinic_name,
    theme_color: settings.theme_color,
    sidebar_color: settings.sidebar_color,
    low_stock_default: settings.low_stock_default,
    logo_url: settings.logo_url ?? ""
  });
  const [uploading, setUploading] = useState(false);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  async function uploadLogo(file: File) {
    setUploading(true); setErr(null);
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `logos/clinic-logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: true });
    if (error) { setErr(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("clinic-assets").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(false);
    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        clinic_name: f.clinic_name,
        theme_color: f.theme_color,
        sidebar_color: f.sidebar_color,
        low_stock_default: Number(f.low_stock_default) || 5,
        logo_url: f.logo_url || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null
      };
      let res;
      if (settings.id === "default") {
        res = await supabase.from("settings").insert(payload);
      } else {
        res = await supabase.from("settings").update(payload).eq("id", settings.id);
      }
      if (res.error) { setErr(res.error.message); return; }
      await supabase.from("activity_logs").insert({
        actor_id: user?.id, action: "updated clinic settings", entity: "settings"
      });
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="label">Clinic Name</label>
        <input className="input" value={f.clinic_name} onChange={e => set("clinic_name", e.target.value)} disabled={disabled} /></div>

      <div className="md:col-span-2">
        <label className="label">Clinic Logo</label>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" disabled={disabled || uploading}
                 onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                 className="text-sm" />
          {uploading && <span className="text-xs" style={{ color: "var(--color-muted)" }}>Uploading...</span>}
        </div>
        {f.logo_url && (
          <p className="text-xs mt-2 break-all" style={{ color: "var(--color-muted)" }}>
            {f.logo_url}
          </p>
        )}
      </div>

      <div><label className="label">Theme (Primary) Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={f.theme_color} onChange={e => set("theme_color", e.target.value)} disabled={disabled}
                 className="h-10 w-14 rounded-xl border" style={{ borderColor: "var(--color-border)" }} />
          <input className="input" value={f.theme_color} onChange={e => set("theme_color", e.target.value)} disabled={disabled} />
        </div></div>

      <div><label className="label">Sidebar Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={f.sidebar_color} onChange={e => set("sidebar_color", e.target.value)} disabled={disabled}
                 className="h-10 w-14 rounded-xl border" style={{ borderColor: "var(--color-border)" }} />
          <input className="input" value={f.sidebar_color} onChange={e => set("sidebar_color", e.target.value)} disabled={disabled} />
        </div></div>

      <div><label className="label">Default Low-Stock Alert</label>
        <input type="number" className="input" value={f.low_stock_default} onChange={e => set("low_stock_default", e.target.value)} disabled={disabled} /></div>

      {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}
      {ok && <p className="md:col-span-2 text-sm text-green-700">Settings saved.</p>}
      {!disabled && (
        <div className="md:col-span-2 flex justify-end">
          <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save settings"}</button>
        </div>
      )}
    </form>
  );
}

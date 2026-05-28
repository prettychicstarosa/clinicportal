"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); setLoading(false); return; }
    const redirect = sp.get("redirect") || "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          className="input" placeholder="you@clinic.com"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password" required value={password}
          onChange={e => setPassword(e.target.value)}
          className="input" placeholder="••••••••"
        />
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

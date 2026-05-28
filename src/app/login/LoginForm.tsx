"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const raw = identifier.trim();
      const email = raw.includes("@") ? raw : `${raw.toLowerCase()}@prettychic.local`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = /invalid login credentials/i.test(error.message)
          ? "Incorrect username/email or password."
          : error.message;
        setErr(msg);
        setLoading(false);
        return;
      }
      const redirect = sp.get("redirect") || "/dashboard";
      router.push(redirect);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isFetchFail = /failed to fetch|networkerror|load failed/i.test(msg);
      if (isFetchFail) {
        setErr("Could not reach the server. Please check your internet connection and try again.");
      } else {
        setErr("Sign in failed. Please try again.");
      }
      console.error("Login error", e);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Username or Email</label>
        <input
          type="text" required value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          className="input" placeholder="staff1 or you@clinic.com"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
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

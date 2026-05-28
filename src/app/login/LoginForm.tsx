"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const RESET_REDIRECT_URL =
  "https://clinicportal-git-main-pretty-chic-aesthetics-projects.vercel.app/reset-password";

export default function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

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

  function openForgot() {
    setResetMsg(null);
    setResetErr(null);
    const guess = identifier.trim();
    setResetEmail(guess.includes("@") ? guess : "");
    setForgotOpen(true);
  }

  function closeForgot() {
    if (resetLoading) return;
    setForgotOpen(false);
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetErr(null);
    setResetMsg(null);
    try {
      const email = resetEmail.trim();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        setResetErr("Please enter a valid email address.");
        setResetLoading(false);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: RESET_REDIRECT_URL,
      });
      if (error) {
        setResetErr(error.message || "Could not send reset email. Please try again.");
        setResetLoading(false);
        return;
      }
      setResetMsg(
        "If an account exists for that email, a password reset link has been sent. Please check your inbox."
      );
      setResetLoading(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isFetchFail = /failed to fetch|networkerror|load failed/i.test(msg);
      setResetErr(
        isFetchFail
          ? "Could not reach the server. Please check your internet connection."
          : "Could not send reset email. Please try again."
      );
      console.error("Reset password error", e);
      setResetLoading(false);
    }
  }

  return (
    <>
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
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Password</label>
            <button
              type="button"
              onClick={openForgot}
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--color-accent)" }}
            >
              Forgot password?
            </button>
          </div>
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

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(43, 28, 19, 0.5)" }}
          onClick={closeForgot}
        >
          <div
            className="card w-full max-w-md"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-title"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2
                  id="forgot-title"
                  className="font-serif text-xl"
                  style={{ color: "var(--color-primary)" }}
                >
                  Reset your password
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  Enter your email and we&apos;ll send you a secure reset link.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForgot}
                className="text-xl leading-none px-2 py-0.5 rounded hover:bg-beige-100"
                style={{ color: "var(--color-muted)" }}
                aria-label="Close"
                disabled={resetLoading}
              >
                &times;
              </button>
            </div>

            <form onSubmit={onResetSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="input"
                  placeholder="you@clinic.com"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={resetLoading}
                />
              </div>

              {resetErr && <p className="text-sm text-red-700">{resetErr}</p>}
              {resetMsg && (
                <p className="text-sm" style={{ color: "var(--color-primary)" }}>
                  {resetMsg}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeForgot}
                  className="btn-ghost flex-1"
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={resetLoading}
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

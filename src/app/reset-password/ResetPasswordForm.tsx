"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setLinkInvalid(null);
      }
    });

    (async () => {
      try {
        if (typeof window !== "undefined" && window.location.hash) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          const errorDescription = params.get("error_description");
          if (errorDescription) {
            setLinkInvalid(
              /expired/i.test(errorDescription)
                ? "This reset link has expired. Please request a new one."
                : decodeURIComponent(errorDescription.replace(/\+/g, " "))
            );
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setReady(true);
        } else {
          setTimeout(async () => {
            const again = await supabase.auth.getSession();
            if (again.data.session) {
              setReady(true);
            } else {
              setLinkInvalid(
                "This reset link is invalid or has expired. Please request a new one from the login page."
              );
            }
          }, 1500);
        }
      } catch (e) {
        console.error("Reset session check failed", e);
        setLinkInvalid(
          "Could not verify your reset link. Please request a new one from the login page."
        );
      }
    })();

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 8) {
      setErr("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErr("Password must include at least one letter and one number.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message || "";
        if (/should be at least|weak|password/i.test(msg)) {
          setErr(msg);
        } else if (/session|expired|invalid/i.test(msg)) {
          setErr("Your reset link has expired. Please request a new one.");
        } else {
          setErr(msg || "Could not update password. Please try again.");
        }
        setLoading(false);
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut().catch(() => {});
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Reset password update failed", e);
      setErr(msg || "Could not update password. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-3 text-center py-4">
        <div
          className="mx-auto rounded-full flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "rgba(193, 139, 123, 0.18)",
            color: "var(--color-primary)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2
          className="font-serif text-xl"
          style={{ color: "var(--color-primary)" }}
        >
          Password updated
        </h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Your password has been reset successfully. Redirecting you to sign in...
        </p>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700">{linkInvalid}</p>
        <a href="/login" className="btn-primary w-full">
          Back to Login
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-3">
        <div className="spinner" />
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Verifying your reset link...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">New Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="input"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
        />
        <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
          Use at least 8 characters with letters and numbers.
        </p>
      </div>
      <div>
        <label className="label">Confirm Password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="input"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}

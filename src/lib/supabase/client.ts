"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      `Supabase env vars missing in client bundle (url: ${url ? "set" : "MISSING"}, anon key: ${key ? "set" : "MISSING"}). Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project and redeploy.`
    );
  }
  return createBrowserClient(url, key);
}

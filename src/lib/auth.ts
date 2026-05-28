import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getCurrentProfile(): Promise<Profile> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?reason=disabled");
  return profile as Profile;
}

export async function requireAdmin(): Promise<Profile> {
  const p = await getCurrentProfile();
  if (p.role !== "admin") redirect("/dashboard?error=admin-required");
  return p;
}

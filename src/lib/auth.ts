import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export function isManager(role: Role | string | undefined | null): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: Role | string | undefined | null): boolean {
  return role === "owner";
}

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
  if (!isManager(p.role)) redirect("/dashboard?error=admin-required");
  return p;
}

export async function requireOwner(): Promise<Profile> {
  const p = await getCurrentProfile();
  if (!isOwner(p.role)) redirect("/dashboard?error=owner-required");
  return p;
}

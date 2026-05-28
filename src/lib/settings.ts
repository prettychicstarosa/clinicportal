import { createSupabaseServerClient } from "./supabase/server";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  id: "default",
  clinic_name: "Pretty Chic Aesthetics",
  logo_url: null,
  theme_color: "#503626",
  sidebar_color: "#2B1C13",
  low_stock_default: 5,
  updated_at: new Date().toISOString()
};

export async function getSettings(): Promise<Settings> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
  return (data as Settings | null) ?? DEFAULT_SETTINGS;
}

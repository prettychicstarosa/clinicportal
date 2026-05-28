import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentProfile, isManager } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";
import GuidelinesManager from "./GuidelinesManager";
import GuidelinesViewer from "./GuidelinesViewer";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  const profile = await getCurrentProfile();
  const isMgr = isManager(profile.role);

  if (!isMgr) {
    const allowed = await canAccess("guidelines", profile);
    if (!allowed) redirect("/dashboard?error=guidelines-restricted");
  }

  const supabase = createSupabaseServerClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("guideline_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("guideline_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  ]);

  const cats = (categories ?? []) as GuidelineCategory[];
  const its = (items ?? []) as GuidelineItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guidelines"
        subtitle="Standard procedures, durations, and internal costs by category"
      />
      {isMgr ? (
        <GuidelinesManager categories={cats} items={its} />
      ) : (
        <GuidelinesViewer categories={cats} items={its} />
      )}
    </div>
  );
}

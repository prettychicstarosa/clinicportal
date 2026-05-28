import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentProfile, isManager } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import GuidelinesManager from "./GuidelinesManager";
import GuidelinesViewer from "./GuidelinesViewer";
import type { GuidelineCategory, GuidelineItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuidelinesPage() {
  noStore();

  const profile = await getCurrentProfile();
  const isMgr = isManager(profile.role);

  if (!isMgr) {
    const allowed = await canAccess("guidelines", profile);
    if (!allowed) redirect("/dashboard?error=guidelines-restricted");
  }

  const supabase = createSupabaseServerClient();
  const [catsRes, itemsRes] = await Promise.all([
    supabase
      .from("guideline_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("guideline_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  ]);

  if (catsRes.error) console.error("[guidelines page] load categories failed", catsRes.error);
  if (itemsRes.error) console.error("[guidelines page] load items failed", itemsRes.error);

  const cats = (catsRes.data ?? []) as GuidelineCategory[];
  const its = (itemsRes.data ?? []) as GuidelineItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guidelines"
        subtitle="Standard procedures, durations, and internal costs by category"
      />
      {isMgr ? (
        <GuidelinesManager initialCategories={cats} initialItems={its} />
      ) : (
        <GuidelinesViewer categories={cats} items={its} />
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import PackageForm from "../../PackageForm";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: pkg }, { data: clients }] = await Promise.all([
    supabase.from("packages").select("*").eq("id", params.id).single(),
    supabase.from("clients").select("id, full_name").order("full_name")
  ]);
  if (!pkg) notFound();
  return (
    <div>
      <PageHeader title={`Edit Package`} subtitle={pkg.name} />
      <div className="card max-w-3xl">
        <PackageForm mode="edit" initial={pkg} clients={clients ?? []} />
      </div>
    </div>
  );
}

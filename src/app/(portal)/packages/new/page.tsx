import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import PackageForm from "../PackageForm";

export const dynamic = "force-dynamic";

export default async function NewPackagePage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: clients } = await supabase.from("clients").select("id, full_name").order("full_name");
  return (
    <div>
      <PageHeader title="New Package" subtitle="Set sessions, price, schedule — appointments are generated automatically." />
      <div className="card max-w-3xl">
        <PackageForm clients={clients ?? []} initialClientId={searchParams.client} />
      </div>
    </div>
  );
}

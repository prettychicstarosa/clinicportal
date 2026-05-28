import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import ClientForm from "../../ClientForm";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.id).single();
  if (!client) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${client.full_name}`} />
      <div className="card max-w-3xl">
        <ClientForm mode="edit" initial={client} />
      </div>
    </div>
  );
}

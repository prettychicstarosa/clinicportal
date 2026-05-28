import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import SessionForm from "../SessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: clients } = await supabase.from("clients")
    .select("id, full_name, remaining_sessions, total_sessions, balance, valid_until")
    .order("full_name");
  return (
    <div>
      <PageHeader title="New Session" />
      <div className="card max-w-2xl">
        <SessionForm clients={clients ?? []} initialClientId={searchParams.client} />
      </div>
    </div>
  );
}

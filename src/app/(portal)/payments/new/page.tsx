import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import PaymentForm from "../PaymentForm";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: clients } = await supabase.from("clients").select("id, full_name, balance").order("full_name");
  return (
    <div>
      <PageHeader title="Record Payment" />
      <div className="card max-w-xl">
        <PaymentForm clients={clients ?? []} initialClientId={searchParams.client} />
      </div>
    </div>
  );
}

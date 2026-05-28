import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import PaymentForm from "../PaymentForm";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: clients }, { data: packages }] = await Promise.all([
    supabase.from("clients").select("id, full_name, balance").order("full_name"),
    supabase.from("packages")
      .select("id, client_id, name, price, amount_paid, balance, payment_status")
      .in("status", ["Active"])
      .order("created_at", { ascending: false })
  ]);
  return (
    <div>
      <PageHeader title="Record Payment" />
      <div className="card max-w-xl">
        <PaymentForm
          clients={clients ?? []}
          packages={packages ?? []}
          initialClientId={searchParams.client}
        />
      </div>
    </div>
  );
}

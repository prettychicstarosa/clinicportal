import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import AppointmentForm from "../AppointmentForm";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: clients } = await supabase.from("clients").select("id, full_name").order("full_name");
  return (
    <div>
      <PageHeader title="New Appointment" />
      <div className="card max-w-2xl">
        <AppointmentForm mode="create" clients={clients ?? []} initial={{ client_id: searchParams.client }} />
      </div>
    </div>
  );
}

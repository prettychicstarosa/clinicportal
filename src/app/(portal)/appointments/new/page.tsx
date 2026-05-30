import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import AppointmentForm from "../AppointmentForm";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({ searchParams }: { searchParams: { client?: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: clients }, { data: packages }, { data: staff }] = await Promise.all([
    supabase.from("clients").select("id, full_name").order("full_name"),
    supabase.from("packages")
      .select("id, name, client_id, total_sessions, used_sessions")
      .in("status", ["Active"])
      .order("created_at", { ascending: false }),
    supabase.from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name")
  ]);
  return (
    <div>
      <PageHeader title="New Appointment" />
      <div className="card max-w-2xl">
        <AppointmentForm
          mode="create"
          clients={clients ?? []}
          packages={packages ?? []}
          staff={staff ?? []}
          initial={{ client_id: searchParams.client }}
        />
      </div>
    </div>
  );
}

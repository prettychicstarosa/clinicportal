import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import AppointmentForm from "../../AppointmentForm";

export const dynamic = "force-dynamic";

export default async function EditAppt({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: appt }, { data: clients }, { data: packages }, { data: staff }] = await Promise.all([
    supabase.from("appointments").select("*").eq("id", params.id).single(),
    supabase.from("clients").select("id, full_name").order("full_name"),
    supabase.from("packages").select("id, name, client_id, total_sessions, used_sessions"),
    supabase.from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name")
  ]);
  if (!appt) notFound();
  return (
    <div>
      <PageHeader title="Edit Appointment" />
      <div className="card max-w-2xl">
        <AppointmentForm mode="edit" initial={appt} clients={clients ?? []} packages={packages ?? []} staff={staff ?? []} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import IncomeForm from "../../IncomeForm";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default async function EditIncomePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("income").select("*").eq("id", params.id).single();
  if (!row) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${MONTHS[row.month - 1]} ${row.year}`} />
      <div className="card max-w-2xl"><IncomeForm mode="edit" initial={row} /></div>
    </div>
  );
}

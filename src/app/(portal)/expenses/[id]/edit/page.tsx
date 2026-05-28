import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import ExpenseForm from "../../ExpenseForm";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: exp } = await supabase.from("expenses").select("*").eq("id", params.id).single();
  if (!exp) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${exp.title}`} />
      <div className="card max-w-xl"><ExpenseForm mode="edit" initial={exp} /></div>
    </div>
  );
}

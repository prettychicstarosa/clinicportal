import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import InventoryForm from "../../InventoryForm";

export const dynamic = "force-dynamic";

export default async function EditInventory({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: item } = await supabase.from("inventory").select("*").eq("id", params.id).single();
  if (!item) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${item.name}`} />
      <div className="card max-w-xl"><InventoryForm mode="edit" initial={item} /></div>
    </div>
  );
}

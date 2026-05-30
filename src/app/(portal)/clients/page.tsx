import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Plus } from "lucide-react";
import ClientsTable from "./ClientsTable";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createSupabaseServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage clients, packages and history"
        action={
          <Link href="/clients/new" className="btn-primary"><Plus size={16}/> Add Client</Link>
        }
      />

      <ClientsTable clients={clients ?? []} />
    </div>
  );
}

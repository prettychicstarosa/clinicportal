import { PageHeader } from "@/components/PageHeader";
import InventoryForm from "../InventoryForm";
import { getSettings } from "@/lib/settings";

export default async function NewInventoryPage() {
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Add Inventory Item" />
      <div className="card max-w-xl"><InventoryForm mode="create" defaultAlert={s.low_stock_default} /></div>
    </div>
  );
}

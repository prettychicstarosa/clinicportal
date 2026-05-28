import { PageHeader } from "@/components/PageHeader";
import IncomeForm from "../IncomeForm";

export default function NewIncomePage() {
  return (
    <div>
      <PageHeader title="New Income" subtitle="Record weekly income for a month" />
      <div className="card max-w-2xl"><IncomeForm mode="create" /></div>
    </div>
  );
}

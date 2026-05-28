import { PageHeader } from "@/components/PageHeader";
import ExpenseForm from "../ExpenseForm";

export default function NewExpensePage() {
  return (
    <div>
      <PageHeader title="New Expense" />
      <div className="card max-w-xl"><ExpenseForm mode="create" /></div>
    </div>
  );
}

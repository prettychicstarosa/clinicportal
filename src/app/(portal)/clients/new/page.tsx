import { PageHeader } from "@/components/PageHeader";
import ClientForm from "../ClientForm";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="Add Client" subtitle="Register a new client profile" />
      <div className="card max-w-3xl">
        <ClientForm mode="create" />
      </div>
    </div>
  );
}

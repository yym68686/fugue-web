import { PageHeader } from "@/components/coss/ui";
import { BillingConsole } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function BillingPage() {
  return (
    <ConsoleShell>
      <PageHeader
        title="Billing"
        description="Prepaid balance, managed capacity envelope, image storage, price book, checkout status, and billing events."
      />
      <BillingConsole />
    </ConsoleShell>
  );
}

import { PageHeader } from "@/components/coss/ui";
import { DNSConsole } from "@/components/fugue-coss/dns-console";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function DNSPage() {
  return (
    <ConsoleShell breadcrumbs={[{ href: "/app", label: "Workspace" }, { label: "DNS" }]}>
      <PageHeader
        title="Hosted DNS"
        description="Tenant DNS zones, records, delegation preflight, and Fugue-managed app records."
      />
      <DNSConsole />
    </ConsoleShell>
  );
}

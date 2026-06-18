import { PageHeader } from "@/components/coss/ui";
import { AdminUsersConsole } from "@/components/fugue-coss/interactive";
import { AdminShell } from "@/components/fugue-coss/shells";

export default function AdminUsersPage() {
  return (
    <AdminShell breadcrumbs={[{ href: "/app/apps", label: "Admin" }, { label: "Users" }]}>
      <PageHeader
        title="Admin users"
        description="User directory, account status, admin state, providers, verification, balance, billing limit, service usage, block, unblock, and delete."
      />
      <AdminUsersConsole />
    </AdminShell>
  );
}

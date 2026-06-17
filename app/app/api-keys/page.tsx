import { PageHeader } from "@/components/coss/ui";
import { AccessKeysConsole } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ApiKeysPage() {
  return (
    <ConsoleShell>
      <PageHeader
        title="Access keys"
        description="Workspace API keys and node enrollment keys with scopes, one-time secrets, join commands, rotation, and revoke actions."
      />
      <AccessKeysConsole />
    </ConsoleShell>
  );
}

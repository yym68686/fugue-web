import { redirect } from "next/navigation";

import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { getCurrentSession } from "@/lib/auth/session";
import { getApiKeyPageData } from "@/lib/api-keys/service";
import { getConsoleData } from "@/lib/console/presenters";

export default async function ApiKeysPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const consoleData = await getConsoleData();

  if (consoleData.workspace.stage !== "ready") {
    redirect("/app?dialog=create");
  }

  const data = await getApiKeyPageData(session.email);

  if (!data) {
    redirect("/app");
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app", label: "Back to projects" },
          { href: "/app/settings/workspace", label: "Inspect workspace", variant: "primary" },
        ]}
        description="Create tenant-scoped API keys, copy stored secrets, and locally disable or delete credentials from the product layer."
        eyebrow="API Keys"
        title="Credential surface"
      />

      <ApiKeyManager
        availableScopes={data.availableScopes}
        initialKeys={data.keys}
        initialSyncError={data.syncError}
        workspaceAdminId={data.workspace.adminKeyId}
      />
    </div>
  );
}

import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { getCurrentSession } from "@/lib/auth/session";
import { getApiKeyPageData } from "@/lib/api-keys/service";

export default async function ApiKeysPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const data = await getApiKeyPageData(session.email);

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsoleEmptyState
          action={{ href: "/app?dialog=create", label: "Create project", variant: "primary" }}
          description="Create the first project before managing API keys."
          title="Create the workspace first"
        />
      </div>
    );
  }

  return (
    <div className="fg-console-page">
      <ApiKeyManager
        availableScopes={data.availableScopes}
        initialKeys={data.keys}
        initialSyncError={data.syncError}
      />
    </div>
  );
}

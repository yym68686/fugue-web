import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
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
        <ApiKeyEmptyState />
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

import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { NodeKeyManager } from "@/components/console/node-key-manager";
import { getCurrentSession } from "@/lib/auth/session";
import { getApiKeyPageData } from "@/lib/api-keys/service";
import { getFugueEnv } from "@/lib/fugue/env";
import { getNodeKeyPageData } from "@/lib/node-keys/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

export default async function ApiKeysPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  try {
    await ensureWorkspaceAccess(session);
  } catch {
    // Fall through to stored state or the manual recovery CTA.
  }

  const [data, nodeKeyData] = await Promise.all([
    getApiKeyPageData(session.email),
    getNodeKeyPageData(session.email, {
      ensureCopyableDefault: true,
    }),
  ]);

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

      {nodeKeyData ? (
        <div id="node-keys">
          <NodeKeyManager
            apiBaseUrl={getFugueEnv().apiUrl}
            initialKeys={nodeKeyData.keys}
            initialSyncError={nodeKeyData.syncError}
          />
        </div>
      ) : null}
    </div>
  );
}

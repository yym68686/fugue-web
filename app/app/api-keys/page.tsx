import { ConsoleApiKeysPageShell } from "@/components/console/console-api-keys-page-shell";
import {
  getStoredApiKeyPageDataForWorkspace,
} from "@/lib/api-keys/service";
import { getCurrentSession } from "@/lib/auth/session";
import type { ConsoleApiKeysPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getFugueEnv } from "@/lib/fugue/env";
import { requireWorkspaceForSession } from "@/lib/fugue/product-route";
import {
  getStoredNodeKeyPageDataForWorkspace,
} from "@/lib/node-keys/service";

export default async function ApiKeysPage() {
  let initialSnapshot: ConsoleApiKeysPageSnapshot | null = null;
  const session = await getCurrentSession();

  if (session) {
    const workspaceState = await requireWorkspaceForSession(session);

    if (workspaceState.workspace) {
      const [apiKeys, nodeKeys] = await Promise.all([
        getStoredApiKeyPageDataForWorkspace(session.email, workspaceState.workspace),
        getStoredNodeKeyPageDataForWorkspace(session.email, workspaceState.workspace),
      ]);

      initialSnapshot = {
        apiBaseUrl: getFugueEnv().apiUrl,
        apiKeys,
        nodeKeys,
        state: "ready",
      };
    } else {
      initialSnapshot = {
        state: "workspace-missing",
      };
    }
  }

  return <ConsoleApiKeysPageShell initialSnapshot={initialSnapshot} />;
}

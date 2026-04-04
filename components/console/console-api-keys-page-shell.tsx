"use client";

import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { NodeKeyManager } from "@/components/console/node-key-manager";
import {
  ConsoleApiKeysPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  type ConsoleApiKeysPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function ConsoleApiKeysPageShell() {
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleApiKeysPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the access key snapshot right now."}
              title="Access key snapshot unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  if (data.state === "workspace-missing") {
    return (
      <div className="fg-console-page">
        <ApiKeyEmptyState />
      </div>
    );
  }

  return (
    <div className="fg-console-page">
      <ApiKeyManager
        availableScopes={data.apiKeys.availableScopes}
        initialKeys={data.apiKeys.keys}
        initialSyncError={data.apiKeys.syncError}
        initialWorkspaceAdminKeyId={data.apiKeys.workspace.adminKeyId}
      />

      <div id="node-keys">
        <NodeKeyManager
          apiBaseUrl={data.apiBaseUrl}
          initialKeys={data.nodeKeys.keys}
          initialSyncError={data.nodeKeys.syncError}
        />
      </div>
    </div>
  );
}

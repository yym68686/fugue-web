"use client";

import { useEffect, useRef } from "react";

import { ApiKeyManager } from "@/components/console/api-key-manager";
import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { NodeKeyManager } from "@/components/console/node-key-manager";
import {
  ConsoleApiKeysPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import {
  PlatformEmptyState,
  PlatformErrorState,
} from "@/components/platform/platform-feedback";
import {
  PlatformPage,
  PlatformPageHeader,
  PlatformSection,
} from "@/components/platform/platform-layout";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  type ConsoleApiKeysPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function ConsoleApiKeysPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleApiKeysPageSnapshot | null;
}) {
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
      {
        initialData: initialSnapshot,
      },
    );
  const didRefreshStaleRef = useRef(false);

  useEffect(() => {
    if (
      didRefreshStaleRef.current ||
      !data ||
      data.state !== "ready" ||
      (!data.apiKeys.stale && !data.nodeKeys.stale)
    ) {
      return;
    }

    didRefreshStaleRef.current = true;
    const timer = window.setTimeout(() => {
      void refresh({ force: true }).catch(() => {});
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [data, refresh]);

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleApiKeysPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <PlatformPage className="fg-console-page">
        <PlatformErrorState
          copy={error ?? t("Fugue could not load the access key snapshot right now.")}
          title={t("Access key snapshot unavailable")}
        />
      </PlatformPage>
    );
  }

  if (data.state === "workspace-missing") {
    return (
      <PlatformPage className="fg-console-page">
        <PlatformEmptyState
          copy={t("Bootstrap the workspace to create the first node key.")}
          title={t("No workspace keys yet")}
        />
        <ApiKeyEmptyState />
      </PlatformPage>
    );
  }

  return (
    <PlatformPage className="fg-console-page">
      <PlatformPageHeader
        description={t("Create scoped API keys and node enrollment keys from one access surface.")}
        eyebrow={t("Access")}
        title={t("Access keys")}
      />

      <PlatformSection
        description={t("Workspace API keys control Fugue API access and automation scopes.")}
        title={t("API keys")}
      >
        <ApiKeyManager
          availableScopes={data.apiKeys.availableScopes}
          initialKeys={data.apiKeys.keys}
          initialSyncError={data.apiKeys.syncError}
          initialStale={data.apiKeys.stale}
          initialWorkspaceAdminKeyId={data.apiKeys.workspace.adminKeyId}
        />
      </PlatformSection>

      <PlatformSection
        description={t("Node keys enroll servers into the Fugue runtime plane.")}
        id="node-keys"
        title={t("Node keys")}
      >
        <NodeKeyManager
          apiBaseUrl={data.apiBaseUrl}
          initialKeys={data.nodeKeys.keys}
          initialSyncError={data.nodeKeys.syncError}
        />
      </PlatformSection>
    </PlatformPage>
  );
}

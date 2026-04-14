"use client";

import { useEffectEvent, useState } from "react";

import {
  ClusterNodeGallery,
  type ClusterNodeGalleryItem,
} from "@/components/console/cluster-node-gallery";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PanelCopy, PanelSection } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { OfflineServerView } from "@/lib/cluster-nodes/service";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

type DeleteRuntimeResponse = {
  deleted?: boolean;
};

function readModeLabel(
  value: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "public":
      return t("Public");
    case "platform-shared":
      return t("Platform shared");
    case "private":
      return t("Private");
    case "internal-shared":
      return t("Internal cluster");
    case "dedicated":
      return t("Dedicated");
    default:
      break;
  }

  if (!value) {
    return t("Unknown");
  }

  return t(
    value
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase()),
  );
}

function readInternalClusterAccessLabel(
  value: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return value?.trim().toLowerCase() === "internal-shared"
    ? t("Enabled")
    : t("Dedicated only");
}

function toOfflineGalleryItem(
  server: OfflineServerView,
  t: (key: string, values?: Record<string, string | number>) => string,
): ClusterNodeGalleryItem {
  const facts: ClusterNodeGalleryItem["facts"] = [
    {
      id: "machine",
      label: t("Machine"),
      value: server.machineLabel,
    },
    {
      id: "endpoint",
      label: t("Endpoint"),
      value: server.endpointLabel,
    },
    {
      id: "connection",
      label: t("Connection"),
      value: server.connectionLabel,
    },
    {
      countryCode: server.locationCountryCode,
      id: "location",
      label: t("Location"),
      value: server.locationLabel,
    },
    {
      id: "cluster-node-name",
      label: t("Cluster node"),
      value: server.clusterNodeNameLabel,
    },
    {
      id: "runtime",
      label: t("Runtime"),
      value: server.runtimeLabel,
    },
    {
      id: "runtime-state",
      label: t("Runtime state"),
      value: server.runtimeStatusLabel,
      valueTone: server.runtimeStatusTone,
    },
    {
      id: "last-contact",
      label: t("Last contact"),
      title: server.lastContactExact,
      value: server.lastContactLabel,
    },
    {
      id: "joined",
      label: t("Joined"),
      title: server.createdExact,
      value: server.createdLabel,
    },
  ];

  if (server.accessMode && server.accessMode !== "private") {
    facts.push({
      id: "visibility",
      label: t("Visibility"),
      value: readModeLabel(server.accessMode, t),
    });
  }

  if (
    server.poolMode &&
    server.runtimeType?.trim().toLowerCase() === "managed-owned"
  ) {
    facts.push({
      id: "internal-cluster",
      label: t("Internal cluster"),
      value: readInternalClusterAccessLabel(server.poolMode, t),
    });
  }

  return {
    accessMode: server.accessMode,
    appCount: 0,
    canManageSharing: false,
    conditions: [],
    eyebrow: t("Offline server"),
    facts,
    headerMeta: server.headerMeta,
    id: server.runtimeId,
    name: server.name,
    ownership: "owned",
    poolMode: server.poolMode,
    publicOffer: null,
    resources: [],
    roleLabels: [],
    runtimeId: server.runtimeId,
    runtimeType: server.runtimeType,
    serviceCount: 0,
    showConditionsSection: false,
    showResourcesSection: false,
    showRuntimeAccessPanel: false,
    showWorkloadsSection: false,
    statusDetail: server.statusDetail,
    statusLabel: server.statusLabel,
    statusTone: server.statusTone,
    workloadCount: 0,
    workloadEmptyDescription: t("No workloads are assigned."),
    workloadEmptyTitle: t("No workloads"),
    workloadSectionNote: t("No workloads are attached to this offline server."),
    workloads: [],
  };
}

export function OfflineServerOverview({
  onRefresh,
  servers,
}: {
  onRefresh: (options?: { force?: boolean }) => Promise<unknown>;
  servers: OfflineServerView[];
}) {
  const { t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [deletingRuntimeId, setDeletingRuntimeId] = useState<string | null>(
    null,
  );

  const handleDelete = useEffectEvent(async (server: OfflineServerView) => {
    if (deletingRuntimeId) {
      return;
    }

    const confirmed = await confirm({
      cancelLabel: t("Keep server"),
      confirmLabel: t("Delete server"),
      description: t(
        "Remove {name} from the server inventory only if this VPS is permanently gone. Fugue will refuse the delete if apps, services, or active operations still depend on it.",
        { name: server.name },
      ),
      textConfirmation: {
        hint: t("Type {name} exactly to enable deletion.", {
          name: server.name,
        }),
        label: t("Server name"),
        matchText: server.name,
        mismatchMessage: t("Enter {name} exactly to delete this server.", {
          name: server.name,
        }),
      },
      title: t("Delete {name}?", { name: server.name }),
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setDeletingRuntimeId(server.runtimeId);

    try {
      const response = await requestJson<DeleteRuntimeResponse>(
        `/api/fugue/runtimes/${encodeURIComponent(server.runtimeId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.deleted) {
        throw new Error(t("Delete request was not accepted."));
      }

      showToast({
        message: t("Deleted {name}.", { name: server.name }),
        variant: "success",
      });
      void onRefresh({ force: true }).catch((error) => {
        showToast({
          message: t("Deleted {name}, but refresh failed: {message}", {
            message: readRequestError(error),
            name: server.name,
          }),
          variant: "error",
        });
      });
    } catch (error) {
      showToast({
        message: readRequestError(error),
        variant: "error",
      });
    } finally {
      setDeletingRuntimeId(null);
    }
  });

  return (
    <ClusterNodeGallery
      ariaLabel={t("Offline servers")}
      items={servers.map((server) => toOfflineGalleryItem(server, t))}
      renderDetailFooter={(item) => {
        const server = servers.find(
          (entry) => entry.runtimeId === item.runtimeId,
        );

        if (!server) {
          return null;
        }

        const deleting = deletingRuntimeId === server.runtimeId;

        return (
          <PanelSection>
            <div className="fg-cluster-node-card__section-head fg-offline-server-overview__danger-head">
              <div className="fg-offline-server-overview__danger-copy">
                <p className="fg-label fg-panel__eyebrow">{t("Danger zone")}</p>
                <PanelCopy>
                  {t(
                    "Delete this server record after the VPS is permanently retired. Fugue will block deletion while workloads or active operations still reference it.",
                  )}
                </PanelCopy>
              </div>

              <div className="fg-offline-server-overview__danger-actions">
                <Button
                  disabled={Boolean(deletingRuntimeId) && !deleting}
                  loading={deleting}
                  loadingLabel={t("Deleting...")}
                  onClick={() => {
                    void handleDelete(server);
                  }}
                  size="compact"
                  variant="danger"
                >
                  {t("Delete server")}
                </Button>
              </div>
            </div>
          </PanelSection>
        );
      }}
    />
  );
}

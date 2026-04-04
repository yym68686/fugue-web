"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { TechStackLogo } from "@/components/ui/tech-stack-logo";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { TechStackBadgeKind } from "@/lib/tech-stack";
import { useToast } from "@/components/ui/toast";

type AdminClusterAppView = {
  canRebuild: boolean;
  id: string;
  name: string;
  ownerLabel: string;
  phase: string;
  phaseTone: "positive" | "warning" | "danger" | "info" | "neutral";
  projectLabel: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
  sourceHref: string | null;
  sourceLabel: string;
  stack: Array<{
    id: string;
    kind: string;
    label: string;
    logoKind: TechStackBadgeKind | null;
    meta: string;
    title: string;
  }>;
  updatedExact: string;
  updatedLabel: string;
};

const ADMIN_APP_USAGE_HEADINGS = [
  { id: "cpu", label: "CPU" },
  { id: "memory", label: "Memory" },
  { id: "storage", label: "Disk" },
  { id: "images", label: "Images" },
] as const;

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!data) {
    throw new Error("Empty response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export function AdminAppManager({
  apps,
  onRefresh,
}: {
  apps: AdminClusterAppView[];
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  function refreshPage() {
    if (onRefresh) {
      onRefresh();
      return;
    }

    router.refresh();
  }

  async function handleRebuild(app: AdminClusterAppView) {
    if (busyAction || !app.canRebuild) {
      return;
    }

    setBusyAction(`rebuild:${app.id}`);

    try {
      const result = await requestJson<{
        operation?: {
          id?: string | null;
        } | null;
      }>(`/api/admin/apps/${encodeURIComponent(app.id)}/rebuild`, {
        method: "POST",
      });

      showToast({
        message: result.operation?.id ? "Rebuild queued." : "Rebuild requested.",
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(app: AdminClusterAppView) {
    if (busyAction) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Delete app",
      description: `${app.name} will be queued for deletion from the admin surface.`,
      title: "Delete app?",
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`delete:${app.id}`);

    try {
      const result = await requestJson<{
        alreadyDeleting?: boolean;
      }>(`/api/admin/apps/${encodeURIComponent(app.id)}`, {
        method: "DELETE",
      });

      showToast({
        message: result.alreadyDeleting ? "Delete is already queued." : "Delete queued.",
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!apps.length) {
    return (
      <ConsoleEmptyState
        description="No apps are currently visible from the bootstrap scope."
        title="No apps visible"
      />
    );
  }

  return (
    <div className="fg-console-table-wrap">
      <table className="fg-console-table fg-console-table--admin fg-console-table--apps">
        <colgroup>
          <col className="fg-console-table__col fg-console-table__col--app-name" />
          <col className="fg-console-table__col fg-console-table__col--app-id" />
          <col className="fg-console-table__col fg-console-table__col--tenant" />
          <col className="fg-console-table__col fg-console-table__col--project" />
          <col className="fg-console-table__col fg-console-table__col--route" />
          <col className="fg-console-table__col fg-console-table__col--runtime" />
          <col className="fg-console-table__col fg-console-table__col--usage" />
          <col className="fg-console-table__col fg-console-table__col--phase" />
          <col className="fg-console-table__col fg-console-table__col--source" />
          <col className="fg-console-table__col fg-console-table__col--stack" />
          <col className="fg-console-table__col fg-console-table__col--updated" />
          <col className="fg-console-table__col fg-console-table__col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">App identifier</th>
            <th scope="col">User email</th>
            <th scope="col">Project</th>
            <th scope="col">Route</th>
            <th scope="col">Runtime</th>
            <th className="fg-console-table__head--usage" scope="col">
              <div className="fg-console-table__resource-head">
                <span className="fg-console-table__resource-head-label">Usage</span>
                <div className="fg-console-table__resource-head-grid">
                  {ADMIN_APP_USAGE_HEADINGS.map((resource) => (
                    <span key={resource.id}>{resource.label}</span>
                  ))}
                </div>
              </div>
            </th>
            <th scope="col">Phase</th>
            <th scope="col">Source</th>
            <th scope="col">Stack</th>
            <th scope="col">Updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id}>
              <td>
                <span className="fg-console-table__clip" title={app.name}>
                  {app.name}
                </span>
              </td>
              <td>
                <span className="fg-console-table__mono fg-console-table__clip" title={app.id}>
                  {app.id}
                </span>
              </td>
              <td>
                <span className="fg-console-table__clip" title={app.ownerLabel}>
                  {app.ownerLabel}
                </span>
              </td>
              <td>
                <span className="fg-console-table__clip" title={app.projectLabel}>
                  {app.projectLabel}
                </span>
              </td>
              <td>
                {app.routeHref ? (
                  <a
                    className="fg-text-link fg-console-table__clip"
                    href={app.routeHref}
                    rel="noreferrer"
                    target="_blank"
                    title={app.routeLabel}
                  >
                    {app.routeLabel}
                  </a>
                ) : (
                  <span className="fg-console-table__clip" title={app.routeLabel}>
                    {app.routeLabel}
                  </span>
                )}
              </td>
              <td>
                <span className="fg-console-table__clip" title={app.runtimeLabel}>
                  {app.runtimeLabel}
                </span>
              </td>
              <td className="fg-console-table__cell--usage">
                <div
                  aria-label={`${app.name} resource usage`}
                  className="fg-console-table__resource-grid"
                >
                  {app.resourceUsage.map((resource) => (
                    <CompactResourceMeter item={resource} key={resource.id} showLabel={false} />
                  ))}
                </div>
              </td>
              <td>
                <StatusBadge tone={app.phaseTone}>{app.phase}</StatusBadge>
              </td>
              <td>
                {app.sourceHref ? (
                  <a
                    className="fg-text-link fg-console-table__clip"
                    href={app.sourceHref}
                    rel="noreferrer"
                    target="_blank"
                    title={app.sourceHref}
                  >
                    {app.sourceLabel}
                  </a>
                ) : (
                  <span className="fg-console-table__clip" title={app.sourceLabel}>
                    {app.sourceLabel}
                  </span>
                )}
              </td>
              <td className="fg-console-table__cell--stack">
                {app.stack.length ? (
                  <div className="fg-console-tech-list">
                    {app.stack.map((item) => (
                      <span
                        className="fg-console-tech-pill"
                        data-logo-kind={item.logoKind ?? undefined}
                        key={item.id}
                        title={item.title}
                      >
                        {item.logoKind ? (
                          <span aria-hidden="true" className="fg-console-tech-pill__glyph">
                            <TechStackLogo kind={item.logoKind} />
                          </span>
                        ) : null}
                        <span className="fg-console-tech-pill__label">{item.label}</span>
                        <span className="fg-console-tech-pill__meta">{item.meta}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="fg-console-tech-empty">Not detected</span>
                )}
              </td>
              <td>
                <span title={app.updatedExact}>{app.updatedLabel}</span>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  {app.canRebuild ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `rebuild:${app.id}`,
                      )}
                      busy={busyAction === `rebuild:${app.id}`}
                      busyLabel="Rebuilding…"
                      label="Rebuild"
                      onClick={() => {
                        void handleRebuild(app);
                      }}
                    />
                  ) : null}
                  <InlineButton
                    blocked={Boolean(
                      busyAction && busyAction !== `delete:${app.id}`,
                    )}
                    busy={busyAction === `delete:${app.id}`}
                    busyLabel="Deleting…"
                    danger
                    label="Delete"
                    onClick={() => {
                      void handleDelete(app);
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { InlineButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type AdminClusterAppView = {
  canRebuild: boolean;
  id: string;
  name: string;
  phase: string;
  phaseTone: "positive" | "warning" | "danger" | "info" | "neutral";
  projectLabel: string;
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
  sourceHref: string | null;
  sourceLabel: string;
  stack: Array<{
    id: string;
    kind: string;
    label: string;
    meta: string;
    title: string;
  }>;
  tenantLabel: string;
  updatedExact: string;
  updatedLabel: string;
};

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
}: {
  apps: AdminClusterAppView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);

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
      startTransition(() => {
        router.refresh();
      });
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

    const confirmed = window.confirm(`Delete ${app.name}?`);

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
      startTransition(() => {
        router.refresh();
      });
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
          <col className="fg-console-table__col fg-console-table__col--phase" />
          <col className="fg-console-table__col fg-console-table__col--source" />
          <col className="fg-console-table__col fg-console-table__col--stack" />
          <col className="fg-console-table__col fg-console-table__col--updated" />
          <col className="fg-console-table__col fg-console-table__col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>App identifier</th>
            <th>Tenant</th>
            <th>Project</th>
            <th>Route</th>
            <th>Runtime</th>
            <th>Phase</th>
            <th>Source</th>
            <th>Stack</th>
            <th>Updated</th>
            <th>Actions</th>
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
                <span className="fg-console-table__clip" title={app.tenantLabel}>
                  {app.tenantLabel}
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
                        key={item.id}
                        title={item.title}
                      >
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

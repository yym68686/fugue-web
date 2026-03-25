"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

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
  sourceLabel: string;
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

function AdminActionButton({
  blocked = false,
  busy = false,
  className,
  label,
  onClick,
}: {
  blocked?: boolean;
  busy?: boolean;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-busy={busy || undefined}
      aria-disabled={blocked || undefined}
      className={cx(
        "fg-console-inline-action",
        busy && "is-busy",
        blocked && "is-blocked",
        className,
      )}
      disabled={busy}
      onClick={() => {
        if (busy || blocked) {
          return;
        }

        onClick();
      }}
      tabIndex={blocked ? -1 : undefined}
      type="button"
    >
      <span aria-hidden="true" className="fg-console-inline-action__status" />
      <span className="fg-console-inline-action__label">{label}</span>
    </button>
  );
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
      <table className="fg-console-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Tenant</th>
            <th>Project</th>
            <th>Route</th>
            <th>Runtime</th>
            <th>Phase</th>
            <th>Source</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id}>
              <td>
                <div className="fg-console-table__stack">
                  <strong>{app.name}</strong>
                  <span>{app.id}</span>
                </div>
              </td>
              <td>{app.tenantLabel}</td>
              <td>{app.projectLabel}</td>
              <td>
                {app.routeHref ? (
                  <a className="fg-text-link" href={app.routeHref} rel="noreferrer" target="_blank">
                    {app.routeLabel}
                  </a>
                ) : (
                  app.routeLabel
                )}
              </td>
              <td>{app.runtimeLabel}</td>
              <td>
                <StatusBadge tone={app.phaseTone}>{app.phase}</StatusBadge>
              </td>
              <td>{app.sourceLabel}</td>
              <td>
                <div className="fg-console-table__stack">
                  <strong>{app.updatedLabel}</strong>
                  <span>{app.updatedExact}</span>
                </div>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  {app.canRebuild ? (
                    <AdminActionButton
                      blocked={Boolean(
                        busyAction && busyAction !== `rebuild:${app.id}`,
                      )}
                      busy={busyAction === `rebuild:${app.id}`}
                      label="Rebuild"
                      onClick={() => {
                        void handleRebuild(app);
                      }}
                    />
                  ) : null}
                  <AdminActionButton
                    blocked={Boolean(
                      busyAction && busyAction !== `delete:${app.id}`,
                    )}
                    busy={busyAction === `delete:${app.id}`}
                    className="is-danger"
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

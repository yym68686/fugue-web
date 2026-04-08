"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { TechStackLogo } from "@/components/ui/tech-stack-logo";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { TechStackBadgeKind } from "@/lib/tech-stack";
import { useToast } from "@/components/ui/toast";

type AdminClusterAppView = {
  canRebuild: boolean;
  createdExact: string;
  createdLabel: string;
  id: string;
  name: string;
  ownerLabel: string;
  phase: string;
  phaseTone: "positive" | "warning" | "danger" | "info" | "neutral";
  projectLabel: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  routeHref: string | null;
  routeLabel: string;
  serverLabel: string;
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
};

function readErrorMessage(
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function requestJson<T>(
  input: RequestInfo,
  init: RequestInit | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!data) {
    throw new Error(t("Empty response."));
  }

  if (!response.ok) {
    throw new Error(data.error || t("Request failed."));
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
  const { t } = useI18n();
  const router = useRouter();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const adminAppUsageHeadings = [
    { id: "cpu", label: t("CPU") },
    { id: "memory", label: t("Memory") },
    { id: "storage", label: t("Disk") },
    { id: "images", label: t("Images") },
  ] as const;

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
      }, t);

      showToast({
        message: result.operation?.id ? t("Rebuild queued.") : t("Rebuild requested."),
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
      confirmLabel: t("Delete app"),
      description: t("{name} will be queued for deletion from the admin surface.", {
        name: app.name,
      }),
      title: t("Delete app?"),
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
      }, t);

      showToast({
        message: result.alreadyDeleting
          ? t("Delete is already queued.")
          : t("Delete queued."),
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!apps.length) {
    return (
      <ConsoleEmptyState
        description={t("No apps are currently visible from the bootstrap scope.")}
        title={t("No apps visible")}
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
            <th scope="col">{t("Name")}</th>
            <th scope="col">{t("App identifier")}</th>
            <th scope="col">{t("User email")}</th>
            <th scope="col">{t("Project")}</th>
            <th scope="col">{t("Route")}</th>
            <th scope="col">{t("Server")}</th>
            <th className="fg-console-table__head--usage" scope="col">
              <div className="fg-console-table__resource-head">
                <span className="fg-console-table__resource-head-label">{t("Usage")}</span>
                <div className="fg-console-table__resource-head-grid">
                  {adminAppUsageHeadings.map((resource) => (
                    <span key={resource.id}>{resource.label}</span>
                  ))}
                </div>
              </div>
            </th>
            <th scope="col">{t("Phase")}</th>
            <th scope="col">{t("Source")}</th>
            <th scope="col">{t("Stack")}</th>
            <th scope="col">{t("Created")}</th>
            <th scope="col">{t("Actions")}</th>
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
                  {t(app.ownerLabel)}
                </span>
              </td>
              <td>
                <span className="fg-console-table__clip" title={app.projectLabel}>
                  {t(app.projectLabel)}
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
                    {t(app.routeLabel)}
                  </a>
                ) : (
                  <span className="fg-console-table__clip" title={app.routeLabel}>
                    {t(app.routeLabel)}
                  </span>
                )}
              </td>
              <td>
                <span className="fg-console-table__clip" title={app.serverLabel}>
                  {t(app.serverLabel)}
                </span>
              </td>
              <td className="fg-console-table__cell--usage">
                <div
                  aria-label={t("{name} resource usage", { name: app.name })}
                  className="fg-console-table__resource-grid"
                >
                  {app.resourceUsage.map((resource) => (
                    <CompactResourceMeter item={resource} key={resource.id} showLabel={false} />
                  ))}
                </div>
              </td>
              <td>
                <StatusBadge tone={app.phaseTone}>{t(app.phase)}</StatusBadge>
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
                    {t(app.sourceLabel)}
                  </a>
                ) : (
                  <span className="fg-console-table__clip" title={app.sourceLabel}>
                    {t(app.sourceLabel)}
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
                        <span className="fg-console-tech-pill__meta">{t(item.meta)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="fg-console-tech-empty">{t("Not detected")}</span>
                )}
              </td>
              <td>
                <span title={app.createdExact}>{app.createdLabel}</span>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  {app.canRebuild ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `rebuild:${app.id}`,
                      )}
                      busy={busyAction === `rebuild:${app.id}`}
                      busyLabel={t("Rebuilding…")}
                      label={t("Rebuild")}
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
                    busyLabel={t("Deleting…")}
                    danger
                    label={t("Delete")}
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

"use client";

import { useEffect, useMemo, useState } from "react";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PanelCopy,
  PanelSection,
  PanelTitle,
} from "@/components/ui/panel";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type {
  AdminClusterNodePolicyView,
  AdminClusterNodeView,
} from "@/lib/admin/service";
import type { ConsoleTone } from "@/lib/console/types";

type NodePolicyDraft = {
  allowBuilds: boolean;
  allowSharedPool: boolean;
  buildTier: "large" | "medium" | "small";
  desiredControlPlaneRole: "candidate" | "member" | "none";
};

function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  return fetch(input, init).then(async (response) => {
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
  });
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function readPolicyDraft(node: AdminClusterNodeView): NodePolicyDraft {
  return {
    allowBuilds: node.policy?.allowBuilds ?? false,
    allowSharedPool: node.policy?.allowSharedPool ?? false,
    buildTier: normalizeBuildTier(node.policy?.buildTier),
    desiredControlPlaneRole: normalizeControlPlaneRole(
      node.policy?.desiredControlPlaneRole,
    ),
  };
}

function normalizeBuildTier(
  value?: string | null,
): NodePolicyDraft["buildTier"] {
  switch (value?.trim().toLowerCase()) {
    case "small":
      return "small";
    case "large":
      return "large";
    default:
      return "medium";
  }
}

function normalizeControlPlaneRole(
  value?: string | null,
): NodePolicyDraft["desiredControlPlaneRole"] {
  switch (value?.trim().toLowerCase()) {
    case "candidate":
      return "candidate";
    case "member":
      return "member";
    default:
      return "none";
  }
}

function toCompactResourceItem(
  resource: AdminClusterNodeView["resources"][number],
) {
  return {
    id: resource.id,
    label: resource.label,
    meterValue: resource.percentValue,
    primaryLabel: resource.percentLabel,
    secondaryLabel: resource.usageLabel,
    title: `${resource.label} / ${resource.usageLabel} / ${resource.totalLabel}`,
    tone: resource.statusTone,
  } satisfies ConsoleCompactResourceItemView;
}

function readControlPlaneTone(roleLabel: string): ConsoleTone {
  switch (roleLabel) {
    case "Member":
      return "positive";
    case "Candidate":
      return "info";
    case "Off":
      return "neutral";
    default:
      return "warning";
  }
}

function readLiveFlagTone(enabled: boolean): ConsoleTone {
  return enabled ? "positive" : "neutral";
}

function draftMatchesPolicy(
  draft: NodePolicyDraft,
  policy: AdminClusterNodePolicyView | null,
) {
  if (!policy) {
    return false;
  }

  return (
    draft.allowBuilds === policy.allowBuilds &&
    draft.allowSharedPool === policy.allowSharedPool &&
    draft.buildTier === normalizeBuildTier(policy.buildTier) &&
    draft.desiredControlPlaneRole ===
      normalizeControlPlaneRole(policy.desiredControlPlaneRole)
  );
}

export function AdminClusterNodeManager({
  nodes,
  onNodeUpdated,
}: {
  nodes: AdminClusterNodeView[];
  onNodeUpdated: (node: AdminClusterNodeView) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, NodePolicyDraft>>({});
  const [busyNodeName, setBusyNodeName] = useState<string | null>(null);

  useEffect(() => {
    setDrafts((current) =>
      Object.fromEntries(
        nodes.map((node) => {
          const existing = current[node.name];
          const nextDraft = readPolicyDraft(node);

          if (!existing) {
            return [node.name, nextDraft] as const;
          }

          const shouldRefreshDraft =
            busyNodeName === node.name ||
            draftMatchesPolicy(existing, node.policy);

          return [
            node.name,
            shouldRefreshDraft ? nextDraft : existing,
          ] as const;
        }),
      ),
    );
  }, [busyNodeName, nodes]);

  const buildTierOptions = useMemo(
    () =>
      [
        { label: t("Small"), value: "small" },
        { label: t("Medium"), value: "medium" },
        { label: t("Large"), value: "large" },
      ] satisfies readonly SegmentedControlOption<
        NodePolicyDraft["buildTier"]
      >[],
    [t],
  );

  const controlPlaneRoleOptions = useMemo(
    () =>
      [
        { label: t("Off"), value: "none" },
        { label: t("Candidate"), value: "candidate" },
        { label: t("Member"), value: "member" },
      ] satisfies readonly SegmentedControlOption<
        NodePolicyDraft["desiredControlPlaneRole"]
      >[],
    [t],
  );

  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            description={t(
              "No cluster nodes are visible from the current bootstrap scope.",
            )}
            title={t("No cluster nodes visible")}
          />
        </PanelSection>
      </Panel>
    );
  }

  async function handleApply(node: AdminClusterNodeView) {
    const draft = drafts[node.name];

    if (!draft || busyNodeName || !node.canManagePolicy) {
      return;
    }

    setBusyNodeName(node.name);

    try {
      const result = await requestJson<{
        node: AdminClusterNodeView | null;
        nodeReconciled: boolean;
        reconcileError: string | null;
      }>(`/api/admin/cluster/nodes/${encodeURIComponent(node.name)}/policy`, {
        body: JSON.stringify(draft),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      const nextNode = result.node;

      if (nextNode) {
        setDrafts((current) => ({
          ...current,
          [nextNode.name]: readPolicyDraft(nextNode),
        }));
        onNodeUpdated(nextNode);
      }

      if (result.reconcileError) {
        showToast({
          message: t("Policy saved, but live reconcile reported: {details}", {
            details: result.reconcileError,
          }),
          variant: "info",
        });
      } else {
        showToast({
          message: result.nodeReconciled
            ? t("Node policy updated.")
            : t("Node policy saved."),
          variant: "success",
        });
      }
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyNodeName(null);
    }
  }

  function resetDraft(node: AdminClusterNodeView) {
    setDrafts((current) => ({
      ...current,
      [node.name]: readPolicyDraft(node),
    }));
  }

  return (
    <div className="fg-admin-cluster-manager">
      {nodes.map((node) => {
        const draft = drafts[node.name] ?? readPolicyDraft(node);
        const dirty = node.canManagePolicy
          ? !draftMatchesPolicy(draft, node.policy)
          : false;
        const busy = busyNodeName === node.name;

        return (
          <Panel className="fg-admin-cluster-manager__card" key={node.name}>
            <PanelSection className="fg-admin-cluster-manager__head">
              <div className="fg-admin-cluster-manager__copy">
                <p className="fg-label fg-panel__eyebrow">
                  {t("Cluster node")}
                </p>
                <PanelTitle>{node.name}</PanelTitle>
                <PanelCopy>
                  {node.headerMeta ||
                    node.statusDetail ||
                    t("No summary available.")}
                </PanelCopy>
              </div>

              <div className="fg-admin-cluster-manager__badges">
                <StatusBadge tone={node.statusTone}>
                  {t(node.statusLabel)}
                </StatusBadge>
                {node.machine ? (
                  <StatusBadge tone="neutral">
                    {t(node.machine.scopeLabel)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">{t("Read only")}</StatusBadge>
                )}
                {node.policy ? (
                  <StatusBadge
                    tone={readControlPlaneTone(
                      node.policy.effectiveControlPlaneRoleLabel,
                    )}
                  >
                    {t(node.policy.effectiveControlPlaneRoleLabel)}
                  </StatusBadge>
                ) : null}
              </div>
            </PanelSection>

            <PanelSection className="fg-admin-cluster-manager__grid">
              <div className="fg-admin-cluster-manager__surface">
                <div className="fg-admin-cluster-manager__surface-head">
                  <strong>{t("Node state")}</strong>
                  <span>
                    {t("Live inventory, workloads, and placement facts")}
                  </span>
                </div>

                <dl className="fg-cluster-node-facts fg-admin-cluster-manager__facts">
                  <div>
                    <dt>{t("Location")}</dt>
                    <dd>{t(node.locationLabel)}</dd>
                  </div>
                  <div>
                    <dt>{t("Public address")}</dt>
                    <dd>{node.publicIpLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Internal address")}</dt>
                    <dd>{node.internalIpLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Zone")}</dt>
                    <dd>{node.zoneLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Runtime")}</dt>
                    <dd>{node.runtimeLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Tenant")}</dt>
                    <dd>{node.tenantLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Machine scope")}</dt>
                    <dd>{node.machine?.scopeLabel ?? t("Unmanaged")}</dd>
                  </div>
                  <div>
                    <dt>{t("Connection")}</dt>
                    <dd>
                      {node.machine?.connectionModeLabel ?? t("Unavailable")}
                    </dd>
                  </div>
                </dl>

                <div className="fg-admin-cluster-manager__resource-strip">
                  {node.resources.map((resource) => (
                    <CompactResourceMeter
                      item={toCompactResourceItem(resource)}
                      key={`${node.name}:${resource.id}`}
                      showLabel
                    />
                  ))}
                </div>

                <div className="fg-admin-cluster-manager__state-grid">
                  <div className="fg-admin-cluster-manager__state-block">
                    <strong>{t("Conditions")}</strong>
                    <div className="fg-admin-cluster-manager__pill-row">
                      {node.conditions.map((condition) => (
                        <StatusBadge
                          key={`${node.name}:${condition.id}`}
                          tone={condition.tone}
                        >
                          {t("{label}: {status}", {
                            label: condition.label,
                            status: condition.statusLabel,
                          })}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>

                  <div className="fg-admin-cluster-manager__state-block">
                    <strong>{t("Workloads")}</strong>
                    {node.workloads.length ? (
                      <ul className="fg-admin-cluster-manager__workload-list">
                        {node.workloads.slice(0, 4).map((workload) => (
                          <li key={`${node.name}:${workload.id}`}>
                            <span>{workload.name}</span>
                            <span>{workload.metaLabel}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fg-admin-cluster-manager__empty-copy">
                        {t(
                          "No Fugue app or backing service is currently scheduled here.",
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="fg-admin-cluster-manager__surface">
                <div className="fg-admin-cluster-manager__surface-head">
                  <strong>{t("Node policy")}</strong>
                  <span>
                    {node.canManagePolicy
                      ? t(
                          "Desired capabilities and the live node state after reconciliation",
                        )
                      : t(
                          "This node is visible, but it is not backed by a managed machine or runtime yet.",
                        )}
                  </span>
                </div>

                <div className="fg-admin-cluster-manager__policy-stack">
                  <label className="fg-project-toggle fg-admin-cluster-manager__toggle">
                    <input
                      id={`allow-builds-${node.name}`}
                      checked={draft.allowBuilds}
                      disabled={!node.canManagePolicy || busy}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDrafts((current) => ({
                          ...current,
                          [node.name]: {
                            ...draft,
                            allowBuilds: checked,
                          },
                        }));
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{t("Allow builds")}</strong>
                      <small>
                        {t("Live: {state} / {tier}", {
                          state: node.policy?.effectiveBuilds
                            ? t("On")
                            : t("Off"),
                          tier: t(
                            node.policy?.effectiveBuildTierLabel ??
                              "Unassigned",
                          ),
                        })}
                      </small>
                    </span>
                  </label>

                  <label className="fg-project-toggle fg-admin-cluster-manager__toggle">
                    <input
                      id={`allow-shared-pool-${node.name}`}
                      checked={draft.allowSharedPool}
                      disabled={!node.canManagePolicy || busy}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDrafts((current) => ({
                          ...current,
                          [node.name]: {
                            ...draft,
                            allowSharedPool: checked,
                          },
                        }));
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{t("Allow shared pool apps")}</strong>
                      <small>
                        {t("Live: {state}", {
                          state: node.policy?.effectiveSharedPool
                            ? t("On")
                            : t("Off"),
                        })}
                      </small>
                    </span>
                  </label>

                  <div className="fg-admin-cluster-manager__field">
                    <div className="fg-admin-cluster-manager__field-head">
                      <strong className="fg-admin-cluster-manager__field-label">
                        {t("Build tier")}
                      </strong>
                      <span className="fg-admin-cluster-manager__field-hint">
                        {t(
                          "Build tier is stored as policy even if builds are currently off.",
                        )}
                      </span>
                    </div>
                    <SegmentedControl
                      ariaLabel={t("Build tier")}
                      controlClassName="fg-admin-cluster-manager__segmented-control"
                      onChange={(value) => {
                        setDrafts((current) => ({
                          ...current,
                          [node.name]: {
                            ...draft,
                            buildTier: value,
                          },
                        }));
                      }}
                      options={buildTierOptions}
                      value={draft.buildTier}
                    />
                  </div>

                  <div className="fg-admin-cluster-manager__field">
                    <div className="fg-admin-cluster-manager__field-head">
                      <strong className="fg-admin-cluster-manager__field-label">
                        {t("Control plane role")}
                      </strong>
                      <span className="fg-admin-cluster-manager__field-hint">
                        {t(
                          "Member is a desired target only. The live node becomes member only after real control-plane promotion outside the agent path.",
                        )}
                      </span>
                    </div>
                    <SegmentedControl
                      ariaLabel={t("Control plane role")}
                      controlClassName="fg-admin-cluster-manager__segmented-control"
                      onChange={(value) => {
                        setDrafts((current) => ({
                          ...current,
                          [node.name]: {
                            ...draft,
                            desiredControlPlaneRole: value,
                          },
                        }));
                      }}
                      options={controlPlaneRoleOptions}
                      value={draft.desiredControlPlaneRole}
                    />
                  </div>

                  <div className="fg-admin-cluster-manager__live-grid">
                    <div>
                      <span>{t("Builds")}</span>
                      <StatusBadge
                        tone={readLiveFlagTone(
                          node.policy?.effectiveBuilds ?? false,
                        )}
                      >
                        {t("{state} / {tier}", {
                          state: node.policy?.effectiveBuilds
                            ? t("On")
                            : t("Off"),
                          tier: t(
                            node.policy?.effectiveBuildTierLabel ??
                              "Unassigned",
                          ),
                        })}
                      </StatusBadge>
                    </div>
                    <div>
                      <span>{t("Shared pool")}</span>
                      <StatusBadge
                        tone={readLiveFlagTone(
                          node.policy?.effectiveSharedPool ?? false,
                        )}
                      >
                        {node.policy?.effectiveSharedPool ? t("On") : t("Off")}
                      </StatusBadge>
                    </div>
                    <div>
                      <span>{t("Control plane")}</span>
                      <StatusBadge
                        tone={readControlPlaneTone(
                          node.policy?.effectiveControlPlaneRoleLabel ??
                            "Unknown",
                        )}
                      >
                        {t(
                          node.policy?.effectiveControlPlaneRoleLabel ??
                            "Unknown",
                        )}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="fg-admin-cluster-manager__actions">
                    <Button
                      disabled={!dirty || !node.canManagePolicy}
                      loading={busy}
                      loadingLabel={t("Applying…")}
                      onClick={() => {
                        void handleApply(node);
                      }}
                      size="compact"
                      variant="primary"
                    >
                      {t("Apply policy")}
                    </Button>
                    <Button
                      disabled={!dirty || busy || !node.canManagePolicy}
                      onClick={() => {
                        resetDraft(node);
                      }}
                      size="compact"
                      variant="secondary"
                    >
                      {t("Reset draft")}
                    </Button>
                  </div>
                </div>
              </div>
            </PanelSection>
          </Panel>
        );
      })}
    </div>
  );
}

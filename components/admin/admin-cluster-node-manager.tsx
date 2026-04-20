"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
import type {
  AdminClusterNodePolicyView,
  AdminClusterNodeView,
} from "@/lib/admin/service";
import type { ConsoleTone } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

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

function readMeterWidth(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
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

function AdminClusterResourceMeter({
  resource,
}: {
  resource: AdminClusterNodeView["resources"][number];
}) {
  const { t } = useI18n();
  const label = resource.id === "cpu" ? t("CPU") : t(resource.label);
  const percentLabel =
    resource.percentLabel === "No stats"
      ? t("No stats")
      : resource.percentLabel;
  const usageLabel =
    resource.usageLabel === "No stats" ? t("No stats") : resource.usageLabel;

  return (
    <article
      className="fg-cluster-resource"
      title={t("{label} / {usage} / {total}", {
        label,
        total: resource.totalLabel,
        usage: resource.usageLabel,
      })}
    >
      <div className="fg-cluster-resource__head">
        <div className="fg-cluster-resource__copy">
          <span className="fg-cluster-resource__label">{label}</span>
          <strong>{percentLabel}</strong>
        </div>

        <StatusBadge tone={resource.statusTone}>
          {t(resource.statusLabel)}
        </StatusBadge>
      </div>

      <div
        aria-label={t("{label} usage {percent} ({usage})", {
          label,
          percent: resource.percentLabel,
          usage: resource.usageLabel,
        })}
        className="fg-cluster-resource__meter"
        role="img"
      >
        <span
          className={cx(
            "fg-cluster-resource__fill",
            `fg-cluster-resource__fill--${resource.statusTone}`,
          )}
          style={{ width: `${readMeterWidth(resource.percentValue)}%` }}
        />
      </div>

      <div className="fg-cluster-resource__meta">
        <span>{usageLabel}</span>
        <span>{resource.totalLabel}</span>
      </div>

      <p className="fg-cluster-resource__detail">{resource.detailLabel}</p>
    </article>
  );
}

function AdminClusterOverviewStat({
  label,
  title,
  value,
}: {
  label: string;
  title?: string;
  value: ReactNode;
}) {
  return (
    <div className="fg-admin-cluster-manager__overview-stat" title={title}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AdminClusterPolicyLiveCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="fg-admin-cluster-manager__policy-live-card">
      <span>{label}</span>
      <div className="fg-admin-cluster-manager__policy-live-value">{value}</div>
    </div>
  );
}

function AdminClusterPolicyToggle({
  checked,
  description,
  id,
  label,
  liveBadge,
  onChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  liveBadge: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="fg-admin-cluster-manager__toggle-card" htmlFor={id}>
      <input
        checked={checked}
        id={id}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        type="checkbox"
      />
      <span className="fg-admin-cluster-manager__toggle-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="fg-admin-cluster-manager__toggle-status">
        {liveBadge}
      </span>
    </label>
  );
}

function AdminClusterInlineEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="fg-admin-cluster-manager__inline-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
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
        const visibleWorkloads = node.workloads.slice(0, 4);
        const workloadCountLabel = t(
          node.workloadCount === 1 ? "{count} workload" : "{count} workloads",
          {
            count: node.workloadCount,
          },
        );
        const appCountLabel = t(
          node.appCount === 1 ? "{count} app" : "{count} apps",
          {
            count: node.appCount,
          },
        );
        const serviceCountLabel = t(
          node.serviceCount === 1
            ? "{count} service"
            : "{count} services",
          {
            count: node.serviceCount,
          },
        );
        const liveBuildLabel = t("{state} / {tier}", {
          state: node.policy?.effectiveBuilds ? t("On") : t("Off"),
          tier: t(node.policy?.effectiveBuildTierLabel ?? "Unassigned"),
        });
        const liveSharedPoolLabel = node.policy?.effectiveSharedPool
          ? t("On")
          : t("Off");
        const liveControlPlaneLabel = t(
          node.policy?.effectiveControlPlaneRoleLabel ?? "Unknown",
        );
        const summaryCopy =
          node.statusDetail || node.headerMeta || t("No summary available.");
        const stateFacts = [
          {
            id: "public",
            label: t("Public address"),
            title: node.publicIpLabel,
            value: node.publicIpLabel,
          },
          {
            id: "internal",
            label: t("Internal address"),
            title: node.internalIpLabel,
            value: node.internalIpLabel,
          },
          {
            id: "zone",
            label: t("Zone"),
            title: node.zoneLabel,
            value: node.zoneLabel,
          },
          {
            id: "scope",
            label: t("Machine scope"),
            title: node.machine?.scopeLabel ?? t("Unmanaged"),
            value: node.machine?.scopeLabel
              ? t(node.machine.scopeLabel)
              : t("Unmanaged"),
          },
          {
            id: "connection",
            label: t("Connection"),
            title: node.machine?.connectionModeLabel ?? t("Unavailable"),
            value: node.machine?.connectionModeLabel
              ? t(node.machine.connectionModeLabel)
              : t("Unavailable"),
          },
          {
            id: "status",
            label: t("Status"),
            value: (
              <StatusBadge tone={node.statusTone}>
                {t(node.statusLabel)}
              </StatusBadge>
            ),
          },
          {
            id: "node-key",
            label: t("Node key"),
            title: node.machine?.nodeKeyId ?? node.machine?.nodeKeyLabel,
            value: node.machine?.nodeKeyLabel ?? t("Unavailable"),
          },
        ];

        return (
          <Panel className="fg-admin-cluster-manager__card" key={node.name}>
            <PanelSection className="fg-admin-cluster-manager__overview">
              <div className="fg-admin-cluster-manager__overview-copy">
                <div className="fg-admin-cluster-manager__head">
                  <div className="fg-admin-cluster-manager__headline">
                    <p className="fg-label fg-panel__eyebrow">
                      {t("Cluster node")}
                    </p>
                    <PanelTitle className="fg-admin-cluster-manager__title">
                      {node.name}
                    </PanelTitle>
                    <PanelCopy className="fg-admin-cluster-manager__summary">
                      {summaryCopy}
                    </PanelCopy>
                  </div>

                  <div className="fg-admin-cluster-manager__badges">
                    <StatusBadge tone={node.statusTone}>
                      {t(node.statusLabel)}
                    </StatusBadge>
                    {dirty ? (
                      <StatusBadge tone="info">
                        {t("Unsaved policy")}
                      </StatusBadge>
                    ) : null}
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
                </div>

                <dl className="fg-admin-cluster-manager__summary-meta">
                  <div>
                    <dt>{t("Location")}</dt>
                    <dd>{t(node.locationLabel)}</dd>
                  </div>
                  <div>
                    <dt>{t("Runtime")}</dt>
                    <dd>{node.runtimeLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("Tenant")}</dt>
                    <dd>{node.tenantLabel}</dd>
                  </div>
                </dl>

                {node.roleLabels.length ? (
                  <div className="fg-console-tech-list fg-admin-cluster-manager__roles">
                    {node.roleLabels.map((role) => (
                      <span className="fg-console-tech-pill" key={role}>
                        <span className="fg-console-tech-pill__label">
                          {t(role)}
                        </span>
                        <span className="fg-console-tech-pill__meta">
                          {t("Role")}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <dl className="fg-admin-cluster-manager__overview-stats">
                <AdminClusterOverviewStat
                  label={t("Workloads")}
                  value={node.workloadCount}
                />
                <AdminClusterOverviewStat
                  label={t("Apps")}
                  value={node.appCount}
                />
                <AdminClusterOverviewStat
                  label={t("Services")}
                  value={node.serviceCount}
                />
                <AdminClusterOverviewStat
                  label={t("Created")}
                  title={node.createdExact}
                  value={node.createdLabel}
                />
              </dl>
            </PanelSection>

            <PanelSection className="fg-admin-cluster-manager__body">
              <section className="fg-admin-cluster-manager__lane">
                <div className="fg-admin-cluster-manager__lane-head">
                  <strong>{t("Node state")}</strong>
                  <span>
                    {t("Identity, reachability, and placement facts.")}
                  </span>
                </div>

                <dl className="fg-cluster-node-facts fg-admin-cluster-manager__facts">
                  {stateFacts.map((fact) => (
                    <div key={`${node.name}:${fact.id}`}>
                      <dt>{fact.label}</dt>
                      <dd title={fact.title}>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="fg-admin-cluster-manager__lane">
                <div className="fg-admin-cluster-manager__lane-head">
                  <strong>{t("Signals")}</strong>
                  <span>{t("Ready and pressure signals.")}</span>
                </div>

                <div className="fg-cluster-resource-grid fg-admin-cluster-manager__resource-grid">
                  {node.resources.map((resource) => (
                    <AdminClusterResourceMeter
                      key={`${node.name}:${resource.id}`}
                      resource={resource}
                    />
                  ))}
                </div>

                <div className="fg-admin-cluster-manager__lane-stack">
                  <div className="fg-admin-cluster-manager__subsection">
                    <div className="fg-admin-cluster-manager__subhead">
                      <strong>{t("Conditions")}</strong>
                    </div>

                    {node.conditions.length ? (
                      <div className="fg-cluster-condition-grid">
                        {node.conditions.map((condition) => (
                          <article
                            className="fg-cluster-condition"
                            key={`${node.name}:${condition.id}`}
                          >
                            <div className="fg-cluster-condition__head">
                              <span className="fg-cluster-condition__label">
                                {t(condition.label)}
                              </span>
                              <StatusBadge tone={condition.tone}>
                                {t(condition.statusLabel)}
                              </StatusBadge>
                            </div>
                            <p
                              className="fg-cluster-condition__detail"
                              title={`${condition.detailLabel} / ${condition.lastTransitionExact}`}
                            >
                              {condition.detailLabel}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <AdminClusterInlineEmptyState
                        description={t("No live signals reported.")}
                        title={t("Conditions")}
                      />
                    )}
                  </div>

                  <div className="fg-admin-cluster-manager__subsection">
                    <div className="fg-admin-cluster-manager__subhead">
                      <strong>{t("Workloads")}</strong>
                      <div className="fg-admin-cluster-manager__section-badges">
                        <StatusBadge tone="neutral">
                          {workloadCountLabel}
                        </StatusBadge>
                        {node.appCount ? (
                          <StatusBadge tone="info">{appCountLabel}</StatusBadge>
                        ) : null}
                        {node.serviceCount ? (
                          <StatusBadge tone="neutral">
                            {serviceCountLabel}
                          </StatusBadge>
                        ) : null}
                      </div>
                    </div>

                    {visibleWorkloads.length ? (
                      <ul className="fg-cluster-workload-list fg-admin-cluster-manager__workload-list">
                        {visibleWorkloads.map((workload) => (
                          <li key={`${node.name}:${workload.id}`}>
                            <article
                              className="fg-cluster-workload"
                              title={workload.title}
                            >
                              <div className="fg-cluster-workload__head">
                                <strong>{workload.name}</strong>
                                <StatusBadge tone={workload.kindTone}>
                                  {t(workload.kindLabel)}
                                </StatusBadge>
                              </div>
                              <p>{workload.metaLabel}</p>
                            </article>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <AdminClusterInlineEmptyState
                        description={t(
                          "No Fugue app or backing service is currently scheduled onto this node.",
                        )}
                        title={t("No workloads on this node")}
                      />
                    )}
                  </div>
                </div>
              </section>

              <section className="fg-admin-cluster-manager__lane fg-admin-cluster-manager__lane--policy">
                <div className="fg-admin-cluster-manager__lane-head">
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

                <div className="fg-admin-cluster-manager__subsection">
                  <div className="fg-admin-cluster-manager__subhead">
                    <strong>{t("Live policy")}</strong>
                  </div>

                  <div className="fg-admin-cluster-manager__policy-live-grid">
                    <AdminClusterPolicyLiveCard
                      label={t("Builds")}
                      value={
                        <StatusBadge
                          tone={readLiveFlagTone(
                            node.policy?.effectiveBuilds ?? false,
                          )}
                        >
                          {liveBuildLabel}
                        </StatusBadge>
                      }
                    />
                    <AdminClusterPolicyLiveCard
                      label={t("Shared pool")}
                      value={
                        <StatusBadge
                          tone={readLiveFlagTone(
                            node.policy?.effectiveSharedPool ?? false,
                          )}
                        >
                          {liveSharedPoolLabel}
                        </StatusBadge>
                      }
                    />
                    <AdminClusterPolicyLiveCard
                      label={t("Control plane")}
                      value={
                        <StatusBadge
                          tone={readControlPlaneTone(
                            node.policy?.effectiveControlPlaneRoleLabel ??
                              "Unknown",
                          )}
                        >
                          {liveControlPlaneLabel}
                        </StatusBadge>
                      }
                    />
                  </div>
                </div>

                {node.canManagePolicy ? (
                  <div className="fg-admin-cluster-manager__subsection">
                    <div className="fg-admin-cluster-manager__subhead">
                      <strong>{t("Desired policy")}</strong>
                      {dirty ? (
                        <StatusBadge tone="info">
                          {t("Unsaved policy")}
                        </StatusBadge>
                      ) : null}
                    </div>

                    <p className="fg-admin-cluster-manager__section-note">
                      {t("Edit the policy Fugue will reconcile onto this machine.")}
                    </p>

                    <fieldset
                      className="fg-admin-cluster-manager__policy-form"
                      disabled={busy}
                    >
                      <div className="fg-admin-cluster-manager__toggle-list">
                        <AdminClusterPolicyToggle
                          checked={draft.allowBuilds}
                          description={t("Accept source builds on this machine.")}
                          id={`allow-builds-${node.name}`}
                          label={t("Allow builds")}
                          liveBadge={
                            <StatusBadge
                              tone={readLiveFlagTone(
                                node.policy?.effectiveBuilds ?? false,
                              )}
                            >
                              {liveBuildLabel}
                            </StatusBadge>
                          }
                          onChange={(checked) => {
                            setDrafts((current) => ({
                              ...current,
                              [node.name]: {
                                ...draft,
                                allowBuilds: checked,
                              },
                            }));
                          }}
                        />

                        <AdminClusterPolicyToggle
                          checked={draft.allowSharedPool}
                          description={t(
                            "Accept shared Fugue workloads from outside a tenant runtime.",
                          )}
                          id={`allow-shared-pool-${node.name}`}
                          label={t("Allow shared pool apps")}
                          liveBadge={
                            <StatusBadge
                              tone={readLiveFlagTone(
                                node.policy?.effectiveSharedPool ?? false,
                              )}
                            >
                              {liveSharedPoolLabel}
                            </StatusBadge>
                          }
                          onChange={(checked) => {
                            setDrafts((current) => ({
                              ...current,
                              [node.name]: {
                                ...draft,
                                allowSharedPool: checked,
                              },
                            }));
                          }}
                        />
                      </div>

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
                    </fieldset>

                    <div className="fg-admin-cluster-manager__actions">
                      <Button
                        disabled={!dirty}
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
                        disabled={!dirty || busy}
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
                ) : (
                  <AdminClusterInlineEmptyState
                    description={t(
                      "This node is visible, but it is not backed by a managed machine or runtime yet.",
                    )}
                    title={t("Policy access unavailable")}
                  />
                )}
              </section>
            </PanelSection>
          </Panel>
        );
      })}
    </div>
  );
}

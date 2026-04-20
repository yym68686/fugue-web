"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { buildAdminClusterGalleryItem } from "@/components/admin/admin-cluster-overview";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import {
  ClusterNodeGallery,
  type ClusterNodeGalleryItem,
  type ClusterNodeGallerySummaryBadge,
} from "@/components/console/cluster-node-gallery";
import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Panel, PanelSection } from "@/components/ui/panel";
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

function policyNeedsReconcile(policy: AdminClusterNodePolicyView | null) {
  if (!policy) {
    return false;
  }

  return (
    policy.allowBuilds !== policy.effectiveBuilds ||
    normalizeBuildTier(policy.buildTier) !==
      normalizeBuildTier(policy.effectiveBuildTier) ||
    policy.allowSharedPool !== policy.effectiveSharedPool
  );
}

function readSummaryBadges(
  node: AdminClusterNodeView,
  dirty: boolean,
  needsReconcile: boolean,
): ClusterNodeGallerySummaryBadge[] {
  if (!node.canManagePolicy) {
    return [{ label: "Read only", tone: "warning" }];
  }

  const badges: ClusterNodeGallerySummaryBadge[] = [];
  if (dirty) {
    badges.push({ label: "Unsaved policy", tone: "info" });
  }
  if (needsReconcile) {
    badges.push({ label: "Reconcile needed", tone: "warning" });
  }
  return badges;
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

function AdminClusterPolicySwitch({
  checked,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="fg-admin-cluster-manager__policy-switch" htmlFor={id}>
      <input
        aria-label={label}
        checked={checked}
        id={id}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        role="switch"
        type="checkbox"
      />
      <span className="fg-admin-cluster-manager__policy-switch-ui">
        <span className="fg-admin-cluster-manager__policy-switch-state">
          {checked ? t("On") : t("Off")}
        </span>
        <span
          aria-hidden="true"
          className="fg-admin-cluster-manager__policy-switch-track"
        >
          <span className="fg-admin-cluster-manager__policy-switch-thumb" />
        </span>
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

function AdminClusterPolicySection({
  busy,
  buildTierOptions,
  controlPlaneRoleOptions,
  dirty,
  draft,
  needsReconcile,
  node,
  onApply,
  onDraftChange,
  onReset,
}: {
  busy: boolean;
  buildTierOptions: readonly SegmentedControlOption<
    NodePolicyDraft["buildTier"]
  >[];
  controlPlaneRoleOptions: readonly SegmentedControlOption<
    NodePolicyDraft["desiredControlPlaneRole"]
  >[];
  dirty: boolean;
  draft: NodePolicyDraft;
  needsReconcile: boolean;
  node: AdminClusterNodeView;
  onApply: () => void;
  onDraftChange: (patch: Partial<NodePolicyDraft>) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
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
  const canApply = dirty || needsReconcile;
  const applyLabel =
    !dirty && needsReconcile ? t("Reapply policy") : t("Apply policy");
  const sectionDescription = node.canManagePolicy
    ? t("Saved machine policy and the current live node state.")
    : t(
        "This node is visible, but it is not backed by a managed machine or runtime yet.",
      );
  const liveStatusNote = needsReconcile
    ? t(
        "Live node labels still differ from the saved policy. Reapply the policy to reconcile again.",
      )
    : t("Current node labels and live role observed in the cluster.");

  return (
    <PanelSection>
      <div className="fg-cluster-node-card__section-head">
        <div className="fg-admin-cluster-manager__section-copy">
          <p className="fg-label fg-panel__eyebrow">{t("Node policy")}</p>
          <p className="fg-admin-cluster-manager__section-note">
            {sectionDescription}
          </p>
        </div>

        <div className="fg-admin-cluster-manager__section-badges">
          {!node.canManagePolicy ? (
            <StatusBadge tone="warning">{t("Read only")}</StatusBadge>
          ) : null}
          {needsReconcile ? (
            <StatusBadge tone="warning">{t("Reconcile needed")}</StatusBadge>
          ) : null}
          {dirty ? (
            <StatusBadge tone="info">{t("Unsaved policy")}</StatusBadge>
          ) : null}
        </div>
      </div>

      <div className="fg-admin-cluster-manager__policy-grid">
        <section className="fg-admin-cluster-manager__policy-column">
          <div className="fg-admin-cluster-manager__subhead">
            <div className="fg-admin-cluster-manager__subhead-copy">
              <strong>{t("Current status")}</strong>
              <p className="fg-admin-cluster-manager__section-note">
                {liveStatusNote}
              </p>
            </div>
          </div>

          <div className="fg-admin-cluster-manager__policy-live-grid">
            <AdminClusterPolicyLiveCard
              label={t("Builds")}
              value={
                <StatusBadge
                  tone={readLiveFlagTone(node.policy?.effectiveBuilds ?? false)}
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
                    node.policy?.effectiveControlPlaneRoleLabel ?? "Unknown",
                  )}
                >
                  {liveControlPlaneLabel}
                </StatusBadge>
              }
            />
          </div>
        </section>

        <section className="fg-admin-cluster-manager__policy-column">
          {node.canManagePolicy ? (
            <>
              <div className="fg-admin-cluster-manager__subhead">
                <div className="fg-admin-cluster-manager__subhead-copy">
                  <strong>{t("Desired policy")}</strong>
                  <p className="fg-admin-cluster-manager__section-note">
                    {t(
                      "Edit the saved machine policy Fugue will try to reconcile onto this node.",
                    )}
                  </p>
                </div>
              </div>

              <fieldset
                className="fg-admin-cluster-manager__policy-form"
                disabled={busy}
              >
                <div className="fg-admin-cluster-manager__policy-card-grid">
                  <section className="fg-admin-cluster-manager__policy-card fg-admin-cluster-manager__policy-card--builds">
                    <div className="fg-admin-cluster-manager__policy-card-head">
                      <div className="fg-admin-cluster-manager__field-head">
                        <strong className="fg-admin-cluster-manager__field-label">
                          {t("Allow builds")}
                        </strong>
                        <span className="fg-admin-cluster-manager__field-hint">
                          {t("Accept source builds on this machine.")}
                        </span>
                      </div>
                      <AdminClusterPolicySwitch
                        checked={draft.allowBuilds}
                        id={`allow-builds-${node.name}`}
                        label={t("Allow builds")}
                        onChange={(checked) => {
                          onDraftChange({ allowBuilds: checked });
                        }}
                      />
                    </div>

                    <div className="fg-admin-cluster-manager__field-stack">
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
                          onDraftChange({ buildTier: value });
                        }}
                        options={buildTierOptions}
                        value={draft.buildTier}
                      />
                    </div>
                  </section>

                  <section className="fg-admin-cluster-manager__policy-card fg-admin-cluster-manager__policy-card--shared-pool">
                    <div className="fg-admin-cluster-manager__policy-card-head">
                      <div className="fg-admin-cluster-manager__field-head">
                        <strong className="fg-admin-cluster-manager__field-label">
                          {t("Allow shared pool apps")}
                        </strong>
                        <span className="fg-admin-cluster-manager__field-hint">
                          {t(
                            "Accept shared Fugue workloads from outside a tenant runtime.",
                          )}
                        </span>
                      </div>
                      <AdminClusterPolicySwitch
                        checked={draft.allowSharedPool}
                        id={`allow-shared-pool-${node.name}`}
                        label={t("Allow shared pool apps")}
                        onChange={(checked) => {
                          onDraftChange({ allowSharedPool: checked });
                        }}
                      />
                    </div>
                  </section>

                  <section className="fg-admin-cluster-manager__policy-card fg-admin-cluster-manager__policy-card--control-plane">
                    <div className="fg-admin-cluster-manager__field-stack">
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
                          onDraftChange({ desiredControlPlaneRole: value });
                        }}
                        options={controlPlaneRoleOptions}
                        value={draft.desiredControlPlaneRole}
                      />
                    </div>
                  </section>
                </div>
              </fieldset>

              <div className="fg-admin-cluster-manager__actions">
                <Button
                  disabled={!canApply}
                  loading={busy}
                  loadingLabel={t("Applying…")}
                  onClick={onApply}
                  size="compact"
                  variant="primary"
                >
                  {applyLabel}
                </Button>
                <Button
                  disabled={!dirty || busy}
                  onClick={onReset}
                  size="compact"
                  variant="secondary"
                >
                  {t("Reset draft")}
                </Button>
              </div>
            </>
          ) : (
            <AdminClusterInlineEmptyState
              description={t(
                "This node is visible, but it is not backed by a managed machine or runtime yet.",
              )}
              title={t("Policy access unavailable")}
            />
          )}
        </section>
      </div>
    </PanelSection>
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

  const nodeByName = useMemo(
    () => new Map(nodes.map((node) => [node.name, node] as const)),
    [nodes],
  );

  const items = useMemo<ClusterNodeGalleryItem[]>(
    () =>
      nodes.map((node) => {
        const draft = drafts[node.name] ?? readPolicyDraft(node);
        const dirty = node.canManagePolicy
          ? !draftMatchesPolicy(draft, node.policy)
          : false;
        const needsReconcile = policyNeedsReconcile(node.policy);

        return {
          ...buildAdminClusterGalleryItem(node),
          summaryBadges: readSummaryBadges(node, dirty, needsReconcile),
        } satisfies ClusterNodeGalleryItem;
      }),
    [drafts, nodes],
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
    const draft = drafts[node.name] ?? readPolicyDraft(node);

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
      <ClusterNodeGallery
        ariaLabel={t("Cluster nodes")}
        items={items}
        renderDetailFooter={(item) => {
          const node = nodeByName.get(item.id);

          if (!node) {
            return null;
          }

          const draft = drafts[node.name] ?? readPolicyDraft(node);
          const dirty = node.canManagePolicy
            ? !draftMatchesPolicy(draft, node.policy)
            : false;
          const needsReconcile = policyNeedsReconcile(node.policy);
          const busy = busyNodeName === node.name;

          return (
            <AdminClusterPolicySection
              busy={busy}
              buildTierOptions={buildTierOptions}
              controlPlaneRoleOptions={controlPlaneRoleOptions}
              dirty={dirty}
              draft={draft}
              needsReconcile={needsReconcile}
              node={node}
              onApply={() => {
                void handleApply(node);
              }}
              onDraftChange={(patch) => {
                setDrafts((current) => ({
                  ...current,
                  [node.name]: {
                    ...(current[node.name] ?? readPolicyDraft(node)),
                    ...patch,
                  },
                }));
              }}
              onReset={() => {
                resetDraft(node);
              }}
            />
          );
        }}
      />
    </div>
  );
}

"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { useCopyToClipboard } from "@fugue/ui/hooks/use-copy-to-clipboard";
import { RotateCcw } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConfirmationDialog, ConsoleDrawer } from "@/components/console/overlays";
import { ResourceMeter } from "@/components/console/resource-meter";
import { useClientUiMessages } from "@/components/i18n/locale-select";
import { CodeBlock } from "@/components/shared/code-block";
import {
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  type ConsoleAdminClusterPageSnapshot,
  invalidateConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleTone } from "@/lib/console/types";
import type { AdminClusterStateMessages } from "@/lib/i18n/console-messages";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

type AdminConfirmOperation = {
  body?: unknown;
  confirmLabel?: string;
  description: string;
  endpoint: string;
  method: "DELETE" | "PATCH" | "POST";
  successMessage: string;
  title: string;
};

type AdminClusterNodeView = ConsoleAdminClusterPageSnapshot["nodes"][number];
type AdminClusterNodeRow = AdminClusterNodeView & { id: string };
type ClusterPolicyDraft = {
  allowBuilds: boolean;
  allowDns: boolean;
  allowEdge: boolean;
  allowSharedPool: boolean;
};

function adminValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function matchesAdminQuery(
  query: string,
  values: Array<boolean | number | string | null | undefined>,
) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return values
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function requestAdminOperation(operation: AdminConfirmOperation) {
  const init: RequestInit = {
    cache: "no-store",
    method: operation.method,
  };

  if (operation.body !== undefined) {
    init.body = JSON.stringify(operation.body);
    init.headers = {
      "Content-Type": "application/json",
    };
  }

  return requestJson<unknown>(operation.endpoint, init);
}

function AdminSnapshotErrors({
  errors,
  messages,
}: {
  errors?: string[];
  messages: AdminClusterStateMessages;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <Alert variant="warning" role="status">
      <AlertTitle>{messages.snapshotPartiallyLoaded}</AlertTitle>
      <AlertDescription>{errors.join(" · ")}</AlertDescription>
    </Alert>
  );
}

function DetailMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card className="coss-card--muted">
      <CardContent className="coss-stack-sm">
        <span className="coss-help">{label}</span>
        <strong className={mono ? "coss-mono" : undefined}>{value}</strong>
      </CardContent>
    </Card>
  );
}

function ClusterResourceMeters({
  noTelemetry,
  node,
}: {
  noTelemetry: string;
  node: AdminClusterNodeView;
}) {
  if (node.resources.length === 0) {
    return <span className="coss-muted">{noTelemetry}</span>;
  }

  return (
    <div className="coss-stack-sm">
      {node.resources.slice(0, 3).map((resource) => (
        <ResourceMeter
          key={resource.id}
          label={`${resource.label} ${resource.percentLabel}`}
          value={resource.percentValue ?? 0}
        />
      ))}
    </div>
  );
}

export function AdminClusterConsole({
  stateMessages,
}: {
  stateMessages: AdminClusterStateMessages;
}) {
  const messages = useClientUiMessages();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
      CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
    );
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<AdminClusterNodeView | null>(null);
  const [policyDraft, setPolicyDraft] = useState<ClusterPolicyDraft | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [issuingKey, setIssuingKey] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const { copyToClipboard } = useCopyToClipboard();
  const nodes = data?.nodes ?? [];
  const trafficSafetyWarnings = data?.trafficSafetyWarnings ?? [];
  const rows = useMemo<AdminClusterNodeRow[]>(
    () =>
      nodes
        .filter((node) =>
          matchesAdminQuery(query, [
            node.name,
            node.statusLabel,
            node.runtimeLabel,
            node.tenantLabel,
            node.locationLabel,
            node.zoneLabel,
            node.internalIpLabel,
            node.publicIpLabel,
            ...node.roleLabels,
            ...node.workloads.map(
              (workload) => `${workload.title} ${workload.metaLabel}`,
            ),
          ]),
        )
        .map((node) => ({
          ...node,
          id: node.name,
        })),
    [nodes, query],
  );

  async function refreshCluster() {
    setRefreshing(true);
    setOperationError(null);
    invalidateConsolePageSnapshot(CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL);

    try {
      await refresh({ force: true });
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function issueJoinKey() {
    setIssuingKey(true);
    setOperationError(null);

    try {
      const result = await requestJson<{ joinCommand: string }>(
        "/api/admin/cluster/node-keys",
        {
          body: JSON.stringify({ label: "platform-node" }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      setSecret(result.joinCommand);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setIssuingKey(false);
    }
  }

  function openPolicyEditor(node: AdminClusterNodeView) {
    setDrawer(node);
    setPolicyDraft(
      node.policy
        ? {
            allowBuilds: node.policy.allowBuilds,
            allowDns: node.policy.allowDns,
            allowEdge: node.policy.allowEdge,
            allowSharedPool: node.policy.allowSharedPool,
          }
        : null,
    );
  }

  async function savePolicy() {
    if (!drawer || !policyDraft) {
      return;
    }

    setSavingPolicy(true);
    setOperationError(null);

    try {
      await requestAdminOperation({
        body: policyDraft,
        description: "",
        endpoint: `/api/admin/cluster/nodes/${encodeURIComponent(drawer.name)}/policy`,
        method: "PATCH",
        successMessage: "",
        title: "",
      });
      invalidateConsolePageSnapshot(CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL);
      await refresh({ force: true });
      toast.notify(`Policy saved for ${drawer.name}`);
      setDrawer(null);
      setPolicyDraft(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setSavingPolicy(false);
    }
  }

  function setPolicyBoolean(key: keyof ClusterPolicyDraft, value: string) {
    setPolicyDraft((draft) =>
      draft
        ? {
            ...draft,
            [key]: value === "true",
          }
        : draft,
    );
  }

  return (
    <>
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Nodes", value: String(data?.summary.nodeCount ?? nodes.length) },
            {
              label: "Ready",
              tone: "success",
              value: String(
                data?.summary.readyCount ??
                  nodes.filter((node) => node.statusLabel === "Ready").length,
              ),
            },
            {
              label: "Attention",
              tone: data?.summary.pressuredCount ? "warning" : undefined,
              value: String(
                data?.summary.pressuredCount ??
                  nodes.filter(
                    (node) =>
                      node.statusTone === "warning" || node.statusTone === "danger",
                  ).length,
              ),
            },
            {
              label: "Workloads",
              value: String(
                data?.summary.workloadCount ??
                  nodes.reduce((total, node) => total + node.workloadCount, 0),
              ),
            },
          ]}
        />

        {trafficSafetyWarnings.length > 0 ? (
          <div className="coss-stack-sm">
            {trafficSafetyWarnings.map((warning) => (
              <Alert
                key={warning.id}
                variant={warning.severityTone === "danger" ? "error" : "warning"}
                role="status"
              >
                <AlertTitle>
                  {
                    <div className="coss-row">
                      <span>{warning.title}</span>
                      <Badge variant={badgeToneFromConsoleTone(warning.severityTone)}>
                        {warning.severityLabel}
                      </Badge>
                    </div>
                  }
                </AlertTitle>
                <AlertDescription>
                  <div className="coss-stack-sm">
                    <span>{warning.message}</span>
                    <div className="coss-grid-2">
                      <DetailMetric label="Subject" value={warning.subjectLabel} mono />
                      <DetailMetric label="Observed" value={warning.observedLabel} />
                      {warning.evidence.slice(0, 4).map((item) => (
                        <DetailMetric
                          key={`${warning.id}:${item.label}`}
                          label={item.label}
                          value={item.value}
                          mono={item.label !== "Redundancy"}
                        />
                      ))}
                    </div>
                    <span>{warning.repairHint}</span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        <div className="coss-split">
          <CardFrame>
            <ConsoleCardHeader
              title="Control plane"
              description="Deployment status, release instance, version, and component rollout state."
              action={
                <Badge
                  variant={badgeToneFromConsoleTone(
                    data?.controlPlane?.statusTone ?? "neutral",
                  )}
                >
                  {data?.controlPlane?.statusLabel ?? stateMessages.unavailable}
                </Badge>
              }
            />
            <CardContent className="coss-stack">
              {data?.controlPlane ? (
                <>
                  <div className="coss-grid-2">
                    <DetailMetric
                      label="Namespace"
                      value={data.controlPlane.namespaceLabel}
                      mono
                    />
                    <DetailMetric
                      label="Version"
                      value={data.controlPlane.versionLabel}
                      mono
                    />
                    <DetailMetric
                      label="Release"
                      value={data.controlPlane.releaseInstanceLabel}
                    />
                    <DetailMetric
                      label="Observed"
                      value={data.controlPlane.observedLabel}
                    />
                  </div>
                  <DataTable
                    columns={["Component", "Replicas", "Rollout", "Image"]}
                    rows={data.controlPlane.components.map((component) => ({
                      ...component,
                      id: component.component,
                    }))}
                    renderRow={(row) => (
                      <tr key={row.component}>
                        <td>
                          <div className="coss-stack-sm">
                            <strong>{row.componentLabel}</strong>
                            <span className="coss-help coss-mono">
                              {row.deploymentName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge variant={badgeToneFromConsoleTone(row.statusTone)}>
                            {row.replicaLabel}
                          </Badge>
                        </td>
                        <td>{row.rolloutLabel}</td>
                        <td className="coss-mono">
                          {row.imageTagLabel || row.imageRepositoryLabel}
                        </td>
                      </tr>
                    )}
                  />
                </>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{stateMessages.controlPlaneUnavailable}</EmptyTitle>
                    <EmptyDescription>
                      {stateMessages.controlPlaneUnavailableDescription}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </CardFrame>

          <CardFrame>
            <ConsoleCardHeader
              title="Platform node join"
              description="Issue a platform-scoped node enrollment key once."
            />
            <CardContent className="coss-stack">
              <Button
                disabled={Boolean(error)}
                loading={issuingKey}
                onClick={() => {
                  void issueJoinKey();
                }}
              >
                Issue join key
              </Button>
              <CodeBlock>
                fugue node join --api-url &lt;api-url&gt; --token &lt;visible-once&gt;
              </CodeBlock>
            </CardContent>
          </CardFrame>
        </div>

        <CardFrame>
          <ConsoleCardHeader
            title="Cluster nodes"
            description="Live node status, runtime assignment, resource pressure, workloads, and policy controls."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => {
                  void refreshCluster();
                }}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <Input
              aria-label="Search cluster nodes"
              autoComplete="off"
              className="coss-input--wide"
              name="clusterNodeSearch"
              placeholder="Search nodes, runtime, tenant, role, workload…"
              spellCheck={false}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {operationError ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{stateMessages.clusterOperationFailed}</AlertTitle>
                <AlertDescription>{operationError}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{stateMessages.clusterUnavailable}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} messages={stateMessages} />

            {loading && !data ? (
              <ConsoleLoadingState
                className="coss-stack-sm"
                label="Loading cluster nodes"
              >
                <Skeleton
                  style={{
                    height: 44,
                  }}
                />
                <Skeleton
                  style={{
                    height: 56,
                  }}
                />
                <Skeleton
                  style={{
                    height: 56,
                  }}
                />
              </ConsoleLoadingState>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {nodes.length === 0
                      ? stateMessages.noNodes
                      : stateMessages.noNodesMatch}
                  </EmptyTitle>
                  <EmptyDescription>
                    {nodes.length === 0
                      ? stateMessages.emptyInventoryDescription
                      : stateMessages.clearSearchDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={[
                  "Node",
                  "Status",
                  "Runtime",
                  "Resources",
                  "Workloads",
                  "Policy",
                ]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.name}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong className="coss-mono">{row.name}</strong>
                        <span className="coss-help">
                          {row.locationLabel} · {row.zoneLabel}
                        </span>
                        <span className="coss-help">
                          {row.roleLabels.join(", ") || stateMessages.noRoleLabels}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <Badge variant={badgeToneFromConsoleTone(row.statusTone)}>
                          {row.statusLabel}
                        </Badge>
                        {row.statusDetail ? (
                          <span className="coss-help">{row.statusDetail}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <span className="coss-mono">{row.runtimeLabel}</span>
                        <span className="coss-help">{row.tenantLabel}</span>
                      </div>
                    </td>
                    <td>
                      <ClusterResourceMeters
                        noTelemetry={stateMessages.noTelemetry}
                        node={row}
                      />
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{pluralize(row.workloadCount, "workload")}</strong>
                        <span className="coss-help">
                          {pluralize(row.appCount, "app")} ·{" "}
                          {pluralize(row.serviceCount, "service")}
                        </span>
                      </div>
                    </td>
                    <td className="coss-table__actions">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!row.canManagePolicy || !row.policy || savingPolicy}
                        onClick={() => openPolicyEditor(row)}
                      >
                        Edit policy
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <ConsoleDrawer
        title={drawer?.name ?? ""}
        description="Runtime node policy"
        open={Boolean(drawer)}
        onClose={() => {
          setDrawer(null);
          setPolicyDraft(null);
        }}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Internal IP" value={drawer.internalIpLabel} mono />
              <DetailMetric label="Public IP" value={drawer.publicIpLabel} mono />
              <DetailMetric label="Runtime" value={drawer.runtimeLabel} mono />
              <DetailMetric
                label="Machine"
                value={adminValue(
                  drawer.machine?.nodeKeyLabel,
                  stateMessages.unavailable,
                )}
              />
            </div>
            {drawer.policy && policyDraft ? (
              <div className="coss-form">
                <Field>
                  <FieldLabel htmlFor="node-policy-builds">Build workloads</FieldLabel>
                  <Select
                    value={String(policyDraft.allowBuilds)}
                    onValueChange={(value) =>
                      value && setPolicyBoolean("allowBuilds", value)
                    }
                  >
                    <SelectTrigger id="node-policy-builds">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="true">Allowed</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectPopup>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="node-policy-dns">DNS traffic</FieldLabel>
                  <Select
                    value={String(policyDraft.allowDns)}
                    onValueChange={(value) =>
                      value && setPolicyBoolean("allowDns", value)
                    }
                  >
                    <SelectTrigger id="node-policy-dns">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="true">Allowed</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectPopup>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="node-policy-edge">Edge traffic</FieldLabel>
                  <Select
                    value={String(policyDraft.allowEdge)}
                    onValueChange={(value) =>
                      value && setPolicyBoolean("allowEdge", value)
                    }
                  >
                    <SelectTrigger id="node-policy-edge">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="true">Allowed</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectPopup>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="node-policy-shared-pool">Shared pool</FieldLabel>
                  <Select
                    value={String(policyDraft.allowSharedPool)}
                    onValueChange={(value) =>
                      value && setPolicyBoolean("allowSharedPool", value)
                    }
                  >
                    <SelectTrigger id="node-policy-shared-pool">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="true">Allowed</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectPopup>
                  </Select>
                </Field>
                <Alert variant="info" role="status">
                  <AlertTitle>{stateMessages.effectivePolicy}</AlertTitle>
                  <AlertDescription>
                    Control plane role: {drawer.policy.effectiveControlPlaneRoleLabel}
                    {"; schedulable: "}
                    {drawer.policy.effectiveSchedulable ? "yes" : "no"}.
                  </AlertDescription>
                </Alert>
                <Button
                  loading={savingPolicy}
                  onClick={() => {
                    void savePolicy();
                  }}
                >
                  Save policy
                </Button>
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{stateMessages.policyUnavailable}</EmptyTitle>
                  <EmptyDescription>
                    {stateMessages.policyUnavailableDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        ) : null}
      </ConsoleDrawer>
      <ConfirmationDialog
        title="Platform join command"
        description={secret ?? ""}
        open={Boolean(secret)}
        confirmLabel={messages.copy}
        onConfirm={() => {
          if (secret) {
            void copyToClipboard(secret).then((copied) => {
              toast.notify(copied ? messages.copySucceeded : messages.copyFailed);
            });
          }
          setSecret(null);
        }}
        onClose={() => setSecret(null)}
      />
    </>
  );
}

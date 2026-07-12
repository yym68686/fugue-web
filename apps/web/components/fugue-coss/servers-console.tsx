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
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import Link from "next/link";
import { useState } from "react";
import {
  ConsoleLoadError,
  ConsoleLoadingState,
} from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConsoleDrawer } from "@/components/console/overlays";
import { ResourceMeter } from "@/components/console/resource-meter";
import { CodeBlock } from "@/components/shared/code-block";
import {
  CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
  type ConsoleClusterNodesPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleTone } from "@/lib/console/types";
import type { ServersStateMessages } from "@/lib/i18n/console-messages";

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

type ClusterNodesReadySnapshot = Extract<
  ConsoleClusterNodesPageSnapshot,
  { state: "ready" }
>;
type ClusterNodeRow = ClusterNodesReadySnapshot["data"]["nodes"][number] & {
  id: string;
};
type OfflineServerRow = ClusterNodesReadySnapshot["data"]["offlineServers"][number] & {
  id: string;
};

function findNodeResource(
  node: ClusterNodesReadySnapshot["data"]["nodes"][number],
  id: "cpu" | "memory" | "storage",
) {
  return node.resources.find((resource) => resource.id === id) ?? null;
}

export function ServersConsole({ messages }: { messages: ServersStateMessages }) {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleClusterNodesPageSnapshot>(
      CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
      {
        ttlMs: 15_000,
      },
    );
  const [drawer, setDrawer] = useState<ClusterNodeRow | null>(null);
  const [query, setQuery] = useState("");
  const ready = data?.state === "ready" ? data : null;
  const normalizedQuery = query.trim().toLowerCase();
  const rows: ClusterNodeRow[] = (ready?.data.nodes ?? [])
    .map((node) => ({
      ...node,
      id: node.name,
    }))
    .filter((node) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        node.name,
        node.runtimeLabel,
        node.ownerLabel,
        node.locationLabel,
        ...node.roleLabels,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  const offlineRows: OfflineServerRow[] = (ready?.data.offlineServers ?? []).map(
    (server) => ({
      ...server,
      id: server.runtimeId,
    }),
  );

  return (
    <>
      <div className="coss-stack">
        {error ? (
          <ConsoleLoadError
            description={error}
            onRetry={() => refresh({ force: true })}
            retryLabel={messages.retry}
            title={messages.serversUnavailable}
          />
        ) : null}
        {data?.state === "workspace-missing" ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.workspaceNotReady}</EmptyTitle>
              <EmptyDescription>
                {messages.workspaceNotReadyDescription}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {loading && !ready ? (
          <ConsoleLoadingState className="coss-stack-sm" label="Loading servers">
            <Skeleton
              style={{
                height: 72,
              }}
            />
            <Skeleton
              style={{
                height: 220,
              }}
            />
          </ConsoleLoadingState>
        ) : null}
        {ready ? (
          <>
            <MetricStrip
              items={[
                { label: "Servers", value: String(ready.data.summary.nodeCount) },
                {
                  label: "Ready",
                  value: String(ready.data.summary.readyCount),
                  tone: "success",
                },
                {
                  label: "Offline",
                  value: String(ready.data.summary.offlineCount),
                  tone: ready.data.summary.offlineCount ? "warning" : undefined,
                },
                { label: "Workloads", value: String(ready.data.summary.workloadCount) },
              ]}
            />
            {ready.data.errors.length ? (
              <Alert variant="warning" role="status">
                <AlertTitle>{messages.inventoryPartiallyLoaded}</AlertTitle>
                <AlertDescription>{ready.data.errors.join(" · ")}</AlertDescription>
              </Alert>
            ) : null}
            <CardFrame>
              <ConsoleCardHeader
                title="Runtime servers"
                description="Heartbeat, roles, pressure signals, capacity, workloads, and runtime access."
                action={
                  <Button
                    render={<Link href="/app/api-keys" />}
                    variant="outline"
                    size="sm"
                  >
                    Open node keys
                  </Button>
                }
              />
              <CardContent className="coss-stack">
                <Input
                  aria-label="Search servers"
                  autoComplete="off"
                  className="coss-input--narrow"
                  name="serverSearch"
                  placeholder="Search servers…"
                  spellCheck={false}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {rows.length ? (
                  <DataTable
                    columns={["Server", "Role", "Ready", "CPU", "Memory", "Actions"]}
                    rows={rows}
                    renderRow={(row) => {
                      const cpu = findNodeResource(row, "cpu");
                      const memory = findNodeResource(row, "memory");

                      return (
                        <tr key={row.id}>
                          <td>
                            <strong className="coss-mono">{row.name}</strong>
                            <div className="coss-help">
                              {row.locationLabel} · {row.runtimeLabel}
                            </div>
                          </td>
                          <td>{row.roleLabels.join(", ") || "runtime"}</td>
                          <td>
                            <span className="coss-row">
                              <Badge variant={badgeToneFromConsoleTone(row.statusTone)}>
                                {row.statusLabel}
                              </Badge>
                              <Badge variant="info">
                                {row.poolMode ?? row.ownership}
                              </Badge>
                            </span>
                          </td>
                          <td>
                            <ResourceMeter label="cpu" value={cpu?.percentValue ?? 0} />
                          </td>
                          <td>
                            <ResourceMeter
                              label="memory"
                              value={memory?.percentValue ?? 0}
                            />
                          </td>
                          <td className="coss-table__actions">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Server details ${row.name}`}
                              onClick={() => setDrawer(row)}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      );
                    }}
                  />
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.noServersFound}</EmptyTitle>
                      <EmptyDescription>
                        {messages.noServersFoundDescription}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </CardFrame>
            <CardFrame>
              <ConsoleCardHeader
                title="Offline servers"
                description="Runtime records that Fugue reports as offline."
              />
              <CardContent className="coss-stack">
                {offlineRows.length ? (
                  <DataTable
                    columns={["Server", "Runtime", "Last contact", "Status"]}
                    rows={offlineRows}
                    renderRow={(row) => (
                      <tr key={row.id}>
                        <td className="coss-mono">{row.name}</td>
                        <td>{row.runtimeLabel}</td>
                        <td>{row.lastContactLabel}</td>
                        <td>
                          <Badge variant={badgeToneFromConsoleTone(row.statusTone)}>
                            {row.statusLabel}
                          </Badge>
                        </td>
                      </tr>
                    )}
                  />
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.noOfflineServers}</EmptyTitle>
                      <EmptyDescription>
                        {messages.noOfflineServersDescription}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </CardFrame>
          </>
        ) : null}
      </div>
      <ConsoleDrawer
        title={drawer?.id ?? ""}
        description="Runtime access and pressure details."
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <div className="coss-stack">
            <MetricStrip
              items={[
                { label: "Apps", value: String(drawer.appCount) },
                { label: "Services", value: String(drawer.serviceCount) },
                { label: "Workloads", value: String(drawer.workloadCount) },
                { label: "Heartbeat", value: drawer.heartbeatLabel },
              ]}
            />
            {drawer.resources.map((resource) => (
              <Card key={resource.id} className="coss-card--muted">
                <CardContent className="coss-stack-sm">
                  <strong>{resource.label}</strong>
                  <ResourceMeter
                    label={resource.label}
                    value={resource.percentValue ?? 0}
                  />
                  <p className="coss-card-description">{resource.detailLabel}</p>
                  <p className="coss-help">{resource.requestLabel}</p>
                </CardContent>
              </Card>
            ))}
            <CodeBlock>
              {JSON.stringify(
                {
                  accessMode: drawer.accessMode,
                  internalIp: drawer.internalIpLabel,
                  machine: drawer.machineLabel,
                  owner: drawer.ownerLabel,
                  publicIp: drawer.publicIpLabel,
                  runtimeId: drawer.runtimeId,
                  runtimeStatus: drawer.runtimeStatusLabel,
                  zone: drawer.zoneLabel,
                },
                null,
                2,
              )}
            </CodeBlock>
          </div>
        ) : null}
      </ConsoleDrawer>
    </>
  );
}

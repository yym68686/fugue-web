"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { Textarea } from "@fugue/ui/components/textarea";
import { toastManager } from "@fugue/ui/components/toast";
import { ToggleGroup, ToggleGroupItem } from "@fugue/ui/components/toggle-group";
import { useCopyToClipboard } from "@fugue/ui/hooks/use-copy-to-clipboard";
import { useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConsoleDrawer } from "@/components/console/overlays";
import type {
  FugueAppEnvResult,
  FugueAppFilesystemTreeResult,
  FugueAppImageInventoryResult,
  FugueAppObservabilityMetricsSummary,
  FugueAppObservabilityRequests,
  FugueBuildLogsResult,
  FugueRuntimeLogsResult,
} from "@/components/fugue-coss/api-types";
import {
  formatBytes,
  formatRelativeOrExact,
  useEndpointData,
  type WorkbenchAppService,
} from "@/components/fugue-coss/project-workbench-shared";
import { CodeBlock } from "@/components/shared/code-block";
import type { ProjectWorkbenchStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

export function EnvironmentTab({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const [mode, setMode] = useState<"Variables" | "Raw .env">("Variables");
  const { data, error, loading, refresh } = useEndpointData<FugueAppEnvResult>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/env`,
  );
  const rows = Object.entries(data?.env ?? {}).map(([key, value]) => ({
    id: key,
    key,
    value,
  }));
  const rawEnv = rows.map((row) => `${row.key}=${row.value}`).join("\n");

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Environment"
        description="Live app environment from Fugue."
        action={
          <Button variant="outline" size="sm" loading={loading} onClick={refresh}>
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack">
        {error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.environmentUnavailable}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <ToggleGroup
          aria-label="Environment display"
          onValueChange={(values) => {
            const nextMode = values[0];
            if (nextMode === "Variables" || nextMode === "Raw .env") {
              setMode(nextMode);
            }
          }}
          value={[mode]}
          variant="outline"
        >
          {(["Variables", "Raw .env"] as const).map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {loading ? (
          <ConsoleLoadingState className="coss-stack-sm" label="Loading environment">
            <Skeleton
              style={{
                height: 40,
              }}
            />
            <Skeleton
              style={{
                height: 40,
              }}
            />
          </ConsoleLoadingState>
        ) : rows.length ? (
          mode === "Variables" ? (
            <DataTable
              columns={["Key", "Value"]}
              rows={rows}
              renderRow={(row) => (
                <tr key={row.id}>
                  <td className="coss-mono">{row.key}</td>
                  <td className="coss-mono">{row.value}</td>
                </tr>
              )}
            />
          ) : (
            <Textarea className="coss-mono" readOnly value={rawEnv} />
          )
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noEnvironment}</EmptyTitle>
              <EmptyDescription>{messages.noEnvironmentDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </CardFrame>
  );
}

export function LogsTab({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const [kind, setKind] = useState<"Runtime" | "Build">(
    service.preferredLogsMode === "build" ? "Build" : "Runtime",
  );
  const toast = useToast();
  const { copyToClipboard } = useCopyToClipboard();
  const query =
    kind === "Build"
      ? `tail_lines=160${service.buildLogsOperationId ? `&operation_id=${encodeURIComponent(service.buildLogsOperationId)}` : ""}`
      : "tail_lines=160";
  const endpoint =
    kind === "Build"
      ? `/api/fugue/apps/${encodeURIComponent(service.id)}/build-logs?${query}`
      : `/api/fugue/apps/${encodeURIComponent(service.id)}/runtime-logs?${query}`;
  const { data, error, loading, refresh } = useEndpointData<
    FugueBuildLogsResult | FugueRuntimeLogsResult
  >(endpoint);
  const logs = data && "logs" in data ? data.logs : "";

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Logs"
        description="Recent logs from Fugue for the selected app."
        action={
          <Button variant="outline" size="sm" loading={loading} onClick={refresh}>
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack">
        {error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.logsUnavailable}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="coss-row coss-row--between">
          <ToggleGroup
            aria-label="Log source"
            onValueChange={(values) => {
              const nextKind = values[0];
              if (nextKind === "Runtime" || nextKind === "Build") {
                setKind(nextKind);
              }
            }}
            value={[kind]}
            variant="outline"
          >
            {(["Runtime", "Build"] as const).map((item) => (
              <ToggleGroupItem key={item} value={item}>
                {item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            disabled={!logs}
            onClick={() => {
              void copyToClipboard(logs).then((copied) => {
                toast.notify(copied ? messages.copySucceeded : messages.copyFailed);
              });
            }}
          >
            Copy logs
          </Button>
        </div>
        {loading ? (
          <ConsoleLoadingState label="Loading logs">
            <Skeleton
              style={{
                height: 220,
              }}
            />
          </ConsoleLoadingState>
        ) : logs ? (
          <CodeBlock>{logs}</CodeBlock>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noLogs}</EmptyTitle>
              <EmptyDescription>{messages.noLogsDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </CardFrame>
  );
}

export function FilesTab({
  locale,
  messages,
  service,
}: {
  locale: Locale;
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const { data, error, loading, refresh } =
    useEndpointData<FugueAppFilesystemTreeResult>(
      `/api/fugue/apps/${encodeURIComponent(service.id)}/filesystem/tree?depth=2`,
    );
  const entries = data?.entries ?? [];
  const rows = entries.map((entry) => ({
    ...entry,
    id: entry.path,
  }));

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Files"
        description="Live filesystem tree from the current runtime container."
        action={
          <Button variant="outline" size="sm" loading={loading} onClick={refresh}>
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack">
        {error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.filesystemUnavailable}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="coss-row">
          <Badge variant="info">{data?.component ?? "app"}</Badge>
          <span className="coss-help coss-mono">{data?.pod ?? messages.noPod}</span>
          <span className="coss-help coss-mono">{data?.workspaceRoot ?? "/"}</span>
        </div>
        {loading ? (
          <ConsoleLoadingState className="coss-stack-sm" label="Loading filesystem">
            <Skeleton
              style={{
                height: 38,
              }}
            />
            <Skeleton
              style={{
                height: 38,
              }}
            />
            <Skeleton
              style={{
                height: 38,
              }}
            />
          </ConsoleLoadingState>
        ) : rows.length ? (
          <DataTable
            columns={["Path", "Kind", "Size", "Modified"]}
            rows={rows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{row.path}</td>
                <td>{row.kind}</td>
                <td>{formatBytes(locale, row.size)}</td>
                <td>{formatRelativeOrExact(locale, row.modifiedAt)}</td>
              </tr>
            )}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noFiles}</EmptyTitle>
              <EmptyDescription>{messages.noFilesDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </CardFrame>
  );
}

export function ImagesTab({
  locale,
  messages,
  service,
}: {
  locale: Locale;
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const [drawer, setDrawer] = useState<
    FugueAppImageInventoryResult["versions"][number] | null
  >(null);
  const { data, error, loading, refresh } =
    useEndpointData<FugueAppImageInventoryResult>(
      `/api/fugue/apps/${encodeURIComponent(service.id)}/images`,
    );
  const versions = data?.versions ?? [];
  const rows = versions.map((version) => ({
    ...version,
    id: version.imageRef,
  }));
  const current = versions.find((version) => version.current);

  return (
    <>
      <CardFrame>
        <ConsoleCardHeader
          title="Images"
          description="Image inventory reported by Fugue registry metadata."
          action={
            <Button variant="outline" size="sm" loading={loading} onClick={refresh}>
              Refresh
            </Button>
          }
        />
        <CardContent className="coss-stack">
          {error ? (
            <Alert variant="error" role="alert">
              <AlertTitle>{messages.imagesUnavailable}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {current ? (
            <Alert variant="success" role="status">
              <AlertTitle>{messages.currentImage}</AlertTitle>
              <AlertDescription>
                {current.runtimeImageRef ?? current.imageRef}
              </AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <ConsoleLoadingState className="coss-stack-sm" label="Loading images">
              <Skeleton
                style={{
                  height: 40,
                }}
              />
              <Skeleton
                style={{
                  height: 40,
                }}
              />
            </ConsoleLoadingState>
          ) : rows.length ? (
            <DataTable
              columns={["Image", "Size", "State", "Deployed", "Actions"]}
              rows={rows}
              renderRow={(row) => (
                <tr key={row.id}>
                  <td className="coss-mono">{row.runtimeImageRef ?? row.imageRef}</td>
                  <td>{formatBytes(locale, row.sizeBytes)}</td>
                  <td>
                    <Badge variant={row.current ? "success" : "default"}>
                      {row.current ? "current" : (row.status ?? "saved")}
                    </Badge>
                  </td>
                  <td>{formatRelativeOrExact(locale, row.lastDeployedAt)}</td>
                  <td className="coss-table__actions">
                    <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>
                      Details
                    </Button>
                  </td>
                </tr>
              )}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{messages.noImages}</EmptyTitle>
                <EmptyDescription>{messages.noImagesDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </CardFrame>
      <ConsoleDrawer
        title="Image details"
        description={drawer?.runtimeImageRef ?? drawer?.imageRef}
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <CodeBlock>
            {JSON.stringify(
              {
                current: drawer.current,
                digest: drawer.digest,
                imageRef: drawer.imageRef,
                lastDeployedAt: drawer.lastDeployedAt,
                runtimeImageRef: drawer.runtimeImageRef,
                status: drawer.status,
              },
              null,
              2,
            )}
          </CodeBlock>
        ) : null}
      </ConsoleDrawer>
    </>
  );
}

export function ObservabilityTab({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const [windowSize, setWindowSize] = useState("1h");
  const since = encodeURIComponent(windowSize);
  const metrics = useEndpointData<FugueAppObservabilityMetricsSummary>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/observability/metrics/summary?since=${since}`,
  );
  const requests = useEndpointData<FugueAppObservabilityRequests>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/observability/requests?since=${since}&limit=20`,
  );
  const requestRows = (requests.data?.requests ?? []).map((request) => ({
    ...request,
    id: request.requestId ?? request.traceId ?? request.timestamp,
  }));

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Observability"
        description="Metrics and request summaries from Fugue observability."
        action={
          <Button
            variant="outline"
            size="sm"
            loading={metrics.loading || requests.loading}
            onClick={() => {
              metrics.refresh();
              requests.refresh();
            }}
          >
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack">
        <div className="coss-row coss-row--between">
          <Select
            value={windowSize}
            onValueChange={(value) => setWindowSize(value ?? "1h")}
          >
            <SelectTrigger aria-label="Time window" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
            </SelectPopup>
          </Select>
          <Badge variant={metrics.data?.source.available ? "success" : "warning"}>
            {metrics.data?.source.status ?? "loading"}
          </Badge>
        </div>
        {metrics.error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.metricsUnavailable}</AlertTitle>
            <AlertDescription>{metrics.error}</AlertDescription>
          </Alert>
        ) : null}
        {requests.error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.requestsUnavailable}</AlertTitle>
            <AlertDescription>{requests.error}</AlertDescription>
          </Alert>
        ) : null}
        {metrics.loading ? (
          <ConsoleLoadingState label="Loading metrics">
            <Skeleton
              style={{
                height: 72,
              }}
            />
          </ConsoleLoadingState>
        ) : metrics.data?.metrics.length ? (
          <MetricStrip
            items={metrics.data.metrics.slice(0, 4).map((metric) => ({
              label: metric.name,
              value: `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`,
            }))}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noMetrics}</EmptyTitle>
              <EmptyDescription>{messages.noMetricsDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {requests.loading ? (
          <ConsoleLoadingState label="Loading requests">
            <Skeleton
              style={{
                height: 140,
              }}
            />
          </ConsoleLoadingState>
        ) : requestRows.length ? (
          <DataTable
            columns={["Request", "Status", "Duration", "Trace"]}
            rows={requestRows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">
                  {[row.method, row.route].filter(Boolean).join(" ") || "request"}
                </td>
                <td>
                  {row.statusCode ? (
                    <Badge variant={row.statusCode < 500 ? "success" : "destructive"}>
                      {row.statusCode}
                    </Badge>
                  ) : (
                    messages.unknown
                  )}
                </td>
                <td>
                  {row.durationMs === undefined
                    ? messages.unknown
                    : `${row.durationMs} ms`}
                </td>
                <td className="coss-mono">{row.traceId ?? messages.noTrace}</td>
              </tr>
            )}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noRequests}</EmptyTitle>
              <EmptyDescription>{messages.noRequestsDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </CardFrame>
  );
}

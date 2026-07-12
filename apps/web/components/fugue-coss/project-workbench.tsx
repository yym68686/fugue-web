"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@fugue/ui/components/toggle-group";
import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConfirmationDialog } from "@/components/console/overlays";
import type { FugueAppRestartResult } from "@/components/fugue-coss/api-types";
import {
  isWorkbenchAppService,
  resolveWorkbenchSelection,
  shouldUseInitialWorkbenchDetail,
  type WorkbenchAppService,
  type WorkbenchBackingService,
  type WorkbenchService,
  workbenchTabs,
} from "@/components/fugue-coss/project-workbench-shared";
import { CodeBlock } from "@/components/shared/code-block";
import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import { fetchConsoleProjectDetail } from "@/lib/console/project-detail-client";
import type { ConsoleTone } from "@/lib/console/types";
import type { ProjectWorkbenchStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

const loadDeferredWorkbenchTabs = () =>
  import("@/components/fugue-coss/project-workbench-deferred-tabs");

const DeferredEnvironmentTab = dynamic(
  () => loadDeferredWorkbenchTabs().then((module) => module.EnvironmentTab),
  { loading: WorkbenchTabLoading },
);
const DeferredLogsTab = dynamic(
  () => loadDeferredWorkbenchTabs().then((module) => module.LogsTab),
  { loading: WorkbenchTabLoading },
);
const DeferredFilesTab = dynamic(
  () => loadDeferredWorkbenchTabs().then((module) => module.FilesTab),
  { loading: WorkbenchTabLoading },
);
const DeferredImagesTab = dynamic(
  () => loadDeferredWorkbenchTabs().then((module) => module.ImagesTab),
  { loading: WorkbenchTabLoading },
);
const DeferredObservabilityTab = dynamic(
  () => loadDeferredWorkbenchTabs().then((module) => module.ObservabilityTab),
  { loading: WorkbenchTabLoading },
);

const DeferredCustomDomainsPanel = dynamic(
  () =>
    import("@/components/fugue-coss/project-workbench-domains").then(
      (module) => module.CustomDomainsPanel,
    ),
  { loading: DomainsPanelLoading },
);

const DEFERRED_WORKBENCH_TABS = new Set([
  "Environment",
  "Logs",
  "Files",
  "Images",
  "Observability",
]);

function preloadDeferredWorkbenchTabs() {
  if (typeof window !== "undefined") {
    void loadDeferredWorkbenchTabs();
  }
}

function WorkbenchTabLoading() {
  return (
    <ConsoleLoadingState label="Loading service section">
      <Skeleton style={{ height: 260 }} />
    </ConsoleLoadingState>
  );
}

function DomainsPanelLoading() {
  return (
    <ConsoleLoadingState label="Loading domains">
      <Skeleton style={{ height: 96 }} />
    </ConsoleLoadingState>
  );
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function alertVariantFromConsoleTone(
  tone: ConsoleTone,
): "default" | "success" | "warning" | "error" | "info" {
  if (tone === "positive") return "success";
  if (tone === "danger") return "error";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function serviceTone(service: WorkbenchService): CossBadgeTone {
  if (isWorkbenchAppService(service)) {
    return badgeToneFromConsoleTone(service.phaseTone);
  }

  return badgeToneFromConsoleTone(service.statusTone);
}

function serviceStatusLabel(service: WorkbenchService) {
  return isWorkbenchAppService(service) ? service.phase : service.status;
}

function serviceRouteLabel(
  service: WorkbenchService,
  messages: ProjectWorkbenchStateMessages,
) {
  if (!isWorkbenchAppService(service)) {
    return `${service.type} · ${service.ownerAppLabel}`;
  }

  return (
    service.routePublicUrl ||
    service.routeInternalUrl ||
    service.routeLabel ||
    messages.noPublicRoute
  );
}

function serviceRuntimeLabel(
  service: WorkbenchService,
  messages: ProjectWorkbenchStateMessages,
) {
  if (isWorkbenchAppService(service)) {
    return service.locationLabel || service.runtimeId || messages.noRuntime;
  }

  return service.locationLabel || service.databaseRuntimeId || messages.noRuntime;
}

export function ProjectWorkbench({
  initialDetail,
  locale,
  messages,
  projectId,
}: {
  initialDetail?: ConsoleProjectDetailData;
  locale: Locale;
  messages: ProjectWorkbenchStateMessages;
  projectId: string;
}) {
  const initialSelection = resolveWorkbenchSelection(initialDetail, null, null);
  const [detail, setDetail] = useState<ConsoleProjectDetailData | null>(
    initialDetail ?? null,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    initialSelection.selectedServiceId,
  );
  const [tab, setTab] = useState(initialSelection.tab);
  const [loading, setLoading] = useState(initialDetail === undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [restartTarget, setRestartTarget] = useState<WorkbenchAppService | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [restartSucceeded, setRestartSucceeded] = useState(false);
  const [restartingServiceId, setRestartingServiceId] = useState<string | null>(null);
  const restartInFlightRef = useRef(false);
  const project = detail?.project ?? null;
  const services = project?.services ?? [];
  const service =
    services.find((item) => item.id === selectedServiceId) ?? services[0] ?? null;
  const tabs = service ? workbenchTabs(service) : [];

  useEffect(() => {
    const applyDetail = (nextDetail: ConsoleProjectDetailData) => {
      setDetail(nextDetail);
      const params = new URLSearchParams(window.location.search);
      const selection = resolveWorkbenchSelection(
        nextDetail,
        params.get("service"),
        params.get("tab"),
      );
      setSelectedServiceId(selection.selectedServiceId);
      setTab(selection.tab);
    };

    setLoadError(null);
    if (shouldUseInitialWorkbenchDetail(initialDetail, refreshKey)) {
      applyDetail(initialDetail);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetchConsoleProjectDetail(projectId, {
      force: refreshKey > 0,
      signal: controller.signal,
    })
      .then((nextDetail) => {
        if (controller.signal.aborted) {
          return;
        }

        applyDetail(nextDetail);
      })
      .catch((nextError) => {
        if (isAbortRequestError(nextError)) {
          return;
        }

        setDetail(null);
        setLoadError(readRequestError(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [initialDetail, projectId, refreshKey]);

  function writeWorkbenchUrl(nextService: WorkbenchService, nextTab: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("service", nextService.id);
    params.set("tab", nextTab);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  function queueRestart(nextService: WorkbenchAppService) {
    if (restartInFlightRef.current) {
      return;
    }

    setRestartError(null);
    setRestartSucceeded(false);
    setRestartTarget(nextService);
  }

  async function confirmRestart() {
    const target = restartTarget;

    if (!target || restartInFlightRef.current) {
      return;
    }

    restartInFlightRef.current = true;
    setRestartingServiceId(target.id);
    setRestartError(null);

    try {
      await requestJson<FugueAppRestartResult>(
        `/api/fugue/apps/${encodeURIComponent(target.id)}/restart`,
        {
          cache: "no-store",
          method: "POST",
        },
      );
      setRestartTarget(null);
      setRestartSucceeded(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setRestartError(readRequestError(error));
    } finally {
      restartInFlightRef.current = false;
      setRestartingServiceId(null);
    }
  }

  if (loading) {
    return (
      <ConsoleLoadingState className="coss-stack-sm" label="Loading project detail">
        <Skeleton
          style={{
            height: 52,
          }}
        />
        <Skeleton
          style={{
            height: 52,
          }}
        />
        <Skeleton
          style={{
            height: 260,
          }}
        />
      </ConsoleLoadingState>
    );
  }

  if (loadError) {
    return (
      <Alert variant="error" role="alert">
        <AlertTitle>{messages.projectUnavailable}</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          {messages.retry}
        </Button>
      </Alert>
    );
  }

  if (!project) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{messages.noProject}</EmptyTitle>
          <EmptyDescription>{messages.noProjectDescription}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {<Button render={<Link href="/app" />}>Back to projects</Button>}
        </EmptyContent>
      </Empty>
    );
  }

  if (!service) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{messages.noServices}</EmptyTitle>
          <EmptyDescription>{messages.noServicesDescription}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {
            <Button
              variant="outline"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RotateCcw aria-hidden="true" />
              Refresh
            </Button>
          }
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="coss-workbench">
      <aside className="coss-service-rail">
        {services.map((item) => {
          const nextTabs = workbenchTabs(item);
          const nextTab = nextTabs[0] ?? "Overview";

          return (
            <Button
              key={item.id}
              variant="outline"
              className="coss-service-button"
              aria-label={`Select service ${item.name}`}
              aria-pressed={service.id === item.id}
              onClick={() => {
                setSelectedServiceId(item.id);
                setTab(nextTab);
                writeWorkbenchUrl(item, nextTab);
              }}
            >
              <strong>{item.name}</strong>
              <p className="coss-card-description">
                {item.kind === "app" ? "app" : item.type} · {serviceStatusLabel(item)}
              </p>
            </Button>
          );
        })}
        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>
          <RotateCcw aria-hidden="true" />
          Refresh project
        </Button>
      </aside>
      <div className="coss-stack">
        {restartSucceeded ? (
          <Alert variant="success" role="status">
            <AlertTitle>{messages.restartRequested}</AlertTitle>
            <AlertDescription>{messages.restartRequestedDescription}</AlertDescription>
          </Alert>
        ) : null}
        <CardFrame>
          <CardContent className="coss-row coss-row--between">
            <div>
              <h2 className="coss-page-title">{service.name}</h2>
              <p className="coss-card-description">
                {serviceRouteLabel(service, messages)}
              </p>
            </div>
            <div className="coss-actions">
              {isWorkbenchAppService(service) ? (
                <Button
                  variant="outline"
                  loading={restartingServiceId === service.id}
                  disabled={Boolean(
                    restartingServiceId && restartingServiceId !== service.id,
                  )}
                  onClick={() => queueRestart(service)}
                >
                  {restartingServiceId === service.id
                    ? messages.restarting
                    : messages.restart}
                </Button>
              ) : null}
              <Badge variant={serviceTone(service)}>
                {serviceStatusLabel(service)}
              </Badge>
              <Badge variant="info">{serviceRuntimeLabel(service, messages)}</Badge>
            </div>
          </CardContent>
        </CardFrame>
        <ToggleGroup
          aria-label="Service sections"
          onValueChange={(values) => {
            const nextTab = values[0];
            if (!nextTab) return;
            setTab(nextTab);
            writeWorkbenchUrl(service, nextTab);
          }}
          value={[tab]}
          variant="outline"
        >
          {tabs.map((item) => (
            <ToggleGroupItem
              key={item}
              value={item}
              onFocus={
                DEFERRED_WORKBENCH_TABS.has(item)
                  ? preloadDeferredWorkbenchTabs
                  : undefined
              }
              onMouseEnter={
                DEFERRED_WORKBENCH_TABS.has(item)
                  ? preloadDeferredWorkbenchTabs
                  : undefined
              }
            >
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {tab === "Route" && isWorkbenchAppService(service) ? (
          <RouteTab
            initialDomains={detail?.initialDomains}
            messages={messages}
            service={service}
          />
        ) : null}
        {tab === "Environment" && isWorkbenchAppService(service) ? (
          <DeferredEnvironmentTab messages={messages} service={service} />
        ) : null}
        {tab === "Logs" && isWorkbenchAppService(service) ? (
          <DeferredLogsTab messages={messages} service={service} />
        ) : null}
        {tab === "Files" && isWorkbenchAppService(service) ? (
          <DeferredFilesTab locale={locale} messages={messages} service={service} />
        ) : null}
        {tab === "Images" && isWorkbenchAppService(service) ? (
          <DeferredImagesTab locale={locale} messages={messages} service={service} />
        ) : null}
        {tab === "Observability" && isWorkbenchAppService(service) ? (
          <DeferredObservabilityTab messages={messages} service={service} />
        ) : null}
        {tab === "Settings" ? (
          <SettingsTab messages={messages} service={service} />
        ) : null}
        {tab === "Overview" && !isWorkbenchAppService(service) ? (
          <BackingOverview messages={messages} service={service} />
        ) : null}
        {tab === "Failover" && !isWorkbenchAppService(service) ? (
          <FailoverTab messages={messages} service={service} />
        ) : null}
      </div>
      <ConfirmationDialog
        confirmLabel={messages.restart}
        confirmLoading={Boolean(restartingServiceId)}
        description={messages.restartConfirmation}
        error={
          restartError ? (
            <div className="coss-stack-sm">
              <strong>{messages.restartFailed}</strong>
              <span>{restartError}</span>
            </div>
          ) : null
        }
        open={Boolean(restartTarget)}
        title={messages.restartApp}
        onClose={() => {
          if (!restartInFlightRef.current) {
            setRestartError(null);
            setRestartTarget(null);
          }
        }}
        onConfirm={() => {
          void confirmRestart();
        }}
      />
    </div>
  );
}

function RouteTab({
  initialDomains,
  messages,
  service,
}: {
  initialDomains?: ConsoleProjectDetailData["initialDomains"];
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  const rows = service.routeHostname
    ? [
        {
          host: service.routeHostname,
          href: service.routeHref || service.routePublicUrl || "",
          id: `${service.id}:primary-route`,
          pathPrefix: service.routePathPrefix ?? "/",
          port: service.routeBaseDomain ?? "public",
          status: "active",
        },
      ]
    : [];

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Routes"
        description="Public route and internal service placement from Fugue."
      />
      <CardContent className="coss-stack">
        <MetricStrip
          items={[
            { label: "Public route", value: rows.length ? "1" : "0" },
            { label: "Service port", value: service.routeLabel },
            { label: "Network", value: service.networkMode ?? "default" },
            {
              label: "Replicas",
              value:
                service.replicaCount === null
                  ? messages.unknown
                  : String(service.replicaCount),
            },
          ]}
        />
        {rows.length ? (
          <DataTable
            columns={["Host", "Path", "Target", "Status"]}
            rows={rows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">
                  {row.href ? <a href={row.href}>{row.host}</a> : row.host}
                </td>
                <td className="coss-mono">{row.pathPrefix}</td>
                <td className="coss-mono">{service.routeLabel}</td>
                <td>
                  <Badge variant="success">{row.status}</Badge>
                </td>
              </tr>
            )}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noPublicRoute}</EmptyTitle>
              <EmptyDescription>{messages.noPublicRouteDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <Card className="coss-card--muted">
          <CardContent className="coss-stack-sm">
            <strong>Internal service</strong>
            <p className="coss-card-description">
              {service.routeInternalUrl || messages.internalServiceUnavailable}
            </p>
          </CardContent>
        </Card>
        <DeferredCustomDomainsPanel
          initialDomains={initialDomains}
          messages={messages}
          service={service}
        />
      </CardContent>
    </CardFrame>
  );
}

function SettingsTab({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchService;
}) {
  if (!isWorkbenchAppService(service)) {
    return <BackingOverview messages={messages} service={service} />;
  }

  return (
    <div className="coss-stack">
      <CardFrame>
        <ConsoleCardHeader
          title="Runtime settings"
          description="Current app runtime settings reported by Fugue."
        />
        <CardContent className="coss-grid-2">
          <Field>
            <FieldLabel htmlFor="workbench-startup-command">Startup command</FieldLabel>
            <Input
              id="workbench-startup-command"
              readOnly
              value={service.startupCommand ?? ""}
              placeholder={messages.notConfigured}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workbench-image-retention">Image retention</FieldLabel>
            <Input
              id="workbench-image-retention"
              readOnly
              value={String(service.imageMirrorLimit)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workbench-network-mode">Network mode</FieldLabel>
            <Input
              id="workbench-network-mode"
              readOnly
              value={service.networkMode ?? "default"}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workbench-runtime">Runtime</FieldLabel>
            <Input
              id="workbench-runtime"
              readOnly
              value={service.runtimeId ?? ""}
              placeholder={messages.noRuntime}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workbench-replicas">Replicas</FieldLabel>
            <Input
              id="workbench-replicas"
              readOnly
              value={service.replicaCount === null ? "" : String(service.replicaCount)}
              placeholder={messages.unknown}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="workbench-deploy-behavior">Deploy behavior</FieldLabel>
            <Input
              id="workbench-deploy-behavior"
              readOnly
              value={service.deployBehavior}
            />
          </Field>
        </CardContent>
      </CardFrame>
      <CardFrame>
        <ConsoleCardHeader
          title="Source"
          description="Current build source and commit metadata."
        />
        <CardContent className="coss-stack-sm">
          <div className="coss-row">
            <span>Source</span>
            <span className="coss-mono">{service.sourceLabel}</span>
          </div>
          <div className="coss-row">
            <span>Branch</span>
            <span className="coss-mono">
              {service.sourceBranchLabel ?? messages.unknown}
            </span>
          </div>
          <div className="coss-row">
            <span>Commit</span>
            <span className="coss-mono">
              {service.currentCommitLabel ?? messages.unknown}
            </span>
          </div>
        </CardContent>
      </CardFrame>
    </div>
  );
}

function BackingOverview({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchBackingService;
}) {
  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Backing service overview"
        description="Runtime location, owner app, continuity, and resource state from Fugue."
      />
      <CardContent className="coss-stack">
        <MetricStrip
          items={[
            {
              label: "Runtime",
              value:
                service.locationLabel ?? service.databaseRuntimeId ?? messages.unknown,
            },
            { label: "Owner app", value: service.ownerAppLabel },
            {
              label: "Status",
              value: service.status,
              tone: badgeToneFromConsoleTone(service.statusTone),
            },
            {
              label: "Continuity",
              value: service.databaseContinuity.label,
              tone: badgeToneFromConsoleTone(service.databaseContinuity.tone),
            },
          ]}
        />
        <CodeBlock>
          {JSON.stringify(
            {
              databaseInstances: service.databaseInstances,
              databaseRuntimeId: service.databaseRuntimeId,
              failoverConfigured: service.databaseFailoverConfigured,
              transferTargetRuntimeId: service.databaseTransferTargetRuntimeId,
              type: service.type,
            },
            null,
            2,
          )}
        </CodeBlock>
      </CardContent>
    </CardFrame>
  );
}

function FailoverTab({
  messages,
  service,
}: {
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchBackingService;
}) {
  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Managed failover"
        description="Current database continuity state from Fugue."
      />
      <CardContent className="coss-stack">
        <Alert
          variant={alertVariantFromConsoleTone(service.databaseContinuity.tone)}
          role="status"
        >
          <AlertTitle>{service.databaseContinuity.label}</AlertTitle>
          <AlertDescription>
            {service.databaseContinuity.live
              ? messages.continuityActiveDescription
              : messages.continuityIdleDescription}
          </AlertDescription>
        </Alert>
        <CodeBlock>
          {JSON.stringify(
            {
              failoverConfigured: service.databaseFailoverConfigured,
              failoverTargetRuntimeId: service.databaseFailoverTargetRuntimeId,
              pendingTargetRuntimeId: service.databaseContinuity.pendingTargetRuntimeId,
              placementPendingRebalance:
                service.databaseContinuity.placementPendingRebalance,
              state: service.databaseContinuity.state,
            },
            null,
            2,
          )}
        </CodeBlock>
      </CardContent>
    </CardFrame>
  );
}

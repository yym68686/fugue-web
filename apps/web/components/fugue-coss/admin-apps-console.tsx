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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { CursorPagination } from "@/components/console/cursor-pagination";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConfirmationDialog, ConsoleDrawer } from "@/components/console/overlays";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { ConsoleAdminAppsPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  useBoundedConsolePage,
  useDebouncedValue,
} from "@/lib/console/use-bounded-page";
import type { AdminAppsStateMessages } from "@/lib/i18n/console-messages";
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

type AdminConfirmOperation = {
  body?: unknown;
  confirmLabel?: string;
  description: string;
  endpoint: string;
  method: "DELETE" | "PATCH" | "POST";
  successMessage: string;
  title: string;
};

type AdminAppView = ConsoleAdminAppsPageSnapshot["apps"][number];

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

const APP_PHASE_FILTERS = [
  ["pending", "Pending"],
  ["queued", "Queued"],
  ["building", "Building"],
  ["deploying", "Deploying"],
  ["running", "Running"],
  ["healthy", "Healthy"],
  ["failed", "Failed"],
  ["disabled", "Disabled"],
] as const;

function AdminSnapshotErrors({
  errors,
  messages,
}: {
  errors?: string[];
  messages: AdminAppsStateMessages;
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

function CompactResourceUsage({
  items,
  emptyLabel,
}: {
  items: ConsoleCompactResourceItemView[];
  emptyLabel?: string;
}) {
  const visibleItems = items.filter((item) => item.primaryLabel.trim()).slice(0, 3);

  if (visibleItems.length === 0) {
    return <span className="coss-muted">{emptyLabel}</span>;
  }

  return (
    <fieldset className="coss-project-usage">
      <legend className="sr-only">Resource usage</legend>
      {visibleItems.map((item) => (
        <span key={item.id} title={item.title}>
          <span>{item.label}</span>
          <strong>{item.primaryLabel}</strong>
        </span>
      ))}
    </fieldset>
  );
}

export function AdminAppsConsole({ messages }: { messages: AdminAppsStateMessages }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<AdminAppView | null>(null);
  const [operation, setOperation] = useState<AdminConfirmOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const toast = useToast();
  const debouncedQuery = useDebouncedValue(query, 300);
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      limit: "50",
      sort: "created_at_desc",
    });
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }
    if (phase !== "all") {
      params.set("phase", phase);
    }
    if (cursor) {
      params.set("cursor", cursor);
    }
    return `/api/fugue/admin/pages/apps?${params.toString()}`;
  }, [cursor, debouncedQuery, phase]);
  const { data, error, loading, refresh } =
    useBoundedConsolePage<ConsoleAdminAppsPageSnapshot>(requestUrl, {
      enabled: query === debouncedQuery,
      onCursorExpired: () => {
        setCursor(null);
        setDrawer(null);
        setOperationError(messages.listChanged);
      },
    });
  const apps = data?.apps ?? [];
  const summary = data?.summary;
  const rows = apps;

  function refreshApps() {
    setOperationError(null);
    refresh();
  }

  async function confirmOperation() {
    if (!operation) {
      return;
    }

    setOperating(true);
    setOperationError(null);

    try {
      await requestAdminOperation(operation);
      setCursor(null);
      refresh();
      toast.notify(operation.successMessage);
      setOperation(null);
      setDrawer(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setOperating(false);
    }
  }

  function queueAppOperation(app: AdminAppView, kind: "delete" | "rebuild") {
    const encodedId = encodeURIComponent(app.id);

    if (kind === "rebuild") {
      setOperation({
        confirmLabel: "Rebuild",
        description: `${app.name} will be queued for a new build through Fugue.`,
        endpoint: `/api/admin/apps/${encodedId}/rebuild`,
        method: "POST",
        successMessage: `Rebuild queued for ${app.name}`,
        title: `Rebuild ${app.name}`,
      });
      return;
    }

    setOperation({
      confirmLabel: "Delete",
      description: `${app.name} will be deleted from Fugue. This cannot be undone from the console.`,
      endpoint: `/api/admin/apps/${encodedId}`,
      method: "DELETE",
      successMessage: `${app.name} deleted`,
      title: `Delete ${app.name}`,
    });
  }

  return (
    <>
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Apps", value: String(summary?.appCount ?? apps.length) },
            {
              label: "Routed on page",
              tone: "success",
              value: String(
                summary?.routedCount ??
                  apps.filter((app) => Boolean(app.routeHref)).length,
              ),
            },
            {
              label: "Tenants on page",
              value: String(
                summary?.tenantCount ?? new Set(apps.map((app) => app.ownerLabel)).size,
              ),
            },
            {
              label: "Latest update",
              tone: summary?.latestUpdateLabel ? "info" : undefined,
              value:
                summary?.latestUpdateLabel ??
                (loading ? messages.loading : messages.none),
            },
          ]}
        />
        <CardFrame>
          <ConsoleCardHeader
            title="Applications"
            description="Live cluster-wide app inventory, route placement, resource usage, rebuild, and deletion."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={() => {
                  refreshApps();
                }}
              >
                {loading ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <Input
                aria-label="Search apps"
                autoComplete="off"
                className="coss-input--medium"
                maxLength={200}
                name="applicationSearch"
                placeholder="Search app, id, project, route, or source…"
                spellCheck={false}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(null);
                }}
              />
              <Select
                value={phase}
                onValueChange={(value) => {
                  setPhase(value ?? "all");
                  setCursor(null);
                }}
              >
                <SelectTrigger aria-label="Filter app phase" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="all">All phases</SelectItem>
                  {APP_PHASE_FILTERS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {operationError ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.adminOperationFailed}</AlertTitle>
                <AlertDescription>{operationError}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.applicationsUnavailable}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} messages={messages} />

            {loading && !data ? (
              <ConsoleLoadingState
                className="coss-stack-sm"
                label="Loading applications"
              >
                <Skeleton
                  style={{
                    height: 44,
                  }}
                />
                <Skeleton
                  style={{
                    height: 48,
                  }}
                />
                <Skeleton
                  style={{
                    height: 48,
                  }}
                />
              </ConsoleLoadingState>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {query.trim() || phase !== "all"
                      ? messages.noApplicationsMatch
                      : messages.noApplications}
                  </EmptyTitle>
                  <EmptyDescription>
                    {query.trim() || phase !== "all"
                      ? messages.clearFilterDescription
                      : messages.emptyInventoryDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={[
                  "App",
                  "Owner",
                  "Phase",
                  "Route",
                  "Runtime",
                  "Usage",
                  "Actions",
                ]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.name}</strong>
                        <span className="coss-help coss-mono">{row.id}</span>
                        <span className="coss-help">
                          {row.projectLabel} · {row.createdLabel}
                        </span>
                      </div>
                    </td>
                    <td>{row.ownerLabel}</td>
                    <td>
                      <Badge variant={badgeToneFromConsoleTone(row.phaseTone)}>
                        {row.phase}
                      </Badge>
                    </td>
                    <td>
                      {row.routeHref ? (
                        <Button
                          render={<Link href={row.routeHref} target="_blank" />}
                          variant="ghost"
                          size="sm"
                        >
                          {row.routeLabel}
                        </Button>
                      ) : (
                        <span className="coss-muted">{row.routeLabel}</span>
                      )}
                    </td>
                    <td className="coss-mono">{row.serverLabel}</td>
                    <td>
                      <CompactResourceUsage
                        emptyLabel={messages.noUsageStats}
                        items={row.resourceUsage}
                      />
                    </td>
                    <td className="coss-table__actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDrawer(row)}
                      >
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!row.canRebuild || operating}
                        onClick={() => queueAppOperation(row, "rebuild")}
                      >
                        Rebuild
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={operating}
                        onClick={() => queueAppOperation(row, "delete")}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
            {data?.pageInfo ? (
              <CursorPagination
                disabled={loading || operating}
                pageInfo={data.pageInfo}
                visibleCount={rows.length}
                onNext={setCursor}
                onPrevious={setCursor}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <ConsoleDrawer
        title={drawer?.name ?? ""}
        description={drawer?.id}
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Owner" value={drawer.ownerLabel} />
              <DetailMetric label="Project" value={drawer.projectLabel} />
              <DetailMetric label="Runtime" value={drawer.serverLabel} mono />
              <DetailMetric label="Created" value={drawer.createdLabel} />
            </div>
            <Card className="coss-card--muted">
              <CardContent className="coss-stack-sm">
                <span className="coss-help">Source</span>
                {drawer.sourceHref ? (
                  <Button
                    render={<Link href={drawer.sourceHref} target="_blank" />}
                    variant="outline"
                    size="sm"
                  >
                    {drawer.sourceLabel}
                  </Button>
                ) : (
                  <strong>{drawer.sourceLabel}</strong>
                )}
              </CardContent>
            </Card>
            <CompactResourceUsage
              emptyLabel={messages.noUsageStats}
              items={drawer.resourceUsage}
            />
            {drawer.stack.length ? (
              <fieldset className="coss-row">
                <legend className="sr-only">Tech stack</legend>
                {drawer.stack.map((item) => (
                  <Badge key={item.id} variant="info">
                    {item.label}
                  </Badge>
                ))}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </ConsoleDrawer>
      <ConfirmationDialog
        title={operation?.title ?? ""}
        description={operation?.description ?? ""}
        open={Boolean(operation)}
        confirmDisabled={operating}
        confirmLabel={operation?.confirmLabel ?? "Confirm"}
        confirmLoading={operating}
        onConfirm={() => {
          void confirmOperation();
        }}
        onClose={() => {
          if (!operating) {
            setOperation(null);
          }
        }}
      />
    </>
  );
}

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
import { Input } from "@fugue/ui/components/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@fugue/ui/components/toggle-group";
import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { DataTable } from "@/components/console/data-table";
import { ConsoleDrawer } from "@/components/console/overlays";
import type { ConsoleGalleryProjectView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import type { ProjectGalleryStateMessages } from "@/lib/i18n/console-messages";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

type ProjectGalleryApiResponse = {
  errors?: string[];
  projects?: ConsoleGalleryProjectView[];
};

type ProjectLifecycleFilter = "running" | "deploying" | "attention" | "empty" | "idle";
type ProjectLifecycleFilterValue = ProjectLifecycleFilter | "all";

const PROJECT_LIFECYCLE_FILTER_LABELS: Record<ProjectLifecycleFilterValue, string> = {
  all: "All lifecycle",
  attention: "Attention",
  deploying: "Deploying",
  empty: "Empty",
  idle: "Idle",
  running: "Running",
};

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";

type ProjectLifecycleState = {
  filter: ProjectLifecycleFilter;
  label: string;
  tone: ConsoleTone;
};

type ProjectListItem = {
  id: string;
  lifecycle: ProjectLifecycleState;
  runtimeLabel: string;
  project: ConsoleGalleryProjectView;
};

function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function statusTextIncludes(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function readProjectLifecycle(
  project: ConsoleGalleryProjectView,
): ProjectLifecycleState {
  const services = project.services ?? [];

  if (services.length === 0) {
    return {
      filter: "empty",
      label: "Empty",
      tone: "neutral",
    };
  }

  let hasDanger = false;
  let hasWarning = false;
  let hasDeploying = false;
  let hasRunning = false;

  for (const service of services) {
    const tone = service.kind === "app" ? service.phaseTone : service.statusTone;
    const status = service.kind === "app" ? service.phase : service.status;
    const normalized = status.trim().toLowerCase();

    if (tone === "danger") {
      hasDanger = true;
    }

    if (tone === "warning") {
      hasWarning = true;
    }

    if (
      tone === "info" ||
      service.serviceRole === "pending" ||
      (service.kind === "backing-service" && service.databaseContinuity.live) ||
      statusTextIncludes(normalized, [
        "building",
        "deploying",
        "importing",
        "provisioning",
        "starting",
        "transferring",
        "creating",
      ])
    ) {
      hasDeploying = true;
    }

    if (
      tone === "positive" ||
      service.serviceRole === "running" ||
      statusTextIncludes(normalized, [
        "active",
        "completed",
        "deployed",
        "healthy",
        "live",
        "ready",
        "running",
      ])
    ) {
      hasRunning = true;
    }
  }

  if (hasDanger || hasWarning) {
    return {
      filter: "attention",
      label: "Attention",
      tone: hasDanger ? "danger" : "warning",
    };
  }

  if (hasDeploying) {
    return {
      filter: "deploying",
      label: "Deploying",
      tone: "info",
    };
  }

  if (hasRunning) {
    return {
      filter: "running",
      label: "Running",
      tone: "positive",
    };
  }

  return {
    filter: "idle",
    label: "Idle",
    tone: "neutral",
  };
}

function readProjectRuntimeLabel(
  project: ConsoleGalleryProjectView,
  noRuntime: string,
) {
  const runtimeLabels = new Set<string>();

  for (const service of project.services ?? []) {
    const runtimeLabel =
      service.locationLabel ??
      (service.kind === "app"
        ? (service.currentRuntimeId ?? service.runtimeId)
        : service.databaseRuntimeId);

    if (runtimeLabel?.trim()) {
      runtimeLabels.add(runtimeLabel.trim());
    }
  }

  if (runtimeLabels.size === 0 && project.defaultRuntimeId?.trim()) {
    runtimeLabels.add(project.defaultRuntimeId.trim());
  }

  const labels = [...runtimeLabels];
  const firstLabel = labels[0];

  if (!firstLabel) {
    return noRuntime;
  }

  if (labels.length === 1) {
    return firstLabel;
  }

  return `${firstLabel} +${labels.length - 1}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProjectGallery({
  initialData,
  messages,
}: {
  initialData?: ProjectGalleryApiResponse;
  messages: ProjectGalleryStateMessages;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectLifecycleFilterValue>("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [drawer, setDrawer] = useState(false);
  const [projects, setProjects] = useState<ConsoleGalleryProjectView[]>(
    initialData?.projects ?? [],
  );
  const [apiErrors, setApiErrors] = useState<string[]>(initialData?.errors ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialData && refreshKey === 0) {
      return;
    }

    const controller = new AbortController();
    const isRefresh = refreshKey > 0;

    setLoadError(null);
    setLoading(!isRefresh);
    setRefreshing(isRefresh);

    requestJson<ProjectGalleryApiResponse>("/api/fugue/console/projects", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((data) => {
        setProjects(data.projects ?? []);
        setApiErrors(data.errors ?? []);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setLoadError(readRequestError(error));
        setProjects([]);
        setApiErrors([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [initialData, refreshKey]);

  const items = useMemo<ProjectListItem[]>(() => {
    return projects.map((project) => ({
      id: project.id,
      lifecycle: readProjectLifecycle(project),
      project,
      runtimeLabel: readProjectRuntimeLabel(project, messages.noRuntime),
    }));
  }, [messages.noRuntime, projects]);

  const deployingCount = useMemo(
    () => items.filter((item) => item.lifecycle.filter === "deploying").length,
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const searchable = [
        item.project.name,
        item.project.id,
        item.runtimeLabel,
        ...item.project.services.map((service) => service.name),
        ...item.project.serviceBadges.map((badge) => badge.label),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesStatus = status === "all" || item.lifecycle.filter === status;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, status]);

  return (
    <>
      <CardFrame className="coss-projects-panel">
        <CardContent className="coss-projects-content">
          <fieldset className="coss-projects-toolbar">
            <legend className="coss-sr-only">Project controls</legend>
            <div className="coss-projects-filterset">
              <Input
                autoComplete="off"
                className="coss-projects-search"
                aria-label="Search projects"
                name="projectSearch"
                placeholder="Search projects…"
                spellCheck={false}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select
                value={status}
                onValueChange={(value) => {
                  if (value && value in PROJECT_LIFECYCLE_FILTER_LABELS) {
                    setStatus(value as ProjectLifecycleFilterValue);
                  }
                }}
              >
                <SelectTrigger
                  aria-label="Filter lifecycle"
                  className="coss-projects-select"
                >
                  <SelectValue>{PROJECT_LIFECYCLE_FILTER_LABELS[status]}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="all">All lifecycle</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="deploying">Deploying</SelectItem>
                  <SelectItem value="attention">Attention</SelectItem>
                  <SelectItem value="empty">Empty</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                </SelectPopup>
              </Select>
              <ToggleGroup
                aria-label="Project view"
                onValueChange={(values) => {
                  const nextView = values[0];
                  if (nextView === "table" || nextView === "cards") setView(nextView);
                }}
                value={[view]}
                variant="outline"
              >
                <ToggleGroupItem value="table">Table</ToggleGroupItem>
                <ToggleGroupItem value="cards">Cards</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="coss-projects-actions">
              <span className="coss-projects-count">
                {loading ? "Loading" : `${pluralize(filtered.length, "project")} shown`}
              </span>
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
              <Button size="sm" onClick={() => setDrawer(true)}>
                <Plus aria-hidden="true" />
                New project
              </Button>
            </div>
          </fieldset>

          {apiErrors.length ? (
            <Alert variant="warning" role="status">
              <AlertTitle>{messages.inventoryPartiallyLoaded}</AlertTitle>
              <AlertDescription>{apiErrors.join(" · ")}</AlertDescription>
            </Alert>
          ) : null}

          {deployingCount > 0 ? (
            <output className="coss-projects-notice">
              <Badge variant="info">In progress</Badge>
              <span>
                {pluralize(deployingCount, "project")} currently importing, building, or
                deploying.
              </span>
            </output>
          ) : null}

          {loadError ? (
            <Alert variant="error" role="alert">
              <AlertTitle>{messages.projectsUnavailable}</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <ConsoleLoadingState className="coss-stack-sm" label="Loading projects">
              <Skeleton
                style={{
                  height: 40,
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
              <Skeleton
                style={{
                  height: 48,
                }}
              />
            </ConsoleLoadingState>
          ) : null}

          {!loading && !loadError && filtered.length > 0 && view === "table" ? (
            <DataTable
              columns={[
                "Project",
                "Lifecycle",
                "Workloads",
                "Runtime",
                "Usage",
                "Actions",
              ]}
              rows={filtered}
              renderRow={(item) => (
                <ProjectRow key={item.project.id} item={item} messages={messages} />
              )}
            />
          ) : null}

          {!loading && !loadError && filtered.length > 0 && view === "cards" ? (
            <div className="coss-project-card-grid">
              {filtered.map((item) => (
                <Card key={item.project.id}>
                  <CardContent className="coss-project-card">
                    <div className="coss-row coss-row--between">
                      <Badge variant={badgeToneFromConsoleTone(item.lifecycle.tone)}>
                        {item.lifecycle.label}
                      </Badge>
                      <span className="coss-help">
                        {pluralize(item.project.serviceCount, "service")}
                      </span>
                    </div>
                    <div>
                      <strong>{item.project.name}</strong>
                      <p className="coss-card-description">
                        {pluralize(item.project.appCount, "app")} · {item.runtimeLabel}
                      </p>
                    </div>
                    <ProjectUsage project={item.project} messages={messages} />
                    <ProjectBadges project={item.project} />
                    <Button
                      render={<Link href={`/app/projects/${item.project.id}`} />}
                      variant="outline"
                      size="sm"
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {!loading && !loadError && filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {projects.length === 0
                    ? messages.noProjects
                    : messages.noProjectsMatch}
                </EmptyTitle>
                <EmptyDescription>
                  {projects.length === 0
                    ? messages.createProjectDescription
                    : messages.clearFilterDescription}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {<Button onClick={() => setDrawer(true)}>New project</Button>}
              </EmptyContent>
            </Empty>
          ) : null}
        </CardContent>
      </CardFrame>
      <ConsoleDrawer
        title="Create project"
        open={drawer}
        onClose={() => setDrawer(false)}
      >
        <div className="coss-stack">
          <Alert variant="info" role="status">
            <AlertTitle>{messages.creationFlowTitle}</AlertTitle>
            <AlertDescription>{messages.creationFlowDescription}</AlertDescription>
          </Alert>
          <Button render={<Link href="/new/repository" />}>Open creation wizard</Button>
        </div>
      </ConsoleDrawer>
    </>
  );
}

function ProjectBadges({ project }: { project: ConsoleGalleryProjectView }) {
  const badges = project.serviceBadges.slice(0, 4);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="coss-project-badges">
      <p className="coss-sr-only">Service badges</p>
      {badges.map((badge) => (
        <span key={badge.id} title={badge.meta}>
          {badge.label}
        </span>
      ))}
      {project.serviceBadges.length > badges.length ? (
        <span>+{project.serviceBadges.length - badges.length}</span>
      ) : null}
    </div>
  );
}

function ProjectUsage({
  compact = false,
  messages,
  project,
}: {
  compact?: boolean;
  messages: ProjectGalleryStateMessages;
  project: ConsoleGalleryProjectView;
}) {
  const items = project.resourceUsage
    .filter((item) => item.primaryLabel !== "No stats")
    .slice(0, compact ? 2 : 3);

  if (items.length === 0) {
    return <span className="coss-muted">{messages.noUsageStats}</span>;
  }

  return (
    <div
      className={`coss-project-usage${compact ? " coss-project-usage--compact" : ""}`}
    >
      <p className="coss-sr-only">Project resource usage</p>
      {items.map((item) => (
        <span key={item.id} title={item.title}>
          <span>{item.label}</span>
          <strong>{item.primaryLabel}</strong>
        </span>
      ))}
    </div>
  );
}

function ProjectRow({
  item,
  messages,
}: {
  item: ProjectListItem;
  messages: ProjectGalleryStateMessages;
}) {
  const { lifecycle, project, runtimeLabel } = item;

  return (
    <tr>
      <td>
        <div className="coss-project-cell">
          <div className="coss-project-primary">
            <Button
              render={<Link href={`/app/projects/${project.id}`} />}
              variant="ghost"
              size="sm"
              className="coss-project-name"
            >
              {project.name}
            </Button>
            <ProjectBadges project={project} />
          </div>
          <span className="coss-project-meta">
            {project.id} · {pluralize(project.appCount, "app")}
          </span>
        </div>
      </td>
      <td>
        <Badge variant={badgeToneFromConsoleTone(lifecycle.tone)}>
          {lifecycle.label}
        </Badge>
      </td>
      <td>{pluralize(project.serviceCount, "service")}</td>
      <td className="coss-mono">{runtimeLabel}</td>
      <td>
        <ProjectUsage project={project} compact messages={messages} />
      </td>
      <td className="coss-table__actions">
        <Button
          render={<Link href={`/app/projects/${project.id}`} />}
          variant="outline"
          size="sm"
        >
          Open
        </Button>
      </td>
    </tr>
  );
}

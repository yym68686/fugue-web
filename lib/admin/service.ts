import "server-only";

import { listAppUsers, type AppUserRecord } from "@/lib/app-users/store";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getFugueApps,
  getFugueProjects,
  getFugueTenants,
  type FugueApp,
  type FugueProject,
  type FugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { listWorkspaceSnapshots, type WorkspaceSnapshot } from "@/lib/workspace/store";

export type AdminClusterAppView = {
  canRebuild: boolean;
  id: string;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  projectLabel: string;
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
  sourceLabel: string;
  stack: Array<{
    id: string;
    kind: string;
    label: string;
    meta: string;
    title: string;
  }>;
  tenantLabel: string;
  updatedExact: string;
  updatedLabel: string;
};

export type AdminAppsPageData = {
  apps: AdminClusterAppView[];
  errors: string[];
  summary: {
    appCount: number;
    latestUpdateLabel: string;
    routedCount: number;
    tenantCount: number;
  };
};

export type AdminUserView = {
  canBlock: boolean;
  canDelete: boolean;
  canUnblock: boolean;
  email: string;
  isAdmin: boolean;
  lastLoginExact: string;
  lastLoginLabel: string;
  name: string;
  provider: string;
  serviceCount: number;
  status: AppUserRecord["status"];
  statusTone: ConsoleTone;
  tenantLabel: string;
  verified: boolean;
};

export type AdminUsersPageData = {
  errors: string[];
  summary: {
    adminCount: number;
    blockedCount: number;
    deletedCount: number;
    userCount: number;
  };
  users: AdminUserView[];
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.trunc(valueForUnit),
        unit,
      );
    }

    valueForUnit /= amount;
  }

  return "Just now";
}

function formatExactTime(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function humanize(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function shortId(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function readProviderLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "node":
    case "nodejs":
      return "Node.js";
    case "python":
      return "Python";
    case "go":
      return "Go";
    case "java":
      return "Java";
    case "ruby":
      return "Ruby";
    case "php":
      return "PHP";
    case "dotnet":
      return ".NET";
    case "rust":
      return "Rust";
    default:
      return null;
  }
}

function normalizeTechKind(value?: string | null) {
  return value?.trim().toLowerCase() || "stack";
}

function buildAppStack(app: FugueApp) {
  const seen = new Set<string>();
  const items: AdminClusterAppView["stack"] = [];

  const addItem = (
    kind: string | null | undefined,
    slug: string | null | undefined,
    label: string | null | undefined,
    source?: string | null,
  ) => {
    const normalizedKind = normalizeTechKind(kind);
    const normalizedSlug = slug?.trim().toLowerCase() || label?.trim().toLowerCase() || "";
    const normalizedLabel = label?.trim();

    if (!normalizedSlug || !normalizedLabel) {
      return;
    }

    const key = `${normalizedKind}:${normalizedSlug}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      id: key,
      kind: normalizedKind,
      label: normalizedLabel,
      meta: normalizedKind,
      title: source?.trim()
        ? `${normalizedLabel} / ${normalizedKind} / ${source.trim()}`
        : `${normalizedLabel} / ${normalizedKind}`,
    });
  };

  if (app.techStack.length) {
    for (const item of app.techStack) {
      addItem(item.kind, item.slug, item.name, item.source);
    }
  } else {
    addItem(
      "language",
      app.source.detectedProvider,
      app.source.detectedProvider
        ? (readProviderLabel(app.source.detectedProvider) ?? humanize(app.source.detectedProvider))
        : null,
      "fallback",
    );
    addItem(
      "build",
      app.source.buildStrategy,
      app.source.buildStrategy ? humanize(app.source.buildStrategy) : null,
      "fallback",
    );
    for (const service of app.backingServices) {
      addItem(
        "service",
        service.type,
        service.type ? humanize(service.type) : null,
        "fallback",
      );
    }
  }

  const techOrder = new Map<string, number>([
    ["language", 0],
    ["service", 1],
    ["build", 2],
  ]);
  const primary = items.filter(
    (item) => item.kind === "language" || item.kind === "service",
  );
  const visible = (primary.length ? primary : items).filter(
    (item) => item.kind !== "source",
  );

  return [...visible]
    .sort((left, right) => {
      const leftOrder = techOrder.get(left.kind) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = techOrder.get(right.kind) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, 4);
}

function toneForStatus(status?: string | null): ConsoleTone {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (normalized.includes("ready") || normalized.includes("active") || normalized.includes("running")) {
    return "positive";
  }

  if (normalized.includes("deploy") || normalized.includes("build") || normalized.includes("pending")) {
    return "info";
  }

  if (normalized.includes("disable") || normalized.includes("blocked")) {
    return "warning";
  }

  if (normalized.includes("delete") || normalized.includes("fail") || normalized.includes("error")) {
    return "danger";
  }

  return "neutral";
}

function formatRepoLabel(app: FugueApp) {
  const repoUrl = app.source.repoUrl?.trim();
  const branch = app.source.repoBranch?.trim();

  if (!repoUrl) {
    return humanize(app.source.type);
  }

  const compact = repoUrl
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");

  return branch ? `${compact} / ${branch}` : compact;
}

function readRouteInfo(app: FugueApp) {
  const publicUrl = app.route.publicUrl?.trim();

  if (publicUrl) {
    try {
      return {
        href: publicUrl,
        label: new URL(publicUrl).host,
      };
    } catch {
      return {
        href: null,
        label: publicUrl,
      };
    }
  }

  if (app.route.hostname) {
    return {
      href: null,
      label: app.route.hostname,
    };
  }

  return {
    href: null,
    label: "Unassigned",
  };
}

function mapAdminApps(
  apps: FugueApp[],
  projects: FugueProject[],
  tenants: FugueTenant[],
) {
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name] as const),
  );
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  return [...apps]
    .sort(
      (left, right) =>
        parseTimestamp(right.status.updatedAt ?? right.updatedAt ?? right.createdAt) -
        parseTimestamp(left.status.updatedAt ?? left.updatedAt ?? left.createdAt),
    )
    .map((app) => {
      const route = readRouteInfo(app);
      const phase = app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
      const runtimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;
      const updatedAt = app.status.updatedAt ?? app.updatedAt ?? app.createdAt;

      return {
        canRebuild: app.source.type === "github-public",
        id: app.id,
        name: app.name,
        phase,
        phaseTone: toneForStatus(phase),
        projectLabel: app.projectId ? projectNames.get(app.projectId) ?? shortId(app.projectId) : "Unassigned",
        routeHref: route.href,
        routeLabel: route.label,
        runtimeLabel: runtimeId ? shortId(runtimeId) : "Unassigned",
        sourceLabel: formatRepoLabel(app),
        stack: buildAppStack(app),
        tenantLabel: app.tenantId ? tenantNames.get(app.tenantId) ?? shortId(app.tenantId) : "Unknown",
        updatedExact: formatExactTime(updatedAt),
        updatedLabel: formatRelativeTime(updatedAt),
      } satisfies AdminClusterAppView;
    });
}

async function getClusterProjects(
  bootstrapKey: string,
  tenants: FugueTenant[],
) {
  if (!tenants.length) {
    return {
      errors: [],
      projects: [],
    } satisfies {
      errors: string[];
      projects: FugueProject[];
    };
  }

  const projectResults = await Promise.allSettled(
    tenants.map((tenant) => getFugueProjects(bootstrapKey, tenant.id)),
  );
  const projects: FugueProject[] = [];
  const errors: string[] = [];

  for (const [index, result] of projectResults.entries()) {
    const tenant = tenants[index];

    if (result.status === "fulfilled") {
      projects.push(...result.value);
      continue;
    }

    errors.push(
      `projects (${tenant?.name ?? tenant?.id ?? "unknown tenant"}): ${readErrorMessage(result.reason)}`,
    );
  }

  return {
    errors,
    projects,
  };
}

function buildUserViews(
  users: AppUserRecord[],
  workspaces: WorkspaceSnapshot[],
  apps: FugueApp[],
  tenants: FugueTenant[],
) {
  const workspaceByEmail = new Map(
    workspaces.map((workspace) => [workspace.email, workspace] as const),
  );
  const appCountByTenant = new Map<string, number>();
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  for (const app of apps) {
    if (!app.tenantId) {
      continue;
    }

    appCountByTenant.set(app.tenantId, (appCountByTenant.get(app.tenantId) ?? 0) + 1);
  }

  return users.map((user) => {
    const workspace = workspaceByEmail.get(user.email);
    const serviceCount =
      workspace?.tenantId ? (appCountByTenant.get(workspace.tenantId) ?? 0) : 0;

    return {
      canBlock: !user.isAdmin && user.status === "active",
      canDelete: !user.isAdmin && user.status !== "deleted",
      canUnblock: !user.isAdmin && user.status === "blocked",
      email: user.email,
      isAdmin: user.isAdmin,
      lastLoginExact: formatExactTime(user.lastLoginAt),
      lastLoginLabel: formatRelativeTime(user.lastLoginAt),
      name: user.name ?? user.email.split("@")[0] ?? user.email,
      provider: user.provider,
      serviceCount,
      status: user.status,
      statusTone: toneForStatus(user.status),
      tenantLabel:
        workspace?.tenantId
          ? tenantNames.get(workspace.tenantId) ?? workspace.tenantName ?? shortId(workspace.tenantId)
          : "No workspace",
      verified: user.verified,
    } satisfies AdminUserView;
  });
}

export async function getAdminAppsPageData(): Promise<AdminAppsPageData> {
  let bootstrapKey: string;

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    return {
      apps: [],
      errors: [readErrorMessage(error)],
      summary: {
        appCount: 0,
        latestUpdateLabel: "Not yet",
        routedCount: 0,
        tenantCount: 0,
      },
    };
  }

  const [tenantsResult, appsResult] = await Promise.allSettled([
    getFugueTenants(bootstrapKey),
    getFugueApps(bootstrapKey),
  ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    appsResult.status === "rejected"
      ? `apps: ${readErrorMessage(appsResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const projectData =
    tenantsResult.status === "fulfilled"
      ? await getClusterProjects(bootstrapKey, tenants)
      : { errors: [], projects: [] };
  const projects = projectData.projects;
  errors.push(...projectData.errors);
  const views = mapAdminApps(apps, projects, tenants);

  return {
    apps: views,
    errors,
    summary: {
      appCount: views.length,
      latestUpdateLabel: views[0]?.updatedLabel ?? "Not yet",
      routedCount: views.filter((app) => app.routeLabel !== "Unassigned").length,
      tenantCount: new Set(apps.map((app) => app.tenantId).filter(Boolean)).size,
    },
  };
}

export async function getAdminUsersPageData(): Promise<AdminUsersPageData> {
  const [usersResult, workspacesResult] = await Promise.allSettled([
    listAppUsers(),
    listWorkspaceSnapshots(),
  ]);

  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const workspaces = workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
  const errors = [
    usersResult.status === "rejected" ? `users: ${readErrorMessage(usersResult.reason)}` : null,
    workspacesResult.status === "rejected"
      ? `workspaces: ${readErrorMessage(workspacesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  let apps: FugueApp[] = [];
  let tenants: FugueTenant[] = [];

  try {
    const bootstrapKey = getFugueEnv().bootstrapKey;
    const [appsResult, tenantsResult] = await Promise.allSettled([
      getFugueApps(bootstrapKey),
      getFugueTenants(bootstrapKey),
    ]);

    if (appsResult.status === "fulfilled") {
      apps = appsResult.value;
    } else {
      errors.push(`apps: ${readErrorMessage(appsResult.reason)}`);
    }

    if (tenantsResult.status === "fulfilled") {
      tenants = tenantsResult.value;
    } else {
      errors.push(`tenants: ${readErrorMessage(tenantsResult.reason)}`);
    }
  } catch (error) {
    errors.push(readErrorMessage(error));
  }

  const views = buildUserViews(users, workspaces, apps, tenants);

  return {
    errors,
    summary: {
      adminCount: views.filter((user) => user.isAdmin).length,
      blockedCount: views.filter((user) => user.status === "blocked").length,
      deletedCount: views.filter((user) => user.status === "deleted").length,
      userCount: views.length,
    },
    users: views,
  };
}

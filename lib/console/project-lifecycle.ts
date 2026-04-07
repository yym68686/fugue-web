import type {
  ConsoleGalleryProjectView,
  ConsoleProjectLifecycleView,
} from "@/lib/console/gallery-types";
import { readProjectLifecycleTone } from "@/lib/console/project-lifecycle-tone";
import { isGitHubSourceType } from "@/lib/github/repository";

function includesLifecycleKeyword(
  value: string,
  keywords: readonly string[],
) {
  return keywords.some((keyword) => value.includes(keyword));
}

function isPausedLifecycleValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, ["disabled", "paused"])
  );
}

export function readConsoleProjectLifecycle(
  project: ConsoleGalleryProjectView,
): ConsoleProjectLifecycleView {
  const hasRunningApp = project.services.some(
    (service) => service.kind === "app" && service.serviceRole === "running",
  );
  const hasPendingApp = project.services.some(
    (service) => service.kind === "app" && service.serviceRole === "pending",
  );
  const tracksGitHubBranch = project.services.some(
    (service) =>
      service.kind === "app" && isGitHubSourceType(service.sourceType),
  );
  const statuses = project.services
    .map((service) => (service.kind === "app" ? service.phase : service.status))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["deleting"]))
  ) {
    return {
      label: "Deleting",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Deleting"),
    };
  }

  if (
    statuses.some((status) =>
      includesLifecycleKeyword(status, ["error", "fail", "stopped"]),
    )
  ) {
    return {
      label: "Error",
      live: false,
      syncMode: "passive",
      tone: readProjectLifecycleTone("Error"),
    };
  }

  if (hasRunningApp && hasPendingApp) {
    return {
      label: "Updating",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Updating"),
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["importing"]))
  ) {
    return {
      label: "Importing",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Importing"),
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["building"]))
  ) {
    return {
      label: "Building",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Building"),
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["deploying"]))
  ) {
    return {
      label: "Deploying",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Deploying"),
    };
  }

  if (
    statuses.some((status) =>
      includesLifecycleKeyword(status, ["queued", "pending", "migrating"]),
    )
  ) {
    return {
      label: "Queued",
      live: true,
      syncMode: "active",
      tone: readProjectLifecycleTone("Queued"),
    };
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => isPausedLifecycleValue(status))
  ) {
    return {
      label: "Paused",
      live: false,
      syncMode: "idle",
      tone: readProjectLifecycleTone("Paused"),
    };
  }

  if (project.appCount > 0) {
    return {
      label: "Running",
      live: false,
      syncMode: tracksGitHubBranch ? "passive" : "idle",
      tone: readProjectLifecycleTone("Running"),
    };
  }

  if (project.serviceCount > 0) {
    return {
      label: "Ready",
      live: false,
      syncMode: "idle",
      tone: readProjectLifecycleTone("Ready"),
    };
  }

  return {
    label: "Idle",
    live: false,
    syncMode: "idle",
    tone: readProjectLifecycleTone("Idle"),
  };
}

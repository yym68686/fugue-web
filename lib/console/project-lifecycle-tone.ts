import type { ConsoleTone } from "@/lib/console/types";

const PROJECT_LIFECYCLE_DANGER_KEYWORDS = [
  "deleting",
  "error",
  "fail",
  "stopped",
] as const;

const PROJECT_LIFECYCLE_WARNING_KEYWORDS = [
  "queued",
  "pending",
  "migrating",
  "paused",
  "disabled",
] as const;

const PROJECT_LIFECYCLE_INFO_KEYWORDS = [
  "updating",
  "importing",
  "building",
  "deploying",
  "starting",
  "creating",
  "provisioning",
] as const;

const PROJECT_LIFECYCLE_POSITIVE_KEYWORDS = [
  "running",
  "ready",
  "healthy",
  "active",
  "deployed",
  "completed",
  "live",
] as const;

function normalizeProjectLifecycleText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function includesProjectLifecycleKeyword(
  value: string,
  keywords: readonly string[],
) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function readProjectLifecycleTone(
  label?: string | null,
  fallbackTone?: string | null,
): ConsoleTone {
  const normalizedLabel = normalizeProjectLifecycleText(label);

  if (normalizedLabel) {
    if (
      includesProjectLifecycleKeyword(
        normalizedLabel,
        PROJECT_LIFECYCLE_DANGER_KEYWORDS,
      )
    ) {
      return "danger";
    }

    if (
      includesProjectLifecycleKeyword(
        normalizedLabel,
        PROJECT_LIFECYCLE_WARNING_KEYWORDS,
      )
    ) {
      return "warning";
    }

    if (
      includesProjectLifecycleKeyword(
        normalizedLabel,
        PROJECT_LIFECYCLE_INFO_KEYWORDS,
      )
    ) {
      return "info";
    }

    if (
      includesProjectLifecycleKeyword(
        normalizedLabel,
        PROJECT_LIFECYCLE_POSITIVE_KEYWORDS,
      )
    ) {
      return "positive";
    }
  }

  switch (normalizeProjectLifecycleText(fallbackTone)) {
    case "positive":
      return "positive";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

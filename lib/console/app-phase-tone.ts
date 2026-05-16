import type { ConsoleTone } from "@/lib/console/types";

export function toneForAppPhase(status?: string | null): ConsoleTone {
  const normalized = status?.toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("stopped") ||
    normalized.includes("deleting")
  ) {
    return "danger";
  }

  if (
    normalized.includes("queued") ||
    normalized.includes("pending") ||
    normalized.includes("migrating") ||
    normalized.includes("disabled")
  ) {
    return "warning";
  }

  if (
    normalized.includes("healthy") ||
    normalized.includes("active") ||
    normalized.includes("deployed") ||
    normalized.includes("completed") ||
    normalized.includes("migrated") ||
    normalized.includes("failed-over") ||
    normalized.includes("running")
  ) {
    return "positive";
  }

  if (
    normalized.includes("building") ||
    normalized.includes("deploying") ||
    normalized.includes("importing") ||
    normalized.includes("transferring") ||
    normalized.includes("failing-over")
  ) {
    return "info";
  }

  return "neutral";
}

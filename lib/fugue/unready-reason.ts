import type { ObservedUnreadyReason } from "@/lib/fugue/observed-status";
import type { TranslateFn } from "@/lib/i18n/translate";

function shortAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * Human copy for a readiness gap. Split from the component so the mapping is
 * testable without rendering, and kept exhaustive so a newly added reason kind
 * is a type error here rather than a blank line in the UI.
 */
export function unreadyReasonText(
  reason: ObservedUnreadyReason | null,
  t: TranslateFn,
): string {
  if (!reason) return "";
  switch (reason.kind) {
    case "no_evidence":
      return t("No runtime observation has been collected yet.");
    case "scaled_to_zero":
      return t("The app is scaled to zero replicas.");
    case "stale":
      return reason.ageMs > 0
        ? t("Runtime evidence is {age} old, past the freshness window.", {
            age: shortAge(reason.ageMs),
          })
        : t("Runtime evidence has not been refreshed recently enough.");
    case "violations":
      return t("Runtime invariants are violated: {violations}", {
        violations: reason.violations.join(", "),
      });
    case "converging":
      return t("A rollout is still converging on the desired spec.");
    case "phase":
      return t("The observed phase is {phase}, not deployed.", { phase: reason.phase });
    case "endpoint":
      return t("The endpoint has not been proven to be present and ready.");
    case "replicas":
      return t("Proven ready replicas: {ready} of {desired}.", {
        ready: reason.ready === null ? t("unknown") : String(reason.ready),
        desired: String(reason.desired),
      });
    case "image":
      return t("The deployed image could not be proven present.");
    case "unknown":
      return t("Runtime evidence is incomplete.");
  }
}

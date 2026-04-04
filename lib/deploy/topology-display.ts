import type { FugueGitHubTemplateInspection } from "@/lib/fugue/api";

export type DeployInspectionManifest = NonNullable<
  FugueGitHubTemplateInspection["fugueManifest"]
>;
export type DeployInspectionManifestService =
  DeployInspectionManifest["services"][number];

function uniqueStrings(values: readonly string[]) {
  return [
    ...new Set(
      values.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function humanizeDeployValue(value?: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function pluralize(
  value: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function readInferenceTone(level?: string | null) {
  switch ((level ?? "").trim().toLowerCase()) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

export function readManifestBindingTargets(
  service: DeployInspectionManifestService,
) {
  return uniqueStrings(service.bindingTargets ?? []);
}

export function describeManifestServiceRole(
  service: DeployInspectionManifestService,
) {
  return humanizeDeployValue(service.serviceType || service.kind);
}

export function describeManifestBuild(
  service: DeployInspectionManifestService,
) {
  const parts = [
    service.buildStrategy?.trim()
      ? humanizeDeployValue(service.buildStrategy)
      : "Auto detect",
  ];

  if (service.sourceDir?.trim()) {
    parts.push(service.sourceDir.trim());
  }
  if (service.dockerfilePath?.trim()) {
    parts.push(service.dockerfilePath.trim());
  }
  if (service.buildContextDir?.trim()) {
    parts.push(`context ${service.buildContextDir.trim()}`);
  }

  return parts.join(" / ");
}

export function summarizeInspectManifest(
  manifest?: DeployInspectionManifest | null,
) {
  const services = manifest?.services ?? [];
  const warnings = manifest?.warnings ?? [];
  const inferenceReport = manifest?.inferenceReport ?? [];
  const backingServices = services.filter((service) => service.backingService);
  const servicesWithBindings = services.filter(
    (service) => readManifestBindingTargets(service).length > 0,
  );
  const bindingEdgeCount = services.reduce(
    (total, service) => total + readManifestBindingTargets(service).length,
    0,
  );

  return {
    backingServiceCount: backingServices.length,
    bindingEdgeCount,
    inferenceReport,
    serviceCount: services.length,
    services,
    servicesWithBindings,
    warnings,
  };
}

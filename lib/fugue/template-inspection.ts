import type { FugueGitHubTemplateInspection } from "@/lib/fugue/api";

type InspectServiceLike = {
  persistentStorageSeedFiles?: Array<{
    path?: string | null;
    seedContent?: string | null;
  }> | null;
  service?: string | null;
};

export type InspectionPersistentStorageSeedField = {
  key: string;
  path: string;
  seedContent: string;
  service: string;
};

function readInspectionServices(
  inspection: FugueGitHubTemplateInspection | null,
): InspectServiceLike[] {
  return [
    ...(inspection?.fugueManifest?.services ?? []),
    ...(inspection?.composeStack?.services ?? []),
  ];
}

export function buildPersistentStorageSeedFileKey(
  service: string,
  path: string,
) {
  return `${service.trim()}::${path.trim()}`;
}

export function readInspectionPersistentStorageSeedFiles(
  inspection: FugueGitHubTemplateInspection | null,
) {
  const filesByKey = new Map<string, InspectionPersistentStorageSeedField>();

  for (const service of readInspectionServices(inspection)) {
    const serviceName = service.service?.trim();

    if (!serviceName) {
      continue;
    }

    for (const file of service.persistentStorageSeedFiles ?? []) {
      const path = file.path?.trim();

      if (!path) {
        continue;
      }

      const key = buildPersistentStorageSeedFileKey(serviceName, path);

      filesByKey.set(key, {
        key,
        path,
        seedContent: file.seedContent ?? "",
        service: serviceName,
      });
    }
  }

  return Array.from(filesByKey.values());
}

export function collectInspectionPersistentStorageSeedFileKeys(
  inspection: FugueGitHubTemplateInspection | null,
) {
  return new Set(
    readInspectionPersistentStorageSeedFiles(inspection).map((file) => file.key),
  );
}

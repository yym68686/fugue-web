import type {
  ConsoleCompactResourceItemView,
  ConsoleProjectResourceUsageSnapshot,
} from "@/lib/console/gallery-types";

type ProjectImageUsageSummaryLike = {
  reclaimableSizeBytes: number;
  totalSizeBytes: number;
  versionCount: number;
};

type ProjectResourceUsageTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatBytesLabel(
  value?: number | null,
  t?: ProjectResourceUsageTranslator,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return t ? t("No stats") : "No stats";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const digits = amount >= 100 || unitIndex === 0 ? 0 : 1;

  if (unitIndex === 0) {
    const rounded = Math.round(amount);
    if (t) {
      return t(rounded === 1 ? "{count} byte" : "{count} bytes", {
        count: rounded,
      });
    }
    return `${rounded} ${rounded === 1 ? "byte" : "bytes"}`;
  }

  return `${formatCompactNumber(amount, digits)} ${units[unitIndex]}`;
}

function formatCPUMillicoresLabel(
  value?: number | null,
  t?: ProjectResourceUsageTranslator,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return t ? t("No stats") : "No stats";
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    const count = formatCompactNumber(cores, 1);
    if (t) {
      return t(cores === 1 ? "{count} core" : "{count} cores", { count });
    }
    return `${count} ${cores === 1 ? "core" : "cores"}`;
  }

  const count = Math.round(value);
  return t ? t("{count} millicores", { count }) : `${count} millicores`;
}

function formatVersionCountLabel(
  value: number,
  t?: ProjectResourceUsageTranslator,
) {
  if (t) {
    return t(value === 1 ? "{count} version" : "{count} versions", {
      count: value,
    });
  }
  return `${value} version${value === 1 ? "" : "s"}`;
}

export function buildProjectResourceUsageView(
  usage: ConsoleProjectResourceUsageSnapshot,
  imageUsage?: ProjectImageUsageSummaryLike | null,
  t?: ProjectResourceUsageTranslator,
): ConsoleCompactResourceItemView[] {
  const imageTotalBytes =
    imageUsage && imageUsage.versionCount > 0 ? imageUsage.totalSizeBytes : null;
  const hasImageUsage = imageTotalBytes !== null;
  const imageSecondaryLabel =
    hasImageUsage && imageUsage
      ? formatVersionCountLabel(imageUsage.versionCount, t)
      : null;
  const computeLabel = t ? t("Compute") : "Compute";
  const memoryLabel = t ? t("Memory") : "Memory";
  const diskLabel = t ? t("Disk") : "Disk";
  const imagesLabel = t ? t("Images") : "Images";
  const currentProjectTotalLabel = t
    ? t("Current project total")
    : "Current project total";
  const liveRuntimeOnlyLabel = t
    ? t("Live service runtime only")
    : "Live service runtime only";
  const imageTitleParts = hasImageUsage
    ? [
        `${t ? t("Image storage") : "Image storage"} / ${formatBytesLabel(imageTotalBytes, t)} / ${
          t ? t("Stored project images") : "Stored project images"
        }`,
        imageUsage ? formatVersionCountLabel(imageUsage.versionCount, t) : null,
      ].filter((value): value is string => Boolean(value))
    : [];
  const cpuPrimaryLabel = formatCPUMillicoresLabel(usage.cpuMillicores, t);
  const memoryPrimaryLabel = formatBytesLabel(usage.memoryBytes, t);
  const diskPrimaryLabel = formatBytesLabel(usage.ephemeralStorageBytes, t);

  return [
    {
      id: "cpu",
      label: computeLabel,
      meterValue: null,
      primaryLabel: cpuPrimaryLabel,
      secondaryLabel: null,
      title: `${computeLabel} / ${cpuPrimaryLabel} / ${currentProjectTotalLabel}`,
      tone: usage.cpuMillicores !== null ? "info" : "neutral",
    },
    {
      id: "memory",
      label: memoryLabel,
      meterValue: null,
      primaryLabel: memoryPrimaryLabel,
      secondaryLabel: null,
      title: `${memoryLabel} / ${memoryPrimaryLabel} / ${currentProjectTotalLabel}`,
      tone: usage.memoryBytes !== null ? "info" : "neutral",
    },
    {
      id: "storage",
      label: diskLabel,
      meterValue: null,
      primaryLabel: diskPrimaryLabel,
      secondaryLabel: null,
      title: `${diskLabel} / ${diskPrimaryLabel} / ${liveRuntimeOnlyLabel}`,
      tone: usage.ephemeralStorageBytes !== null ? "info" : "neutral",
    },
    ...(hasImageUsage
      ? [
          {
            id: "images",
            label: imagesLabel,
            meterValue: null,
            primaryLabel: formatBytesLabel(imageTotalBytes, t),
            secondaryLabel: imageSecondaryLabel,
            title: imageTitleParts.join(" / "),
            tone: "info" as const,
          },
        ]
      : []),
  ];
}

import type {
  ConsoleCompactResourceItemView,
  ConsoleProjectResourceUsageSnapshot,
} from "@/lib/console/gallery-types";

type ProjectImageUsageSummaryLike = {
  reclaimableSizeBytes: number;
  totalSizeBytes: number;
  versionCount: number;
};

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatBytesLabel(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "No stats";
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
    return `${rounded} ${rounded === 1 ? "byte" : "bytes"}`;
  }

  return `${formatCompactNumber(amount, digits)} ${units[unitIndex]}`;
}

function formatCPUMillicoresLabel(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "No stats";
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    return `${formatCompactNumber(cores, 1)} ${cores === 1 ? "core" : "cores"}`;
  }

  return `${Math.round(value)} millicores`;
}

function formatVersionCountLabel(value: number) {
  return `${value} version${value === 1 ? "" : "s"}`;
}

export function buildProjectResourceUsageView(
  usage: ConsoleProjectResourceUsageSnapshot,
  imageUsage?: ProjectImageUsageSummaryLike | null,
): ConsoleCompactResourceItemView[] {
  const imageTotalBytes =
    imageUsage && imageUsage.versionCount > 0 ? imageUsage.totalSizeBytes : null;
  const hasImageUsage = imageTotalBytes !== null;
  const imageSecondaryLabel =
    hasImageUsage && imageUsage
      ? formatVersionCountLabel(imageUsage.versionCount)
      : null;
  const imageTitleParts = hasImageUsage
    ? [
        `Image storage / ${formatBytesLabel(imageTotalBytes)} / Stored project images`,
        imageUsage ? formatVersionCountLabel(imageUsage.versionCount) : null,
      ].filter((value): value is string => Boolean(value))
    : [];

  return [
    {
      id: "cpu",
      label: "Compute",
      meterValue: null,
      primaryLabel: formatCPUMillicoresLabel(usage.cpuMillicores),
      secondaryLabel: null,
      title: `Compute / ${formatCPUMillicoresLabel(usage.cpuMillicores)} / Current project total`,
      tone: usage.cpuMillicores !== null ? "info" : "neutral",
    },
    {
      id: "memory",
      label: "Memory",
      meterValue: null,
      primaryLabel: formatBytesLabel(usage.memoryBytes),
      secondaryLabel: null,
      title: `Memory / ${formatBytesLabel(usage.memoryBytes)} / Current project total`,
      tone: usage.memoryBytes !== null ? "info" : "neutral",
    },
    {
      id: "storage",
      label: "Disk",
      meterValue: null,
      primaryLabel: formatBytesLabel(usage.ephemeralStorageBytes),
      secondaryLabel: null,
      title: `Disk / ${formatBytesLabel(usage.ephemeralStorageBytes)} / Live service runtime only`,
      tone: usage.ephemeralStorageBytes !== null ? "info" : "neutral",
    },
    ...(hasImageUsage
      ? [
          {
            id: "images",
            label: "Images",
            meterValue: null,
            primaryLabel: formatBytesLabel(imageTotalBytes),
            secondaryLabel: imageSecondaryLabel,
            title: imageTitleParts.join(" / "),
            tone: "info" as const,
          },
        ]
      : []),
  ];
}

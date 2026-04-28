"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import { cx } from "@/lib/ui/cx";

function readMeterWidth(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function readLocalizedResourceLabel(
  item: ConsoleCompactResourceItemView,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (item.id === "cpu") {
    return t("CPU");
  }

  return t(item.label);
}

function readLocalizedResourceValue(
  value: string | null,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!value) {
    return value;
  }

  if (value === "No stats" || value === "No images") {
    return t(value);
  }

  const versionMatch = value.match(/^(\d+) version(s)?$/);

  if (versionMatch) {
    const count = Number.parseInt(versionMatch[1] ?? "", 10);

    if (Number.isFinite(count)) {
      return t(count === 1 ? "{count} version" : "{count} versions", {
        count,
      });
    }
  }

  return value;
}

export function CompactResourceMeter({
  item,
  showLabel = true,
}: {
  item: ConsoleCompactResourceItemView;
  showLabel?: boolean;
}) {
  const { t } = useI18n();
  const showMeter = item.meterValue !== null && item.meterValue !== undefined;
  const label = readLocalizedResourceLabel(item, t);
  const primaryLabel = readLocalizedResourceValue(item.primaryLabel, t) ?? item.primaryLabel;
  const secondaryLabel = readLocalizedResourceValue(item.secondaryLabel, t);

  return (
    <article
      className={cx(
        "fg-cluster-resource",
        "fg-cluster-resource--compact",
        !showMeter && "fg-cluster-resource--compact-static",
      )}
      title={item.title}
    >
      <span
        className={cx(
          "fg-cluster-resource__label",
          !showLabel && "fg-cluster-resource__label--sr-only",
        )}
      >
        {label}
      </span>
      <div className="fg-cluster-resource__compact-values">
        <strong>{primaryLabel}</strong>
        {secondaryLabel ? <span>{secondaryLabel}</span> : null}
      </div>

      {showMeter ? (
        <div aria-label={item.title} className="fg-cluster-resource__meter" role="img">
          <span
            className={cx(
              "fg-cluster-resource__fill",
              `fg-cluster-resource__fill--${item.tone}`,
            )}
            style={{ width: `${readMeterWidth(item.meterValue)}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

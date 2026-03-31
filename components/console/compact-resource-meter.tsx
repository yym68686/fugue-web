import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import { cx } from "@/lib/ui/cx";

function readMeterWidth(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function CompactResourceMeter({
  item,
}: {
  item: ConsoleCompactResourceItemView;
}) {
  const showMeter = item.meterValue !== null && item.meterValue !== undefined;

  return (
    <article
      className={cx(
        "fg-cluster-resource",
        "fg-cluster-resource--compact",
        !showMeter && "fg-cluster-resource--compact-static",
      )}
      title={item.title}
    >
      <span className="fg-cluster-resource__label">{item.label}</span>
      <div className="fg-cluster-resource__compact-values">
        <strong>{item.primaryLabel}</strong>
        {item.secondaryLabel ? <span>{item.secondaryLabel}</span> : null}
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

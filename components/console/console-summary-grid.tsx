import {
  PlatformMetric,
  PlatformMetricGrid,
} from "@/components/platform/platform-data";

type ConsoleSummaryItem = {
  label: string;
  value: number | string;
};

export function ConsoleSummaryGrid({
  ariaLabel = "Summary",
  items,
}: {
  ariaLabel?: string;
  items: ConsoleSummaryItem[];
}) {
  return (
    <PlatformMetricGrid aria-label={ariaLabel} className="fg-console-metric-grid">
      {items.map((item) => {
        const value = String(item.value);

        return (
          <PlatformMetric key={item.label} label={item.label} value={value} />
        );
      })}
    </PlatformMetricGrid>
  );
}

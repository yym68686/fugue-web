import {
  PlatformMetric,
  PlatformMetricGrid,
} from "@/components/platform/platform-data";
import { useI18n } from "@/components/providers/i18n-provider";

type AdminSummaryItem = {
  label: string;
  value: number | string;
};

export function AdminSummaryGrid({
  items,
}: {
  items: AdminSummaryItem[];
}) {
  const { t } = useI18n();

  return (
    <PlatformMetricGrid
      aria-label={t("Admin summary")}
      className="fg-console-metric-grid"
    >
      {items.map((item) => {
        const value = String(item.value);

        return (
          <PlatformMetric key={item.label} label={t(item.label)} value={value} />
        );
      })}
    </PlatformMetricGrid>
  );
}

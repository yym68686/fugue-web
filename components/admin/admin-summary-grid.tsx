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
    <section className="fg-console-metric-grid" aria-label={t("Admin summary")}>
      {items.map((item) => {
        const value = String(item.value);
        const compact = value.length > 12;

        return (
          <article className="fg-console-metric-card fg-admin-summary-card" key={item.label}>
            <span className="fg-admin-summary-card__label">{t(item.label)}</span>
            <strong
              className={`fg-console-metric-card__value fg-admin-summary-card__value${
                compact ? " is-compact" : ""
              }`}
            >
              {value}
            </strong>
          </article>
        );
      })}
    </section>
  );
}

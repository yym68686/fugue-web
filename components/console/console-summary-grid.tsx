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
    <section className="fg-console-metric-grid" aria-label={ariaLabel}>
      {items.map((item) => {
        const value = String(item.value);
        const compact = value.length > 12;

        return (
          <article className="fg-console-metric-card fg-admin-summary-card" key={item.label}>
            <span className="fg-admin-summary-card__label">{item.label}</span>
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

import { Panel, PanelSection } from "@/components/ui/panel";
import { cx } from "@/lib/ui/cx";

const RAIL_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const LIST_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const TABLE_ROWS = Array.from({ length: 5 }, (_, index) => index);

function SkeletonBlock({ className }: { className?: string }) {
  return <span className={cx("fg-console-skeleton__block", className)} />;
}

export function ConsolePageSkeleton() {
  return (
    <div aria-hidden="true" className="fg-console-page fg-console-skeleton">
      <section className="fg-console-page-intro fg-console-skeleton__intro">
        <div className="fg-console-page-intro__copy">
          <SkeletonBlock className="fg-console-skeleton__eyebrow" />
          <SkeletonBlock className="fg-console-skeleton__page-title" />
          <SkeletonBlock className="fg-console-skeleton__copy is-wide" />
          <SkeletonBlock className="fg-console-skeleton__copy" />
        </div>

        <div className="fg-console-page-intro__actions">
          <SkeletonBlock className="fg-console-skeleton__pill" />
          <SkeletonBlock className="fg-console-skeleton__pill fg-console-skeleton__pill--primary" />
        </div>
      </section>

      <section className="fg-console-board fg-console-skeleton__board">
        <Panel>
          <PanelSection className="fg-console-skeleton__section">
            <div className="fg-console-skeleton__section-head">
              <SkeletonBlock className="fg-console-skeleton__section-label" />
              <SkeletonBlock className="fg-console-skeleton__badge" />
            </div>
            <SkeletonBlock className="fg-console-skeleton__section-title" />
            <SkeletonBlock className="fg-console-skeleton__copy is-wide" />
          </PanelSection>

          <PanelSection className="fg-console-skeleton__section">
            <div className="fg-console-skeleton__stack">
              {LIST_ITEMS.map((item) => (
                <div className="fg-console-skeleton__list-item" key={`list-${item}`}>
                  <div className="fg-console-skeleton__list-copy">
                    <SkeletonBlock className="fg-console-skeleton__item-title" />
                    <SkeletonBlock className="fg-console-skeleton__item-meta" />
                  </div>
                  <SkeletonBlock className="fg-console-skeleton__chip" />
                </div>
              ))}
            </div>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection className="fg-console-skeleton__section">
            <div className="fg-console-skeleton__section-head">
              <SkeletonBlock className="fg-console-skeleton__section-label" />
              <SkeletonBlock className="fg-console-skeleton__badge" />
            </div>
            <SkeletonBlock className="fg-console-skeleton__section-title is-medium" />
            <SkeletonBlock className="fg-console-skeleton__copy is-wide" />
          </PanelSection>

          <PanelSection className="fg-console-skeleton__section">
            <div className="fg-console-skeleton__workbench">
              <div className="fg-console-skeleton__workbench-rail">
                {RAIL_ITEMS.map((item) => (
                  <SkeletonBlock className="fg-console-skeleton__rail-pill" key={`rail-${item}`} />
                ))}
              </div>

              <div className="fg-console-skeleton__workbench-main">
                <SkeletonBlock className="fg-console-skeleton__code-line is-strong" />
                <SkeletonBlock className="fg-console-skeleton__code-line" />
                <SkeletonBlock className="fg-console-skeleton__code-line is-short" />
                <SkeletonBlock className="fg-console-skeleton__terminal" />
              </div>
            </div>
          </PanelSection>
        </Panel>
      </section>

      <Panel>
        <PanelSection className="fg-console-skeleton__section">
          <div className="fg-console-skeleton__section-head">
            <SkeletonBlock className="fg-console-skeleton__section-label" />
            <SkeletonBlock className="fg-console-skeleton__badge" />
          </div>
          <SkeletonBlock className="fg-console-skeleton__section-title" />
          <SkeletonBlock className="fg-console-skeleton__copy is-wide" />
        </PanelSection>

        <PanelSection className="fg-console-skeleton__section">
          <div className="fg-console-skeleton__table">
            <div className="fg-console-skeleton__table-head">
              {LIST_ITEMS.map((item) => (
                <SkeletonBlock className="fg-console-skeleton__table-label" key={`head-${item}`} />
              ))}
            </div>

            {TABLE_ROWS.map((row) => (
              <div className="fg-console-skeleton__table-row" key={`row-${row}`}>
                <div className="fg-console-skeleton__table-main">
                  <SkeletonBlock className="fg-console-skeleton__item-title" />
                  <SkeletonBlock className="fg-console-skeleton__item-meta" />
                </div>
                <SkeletonBlock className="fg-console-skeleton__table-chip" />
                <SkeletonBlock className="fg-console-skeleton__table-cell" />
                <SkeletonBlock className="fg-console-skeleton__table-cell is-wide" />
              </div>
            ))}
          </div>
        </PanelSection>
      </Panel>
    </div>
  );
}

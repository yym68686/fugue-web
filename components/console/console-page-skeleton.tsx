import type { CSSProperties, ReactNode } from "react";

import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { cx } from "@/lib/ui/cx";

const METRIC_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const TABLE_ROWS = Array.from({ length: 4 }, (_, index) => index);
const PROJECT_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const SERVICE_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const API_KEY_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const PERMISSION_ITEMS = Array.from({ length: 6 }, (_, index) => index);
const RESOURCE_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const FACT_ITEMS = Array.from({ length: 6 }, (_, index) => index);
const CONDITION_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const WORKLOAD_ITEMS = Array.from({ length: 3 }, (_, index) => index);

function SkeletonBlock({
  className,
  height,
  radius,
  width,
}: {
  className?: string;
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  width?: CSSProperties["width"];
}) {
  return (
    <span
      className={cx("fg-console-skeleton__block", className)}
      style={{
        borderRadius: radius,
        height,
        width,
      }}
    />
  );
}

function ConsoleSkeletonPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cx("fg-console-page", "fg-console-skeleton", className)}>
      {children}
    </div>
  );
}

export function ConsoleLoadingState({
  children,
  label = "Loading console page",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} className="fg-console-loading" role="status">
      {children}
    </div>
  );
}

function PageIntroSkeleton({
  actions = [],
  copyWidths = ["29rem", "23rem"],
  eyebrowWidth = "6.5rem",
  titleWidth = "18rem",
}: {
  actions?: string[];
  copyWidths?: string[];
  eyebrowWidth?: string;
  titleWidth?: string;
}) {
  return (
    <section className="fg-console-page-intro fg-console-skeleton__intro">
      <div className="fg-console-page-intro__copy">
        <SkeletonBlock className="fg-console-skeleton__eyebrow" width={eyebrowWidth} />
        <SkeletonBlock className="fg-console-skeleton__page-title" width={titleWidth} />
        {copyWidths.map((width) => (
          <SkeletonBlock
            className={cx("fg-console-skeleton__copy", width === copyWidths[0] && "is-wide")}
            key={width}
            width={width}
          />
        ))}
      </div>

      {actions.length ? (
        <div className="fg-console-page-intro__actions">
          {actions.map((width, index) => (
            <SkeletonBlock
              className={cx(
                "fg-console-skeleton__pill",
                index === actions.length - 1 && "fg-console-skeleton__pill--primary",
              )}
              key={`${width}-${index}`}
              width={width}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SummaryGridSkeleton() {
  return (
    <section aria-hidden="true" className="fg-console-metric-grid">
      {METRIC_ITEMS.map((item) => (
        <article className="fg-console-metric-card fg-admin-summary-card" key={`metric-${item}`}>
          <SkeletonBlock className="fg-console-skeleton__metric-label" width="5rem" />
          <SkeletonBlock className="fg-console-skeleton__metric-value" width={item === 3 ? "9rem" : "5.75rem"} />
        </article>
      ))}
    </section>
  );
}

function MetadataPairSkeleton({
  labelWidth = "5rem",
  valueWidth = "8rem",
}: {
  labelWidth?: string;
  valueWidth?: string;
}) {
  return (
    <div>
      <dt>
        <SkeletonBlock className="fg-console-skeleton__section-label" width={labelWidth} />
      </dt>
      <dd>
        <SkeletonBlock className="fg-console-skeleton__item-title" width={valueWidth} />
      </dd>
    </div>
  );
}

function SectionHeaderSkeleton({
  copyWidth = "20rem",
  titleWidth = "12rem",
}: {
  copyWidth?: string;
  titleWidth?: string;
}) {
  return (
    <PanelSection>
      <SkeletonBlock className="fg-console-skeleton__eyebrow" width="6rem" />
      <PanelTitle>
        <SkeletonBlock className="fg-console-skeleton__section-title" width={titleWidth} />
      </PanelTitle>
      <PanelCopy>
        <SkeletonBlock className="fg-console-skeleton__copy is-wide" width={copyWidth} />
      </PanelCopy>
    </PanelSection>
  );
}

function TableActionSkeleton({ width = "4.75rem" }: { width?: string }) {
  return <SkeletonBlock className="fg-console-skeleton__chip" width={width} />;
}

function ProjectServiceCardSkeleton({ active = false }: { active?: boolean }) {
  return (
    <li>
      <div className={cx("fg-project-service-card", active && "is-active")}>
        <div className="fg-project-service-card__head">
          <div className="fg-project-service-card__title-row">
            <div className="fg-project-service-card__summary">
              <span className="fg-project-service-card__primary-badge">
                <SkeletonBlock className="fg-console-skeleton__chip" width="4.6rem" />
              </span>
              <div className="fg-project-service-card__identity">
                <SkeletonBlock className="fg-console-skeleton__item-title" width="7.75rem" />
              </div>
            </div>

            <div className="fg-project-service-card__status">
              <SkeletonBlock className="fg-console-skeleton__badge" width="4.4rem" />
              <SkeletonBlock className="fg-console-skeleton__item-meta" width="4.8rem" />
            </div>
          </div>

          <div className="fg-project-service-card__meta">
            <SkeletonBlock className="fg-console-skeleton__item-meta" width="8.5rem" />
            <SkeletonBlock className="fg-console-skeleton__item-meta" width="6.75rem" />
          </div>
        </div>
      </div>
    </li>
  );
}

function ClusterResourceSkeleton({
  compact = false,
  showMeter = true,
  showLabel = true,
  showSecondary = true,
}: {
  compact?: boolean;
  showMeter?: boolean;
  showLabel?: boolean;
  showSecondary?: boolean;
}) {
  return (
    <article
      className={cx(
        "fg-cluster-resource",
        compact && "fg-cluster-resource--compact",
        compact && !showMeter && "fg-cluster-resource--compact-static",
      )}
    >
      {compact ? (
        <>
          {showLabel ? (
            <SkeletonBlock className="fg-console-skeleton__section-label" width="2.4rem" />
          ) : null}
          <div className="fg-cluster-resource__compact-values">
            <SkeletonBlock className="fg-console-skeleton__item-title" width="3.5rem" />
            {showSecondary ? (
              <SkeletonBlock className="fg-console-skeleton__item-meta" width="3rem" />
            ) : null}
          </div>
        </>
      ) : (
        <div className="fg-cluster-resource__head">
          <div className="fg-cluster-resource__copy">
            <SkeletonBlock className="fg-console-skeleton__section-label" width="3rem" />
            <SkeletonBlock className="fg-console-skeleton__item-title" width="4rem" />
          </div>
          <SkeletonBlock className="fg-console-skeleton__badge" width="4rem" />
        </div>
      )}

      {showMeter ? (
        <div className="fg-cluster-resource__meter">
          <SkeletonBlock
            className="fg-console-skeleton__meter"
            height="100%"
            radius="inherit"
            width={compact ? "58%" : "64%"}
          />
        </div>
      ) : null}

      {compact ? null : (
        <>
          <div className="fg-cluster-resource__meta">
            <SkeletonBlock className="fg-console-skeleton__item-meta" width="4.5rem" />
            <SkeletonBlock className="fg-console-skeleton__item-meta" width="3.75rem" />
          </div>
          <SkeletonBlock className="fg-console-skeleton__copy" width="9rem" />
        </>
      )}
    </article>
  );
}

function ClusterGallerySkeleton({ includeInventoryHead = false }: { includeInventoryHead?: boolean }) {
  return (
    <>
      {includeInventoryHead ? (
        <div className="fg-credential-section__head">
          <div className="fg-credential-section__copy">
            <SkeletonBlock className="fg-console-skeleton__section-title" width="9rem" />
            <SkeletonBlock className="fg-console-skeleton__copy" width="16rem" />
          </div>
        </div>
      ) : null}

      <div className="fg-project-gallery fg-cluster-gallery">
        <section aria-hidden="true" className="fg-project-gallery__shelf">
          <div className="fg-project-gallery__stack">
            {[0, 1].map((item) => {
              const expanded = item === 0;

              return (
                <article
                  className={cx(
                    "fg-project-card",
                    "fg-cluster-node-card",
                    expanded && "is-active",
                    expanded && "is-expanded",
                  )}
                  key={`cluster-${item}`}
                >
                  <div className="fg-project-card__summary fg-cluster-node-card__summary">
                    <div className="fg-cluster-node-card__summary-head">
                      <div className="fg-project-card__summary-copy fg-cluster-node-card__summary-copy">
                        <SkeletonBlock className="fg-console-skeleton__eyebrow" width="4.8rem" />
                        <SkeletonBlock className="fg-console-skeleton__item-title" width="9rem" />
                        <SkeletonBlock className="fg-console-skeleton__item-meta" width="10.5rem" />
                        <SkeletonBlock className="fg-console-skeleton__item-meta" width="7rem" />
                      </div>

                      <div className="fg-cluster-node-card__summary-resources">
                        {RESOURCE_ITEMS.map((resource) => (
                          <ClusterResourceSkeleton compact key={`cluster-summary-resource-${resource}`} />
                        ))}
                      </div>

                      <div className="fg-project-card__summary-side fg-cluster-node-card__summary-side">
                        <SkeletonBlock className="fg-console-skeleton__badge" width="4.25rem" />
                        <SkeletonBlock className="fg-console-skeleton__badge" width="4.8rem" />
                        <SkeletonBlock className="fg-console-skeleton__icon-button" />
                      </div>
                    </div>

                    <div className="fg-console-tech-list fg-cluster-node-card__summary-roles">
                      {["4.75rem", "4rem", "4.5rem"].map((width) => (
                        <SkeletonBlock className="fg-console-skeleton__chip" key={width} width={width} />
                      ))}
                    </div>
                  </div>

                  {expanded ? (
                    <div className="fg-project-card__detail fg-cluster-node-card__detail">
                      <PanelSection>
                        <dl className="fg-cluster-node-facts">
                          {FACT_ITEMS.map((fact) => (
                            <MetadataPairSkeleton
                              key={`fact-${fact}`}
                              labelWidth="4.5rem"
                              valueWidth={fact % 3 === 0 ? "7.5rem" : "5.75rem"}
                            />
                          ))}
                        </dl>
                      </PanelSection>

                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <SkeletonBlock className="fg-console-skeleton__section-title" width="8rem" />
                            <SkeletonBlock className="fg-console-skeleton__copy" width="12rem" />
                          </div>
                        </div>

                        <div className="fg-cluster-condition-grid">
                          {CONDITION_ITEMS.map((condition) => (
                            <article className="fg-cluster-condition" key={`condition-${condition}`}>
                              <div className="fg-cluster-condition__head">
                                <SkeletonBlock className="fg-console-skeleton__item-title" width="5rem" />
                                <SkeletonBlock className="fg-console-skeleton__badge" width="4.2rem" />
                              </div>
                              <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="10rem" />
                              <SkeletonBlock className="fg-console-skeleton__item-meta" width="5.75rem" />
                            </article>
                          ))}
                        </div>
                      </PanelSection>

                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <SkeletonBlock className="fg-console-skeleton__section-title" width="7rem" />
                            <SkeletonBlock className="fg-console-skeleton__copy" width="11rem" />
                          </div>
                        </div>

                        <div className="fg-cluster-resource-grid">
                          {RESOURCE_ITEMS.map((resource) => (
                            <ClusterResourceSkeleton key={`cluster-resource-${resource}`} />
                          ))}
                        </div>
                      </PanelSection>

                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <SkeletonBlock className="fg-console-skeleton__section-title" width="7rem" />
                            <SkeletonBlock className="fg-console-skeleton__copy" width="11rem" />
                          </div>
                        </div>

                        <ul className="fg-cluster-workload-list">
                          {WORKLOAD_ITEMS.map((workload) => (
                            <li key={`workload-${workload}`}>
                              <article className="fg-cluster-workload">
                                <div className="fg-cluster-workload__head">
                                  <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
                                  <SkeletonBlock className="fg-console-skeleton__badge" width="4rem" />
                                </div>
                                <SkeletonBlock className="fg-console-skeleton__item-meta" width="5rem" />
                              </article>
                            </li>
                          ))}
                        </ul>
                      </PanelSection>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function AdminAppsTableSkeleton() {
  return (
    <div className="fg-console-table-wrap">
      <table className="fg-console-table fg-console-table--admin fg-console-table--apps">
        <colgroup>
          <col className="fg-console-table__col fg-console-table__col--app-name" />
          <col className="fg-console-table__col fg-console-table__col--app-id" />
          <col className="fg-console-table__col fg-console-table__col--tenant" />
          <col className="fg-console-table__col fg-console-table__col--project" />
          <col className="fg-console-table__col fg-console-table__col--route" />
          <col className="fg-console-table__col fg-console-table__col--runtime" />
          <col className="fg-console-table__col fg-console-table__col--usage" />
          <col className="fg-console-table__col fg-console-table__col--phase" />
          <col className="fg-console-table__col fg-console-table__col--source" />
          <col className="fg-console-table__col fg-console-table__col--stack" />
          <col className="fg-console-table__col fg-console-table__col--updated" />
          <col className="fg-console-table__col fg-console-table__col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="5rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4.5rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th className="fg-console-table__head--usage">
              <div className="fg-console-table__resource-head">
                <SkeletonBlock className="fg-console-skeleton__table-label" width="3.75rem" />
                <div className="fg-console-table__resource-head-grid">
                  <SkeletonBlock className="fg-console-skeleton__table-label" width="1.9rem" />
                  <SkeletonBlock className="fg-console-skeleton__table-label" width="2.7rem" />
                  <SkeletonBlock className="fg-console-skeleton__table-label" width="2rem" />
                </div>
              </div>
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="3.5rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="3.5rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
            <th>
              <SkeletonBlock className="fg-console-skeleton__table-label" width="4rem" />
            </th>
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((row) => (
            <tr key={`apps-row-${row}`}>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="8rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="7rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="9rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="7.5rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="5rem" />
              </td>
              <td className="fg-console-table__cell--usage">
                <div className="fg-console-table__resource-grid">
                  <ClusterResourceSkeleton compact showLabel={false} />
                  <ClusterResourceSkeleton compact showLabel={false} />
                  <ClusterResourceSkeleton
                    compact
                    showLabel={false}
                    showMeter={false}
                    showSecondary={false}
                  />
                </div>
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__badge" width="4.4rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="6.75rem" />
              </td>
              <td>
                <div className="fg-console-tech-list">
                  <SkeletonBlock className="fg-console-skeleton__chip" width="4rem" />
                  <SkeletonBlock className="fg-console-skeleton__chip" width="3.5rem" />
                </div>
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="5rem" />
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <TableActionSkeleton width="4.2rem" />
                  <TableActionSkeleton width="4rem" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminUsersTableSkeleton() {
  return (
    <div className="fg-console-table-wrap">
      <table className="fg-console-table fg-console-table--admin fg-console-table--users">
        <colgroup>
          <col className="fg-console-table__col fg-console-table__col--user" />
          <col className="fg-console-table__col fg-console-table__col--status" />
          <col className="fg-console-table__col fg-console-table__col--provider" />
          <col className="fg-console-table__col fg-console-table__col--tenant" />
          <col className="fg-console-table__col fg-console-table__col--services" />
          <col className="fg-console-table__col fg-console-table__col--last-login" />
          <col className="fg-console-table__col fg-console-table__col--user-actions" />
        </colgroup>
        <thead>
          <tr>
            {["3.5rem", "3.75rem", "4.5rem", "3.75rem", "3.5rem", "5rem", "4rem"].map((width, index) => (
              <th key={`users-head-${index}`}>
                <SkeletonBlock className="fg-console-skeleton__table-label" width={width} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((row) => (
            <tr key={`users-row-${row}`}>
              <td>
                <div className="fg-console-table__pair">
                  <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
                  <SkeletonBlock className="fg-console-skeleton__item-meta" width="10rem" />
                </div>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <SkeletonBlock className="fg-console-skeleton__badge" width="4.2rem" />
                  <SkeletonBlock className="fg-console-skeleton__badge" width="3.6rem" />
                </div>
              </td>
              <td>
                <div className="fg-console-table__pair">
                  <SkeletonBlock className="fg-console-skeleton__item-title" width="4.5rem" />
                  <SkeletonBlock className="fg-console-skeleton__item-meta" width="5rem" />
                </div>
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="6rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-title" width="2rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="5rem" />
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <TableActionSkeleton width="5.8rem" />
                  <TableActionSkeleton width="4rem" />
                  <TableActionSkeleton width="4.4rem" />
                  <TableActionSkeleton width="4rem" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NodeKeysTableSkeleton() {
  return (
    <div className="fg-console-table-wrap">
      <table className="fg-console-table fg-console-table--admin fg-console-table--node-keys">
        <colgroup>
          <col className="fg-console-table__col fg-console-table__col--node-key-name" />
          <col className="fg-console-table__col fg-console-table__col--node-key-prefix" />
          <col className="fg-console-table__col fg-console-table__col--node-key-status" />
          <col className="fg-console-table__col fg-console-table__col--node-key-last-used" />
          <col className="fg-console-table__col fg-console-table__col--node-key-created" />
          <col className="fg-console-table__col fg-console-table__col--node-key-actions" />
        </colgroup>
        <thead>
          <tr>
            {["4rem", "4rem", "3.75rem", "4rem", "4rem", "4rem"].map((width, index) => (
              <th key={`node-keys-head-${index}`}>
                <SkeletonBlock className="fg-console-skeleton__table-label" width={width} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((row) => (
            <tr key={`node-key-row-${row}`}>
              <td>
                <div className="fg-console-table__pair fg-node-key-table__pair fg-node-key-table__pair--name">
                  <SkeletonBlock className="fg-console-skeleton__item-title" width="6rem" />
                  <SkeletonBlock className="fg-console-skeleton__item-meta" width="8.5rem" />
                </div>
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="6rem" />
              </td>
              <td>
                <div className="fg-console-table__pair fg-node-key-table__pair">
                  <SkeletonBlock className="fg-console-skeleton__item-title" width="4rem" />
                  <SkeletonBlock className="fg-console-skeleton__item-meta" width="4rem" />
                </div>
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="4.5rem" />
              </td>
              <td>
                <SkeletonBlock className="fg-console-skeleton__item-meta" width="4rem" />
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <TableActionSkeleton width="6.2rem" />
                  <TableActionSkeleton width="5.5rem" />
                  <TableActionSkeleton width="4.25rem" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsoleProjectGallerySkeleton() {
  return (
    <ConsoleSkeletonPage className="fg-console-skeleton--projects">
      <div className="fg-project-gallery">
        <section aria-hidden="true" className="fg-project-gallery__shelf">
          <div className="fg-project-gallery__stack">
            {PROJECT_ITEMS.map((project) => {
              const expanded = project === 0;

              return (
                <article
                  className={cx("fg-project-card", expanded && "is-active", expanded && "is-expanded")}
                  key={`project-${project}`}
                >
                  <div className="fg-project-card__summary">
                    <div className="fg-project-card__summary-head">
                      <div className="fg-project-card__summary-copy">
                        <SkeletonBlock className="fg-console-skeleton__item-title" width="10rem" />
                        <div className="fg-project-card__summary-meta">
                          <SkeletonBlock className="fg-console-skeleton__item-meta" width="8rem" />
                          <div aria-hidden="true" className="fg-project-card__badges fg-project-card__badges--inline">
                            {["4.75rem", "4rem", "4.25rem"].map((width) => (
                              <SkeletonBlock className="fg-console-skeleton__chip" key={width} width={width} />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="fg-project-card__summary-resources">
                        {RESOURCE_ITEMS.map((resource) => (
                          <ClusterResourceSkeleton
                            compact
                            key={`project-summary-resource-${resource}`}
                            showMeter={false}
                            showSecondary={false}
                          />
                        ))}
                      </div>

                      <div className="fg-project-card__summary-side">
                        <SkeletonBlock className="fg-console-skeleton__icon-button" />
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="fg-project-card__detail">
                      <section className="fg-bezel fg-panel fg-project-workbench">
                        <div className="fg-bezel__inner fg-project-workbench__inner">
                          <aside className="fg-project-services fg-project-services--rail fg-project-workbench__rail">
                            <PanelSection className="fg-project-services__head">
                              <div className="fg-project-services__title-row">
                                <SkeletonBlock className="fg-console-skeleton__eyebrow" width="5rem" />
                                <SkeletonBlock className="fg-console-skeleton__pill" width="7rem" />
                              </div>
                            </PanelSection>

                            <PanelSection>
                              <ul className="fg-project-service-list">
                                {SERVICE_ITEMS.map((service) => (
                                  <ProjectServiceCardSkeleton active={service === 0} key={`service-${service}`} />
                                ))}
                              </ul>
                            </PanelSection>
                          </aside>

                          <div className="fg-project-inspector fg-project-workbench__main">
                            <PanelSection className="fg-project-inspector__head">
                              <div className="fg-project-inspector__header-row">
                                <div className="fg-project-inspector__hero">
                                  <PanelTitle>
                                    <SkeletonBlock className="fg-console-skeleton__section-title" width="11rem" />
                                  </PanelTitle>
                                  <PanelCopy className="fg-project-inspector__copy">
                                    <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="22rem" />
                                  </PanelCopy>
                                </div>
                              </div>

                              <div className="fg-project-inspector__meta-grid">
                                <MetadataPairSkeleton labelWidth="4rem" valueWidth="8rem" />
                                <MetadataPairSkeleton labelWidth="3.5rem" valueWidth="7rem" />
                                <MetadataPairSkeleton labelWidth="2.5rem" valueWidth="9rem" />
                                <MetadataPairSkeleton labelWidth="4rem" valueWidth="6rem" />
                              </div>
                            </PanelSection>

                            <PanelSection className="fg-project-inspector__controls">
                              <div className="fg-project-toolbar">
                                <div className="fg-project-toolbar__group">
                                  <SkeletonBlock className="fg-console-skeleton__eyebrow" width="4.5rem" />
                                  <div className="fg-project-actions">
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="8rem" />
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="7rem" />
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="6rem" />
                                  </div>
                                </div>

                                <div className="fg-project-toolbar__group fg-project-toolbar__group--tabs">
                                  <SkeletonBlock className="fg-console-skeleton__eyebrow" width="4rem" />
                                  <div className="fg-project-actions">
                                    {["5rem", "4rem", "4rem", "5rem"].map((width) => (
                                      <SkeletonBlock className="fg-console-skeleton__chip" key={width} width={width} />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </PanelSection>

                            <PanelSection className="fg-project-pane">
                              <div className="fg-workbench-section">
                                <div className="fg-workbench-section__head">
                                  <div className="fg-workbench-section__copy fg-env-section__copy">
                                    <SkeletonBlock className="fg-console-skeleton__eyebrow" width="6rem" />
                                    <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="20rem" />
                                  </div>

                                  <div className="fg-workbench-section__actions fg-env-section__actions">
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="11rem" />
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="7rem" />
                                    <SkeletonBlock className="fg-console-skeleton__pill" width="5.5rem" />
                                  </div>
                                </div>

                                <div className="fg-env-table">
                                  <div aria-hidden="true" className="fg-env-table__head">
                                    <SkeletonBlock className="fg-console-skeleton__table-label" width="2.5rem" />
                                    <SkeletonBlock className="fg-console-skeleton__table-label" width="3rem" />
                                    <SkeletonBlock className="fg-console-skeleton__table-label" width="3.25rem" />
                                  </div>

                                  {TABLE_ROWS.map((row) => (
                                    <div className="fg-env-row" key={`env-row-${row}`}>
                                      <SkeletonBlock className="fg-console-skeleton__field" />
                                      <SkeletonBlock className="fg-console-skeleton__field" />
                                      <SkeletonBlock className="fg-console-skeleton__pill" width="6rem" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </PanelSection>
                          </div>
                        </div>
                      </section>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </ConsoleSkeletonPage>
  );
}

function AdminTablePageSkeleton({
  introTitleWidth,
  table,
}: {
  introTitleWidth: string;
  table: "apps" | "users";
}) {
  return (
    <ConsoleSkeletonPage>
      <PageIntroSkeleton copyWidths={["16rem"]} titleWidth={introTitleWidth} />
      <SummaryGridSkeleton />
      <Panel>
        <PanelSection>{table === "apps" ? <AdminAppsTableSkeleton /> : <AdminUsersTableSkeleton />}</PanelSection>
      </Panel>
    </ConsoleSkeletonPage>
  );
}

export function ConsoleAdminAppsPageSkeleton() {
  return <AdminTablePageSkeleton introTitleWidth="12rem" table="apps" />;
}

export function ConsoleAdminUsersPageSkeleton() {
  return <AdminTablePageSkeleton introTitleWidth="8rem" table="users" />;
}

export function ConsoleAdminClusterPageSkeleton() {
  return (
    <ConsoleSkeletonPage>
      <PageIntroSkeleton copyWidths={["26rem"]} titleWidth="10rem" />
      <SummaryGridSkeleton />
      <ClusterGallerySkeleton />
    </ConsoleSkeletonPage>
  );
}

export function ConsoleApiKeysPageSkeleton() {
  return (
    <ConsoleSkeletonPage>
      <Panel>
        <PanelSection>
          <div className="fg-api-key-list">
            {API_KEY_ITEMS.map((item) => {
              const expanded = item === 0;

              return (
                <article className={cx("fg-api-key-item", expanded && "is-expanded")} key={`api-key-${item}`}>
                  <div className="fg-api-key-item__summary">
                    <div className="fg-api-key-item__toggle">
                      <div className="fg-api-key-item__title">
                        <SkeletonBlock className="fg-console-skeleton__item-title" width="8rem" />
                      </div>
                      <SkeletonBlock className="fg-console-skeleton__item-meta" width="13rem" />
                    </div>

                    <div className="fg-api-key-item__actions">
                      <TableActionSkeleton width="4.75rem" />
                      <TableActionSkeleton width="4rem" />
                      <TableActionSkeleton width="4.75rem" />
                      <TableActionSkeleton width="4rem" />
                    </div>
                  </div>

                  {expanded ? (
                    <div className="fg-api-key-item__panel">
                      <div className="fg-api-key-item__details">
                        <dl className="fg-api-key-facts">
                          <MetadataPairSkeleton labelWidth="4rem" valueWidth="10rem" />
                          <MetadataPairSkeleton labelWidth="3rem" valueWidth="7rem" />
                          <MetadataPairSkeleton labelWidth="3.5rem" valueWidth="5rem" />
                        </dl>
                      </div>

                      <div className="fg-api-key-permissions">
                        <div className="fg-api-key-permissions__head">
                          <div>
                            <SkeletonBlock className="fg-console-skeleton__section-title" width="8rem" />
                            <SkeletonBlock className="fg-console-skeleton__copy" width="10rem" />
                          </div>
                          <SkeletonBlock className="fg-console-skeleton__badge" width="3.5rem" />
                        </div>

                        <div className="fg-api-key-permission-grid">
                          {PERMISSION_ITEMS.map((permission) => (
                            <label
                              className={cx(
                                "fg-api-key-permission",
                                permission < 2 && "is-selected",
                              )}
                              key={`permission-${permission}`}
                            >
                              <span className="fg-api-key-permission__row">
                                <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
                                <SkeletonBlock className="fg-console-skeleton__item-meta" width="2rem" />
                              </span>
                              <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="10rem" />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </PanelSection>
      </Panel>

      <Panel>
        <PanelSection>
          <div className="fg-credential-section__head">
            <div className="fg-credential-section__copy">
              <SkeletonBlock className="fg-console-skeleton__section-title" width="6rem" />
              <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="18rem" />
            </div>

            <div className="fg-project-actions">
              <SkeletonBlock className="fg-console-skeleton__pill" width="8rem" />
            </div>
          </div>
        </PanelSection>

        <PanelSection>
          <NodeKeysTableSkeleton />
        </PanelSection>
      </Panel>
    </ConsoleSkeletonPage>
  );
}

export function ConsoleClusterNodesPageSkeleton() {
  return (
    <ConsoleSkeletonPage>
      <PageIntroSkeleton copyWidths={["28rem"]} titleWidth="9rem" />
      <SummaryGridSkeleton />
      <ClusterGallerySkeleton includeInventoryHead />
    </ConsoleSkeletonPage>
  );
}

export function ConsoleWorkspaceSettingsPageSkeleton() {
  return (
    <ConsoleSkeletonPage>
      <PageIntroSkeleton actions={["9rem", "11rem"]} copyWidths={["24rem"]} titleWidth="14rem" />

      <section className="fg-console-two-up">
        <Panel>
          <SectionHeaderSkeleton copyWidth="15rem" titleWidth="11rem" />
          <PanelSection>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              {[
                "7rem",
                "8rem",
                "7rem",
                "7rem",
                "8rem",
                "6rem",
                "6rem",
                "9rem",
              ].map((width, index) => (
                <MetadataPairSkeleton key={`workspace-meta-${index}`} labelWidth="5.25rem" valueWidth={width} />
              ))}
            </dl>
          </PanelSection>
        </Panel>

        <Panel>
          <SectionHeaderSkeleton copyWidth="13rem" titleWidth="8rem" />
          <PanelSection>
            <div className="fg-console-inline-status">
              <SkeletonBlock className="fg-console-skeleton__badge" width="4.5rem" />
              <SkeletonBlock className="fg-console-skeleton__badge" width="5.25rem" />
            </div>

            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <MetadataPairSkeleton labelWidth="3rem" valueWidth="7rem" />
              <MetadataPairSkeleton labelWidth="3rem" valueWidth="12rem" />
              <MetadataPairSkeleton labelWidth="4rem" valueWidth="5rem" />
              <MetadataPairSkeleton labelWidth="5rem" valueWidth="6rem" />
            </dl>
          </PanelSection>
        </Panel>
      </section>

      <section className="fg-console-two-up">
        <Panel>
          <SectionHeaderSkeleton copyWidth="14rem" titleWidth="9rem" />
          <PanelSection>
            <ul className="fg-console-list">
              {TABLE_ROWS.map((row) => (
                <li className="fg-console-list__item" key={`tenant-${row}`}>
                  <div className="fg-console-list__main">
                    <div className="fg-console-list__title-row">
                      <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
                      <SkeletonBlock className="fg-console-skeleton__badge" width="4.5rem" />
                    </div>
                    <SkeletonBlock className="fg-console-skeleton__item-meta" width="9rem" />
                  </div>

                  <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
                    <MetadataPairSkeleton labelWidth="2rem" valueWidth="2rem" />
                    <MetadataPairSkeleton labelWidth="4rem" valueWidth="2rem" />
                  </dl>
                </li>
              ))}
            </ul>
          </PanelSection>
        </Panel>

        <Panel>
          <SectionHeaderSkeleton copyWidth="12rem" titleWidth="8rem" />
          <PanelSection>
            <ul className="fg-console-list">
              {TABLE_ROWS.map((row) => (
                <li className="fg-console-list__item" key={`actor-${row}`}>
                  <div className="fg-console-list__main">
                    <div className="fg-console-list__title-row">
                      <SkeletonBlock className="fg-console-skeleton__item-title" width="6.5rem" />
                      <SkeletonBlock className="fg-console-skeleton__badge" width="4.25rem" />
                    </div>
                    <SkeletonBlock className="fg-console-skeleton__item-meta" width="8rem" />
                  </div>

                  <SkeletonBlock className="fg-console-skeleton__badge" width="5rem" />
                </li>
              ))}
            </ul>
          </PanelSection>
        </Panel>
      </section>
    </ConsoleSkeletonPage>
  );
}

export function ConsoleBillingPageSkeleton() {
  return (
    <ConsoleSkeletonPage>
      <PageIntroSkeleton
        copyWidths={["31rem", "23rem"]}
        eyebrowWidth="4.25rem"
        titleWidth="17rem"
      />

      <SummaryGridSkeleton />

      <section className="fg-billing-stack">
        <Panel className="fg-billing-surface fg-billing-surface--envelope">
          <PanelSection>
            <div className="fg-billing-hero">
              <div className="fg-billing-hero__copy">
                <SkeletonBlock className="fg-console-skeleton__eyebrow" width="8rem" />

                <div className="fg-billing-hero__price">
                  <SkeletonBlock className="fg-console-skeleton__section-label" width="6.5rem" />

                  <div className="fg-billing-hero__price-line">
                    <SkeletonBlock height="4.9rem" radius="1.35rem" width="15rem" />
                    <SkeletonBlock className="fg-console-skeleton__item-meta" width="5.25rem" />
                  </div>

                  <div className="fg-billing-hero__meta">
                    {["7.5rem", "8.25rem", "6rem"].map((width) => (
                      <SkeletonBlock className="fg-console-skeleton__chip" key={width} width={width} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="fg-billing-status-row">
                <SkeletonBlock className="fg-console-skeleton__badge" width="4.75rem" />
                <SkeletonBlock className="fg-console-skeleton__badge" width="5.5rem" />
              </div>
            </div>
          </PanelSection>

          <PanelSection>
            <div className="fg-billing-form__grid">
              {[0, 1].map((item) => (
                <div className="fg-field-stack" key={`billing-envelope-skeleton-${item}`}>
                  <SkeletonBlock
                    className="fg-console-skeleton__section-label"
                    width={item === 0 ? "3rem" : "4rem"}
                  />
                  <SkeletonBlock className="fg-console-skeleton__field" height="4.25rem" radius="1.15rem" />
                  <SkeletonBlock
                    className="fg-console-skeleton__copy"
                    width={item === 0 ? "13rem" : "14rem"}
                  />
                </div>
              ))}
            </div>

            <div className="fg-settings-form__actions">
              <SkeletonBlock className="fg-console-skeleton__pill fg-console-skeleton__pill--primary" width="8.5rem" />
              <SkeletonBlock className="fg-console-skeleton__pill" width="6.25rem" />
            </div>
          </PanelSection>
        </Panel>

        <Panel className="fg-billing-surface fg-billing-surface--balance">
          <PanelSection>
            <div className="fg-billing-balance__head">
              <div className="fg-billing-balance__copy">
                <SkeletonBlock className="fg-console-skeleton__eyebrow" width="5.25rem" />
                <SkeletonBlock className="fg-console-skeleton__section-title" width="10rem" />
              </div>

              <div className="fg-billing-status-row">
                <SkeletonBlock className="fg-console-skeleton__badge" width="4.75rem" />
              </div>
            </div>

            <div className="fg-billing-balance__figures">
              <article className="fg-billing-balance__figure is-primary">
                <SkeletonBlock className="fg-console-skeleton__section-label" width="4.5rem" />
                <SkeletonBlock height="3.8rem" radius="1.25rem" width="12rem" />
              </article>

              <article className="fg-billing-balance__figure">
                <SkeletonBlock className="fg-console-skeleton__section-label" width="4.25rem" />
                <SkeletonBlock height="2.8rem" radius="1rem" width="8.5rem" />
              </article>
            </div>
          </PanelSection>

          <PanelSection>
            <div className="fg-billing-top-up-form">
              <div className="fg-field-stack">
                <SkeletonBlock className="fg-console-skeleton__section-label" width="7rem" />
                <SkeletonBlock className="fg-console-skeleton__field" />
              </div>

              <div className="fg-settings-form__actions fg-billing-top-up-form__actions">
                <SkeletonBlock className="fg-console-skeleton__pill fg-console-skeleton__pill--primary" width="9.5rem" />
              </div>
            </div>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <SkeletonBlock className="fg-console-skeleton__eyebrow" width="4.5rem" />
            <PanelTitle>
              <SkeletonBlock className="fg-console-skeleton__section-title" width="12rem" />
            </PanelTitle>
          </PanelSection>

          <PanelSection>
            <div className="fg-billing-ledger-table" role="presentation">
              <div className="fg-billing-ledger-table__head">
                {["3rem", "3.5rem", "5.5rem", "4rem"].map((width, index) => (
                  <SkeletonBlock className="fg-console-skeleton__table-label" key={`billing-head-${index}`} width={width} />
                ))}
              </div>

              <ul className="fg-billing-ledger-table__body">
                {TABLE_ROWS.map((row) => (
                  <li className="fg-billing-ledger-row" key={`billing-row-${row}`}>
                    <div className="fg-billing-ledger-row__event">
                      <div className="fg-billing-ledger-row__event-head">
                        <SkeletonBlock className="fg-console-skeleton__item-title" width="8.25rem" />
                        <SkeletonBlock className="fg-console-skeleton__badge" width="4.5rem" />
                      </div>
                      <SkeletonBlock className="fg-console-skeleton__copy is-wide" width="16rem" />
                    </div>

                    <div className="fg-billing-ledger-row__cell">
                      <SkeletonBlock className="fg-console-skeleton__item-title" width="6rem" />
                    </div>

                    <div className="fg-billing-ledger-row__cell">
                      <SkeletonBlock className="fg-console-skeleton__item-title" width="6.75rem" />
                    </div>

                    <div className="fg-billing-ledger-row__cell">
                      <SkeletonBlock className="fg-console-skeleton__item-title" width="7rem" />
                      <SkeletonBlock className="fg-console-skeleton__item-meta" width="4.5rem" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </PanelSection>
        </Panel>
      </section>
    </ConsoleSkeletonPage>
  );
}

export const ConsolePageSkeleton = ConsoleProjectGallerySkeleton;

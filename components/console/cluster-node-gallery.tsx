"use client";

import { useEffect, useState } from "react";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { CountryFlagLabel } from "@/components/ui/country-flag-label";
import { PanelSection } from "@/components/ui/panel";
import type { ConsoleTone } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

export type ClusterNodeGalleryFact = {
  countryCode?: string | null;
  id: string;
  label: string;
  title?: string;
  value: string;
  valueTone?: ConsoleTone | null;
};

export type ClusterNodeGalleryCondition = {
  detailLabel: string;
  id: string;
  label: string;
  lastTransitionExact: string;
  lastTransitionLabel: string;
  statusLabel: string;
  tone: ConsoleTone;
};

export type ClusterNodeGalleryResource = {
  detailLabel: string;
  id: string;
  label: string;
  percentLabel: string;
  percentValue: number | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  totalLabel: string;
  usageLabel: string;
};

export type ClusterNodeGalleryWorkload = {
  id: string;
  kindLabel: string;
  kindTone: ConsoleTone;
  metaLabel: string;
  name: string;
  title: string;
};

export type ClusterNodeGalleryItem = {
  appCount: number;
  conditions: ClusterNodeGalleryCondition[];
  eyebrow: string;
  facts: ClusterNodeGalleryFact[];
  headerMeta: string;
  id: string;
  name: string;
  resources: ClusterNodeGalleryResource[];
  roleLabels: string[];
  serviceCount: number;
  statusDetail?: string | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  workloadCount: number;
  workloadEmptyDescription: string;
  workloadEmptyTitle: string;
  workloadSectionNote: string;
  workloads: ClusterNodeGalleryWorkload[];
};

function readMeterWidth(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function sanitizeDomId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ClusterResourceMeter({
  compact = false,
  resource,
}: {
  compact?: boolean;
  resource: ClusterNodeGalleryResource;
}) {
  return (
    <article
      className={cx("fg-cluster-resource", compact && "fg-cluster-resource--compact")}
      title={`${resource.label} / ${resource.usageLabel} / ${resource.totalLabel}`}
    >
      {compact ? (
        <>
          <span className="fg-cluster-resource__label">{resource.label}</span>
          <div className="fg-cluster-resource__compact-values">
            <strong>{resource.percentLabel}</strong>
            <span>{resource.usageLabel}</span>
          </div>
        </>
      ) : (
        <div className="fg-cluster-resource__head">
          <div className="fg-cluster-resource__copy">
            <span className="fg-cluster-resource__label">{resource.label}</span>
            <strong>{resource.percentLabel}</strong>
          </div>

          <StatusBadge tone={resource.statusTone}>{resource.statusLabel}</StatusBadge>
        </div>
      )}

      <div
        aria-label={`${resource.label} usage ${resource.percentLabel} (${resource.usageLabel})`}
        className="fg-cluster-resource__meter"
        role="img"
      >
        <span
          className={cx(
            "fg-cluster-resource__fill",
            `fg-cluster-resource__fill--${resource.statusTone}`,
          )}
          style={{ width: `${readMeterWidth(resource.percentValue)}%` }}
        />
      </div>

      {compact ? null : (
        <>
          <div className="fg-cluster-resource__meta">
            <span>{resource.usageLabel}</span>
            <span>{resource.totalLabel}</span>
          </div>

          <p className="fg-cluster-resource__detail">{resource.detailLabel}</p>
        </>
      )}
    </article>
  );
}

function ClusterFactValue({ fact }: { fact: ClusterNodeGalleryFact }) {
  if (fact.valueTone) {
    return <StatusBadge tone={fact.valueTone}>{fact.value}</StatusBadge>;
  }

  if (fact.countryCode || fact.label === "Location") {
    return <CountryFlagLabel countryCode={fact.countryCode} label={fact.value} />;
  }

  return <>{fact.value}</>;
}

export function ClusterNodeGallery({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: ClusterNodeGalleryItem[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!expandedId) {
      return;
    }

    if (!items.some((item) => item.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, items]);

  return (
    <div className="fg-project-gallery fg-cluster-gallery">
      <section aria-label={ariaLabel} className="fg-project-gallery__shelf">
        <div className="fg-project-gallery__stack">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const detailId = `cluster-node-detail-${sanitizeDomId(item.id)}`;

            return (
              <article
                className={cx(
                  "fg-project-card",
                  "fg-cluster-node-card",
                  expanded && "is-active",
                  expanded && "is-expanded",
                )}
                key={item.id}
              >
                <button
                  aria-controls={detailId}
                  aria-expanded={expanded}
                  className="fg-project-card__summary fg-cluster-node-card__summary"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  type="button"
                >
                  <div className="fg-cluster-node-card__summary-head">
                    <div className="fg-project-card__summary-copy fg-cluster-node-card__summary-copy">
                      <span className="fg-label fg-panel__eyebrow">{item.eyebrow}</span>
                      <strong>{item.name}</strong>
                      {item.statusDetail ? (
                        <span className="fg-cluster-node-card__summary-detail">
                          {item.statusDetail}
                        </span>
                      ) : null}
                      <span className="fg-cluster-node-card__summary-meta">{item.headerMeta}</span>
                    </div>

                    <div className="fg-cluster-node-card__summary-resources">
                      {item.resources.map((resource) => (
                        <ClusterResourceMeter compact key={resource.id} resource={resource} />
                      ))}
                    </div>

                    <div className="fg-project-card__summary-side fg-cluster-node-card__summary-side">
                      <StatusBadge tone={item.statusTone}>{item.statusLabel}</StatusBadge>
                      <span
                        className="fg-project-card__summary-expand fg-cluster-node-card__summary-expand"
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 24 24">
                          <path
                            d="m7.2 9.4 4.8 5.2 4.8-5.2"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {item.roleLabels.length ? (
                    <div className="fg-console-tech-list fg-cluster-node-card__summary-roles">
                      {item.roleLabels.map((role) => (
                        <span className="fg-console-tech-pill" key={role}>
                          <span className="fg-console-tech-pill__label">{role}</span>
                          <span className="fg-console-tech-pill__meta">Role</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>

                {expanded ? (
                  <div className="fg-project-card__detail fg-cluster-node-card__detail" id={detailId}>
                    <PanelSection>
                      <dl className="fg-cluster-node-facts">
                        {item.facts.map((fact) => (
                          <div key={fact.id}>
                            <dt>{fact.label}</dt>
                            <dd title={fact.title}>
                              <ClusterFactValue fact={fact} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </PanelSection>

                    <PanelSection>
                      <div className="fg-cluster-node-card__section-head">
                        <div>
                          <p className="fg-label fg-panel__eyebrow">Signals</p>
                          <p className="fg-console-note">
                            Ready plus memory, disk, and process pressure.
                          </p>
                        </div>
                      </div>

                      <div className="fg-cluster-condition-grid">
                        {item.conditions.map((condition) => (
                          <article className="fg-cluster-condition" key={condition.id}>
                            <div className="fg-cluster-condition__head">
                              <span className="fg-cluster-condition__label">{condition.label}</span>
                              <StatusBadge tone={condition.tone}>
                                {condition.statusLabel}
                              </StatusBadge>
                            </div>
                            <p
                              className="fg-cluster-condition__detail"
                              title={`${condition.detailLabel} / ${condition.lastTransitionExact}`}
                            >
                              {condition.detailLabel}
                            </p>
                          </article>
                        ))}
                      </div>
                    </PanelSection>

                    <PanelSection>
                      <div className="fg-cluster-node-card__section-head">
                        <div>
                          <p className="fg-label fg-panel__eyebrow">Capacity</p>
                          <p className="fg-console-note">
                            Live compute, memory, and disk usage from the node.
                          </p>
                        </div>
                      </div>

                      <div className="fg-cluster-resource-grid">
                        {item.resources.map((resource) => (
                          <ClusterResourceMeter key={resource.id} resource={resource} />
                        ))}
                      </div>
                    </PanelSection>

                    <PanelSection>
                      <div className="fg-cluster-node-card__section-head">
                        <div>
                          <p className="fg-label fg-panel__eyebrow">Workloads</p>
                          <p className="fg-console-note">{item.workloadSectionNote}</p>
                        </div>

                        <div className="fg-project-actions">
                          <StatusBadge tone="neutral">{item.workloadCount} workloads</StatusBadge>
                          {item.appCount ? (
                            <StatusBadge tone="info">{item.appCount} apps</StatusBadge>
                          ) : null}
                          {item.serviceCount ? (
                            <StatusBadge tone="neutral">{item.serviceCount} services</StatusBadge>
                          ) : null}
                        </div>
                      </div>

                      {item.workloads.length ? (
                        <ul className="fg-cluster-workload-list">
                          {item.workloads.map((workload) => (
                            <li key={workload.id}>
                              <article className="fg-cluster-workload" title={workload.title}>
                                <div className="fg-cluster-workload__head">
                                  <strong>{workload.name}</strong>
                                  <StatusBadge tone={workload.kindTone}>
                                    {workload.kindLabel}
                                  </StatusBadge>
                                </div>
                                <p>{workload.metaLabel}</p>
                              </article>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ConsoleEmptyState
                          description={item.workloadEmptyDescription}
                          title={item.workloadEmptyTitle}
                        />
                      )}
                    </PanelSection>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

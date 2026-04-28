"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { RuntimeAccessPanel } from "@/components/console/runtime-access-panel";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { CountryFlagLabel } from "@/components/ui/country-flag-label";
import { HintInline } from "@/components/ui/hint-tooltip";
import { PanelSection } from "@/components/ui/panel";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import type {
  RuntimeOwnership,
  RuntimePublicOfferView,
} from "@/lib/runtimes/types";
import { cx } from "@/lib/ui/cx";

export type ClusterNodeGalleryFact = {
  countryCode?: string | null;
  id: string;
  label: string;
  title?: string;
  translateValue?: boolean;
  value: string;
  valueTone?: ConsoleTone | null;
};

export type ClusterNodeGallerySummaryBadge = {
  label: string;
  tone: ConsoleTone;
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
  requestLabel: string | null;
  requestPercentLabel: string;
  requestPercentValue: number | null;
  requestTone: ConsoleTone;
  schedulableFreeLabel: string | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  totalLabel: string;
  usageTone: ConsoleTone;
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
  accessMode?: string | null;
  appCount: number;
  canManagePool?: boolean;
  canManageSharing?: boolean;
  conditions: ClusterNodeGalleryCondition[];
  eyebrow: string;
  facts: ClusterNodeGalleryFact[];
  headerMeta: string;
  id: string;
  name: string;
  ownerEmail?: string | null;
  ownerLabel?: string | null;
  ownership?: RuntimeOwnership;
  poolMode?: string | null;
  publicOffer?: RuntimePublicOfferView | null;
  resources: ClusterNodeGalleryResource[];
  roleLabels: string[];
  summaryBadges?: ClusterNodeGallerySummaryBadge[];
  runtimeId?: string | null;
  runtimeType?: string | null;
  serviceCount: number;
  showConditionsSection?: boolean;
  showResourcesSection?: boolean;
  showRuntimeAccessPanel?: boolean;
  showWorkloadsSection?: boolean;
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
  const { t } = useI18n();
  const label = resource.id === "cpu" ? t("CPU") : t(resource.label);
  const percentLabel =
    resource.percentLabel === "No stats"
      ? t("No stats")
      : resource.percentLabel;
  const usageLabel =
    resource.usageLabel === "No stats" ? t("No stats") : resource.usageLabel;
  const requestLabel =
    resource.requestLabel === "No stats"
      ? t("No stats")
      : resource.requestLabel;
  const requestPercentLabel =
    resource.requestPercentLabel === "No stats"
      ? t("No stats")
      : resource.requestPercentLabel;
  const schedulableFreeLabel =
    resource.schedulableFreeLabel === "No stats"
      ? t("No stats")
      : resource.schedulableFreeLabel;
  const title = requestLabel
    ? schedulableFreeLabel
      ? t("{label} / {usage} / {total} / {request} / {free}", {
          free: schedulableFreeLabel,
          label,
          request: requestLabel,
          total: resource.totalLabel,
          usage: resource.usageLabel,
        })
      : t("{label} / {usage} / {total} / {request}", {
          label,
          request: requestLabel,
          total: resource.totalLabel,
          usage: resource.usageLabel,
        })
    : t("{label} / {usage} / {total}", {
        label,
        total: resource.totalLabel,
        usage: resource.usageLabel,
      });

  return (
    <article
      className={cx(
        "fg-cluster-resource",
        compact && "fg-cluster-resource--compact",
      )}
      title={title}
    >
      {compact ? (
        <>
          <span className="fg-cluster-resource__label">{label}</span>
          <div className="fg-cluster-resource__compact-values">
            <strong>{percentLabel}</strong>
            <span>{usageLabel}</span>
          </div>
        </>
      ) : (
        <div className="fg-cluster-resource__head">
          <div className="fg-cluster-resource__copy">
            <span className="fg-cluster-resource__label">{label}</span>
            <strong>{percentLabel}</strong>
          </div>

          <StatusBadge tone={resource.statusTone}>
            {t(resource.statusLabel)}
          </StatusBadge>
        </div>
      )}

      <div className="fg-cluster-resource__meters">
        <div
          aria-label={t("{label} usage {percent} ({usage})", {
            label,
            percent: resource.percentLabel,
            usage: resource.usageLabel,
          })}
          className="fg-cluster-resource__meter"
          role="img"
        >
          <span
            className={cx(
              "fg-cluster-resource__fill",
              `fg-cluster-resource__fill--${resource.usageTone}`,
            )}
            style={{ width: `${readMeterWidth(resource.percentValue)}%` }}
          />
        </div>

        {resource.requestPercentValue !== null &&
        resource.requestPercentValue !== undefined ? (
          <div
            aria-label={t("{label} requested {percent} ({usage})", {
              label,
              percent: resource.requestPercentLabel,
              usage: resource.requestLabel ?? resource.requestPercentLabel,
            })}
            className="fg-cluster-resource__meter fg-cluster-resource__meter--request"
            role="img"
          >
            <span
              className={cx(
                "fg-cluster-resource__fill",
                `fg-cluster-resource__fill--${resource.requestTone}`,
              )}
              style={{
                width: `${readMeterWidth(resource.requestPercentValue)}%`,
              }}
            />
          </div>
        ) : null}
      </div>

      {compact ? null : (
        <>
          <div className="fg-cluster-resource__meta">
            <span>{usageLabel}</span>
            <span>{resource.totalLabel}</span>
          </div>

          {requestLabel ? (
            <div className="fg-cluster-resource__meta fg-cluster-resource__meta--request">
              <span>{requestLabel}</span>
              {schedulableFreeLabel ? <span>{schedulableFreeLabel}</span> : null}
            </div>
          ) : null}

          <p className="fg-cluster-resource__detail">{resource.detailLabel}</p>
        </>
      )}
    </article>
  );
}

function ClusterFactValue({ fact }: { fact: ClusterNodeGalleryFact }) {
  const { t } = useI18n();
  const value = fact.translateValue ? t(fact.value) : fact.value;

  if (fact.valueTone) {
    return <StatusBadge tone={fact.valueTone}>{value}</StatusBadge>;
  }

  if (fact.countryCode || fact.id === "location") {
    return (
      <CountryFlagLabel countryCode={fact.countryCode} label={value} />
    );
  }

  return <>{value}</>;
}

function buildCompactResourceItem(
  resource: ClusterNodeGalleryResource,
  t: ReturnType<typeof useI18n>["t"],
): ConsoleCompactResourceItemView {
  const label = resource.id === "cpu" ? t("CPU") : t(resource.label);
  const requestSummaryLabel =
    resource.requestPercentValue !== null &&
    resource.requestPercentValue !== undefined
      ? t("Req {percent}", { percent: resource.requestPercentLabel })
      : null;
  const requestIsPrimary =
    resource.requestPercentValue !== null &&
    resource.requestPercentValue !== undefined &&
    (resource.percentValue === null ||
      resource.percentValue === undefined ||
      resource.requestPercentValue > resource.percentValue);
  const usageSummaryLabel = t("Use {percent}", {
    percent: resource.percentLabel,
  });
  const title = resource.requestLabel
    ? resource.schedulableFreeLabel
      ? t("{label} / {usage} / {total} / {request} / {free}", {
          free: resource.schedulableFreeLabel,
          label,
          request: resource.requestLabel,
          total: resource.totalLabel,
          usage: resource.usageLabel,
        })
      : t("{label} / {usage} / {total} / {request}", {
          label,
          request: resource.requestLabel,
          total: resource.totalLabel,
          usage: resource.usageLabel,
        })
    : t("{label} / {usage} / {total}", {
        label,
        total: resource.totalLabel,
        usage: resource.usageLabel,
      });

  return {
    id: resource.id,
    label: resource.label,
    meterValue: requestIsPrimary
      ? resource.requestPercentValue
      : resource.percentValue,
    primaryLabel:
      requestIsPrimary && requestSummaryLabel
        ? requestSummaryLabel
        : resource.percentLabel,
    secondaryLabel: requestSummaryLabel
      ? requestIsPrimary
        ? usageSummaryLabel
        : requestSummaryLabel
      : resource.usageLabel,
    title,
    tone: requestIsPrimary ? resource.requestTone : resource.usageTone,
  };
}

function readOwnershipBadge(
  item: ClusterNodeGalleryItem,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!item.ownership) {
    return null;
  }

  if (item.ownership === "owned") {
    return {
      label: t("Owned"),
      tone: "neutral",
    } satisfies { label: string; tone: ConsoleTone };
  }

  if (item.ownership === "internal-cluster") {
    return {
      label: t("Cluster"),
      tone: "info",
    } satisfies { label: string; tone: ConsoleTone };
  }

  return {
    label: t("Shared"),
    tone: "info",
  } satisfies { label: string; tone: ConsoleTone };
}

export function ClusterNodeGallery({
  ariaLabel,
  items,
  renderDetailFooter,
}: {
  ariaLabel: string;
  items: ClusterNodeGalleryItem[];
  renderDetailFooter?: (item: ClusterNodeGalleryItem) => ReactNode;
}) {
  const { t } = useI18n();
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
            const ownershipBadge = readOwnershipBadge(item, t);
            const hasSummaryResources = item.resources.length > 0;
            const showRuntimeAccessPanel =
              item.showRuntimeAccessPanel ?? Boolean(item.runtimeId);
            const showConditionsSection =
              item.showConditionsSection ?? item.conditions.length > 0;
            const showResourcesSection =
              item.showResourcesSection ?? item.resources.length > 0;
            const showWorkloadsSection = item.showWorkloadsSection ?? true;

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
                  <div
                    className={cx(
                      "fg-cluster-node-card__summary-head",
                      !hasSummaryResources && "is-resource-less",
                    )}
                  >
                    <div className="fg-project-card__summary-copy fg-cluster-node-card__summary-copy">
                      <span className="fg-label fg-panel__eyebrow">
                        {t(item.eyebrow)}
                      </span>
                      <strong>{item.name}</strong>
                      {item.statusDetail ? (
                        <span className="fg-cluster-node-card__summary-detail">
                          {item.statusDetail}
                        </span>
                      ) : null}
                      <span className="fg-cluster-node-card__summary-meta">
                        {item.headerMeta}
                      </span>
                    </div>

                    {hasSummaryResources ? (
                      <div className="fg-cluster-node-card__summary-resources">
                        {item.resources.map((resource) => (
                          <CompactResourceMeter
                            item={buildCompactResourceItem(resource, t)}
                            key={resource.id}
                          />
                        ))}
                      </div>
                    ) : null}

                    <div className="fg-project-card__summary-side fg-cluster-node-card__summary-side">
                      {item.summaryBadges?.map((badge) => (
                        <StatusBadge key={`${item.id}:${badge.label}`} tone={badge.tone}>
                          {t(badge.label)}
                        </StatusBadge>
                      ))}
                      {ownershipBadge ? (
                        <StatusBadge tone={ownershipBadge.tone}>
                          {ownershipBadge.label}
                        </StatusBadge>
                      ) : null}
                      <StatusBadge tone={item.statusTone}>
                        {t(item.statusLabel)}
                      </StatusBadge>
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
                          <span className="fg-console-tech-pill__label">
                            {role}
                          </span>
                          <span className="fg-console-tech-pill__meta">
                            {t("Role")}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>

                {expanded ? (
                  <div
                    className="fg-project-card__detail fg-cluster-node-card__detail"
                    id={detailId}
                  >
                    <PanelSection>
                      <dl className="fg-cluster-node-facts">
                        {item.facts.map((fact) => (
                          <div key={fact.id}>
                            <dt>{t(fact.label)}</dt>
                            <dd title={fact.title}>
                              <ClusterFactValue fact={fact} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </PanelSection>

                    {showRuntimeAccessPanel && item.runtimeId ? (
                      <PanelSection>
                        <RuntimeAccessPanel
                          accessMode={item.accessMode ?? null}
                          canManagePool={item.canManagePool}
                          canManageSharing={item.canManageSharing}
                          ownerEmail={item.ownerEmail ?? null}
                          ownerLabel={item.ownerLabel ?? t("Unknown owner")}
                          ownership={item.ownership ?? "owned"}
                          poolMode={item.poolMode ?? null}
                          publicOffer={item.publicOffer ?? null}
                          runtimeId={item.runtimeId ?? null}
                          runtimeType={item.runtimeType ?? null}
                        />
                      </PanelSection>
                    ) : null}

                    {showConditionsSection ? (
                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <HintInline
                              ariaLabel={t("Signals")}
                              hint={t("Ready and pressure signals.")}
                            >
                              <p className="fg-label fg-panel__eyebrow">
                                {t("Signals")}
                              </p>
                            </HintInline>
                          </div>
                        </div>

                        <div className="fg-cluster-condition-grid">
                          {item.conditions.map((condition) => (
                            <article
                              className="fg-cluster-condition"
                              key={condition.id}
                            >
                              <div className="fg-cluster-condition__head">
                                <span className="fg-cluster-condition__label">
                                  {t(condition.label)}
                                </span>
                                <StatusBadge tone={condition.tone}>
                                  {t(condition.statusLabel)}
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
                    ) : null}

                    {showResourcesSection ? (
                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <HintInline
                              ariaLabel={t("Capacity")}
                              hint={t(
                                "Live and reserved CPU, memory, and disk capacity.",
                              )}
                            >
                              <p className="fg-label fg-panel__eyebrow">
                                {t("Capacity")}
                              </p>
                            </HintInline>
                          </div>
                        </div>

                        <div className="fg-cluster-resource-grid">
                          {item.resources.map((resource) => (
                            <ClusterResourceMeter
                              key={resource.id}
                              resource={resource}
                            />
                          ))}
                        </div>
                      </PanelSection>
                    ) : null}

                    {showWorkloadsSection ? (
                      <PanelSection>
                        <div className="fg-cluster-node-card__section-head">
                          <div>
                            <HintInline
                              ariaLabel={t("Workloads")}
                              hint={t(item.workloadSectionNote)}
                            >
                              <p className="fg-label fg-panel__eyebrow">
                                {t("Workloads")}
                              </p>
                            </HintInline>
                          </div>

                          <div className="fg-project-actions">
                            <StatusBadge tone="neutral">
                              {t(
                                item.workloadCount === 1
                                  ? "{count} workload"
                                  : "{count} workloads",
                                { count: item.workloadCount },
                              )}
                            </StatusBadge>
                            {item.appCount ? (
                              <StatusBadge tone="info">
                                {t(
                                  item.appCount === 1
                                    ? "{count} app"
                                    : "{count} apps",
                                  {
                                    count: item.appCount,
                                  },
                                )}
                              </StatusBadge>
                            ) : null}
                            {item.serviceCount ? (
                              <StatusBadge tone="neutral">
                                {t(
                                  item.serviceCount === 1
                                    ? "{count} service"
                                    : "{count} services",
                                  { count: item.serviceCount },
                                )}
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>

                        {item.workloads.length ? (
                          <ul className="fg-cluster-workload-list">
                            {item.workloads.map((workload) => (
                              <li key={workload.id}>
                                <article
                                  className="fg-cluster-workload"
                                  title={workload.title}
                                >
                                  <div className="fg-cluster-workload__head">
                                    <strong>{workload.name}</strong>
                                    <StatusBadge tone={workload.kindTone}>
                                      {t(workload.kindLabel)}
                                    </StatusBadge>
                                  </div>
                                  <p>{workload.metaLabel}</p>
                                </article>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ConsoleEmptyState
                            description={t(item.workloadEmptyDescription)}
                            title={t(item.workloadEmptyTitle)}
                          />
                        )}
                      </PanelSection>
                    ) : null}

                    {renderDetailFooter ? renderDetailFooter(item) : null}
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

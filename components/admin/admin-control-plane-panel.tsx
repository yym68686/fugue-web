"use client";

import { StatusBadge } from "@/components/console/status-badge";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import type {
  AdminControlPlaneComponentView,
  AdminControlPlaneView,
} from "@/lib/admin/service";
import { cx } from "@/lib/ui/cx";

function readLocalizedControlPlaneVersionLabel(
  value: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  const releaseMatch = value.match(/^Release\s+(.+)$/);

  if (releaseMatch) {
    return t("Release {value}", { value: releaseMatch[1] ?? value });
  }

  return t(value);
}

function readLocalizedControlPlaneMetricLabel(
  value: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  const readyMatch = value.match(/^(\d+)\/(\d+)\s+ready$/);

  if (readyMatch) {
    return t("{ready}/{desired} ready", {
      desired: readyMatch[2] ?? "",
      ready: readyMatch[1] ?? "",
    });
  }

  const rolloutMatch = value.match(/^(\d+)\s+updated\s+\/\s+(\d+)\s+available$/);

  if (rolloutMatch) {
    return t("{updated} updated / {available} available", {
      available: rolloutMatch[2] ?? "",
      updated: rolloutMatch[1] ?? "",
    });
  }

  return t(value);
}

function ControlPlaneComponentCard({
  component,
}: {
  component: AdminControlPlaneComponentView;
}) {
  const { t } = useI18n();

  return (
    <article
      className={cx(
        "fg-control-plane-card",
        `fg-control-plane-card--${component.statusTone}`,
      )}
    >
      <div className="fg-control-plane-card__head">
        <div className="fg-control-plane-card__identity">
          <span className="fg-label fg-panel__eyebrow">{t(component.componentLabel)}</span>
          <strong title={component.imageTagExact || undefined}>
            {t(component.imageTagLabel)}
          </strong>
          <span title={component.deploymentName}>{t(component.deploymentName)}</span>
        </div>

        <StatusBadge tone={component.statusTone}>{t(component.statusLabel)}</StatusBadge>
      </div>

      <dl className="fg-cluster-node-facts fg-control-plane-card__facts">
        <div>
          <dt>{t("Replicas")}</dt>
          <dd>{readLocalizedControlPlaneMetricLabel(component.replicaLabel, t)}</dd>
        </div>
        <div>
          <dt>{t("Rollout")}</dt>
          <dd>{readLocalizedControlPlaneMetricLabel(component.rolloutLabel, t)}</dd>
        </div>
        <div>
          <dt>{t("Image")}</dt>
          <dd title={component.imageExact}>{component.imageRepositoryLabel}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminControlPlanePanel({
  controlPlane,
}: {
  controlPlane: AdminControlPlaneView | null;
}) {
  const { t } = useI18n();

  if (!controlPlane) {
    return (
      <Panel className="fg-control-plane-panel">
        <PanelSection>
          <ConsoleEmptyState
            description={t(
              "The admin API could not resolve the current API and controller release.",
            )}
            title={t("Control plane version unavailable")}
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <Panel className="fg-control-plane-panel">
      <PanelSection className="fg-control-plane-panel__hero">
        <div className="fg-control-plane-panel__copy">
          <div className="fg-control-plane-panel__eyebrow-row">
            <span className="fg-label fg-panel__eyebrow">{t("Control plane")}</span>
            <StatusBadge tone={controlPlane.statusTone}>
              {t(controlPlane.statusLabel)}
            </StatusBadge>
          </div>

          <PanelTitle
            className="fg-control-plane-panel__title"
            title={controlPlane.versionExact || undefined}
          >
            {readLocalizedControlPlaneVersionLabel(controlPlane.versionLabel, t)}
          </PanelTitle>

          <PanelCopy>{t(controlPlane.summaryLabel)}</PanelCopy>
        </div>

        <dl className="fg-console-inline-meta fg-console-inline-meta--stacked fg-control-plane-panel__meta">
          <div>
            <dt>{t("Namespace")}</dt>
            <dd>{t(controlPlane.namespaceLabel)}</dd>
          </div>
          <div>
            <dt>{t("Release")}</dt>
            <dd>{t(controlPlane.releaseInstanceLabel)}</dd>
          </div>
          <div>
            <dt>{t("Observed")}</dt>
            <dd title={controlPlane.observedExact}>{controlPlane.observedLabel}</dd>
          </div>
        </dl>
      </PanelSection>

      <PanelSection className="fg-control-plane-panel__components">
        {controlPlane.components.map((component) => (
          <ControlPlaneComponentCard
            component={component}
            key={component.component}
          />
        ))}
      </PanelSection>
    </Panel>
  );
}

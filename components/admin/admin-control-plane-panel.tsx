import { StatusBadge } from "@/components/console/status-badge";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import type {
  AdminControlPlaneComponentView,
  AdminControlPlaneView,
} from "@/lib/admin/service";
import { cx } from "@/lib/ui/cx";

function ControlPlaneComponentCard({
  component,
}: {
  component: AdminControlPlaneComponentView;
}) {
  return (
    <article
      className={cx(
        "fg-control-plane-card",
        `fg-control-plane-card--${component.statusTone}`,
      )}
    >
      <div className="fg-control-plane-card__head">
        <div className="fg-control-plane-card__identity">
          <span className="fg-label fg-panel__eyebrow">{component.componentLabel}</span>
          <strong title={component.imageTagExact || undefined}>
            {component.imageTagLabel}
          </strong>
          <span title={component.deploymentName}>{component.deploymentName}</span>
        </div>

        <StatusBadge tone={component.statusTone}>{component.statusLabel}</StatusBadge>
      </div>

      <dl className="fg-cluster-node-facts fg-control-plane-card__facts">
        <div>
          <dt>Replicas</dt>
          <dd>{component.replicaLabel}</dd>
        </div>
        <div>
          <dt>Rollout</dt>
          <dd>{component.rolloutLabel}</dd>
        </div>
        <div>
          <dt>Image</dt>
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
  if (!controlPlane) {
    return (
      <Panel className="fg-control-plane-panel">
        <PanelSection>
          <ConsoleEmptyState
            description="The admin API could not resolve the current API and controller release."
            title="Control plane version unavailable"
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
            <span className="fg-label fg-panel__eyebrow">Control plane</span>
            <StatusBadge tone={controlPlane.statusTone}>
              {controlPlane.statusLabel}
            </StatusBadge>
          </div>

          <PanelTitle
            className="fg-control-plane-panel__title"
            title={controlPlane.versionExact || undefined}
          >
            {controlPlane.versionLabel}
          </PanelTitle>

          <PanelCopy>{controlPlane.summaryLabel}</PanelCopy>
        </div>

        <dl className="fg-console-inline-meta fg-console-inline-meta--stacked fg-control-plane-panel__meta">
          <div>
            <dt>Namespace</dt>
            <dd>{controlPlane.namespaceLabel}</dd>
          </div>
          <div>
            <dt>Release</dt>
            <dd>{controlPlane.releaseInstanceLabel}</dd>
          </div>
          <div>
            <dt>Observed</dt>
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

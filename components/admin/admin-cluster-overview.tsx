import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import type {
  AdminClusterNodeView,
  AdminClusterResourceView,
} from "@/lib/admin/service";
import { cx } from "@/lib/ui/cx";

function readMeterWidth(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function ClusterResourceMeter({
  resource,
}: {
  resource: AdminClusterResourceView;
}) {
  return (
    <article className="fg-cluster-resource">
      <div className="fg-cluster-resource__head">
        <div className="fg-cluster-resource__copy">
          <span className="fg-cluster-resource__label">{resource.label}</span>
          <strong>{resource.percentLabel}</strong>
        </div>

        <StatusBadge tone={resource.statusTone}>{resource.statusLabel}</StatusBadge>
      </div>

      <div
        aria-label={`${resource.label} usage ${resource.percentLabel}`}
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

      <div className="fg-cluster-resource__meta">
        <span>{resource.usageLabel}</span>
        <span>{resource.totalLabel}</span>
      </div>

      <p className="fg-cluster-resource__detail">{resource.detailLabel}</p>
    </article>
  );
}

function ClusterNodeCard({
  node,
}: {
  node: AdminClusterNodeView;
}) {
  return (
    <Panel className="fg-cluster-node-card">
      <PanelSection>
        <div className="fg-cluster-node-card__head">
          <div className="fg-cluster-node-card__copy">
            <p className="fg-label fg-panel__eyebrow">Cluster node</p>
            <PanelTitle>{node.name}</PanelTitle>
            <PanelCopy>{node.statusDetail}</PanelCopy>
            <p className="fg-console-note">{node.headerMeta}</p>
          </div>

          <StatusBadge tone={node.statusTone}>{node.statusLabel}</StatusBadge>
        </div>

        {node.roleLabels.length ? (
          <div className="fg-console-tech-list">
            {node.roleLabels.map((role) => (
              <span className="fg-console-tech-pill" key={role}>
                <span className="fg-console-tech-pill__label">{role}</span>
                <span className="fg-console-tech-pill__meta">Role</span>
              </span>
            ))}
          </div>
        ) : null}
      </PanelSection>

      <PanelSection>
        <dl className="fg-cluster-node-facts">
          <div>
            <dt>Location</dt>
            <dd>{node.locationLabel}</dd>
          </div>
          <div>
            <dt>Public address</dt>
            <dd>{node.externalIpLabel}</dd>
          </div>
          <div>
            <dt>Internal address</dt>
            <dd>{node.internalIpLabel}</dd>
          </div>
          <div>
            <dt>Zone</dt>
            <dd>{node.zoneLabel}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{node.runtimeLabel}</dd>
          </div>
          <div>
            <dt>Tenant</dt>
            <dd>{node.tenantLabel}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd title={node.createdExact}>{node.createdLabel}</dd>
          </div>
        </dl>
      </PanelSection>

      <PanelSection>
        <div className="fg-cluster-node-card__section-head">
          <div>
            <p className="fg-label fg-panel__eyebrow">Signals</p>
            <p className="fg-console-note">Ready plus memory, disk, and process pressure.</p>
          </div>
        </div>

        <div className="fg-cluster-condition-grid">
          {node.conditions.map((condition) => (
            <article className="fg-cluster-condition" key={condition.id}>
              <div className="fg-cluster-condition__head">
                <span className="fg-cluster-condition__label">{condition.label}</span>
                <StatusBadge tone={condition.tone}>{condition.statusLabel}</StatusBadge>
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
            <p className="fg-console-note">Live compute, memory, and disk usage from the node.</p>
          </div>
        </div>

        <div className="fg-cluster-resource-grid">
          {node.resources.map((resource) => (
            <ClusterResourceMeter key={resource.id} resource={resource} />
          ))}
        </div>
      </PanelSection>

      <PanelSection>
        <div className="fg-cluster-node-card__section-head">
          <div>
            <p className="fg-label fg-panel__eyebrow">Workloads</p>
            <p className="fg-console-note">Fugue apps and backing services placed on this machine.</p>
          </div>

          <div className="fg-console-inline-status">
            <StatusBadge tone="neutral">{node.workloadCount} workloads</StatusBadge>
            {node.appCount ? <StatusBadge tone="info">{node.appCount} apps</StatusBadge> : null}
            {node.serviceCount ? <StatusBadge tone="neutral">{node.serviceCount} services</StatusBadge> : null}
          </div>
        </div>

        {node.workloads.length ? (
          <ul className="fg-cluster-workload-list">
            {node.workloads.map((workload) => (
              <li key={workload.id}>
                <article className="fg-cluster-workload" title={workload.title}>
                  <div className="fg-cluster-workload__head">
                    <strong>{workload.name}</strong>
                    <StatusBadge tone={workload.kindTone}>{workload.kindLabel}</StatusBadge>
                  </div>
                  <p>{workload.metaLabel}</p>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <ConsoleEmptyState
            description="No Fugue app or backing service is currently scheduled onto this node."
            title="No workloads on this node"
          />
        )}
      </PanelSection>
    </Panel>
  );
}

export function AdminClusterOverview({
  nodes,
}: {
  nodes: AdminClusterNodeView[];
}) {
  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            description="No cluster nodes are visible from the current bootstrap scope."
            title="No cluster nodes visible"
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <section className="fg-cluster-node-grid" aria-label="Cluster nodes">
      {nodes.map((node) => (
        <ClusterNodeCard key={node.name} node={node} />
      ))}
    </section>
  );
}

import { redirect } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getConsoleData } from "@/lib/console/presenters";

export default async function RuntimesPage() {
  const consoleData = await getConsoleData();

  if (consoleData.workspace.stage !== "ready") {
    redirect("/app?dialog=create");
  }

  const mostLoadedRuntime = [...consoleData.runtimes].sort((left, right) => right.appCount - left.appCount)[0];

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app/apps", label: "Back to apps" },
          { href: "/app/operations", label: "Watch route operations", variant: "primary" },
        ]}
        description="Shared and attached runtimes with health, placement, endpoint, and heartbeat."
        eyebrow="Runtimes"
        title="Runtime placement"
      />

      <section className="fg-console-runtime-grid">
        {consoleData.runtimes.length ? (
          consoleData.runtimes.map((runtime) => (
            <Panel key={runtime.id}>
              <PanelSection>
                <div className="fg-console-runtime-card__head">
                  <div>
                    <p className="fg-label fg-panel__eyebrow">{runtime.kindLabel}</p>
                    <PanelTitle>{runtime.label}</PanelTitle>
                  </div>
                  <StatusBadge tone={runtime.statusTone}>{runtime.status}</StatusBadge>
                </div>
                <PanelCopy>{runtime.detail}</PanelCopy>
              </PanelSection>

              <PanelSection>
                <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
                  <div>
                    <dt>Runtime id</dt>
                    <dd>{runtime.id}</dd>
                  </div>
                  <div>
                    <dt>Tenant</dt>
                    <dd>{runtime.tenantLabel}</dd>
                  </div>
                  <div>
                    <dt>Endpoint</dt>
                    <dd>{runtime.endpointLabel}</dd>
                  </div>
                  <div>
                    <dt>Cluster node</dt>
                    <dd>{runtime.clusterNodeLabel}</dd>
                  </div>
                  <div>
                    <dt>Apps</dt>
                    <dd>{runtime.appCount}</dd>
                  </div>
                  <div>
                    <dt>Heartbeat</dt>
                    <dd>{runtime.activityLabel}</dd>
                  </div>
                </dl>
              </PanelSection>
            </Panel>
          ))
        ) : (
          <Panel>
            <PanelSection>
                <ConsoleEmptyState
                  action={{ href: "/app/settings/workspace", label: "Inspect scope" }}
                  description="No runtimes are visible in this workspace right now."
                  title="No runtimes visible"
                />
              </PanelSection>
          </Panel>
        )}
      </section>

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Topology</p>
            <PanelTitle>Current runtime footprint</PanelTitle>
            <PanelCopy>Shared ingress first, attached capacity when you need it.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <ul className="fg-console-stat-list">
              <li>
                <strong>Shared footprint</strong>
                <span>{consoleData.summary.sharedRuntimeCount} visible</span>
              </li>
              <li>
                <strong>Owned footprint</strong>
                <span>{consoleData.summary.ownedRuntimeCount} visible</span>
              </li>
              <li>
                <strong>Most loaded runtime</strong>
                <span>{mostLoadedRuntime ? `${mostLoadedRuntime.label} / ${mostLoadedRuntime.appCount} apps` : "—"}</span>
              </li>
              <li>
                <strong>Latest platform activity</strong>
                <span>{consoleData.summary.latestActivityLabel}</span>
              </li>
            </ul>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Readiness</p>
            <PanelTitle>Recent runtime events</PanelTitle>
            <PanelCopy>Cluster joins and runtime-scoped events land here first.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {consoleData.runtimeAuditEvents.length ? (
              <ul className="fg-console-list">
                {consoleData.runtimeAuditEvents.map((event) => (
                  <li className="fg-console-list__item" key={event.id}>
                    <div className="fg-console-list__main">
                      <div className="fg-console-list__title-row">
                        <strong>{event.targetLabel}</strong>
                        <StatusBadge tone={event.tone}>{event.timestampLabel}</StatusBadge>
                      </div>
                      <p>{event.action}</p>
                    </div>
                    <StatusBadge tone="neutral">{event.actorLabel}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <ConsoleEmptyState
                action={{ href: "/app/operations", label: "Open operations" }}
                description="No runtime-specific events are visible right now."
                title="No recent runtime events"
              />
            )}
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}

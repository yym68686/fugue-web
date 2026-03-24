import { redirect } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getConsoleData } from "@/lib/console/presenters";

export default async function OperationsPage() {
  const consoleData = await getConsoleData();

  if (consoleData.workspace.stage !== "ready") {
    redirect("/app?dialog=create");
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app", label: "Back to projects" },
          { href: "/app/settings/workspace", label: "Open workspace settings", variant: "primary" },
        ]}
        description="Imports, deploys, scales, and deletes, read as one operational queue."
        eyebrow="Operations"
        title="Change history"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Queue</p>
            <PanelTitle>Active operations</PanelTitle>
            <PanelCopy>Running work stays separate from completed work.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {consoleData.activeOperations.length ? (
              <ul className="fg-console-timeline">
                {consoleData.activeOperations.map((operation) => (
                  <li className="fg-console-timeline__item" key={operation.id}>
                    <div className="fg-console-timeline__marker" aria-hidden="true" />
                    <div className="fg-console-timeline__body">
                      <div className="fg-console-list__title-row">
                        <strong>
                          {operation.actionLabel} / {operation.targetLabel}
                        </strong>
                        <StatusBadge tone={operation.statusTone}>{operation.status}</StatusBadge>
                      </div>
                      <p>{operation.detail}</p>
                      <span className="fg-console-timeline__meta">
                        {operation.actorLabel} / {operation.timestampLabel} / {operation.id}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ConsoleEmptyState
                action={{ href: "/app", label: "Back to projects" }}
                description="There are no queued or running operations right now."
                title="No active operations"
              />
            )}
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Audit</p>
            <PanelTitle>Recent events</PanelTitle>
            <PanelCopy>Product auth and control-plane events stay readable together.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {consoleData.recentAuditEvents.length ? (
              <ul className="fg-console-list">
                {consoleData.recentAuditEvents.slice(0, 8).map((event) => (
                  <li className="fg-console-list__item" key={event.id}>
                    <div className="fg-console-list__main">
                      <div className="fg-console-list__title-row">
                        <strong>{event.action}</strong>
                        <StatusBadge tone={event.tone}>{event.timestampLabel}</StatusBadge>
                      </div>
                      <p>
                        {event.actorLabel} / {event.targetLabel}
                      </p>
                    </div>
                    <StatusBadge tone="neutral">{event.scopeLabel}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <ConsoleEmptyState
                description="No audit events are currently visible."
                title="No audit events"
              />
            )}
          </PanelSection>
        </Panel>
      </section>

      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">History</p>
          <PanelTitle>Recent operations</PanelTitle>
          <PanelCopy>Completed work stays visible even when the live queue is empty.</PanelCopy>
        </PanelSection>

        <PanelSection>
          <div className="fg-console-table-wrap">
            <table className="fg-console-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Actor</th>
                  <th>Tenant</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {consoleData.recentOperations.length ? (
                  consoleData.recentOperations.map((operation) => (
                    <tr key={operation.id}>
                      <td>
                        <div className="fg-console-table__stack">
                          <strong>{operation.actionLabel}</strong>
                          <span>{operation.id}</span>
                        </div>
                      </td>
                      <td>{operation.targetLabel}</td>
                      <td>
                        <StatusBadge tone={operation.statusTone}>{operation.status}</StatusBadge>
                      </td>
                      <td>{operation.actorLabel}</td>
                      <td>{operation.tenantLabel}</td>
                      <td>{operation.timestampLabel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <ConsoleEmptyState
                        description="No operations are currently visible in this workspace."
                        title="No operation history"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PanelSection>
      </Panel>
    </div>
  );
}

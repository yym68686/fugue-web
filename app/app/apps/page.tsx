import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getConsoleData } from "@/lib/console/presenters";

export default async function AppsPage() {
  const consoleData = await getConsoleData();

  if (consoleData.workspace.stage !== "ready") {
    redirect("/app?dialog=create");
  }

  const uniqueSources = new Set(consoleData.apps.map((app) => app.sourceLabel)).size;
  const routedApps = consoleData.apps.filter((app) => app.routeLabel !== "Unassigned").length;
  const latestUpdate = consoleData.apps[0]?.updatedLabel ?? "Not yet";

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app/runtimes", label: "Inspect runtimes" },
          { href: "/app/operations", label: "Review active operations", variant: "primary" },
        ]}
        description="Routes, runtimes, source repos, and current phase for each app in this workspace."
        eyebrow="Apps"
        title="Apps in scope"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Inventory</p>
            <PanelTitle>Current apps</PanelTitle>
            <PanelCopy>Live apps visible through your workspace admin key.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <div className="fg-console-table-wrap">
              <table className="fg-console-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Project</th>
                    <th>Runtime</th>
                    <th>Route</th>
                    <th>Phase</th>
                    <th>Replicas</th>
                    <th>Last operation</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {consoleData.apps.length ? (
                    consoleData.apps.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div className="fg-console-table__stack">
                            <strong>{app.name}</strong>
                            <span>{app.sourceLabel}</span>
                          </div>
                        </td>
                        <td>{app.projectLabel}</td>
                        <td>{app.runtimeLabel}</td>
                        <td>
                          {app.routeHref ? (
                            <a className="fg-text-link" href={app.routeHref} rel="noreferrer" target="_blank">
                              {app.routeLabel}
                            </a>
                          ) : (
                            app.routeLabel
                          )}
                        </td>
                        <td>
                          <StatusBadge tone={app.phaseTone}>{app.phase}</StatusBadge>
                        </td>
                        <td>{app.replicasLabel}</td>
                        <td>{app.lastOperationLabel}</td>
                        <td>{app.updatedLabel}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <ConsoleEmptyState
                          action={{ href: "/app/settings/workspace", label: "Check scope" }}
                          description="No apps are visible in this workspace right now."
                          title="No apps visible"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Current surface</p>
            <PanelTitle>Current readout</PanelTitle>
            <PanelCopy>Counts, source spread, and the newest status message.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <ul className="fg-console-stat-list">
              <li>
                <strong>Routed apps</strong>
                <span>{routedApps} visible</span>
              </li>
              <li>
                <strong>Source repos</strong>
                <span>{uniqueSources} visible</span>
              </li>
              <li>
                <strong>Latest app update</strong>
                <span>{latestUpdate}</span>
              </li>
              <li>
                <strong>Projects in scope</strong>
                <span>{consoleData.summary.projectCount}</span>
              </li>
            </ul>
            {consoleData.apps[0] ? (
              <div className="fg-console-empty-state">
                <div>
                  <strong>Most recent app message</strong>
                  <p>{consoleData.apps[0].lastMessage}</p>
                </div>
                <div className="fg-console-empty-state__actions">
                  <Link className="fg-text-link" href="/app/operations">
                    Follow operations
                  </Link>
                </div>
              </div>
            ) : null}
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}

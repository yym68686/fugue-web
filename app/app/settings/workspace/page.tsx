import { redirect } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getCurrentSession } from "@/lib/auth/session";
import { getConsoleData } from "@/lib/console/presenters";
import { getCurrentWorkspaceAccess } from "@/lib/workspace/current";

function readSessionName(name: string | undefined, email: string) {
  return name?.trim() || email.split("@")[0] || email;
}

function readProviderLabel(provider: "email" | "google") {
  switch (provider) {
    case "google":
      return "Google";
    case "email":
      return "Email";
    default:
      return provider;
  }
}

function readVerificationLabel(verified: boolean) {
  return verified ? "Verified" : "Unverified";
}

export default async function WorkspaceSettingsPage() {
  const consoleData = await getConsoleData();
  const session = await getCurrentSession();
  const workspace = await getCurrentWorkspaceAccess();

  if (!session) {
    return null;
  }

  if (consoleData.workspace.stage === "needs-workspace") {
    redirect("/app?dialog=create");
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app", label: "Back to projects" },
          { href: "/app/api-keys", label: "Manage access keys", variant: "primary" },
        ]}
        description="Product auth, workspace ownership, and the stored tenant admin key meet here. Bootstrap access is only used once to mint the workspace admin key."
        eyebrow="Workspace"
        title="Identity and control-plane boundary"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Control-plane access</p>
            <PanelTitle>Current Fugue path</PanelTitle>
            <PanelCopy>
              Every normal request now runs through your stored workspace admin key. The bootstrap
              key is only used to provision the workspace and mint that admin key.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <div>
                <dt>Connection state</dt>
                <dd>{consoleData.summary.connectionLabel}</dd>
              </div>
              <div>
                <dt>Access scope</dt>
                <dd>{consoleData.summary.scopeLabel}</dd>
              </div>
              <div>
                <dt>Admin key</dt>
                <dd>{workspace?.adminKeyLabel ?? consoleData.workspace.adminKeyLabel ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Admin key id</dt>
                <dd>{workspace?.adminKeyId ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Control-plane host</dt>
                <dd>{consoleData.summary.apiHost}</dd>
              </div>
              <div>
                <dt>Tenant</dt>
                <dd>{consoleData.workspace.tenantName ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{consoleData.workspace.defaultProjectName ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Latest activity</dt>
                <dd>{consoleData.summary.latestActivityExact}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Session</p>
            <PanelTitle>Current product login</PanelTitle>
            <PanelCopy>
              Product auth stays separate from Fugue scopes. This identity opens the website; the
              server then selects your stored workspace admin key for Fugue requests.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            <div className="fg-console-inline-status">
              <StatusBadge tone="neutral">{readProviderLabel(session.provider)}</StatusBadge>
              <StatusBadge tone={session.verified ? "positive" : "warning"}>
                {readVerificationLabel(session.verified)}
              </StatusBadge>
            </div>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <div>
                <dt>Name</dt>
                <dd>{readSessionName(session.name, session.email)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{session.email}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{readProviderLabel(session.provider)}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>{readVerificationLabel(session.verified)}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>
      </section>

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Visible tenants</p>
            <PanelTitle>Current control-plane surface</PanelTitle>
            <PanelCopy>
              There is no separate membership service yet, so the most truthful surface is still what
              your workspace admin key can currently observe from Fugue.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            {consoleData.tenants.length ? (
              <ul className="fg-console-list">
                {consoleData.tenants.map((tenant) => (
                  <li className="fg-console-list__item" key={tenant.id}>
                    <div className="fg-console-list__main">
                      <div className="fg-console-list__title-row">
                        <strong>{tenant.label}</strong>
                        <StatusBadge tone="neutral">{tenant.latestActivityLabel}</StatusBadge>
                      </div>
                      <p>{tenant.id}</p>
                    </div>
                    <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
                      <div>
                        <dt>Apps</dt>
                        <dd>{tenant.appCount}</dd>
                      </div>
                      <div>
                        <dt>Runtimes</dt>
                        <dd>{tenant.runtimeCount}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <ConsoleEmptyState
                description="No tenant visibility is currently coming back from Fugue. Check the configured key and control-plane host."
                title="No tenants visible"
              />
            )}
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Recent actors</p>
            <PanelTitle>Who is touching the control plane</PanelTitle>
            <PanelCopy>
              Until product-level roles land, recent Fugue actors remain the clearest visibility
              surface for operational access.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            {consoleData.actors.length ? (
              <ul className="fg-console-list">
                {consoleData.actors.map((actor) => (
                  <li className="fg-console-list__item" key={`${actor.typeLabel}:${actor.id}`}>
                    <div className="fg-console-list__main">
                      <div className="fg-console-list__title-row">
                        <strong>{actor.label}</strong>
                        <StatusBadge tone="neutral">{actor.typeLabel}</StatusBadge>
                      </div>
                      <p>{actor.eventCount} recent events</p>
                    </div>
                    <StatusBadge tone="info">{actor.lastSeenLabel}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <ConsoleEmptyState
                description="No recent actors are visible in Fugue audit yet."
                title="No actor activity"
              />
            )}
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}

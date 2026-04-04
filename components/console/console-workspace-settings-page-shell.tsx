"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleLoadingState,
  ConsoleWorkspaceSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";
import { StatusBadge } from "@/components/console/status-badge";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import {
  CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL,
  type ConsoleWorkspaceSettingsPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

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

export function ConsoleWorkspaceSettingsPageShell() {
  const router = useRouter();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleWorkspaceSettingsPageSnapshot>(
      CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL,
    );

  useEffect(() => {
    if (data?.state !== "workspace-missing") {
      return;
    }

    router.replace("/app?dialog=create");
  }, [data, router]);

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleWorkspaceSettingsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          actions={[
            { href: "/app", label: "Back to projects" },
            { href: "/app/api-keys", label: "Manage access keys", variant: "primary" },
          ]}
          description="Current login, workspace access, and control-plane visibility."
          eyebrow="Workspace"
          title="Identity and access"
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load workspace settings right now."}
              title="Workspace settings unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  if (data.state === "workspace-missing") {
    return (
      <ConsoleLoadingState>
        <ConsoleWorkspaceSettingsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app", label: "Back to projects" },
          { href: "/app/api-keys", label: "Manage access keys", variant: "primary" },
        ]}
        description="Current login, workspace access, and control-plane visibility."
        eyebrow="Workspace"
        title="Identity and access"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Control-plane access</p>
            <PanelTitle>Current workspace access</PanelTitle>
            <PanelCopy>Requests use the stored workspace admin key.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <div>
                <dt>Connection state</dt>
                <dd>{data.consoleData.summary.connectionLabel}</dd>
              </div>
              <div>
                <dt>Access scope</dt>
                <dd>{data.consoleData.summary.scopeLabel}</dd>
              </div>
              <div>
                <dt>Admin key</dt>
                <dd>
                  {data.workspace?.adminKeyLabel ??
                    data.consoleData.workspace.adminKeyLabel ??
                    "Not assigned"}
                </dd>
              </div>
              <div>
                <dt>Admin key id</dt>
                <dd>{data.workspace?.adminKeyId ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Control-plane host</dt>
                <dd>{data.consoleData.summary.apiHost}</dd>
              </div>
              <div>
                <dt>Tenant</dt>
                <dd>{data.consoleData.workspace.tenantName ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{data.consoleData.workspace.defaultProjectName ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Latest activity</dt>
                <dd>{data.consoleData.summary.latestActivityExact}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Session</p>
            <PanelTitle>Current login</PanelTitle>
            <PanelCopy>Website sign-in and Fugue access stay separate.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <div className="fg-console-inline-status">
              <StatusBadge tone="neutral">
                {readProviderLabel(data.session.provider)}
              </StatusBadge>
              <StatusBadge tone={data.session.verified ? "positive" : "warning"}>
                {readVerificationLabel(data.session.verified)}
              </StatusBadge>
            </div>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <div>
                <dt>Name</dt>
                <dd>{readSessionName(data.session.name, data.session.email)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{data.session.email}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{readProviderLabel(data.session.provider)}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>{readVerificationLabel(data.session.verified)}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>
      </section>

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Visible tenants</p>
            <PanelTitle>Tenant visibility</PanelTitle>
            <PanelCopy>Visible from the current workspace admin key.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {data.consoleData.tenants.length ? (
              <ul className="fg-console-list">
                {data.consoleData.tenants.map((tenant) => (
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
                description="No tenant data is visible. Check the configured key and control-plane host."
                title="No tenants visible"
              />
            )}
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Audit</p>
            <PanelTitle>Recent actors</PanelTitle>
            <PanelCopy>Recent actors in Fugue audit.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {data.consoleData.actors.length ? (
              <ul className="fg-console-list">
                {data.consoleData.actors.map((actor) => (
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
                description="No recent actors are visible yet."
                title="No actor activity"
              />
            )}
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}

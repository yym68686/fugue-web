"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleLoadingState,
  ConsoleWorkspaceSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  readAuthMethodLabel,
  readProviderLabel,
  readSessionLabel,
  readVerificationLabel,
} from "@/lib/auth/presenters";
import {
  CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL,
  type ConsoleWorkspaceSettingsPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useGitHubConnection } from "@/lib/github/connection-client";
import { requestJson } from "@/lib/ui/request-json";

function readConnectionTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "Not connected";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function ConsoleWorkspaceSettingsPageShell() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleWorkspaceSettingsPageSnapshot>(
      CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL,
    );
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
    refresh: refreshGitHubConnection,
  } = useGitHubConnection();
  const [disconnectingGitHub, setDisconnectingGitHub] = useState(false);

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

  async function handleDisconnectGitHub() {
    if (disconnectingGitHub) {
      return;
    }

    setDisconnectingGitHub(true);

    try {
      await requestJson("/api/auth/github/connection", {
        method: "DELETE",
      });
      await refreshGitHubConnection();
      showToast({
        message: "GitHub access disconnected.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not disconnect GitHub access.",
        variant: "error",
      });
    } finally {
      setDisconnectingGitHub(false);
    }
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
                {readAuthMethodLabel(data.session.authMethod, data.session.provider)}
              </StatusBadge>
              <StatusBadge tone={data.session.verified ? "positive" : "warning"}>
                {readVerificationLabel(data.session.verified)}
              </StatusBadge>
            </div>
            <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
              <div>
                <dt>Name</dt>
                <dd>{readSessionLabel(data.session)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{data.session.email}</dd>
              </div>
              <div>
                <dt>Sign-in method</dt>
                <dd>{readAuthMethodLabel(data.session.authMethod, data.session.provider)}</dd>
              </div>
              <div>
                <dt>Current provider</dt>
                <dd>{readProviderLabel(data.session.provider)}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>{readVerificationLabel(data.session.verified)}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Source access</p>
            <PanelTitle>GitHub authorization</PanelTitle>
            <PanelCopy>
              Authorize once to deploy and auto-sync private repositories without pasting a token into each service.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            {githubConnectionLoading ? (
              <InlineAlert>Checking saved GitHub access…</InlineAlert>
            ) : githubConnectionError ? (
              <InlineAlert variant="warning">{githubConnectionError}</InlineAlert>
            ) : githubConnection?.connected ? (
              <>
                <div className="fg-console-inline-status">
                  <StatusBadge tone="positive">Connected</StatusBadge>
                  <StatusBadge tone="neutral">
                    {githubConnection.login ? `@${githubConnection.login}` : "GitHub"}
                  </StatusBadge>
                </div>
                <dl className="fg-console-inline-meta fg-console-inline-meta--stacked">
                  <div>
                    <dt>Account</dt>
                    <dd>
                      {githubConnection.login
                        ? `@${githubConnection.login}`
                        : "Saved GitHub access"}
                    </dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{githubConnection.name ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Scopes</dt>
                    <dd>
                      {githubConnection.scopes.length
                        ? githubConnection.scopes.join(", ")
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{readConnectionTimeLabel(githubConnection.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="fg-settings-form__actions">
                  {githubConnection.authEnabled ? (
                    <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                      Reconnect GitHub
                    </ButtonAnchor>
                  ) : null}
                  <Button
                    disabled={disconnectingGitHub}
                    loading={disconnectingGitHub}
                    loadingLabel="Disconnecting…"
                    size="compact"
                    type="button"
                    variant="danger"
                    onClick={handleDisconnectGitHub}
                  >
                    Disconnect
                  </Button>
                </div>
              </>
            ) : githubConnection?.authEnabled ? (
              <>
                <InlineAlert>
                  GitHub web authorization is available. Use it when a repository needs private access.
                </InlineAlert>
                <div className="fg-settings-form__actions">
                  <ButtonAnchor href={githubConnectHref} size="compact" variant="primary">
                    Connect GitHub
                  </ButtonAnchor>
                </div>
              </>
            ) : (
              <InlineAlert variant="warning">
                GitHub web authorization is not configured in this environment. Private repositories still need a pasted token.
              </InlineAlert>
            )}
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

import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ConsoleNav } from "@/components/console/console-nav";
import { ConsolePrimaryAction } from "@/components/console/console-primary-action";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { getFugueApps } from "@/lib/fugue/api";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

function readSessionLabel(session: SessionUser) {
  return session.name?.trim() || session.email.split("@")[0] || session.email;
}

function readMonogram(label: string) {
  const normalized = label.replace(/[^a-z0-9]+/gi, "");

  if (!normalized) {
    return "Fg";
  }

  const first = normalized[0] ?? "F";
  const second = normalized[1] ?? "g";
  return `${first.toUpperCase()}${second.toLowerCase()}`;
}

function readProviderLabel(provider: SessionUser["provider"]) {
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

export async function ConsoleShell({
  children,
  isAdmin = false,
  session,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  session: SessionUser;
}) {
  const sessionLabel = readSessionLabel(session);
  let hasProjects = false;

  try {
    const workspace = await getWorkspaceAccessByEmail(session.email);

    if (workspace) {
      const apps = await getFugueApps(workspace.adminKeySecret);
      hasProjects = apps.length > 0;
    }
  } catch {
    hasProjects = false;
  }

  return (
    <main className="fg-console">
      <div className="fg-console-shell fg-console-shell--stacked">
        <header className="fg-console-topbar">
          <div className="fg-console-topbar__brand">
            <Brand meta="Console" />
          </div>

          <ConsoleNav isAdmin={isAdmin} />

          <div className="fg-console-topbar__actions">
            <ConsolePrimaryAction hasProjects={hasProjects} />

            <details className="fg-console-profile">
              <summary className="fg-console-profile__trigger">
                <span className="fg-console-profile__avatar" aria-hidden="true">
                  {readMonogram(sessionLabel)}
                </span>
                <span className="fg-console-profile__summary">
                  <strong>{sessionLabel}</strong>
                  <span>{session.email}</span>
                </span>
              </summary>

              <div className="fg-console-profile__menu">
                <div className="fg-console-profile__menu-head">
                  <strong>{sessionLabel}</strong>
                  <span>{session.email}</span>
                </div>

                <div className="fg-console-inline-status">
                  {isAdmin ? <StatusBadge tone="info">Admin</StatusBadge> : null}
                  <StatusBadge tone="neutral">{readProviderLabel(session.provider)}</StatusBadge>
                  <StatusBadge tone={session.verified ? "positive" : "warning"}>
                    {readVerificationLabel(session.verified)}
                  </StatusBadge>
                </div>

                <form action="/api/auth/sign-out" className="fg-signout-form" method="post">
                  <Button className="fg-button--full-width" size="compact" type="submit" variant="secondary">
                    Sign out
                  </Button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <div className="fg-console-content">{children}</div>
      </div>
    </main>
  );
}

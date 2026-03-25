import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ConsoleNav } from "@/components/console/console-nav";
import { ConsolePrimaryAction } from "@/components/console/console-primary-action";
import { StatusBadge } from "@/components/console/status-badge";
import type { SessionUser } from "@/lib/auth/session";

function readSessionLabel(session: SessionUser) {
  return session.name?.trim() || session.email.split("@")[0] || session.email;
}

function readInitials(label: string) {
  const tokens = label.split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return "FG";
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");
}

export async function ConsoleShell({
  children,
  session,
}: {
  children: ReactNode;
  session: SessionUser;
}) {
  const sessionLabel = readSessionLabel(session);

  return (
    <main className="fg-console">
      <div className="fg-console-shell fg-console-shell--stacked">
        <header className="fg-console-topbar">
          <div className="fg-console-topbar__brand">
            <Brand meta="console" />
          </div>

          <ConsoleNav />

          <div className="fg-console-topbar__actions">
            <ConsolePrimaryAction />

            <details className="fg-console-profile">
              <summary className="fg-console-profile__trigger">
                <span className="fg-console-profile__avatar" aria-hidden="true">
                  {readInitials(sessionLabel)}
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
                  <StatusBadge tone="neutral">{session.provider}</StatusBadge>
                  <StatusBadge tone={session.verified ? "positive" : "warning"}>
                    {session.verified ? "verified" : "unverified"}
                  </StatusBadge>
                </div>

                <form action="/api/auth/sign-out" className="fg-signout-form" method="post">
                  <button className="fg-console-menu-button" type="submit">
                    Sign out
                  </button>
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

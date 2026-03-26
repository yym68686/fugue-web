import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ConsoleNav } from "@/components/console/console-nav";
import { ConsoleProfileMenu } from "@/components/console/console-profile-menu";
import { ConsolePrimaryAction } from "@/components/console/console-primary-action";
import type { SessionUser } from "@/lib/auth/session";
import { getFugueApps } from "@/lib/fugue/api";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

export async function ConsoleShell({
  children,
  isAdmin = false,
  session,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  session: SessionUser;
}) {
  let hasProjects = false;

  try {
    let workspace = await getWorkspaceAccessByEmail(session.email);

    if (workspace) {
      try {
        const apps = await getFugueApps(workspace.adminKeySecret);
        hasProjects = apps.length > 0;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("401")) {
          throw error;
        }

        const refreshed = await ensureWorkspaceAccess(session);
        workspace = refreshed.workspace;
        const apps = await getFugueApps(workspace.adminKeySecret);
        hasProjects = apps.length > 0;
      }
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
            <ConsoleProfileMenu isAdmin={isAdmin} session={session} />
          </div>
        </header>

        <div className="fg-console-content">{children}</div>
      </div>
    </main>
  );
}

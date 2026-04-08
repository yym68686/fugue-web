import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ConsoleNav } from "@/components/console/console-nav";
import { ConsoleProfileMenu } from "@/components/console/console-profile-menu";
import { ConsolePrimaryAction } from "@/components/console/console-primary-action";
import {
  ConsoleRouteTransitionContent,
  ConsoleRouteTransitionProvider,
} from "@/components/console/console-route-transition";
import type { SessionUser } from "@/lib/auth/session";

export function ConsoleShell({
  children,
  hasProjects = false,
  isAdmin = false,
  session,
}: {
  children: ReactNode;
  hasProjects?: boolean;
  isAdmin?: boolean;
  session: SessionUser;
}) {
  return (
    <main className="fg-console">
      <div className="fg-console-shell fg-console-shell--stacked">
        <ConsoleRouteTransitionProvider>
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

          <ConsoleRouteTransitionContent>{children}</ConsoleRouteTransitionContent>
        </ConsoleRouteTransitionProvider>
      </div>
    </main>
  );
}

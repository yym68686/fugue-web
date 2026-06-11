import type { ReactNode } from "react";

import { ConsoleSidebar } from "@/components/console/console-sidebar";
import { ConsoleTopbar } from "@/components/console/console-topbar";
import {
  ConsoleRouteTransitionContent,
  ConsoleRouteTransitionProvider,
} from "@/components/console/console-route-transition";
import { PlatformShell } from "@/components/platform/platform-layout";
import type { SessionUser } from "@/lib/auth/session";
import { getRequestI18n } from "@/lib/i18n/server";

export async function ConsoleShell({
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
  const { t } = await getRequestI18n();

  return (
    <ConsoleRouteTransitionProvider>
      <PlatformShell
        className="fp-app-shell--console"
        mobileNavigationLabel={t("Open menu")}
        mobileNavigation={
          <ConsoleSidebar isAdmin={isAdmin} />
        }
        sidebar={<ConsoleSidebar isAdmin={isAdmin} />}
        topbar={
          <ConsoleTopbar
            hasProjects={hasProjects}
            isAdmin={isAdmin}
            session={session}
          />
        }
      >
        <ConsoleRouteTransitionContent>{children}</ConsoleRouteTransitionContent>
      </PlatformShell>
    </ConsoleRouteTransitionProvider>
  );
}

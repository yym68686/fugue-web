"use client";

import { useMemo } from "react";

import { ConsolePrimaryAction } from "@/components/console/console-primary-action";
import { ConsoleProfileMenu } from "@/components/console/console-profile-menu";
import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { PlatformBreadcrumbs, PlatformTopbar } from "@/components/platform/platform-layout";
import { LocaleMenuButton } from "@/components/ui/locale-switcher";
import { ThemeMenuButton } from "@/components/ui/theme-switcher";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";
import type { SessionUser } from "@/lib/auth/session";

function projectDetailLabel(pathname: string, fallback: string) {
  if (!pathname.startsWith("/app/projects/")) {
    return fallback;
  }

  const encodedProjectId = pathname.split("/").filter(Boolean)[2];

  if (!encodedProjectId) {
    return fallback;
  }

  try {
    return decodeURIComponent(encodedProjectId);
  } catch {
    return encodedProjectId;
  }
}

export function ConsoleTopbar({
  hasProjects,
  isAdmin,
  session,
}: {
  hasProjects: boolean;
  isAdmin: boolean;
  session: SessionUser;
}) {
  const { locale, t } = useI18n();
  const { displayPathname } = useConsoleRouteTransition();
  const activeItem = useMemo(() => {
    const groups = getConsoleNavGroups({ isAdmin, locale });

    return groups
      .flatMap((group) => group.items)
      .find((item) => isConsoleNavHrefActive(displayPathname, item.href));
  }, [displayPathname, isAdmin, locale]);
  const currentLabel =
    displayPathname.startsWith("/app/projects/")
      ? projectDetailLabel(displayPathname, t("Project workbench"))
      : activeItem?.label ?? t("Console");

  return (
    <PlatformTopbar
      actions={
        <>
          <ConsolePrimaryAction hasProjects={hasProjects} />
          <LocaleMenuButton />
          <ThemeMenuButton />
          <ConsoleProfileMenu isAdmin={isAdmin} session={session} />
        </>
      }
      breadcrumbs={
        <PlatformBreadcrumbs
          items={[
            { href: "/app", label: t("Console") },
            { current: true, label: currentLabel },
          ]}
        />
      }
      title={currentLabel}
    />
  );
}

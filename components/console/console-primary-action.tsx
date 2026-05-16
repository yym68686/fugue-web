"use client";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { dispatchOpenCreateProjectDialogEvent } from "@/lib/console/dialog-events";

function isProjectDetailPathname(pathname: string) {
  return pathname.startsWith("/app/projects/");
}

export function ConsolePrimaryAction({ hasProjects }: { hasProjects: boolean }) {
  const { t } = useI18n();
  const className = "fg-console-topbar__primary-action";
  const { beginRouteTransition, displayPathname } = useConsoleRouteTransition();

  if (displayPathname === "/app") {
    return (
      <Button
        className={className}
        onClick={dispatchOpenCreateProjectDialogEvent}
        size="compact"
        type="button"
        variant="primary"
      >
        {t("Create project")}
      </Button>
    );
  }

  if (isProjectDetailPathname(displayPathname)) {
    return (
      <ButtonLink
        className={className}
        href="/app"
        onNavigate={() => {
          beginRouteTransition("/app", t("Projects"));
        }}
        size="compact"
        variant="secondary"
      >
        {t("Back home")}
      </ButtonLink>
    );
  }

  if (!hasProjects) {
    return null;
  }

  return (
    <ButtonLink
      className={className}
      href="/app?dialog=create"
      size="compact"
      variant="primary"
    >
      {t("Create project")}
    </ButtonLink>
  );
}

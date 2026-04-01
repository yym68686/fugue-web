"use client";

import { usePathname } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { dispatchOpenCreateProjectDialogEvent } from "@/lib/console/dialog-events";

export function ConsolePrimaryAction({ hasProjects }: { hasProjects: boolean }) {
  const className = "fg-console-topbar__primary-action";
  const pathname = usePathname();

  if (!hasProjects) {
    return null;
  }

  if (pathname === "/app") {
    return (
      <Button
        className={className}
        onClick={dispatchOpenCreateProjectDialogEvent}
        size="compact"
        type="button"
        variant="primary"
      >
        Create project
      </Button>
    );
  }

  return (
    <ButtonLink
      className={className}
      href="/app?dialog=create"
      size="compact"
      variant="primary"
    >
      Create project
    </ButtonLink>
  );
}

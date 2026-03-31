"use client";

import { ButtonLink } from "@/components/ui/button";

export function ConsolePrimaryAction({ hasProjects }: { hasProjects: boolean }) {
  const className = "fg-console-topbar__primary-action";

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
      Create project
    </ButtonLink>
  );
}

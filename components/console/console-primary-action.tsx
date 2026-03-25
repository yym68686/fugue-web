"use client";

import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";

function isApiKeysPath(pathname: string) {
  return pathname === "/app/api-keys" || pathname.startsWith("/app/api-keys/");
}

export function ConsolePrimaryAction() {
  const pathname = usePathname();
  const className = "fg-console-topbar__primary-action";

  if (isApiKeysPath(pathname)) {
    return null;
  }

  return (
    <ButtonLink
      className={className}
      href="/app?dialog=create"
      size="compact"
      variant="route"
    >
      Create project
    </ButtonLink>
  );
}

"use client";

import { usePathname } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { API_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";

function isApiKeysPath(pathname: string) {
  return pathname === "/app/api-keys" || pathname.startsWith("/app/api-keys/");
}

export function ConsolePrimaryAction() {
  const pathname = usePathname();
  const className = "fg-console-topbar__primary-action";

  if (isApiKeysPath(pathname)) {
    return (
      <Button
        className={className}
        onClick={() => {
          window.dispatchEvent(new CustomEvent(API_KEY_CREATE_REQUEST_EVENT));
        }}
        size="compact"
        type="button"
        variant="primary"
      >
        Create key
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

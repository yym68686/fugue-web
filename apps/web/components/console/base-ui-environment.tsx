"use client";

import { CSPProvider } from "@fugue/ui/base-ui/csp-provider";
import { DirectionProvider } from "@fugue/ui/base-ui/direction-provider";
import type { ReactNode } from "react";

import type { TextDirection } from "@/lib/i18n/core";

export function ConsoleBaseUIEnvironment({
  children,
  direction,
  nonce,
}: {
  children: ReactNode;
  direction: TextDirection;
  /** Supply only when the server emitted the same nonce in its CSP header. */
  nonce?: string;
}) {
  if (direction === "ltr" && !nonce) {
    return children;
  }

  const directionalChildren =
    direction === "rtl" ? (
      <DirectionProvider direction={direction}>{children}</DirectionProvider>
    ) : (
      children
    );

  return nonce ? (
    <CSPProvider nonce={nonce}>{directionalChildren}</CSPProvider>
  ) : (
    directionalChildren
  );
}

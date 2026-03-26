"use client";

import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";

function readSessionLabel(session: SessionUser) {
  return session.name?.trim() || session.email.split("@")[0] || session.email;
}

function readMonogram(label: string) {
  const normalized = label.replace(/[^a-z0-9]+/gi, "");

  if (!normalized) {
    return "Fg";
  }

  const first = normalized[0] ?? "F";
  const second = normalized[1] ?? "g";
  return `${first.toUpperCase()}${second.toLowerCase()}`;
}

function readProviderLabel(provider: SessionUser["provider"]) {
  switch (provider) {
    case "google":
      return "Google";
    case "email":
      return "Email";
    default:
      return provider;
  }
}

function readVerificationLabel(verified: boolean) {
  return verified ? "Verified" : "Unverified";
}

export function ConsoleProfileMenu({
  isAdmin = false,
  session,
}: {
  isAdmin?: boolean;
  session: SessionUser;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const sessionLabel = readSessionLabel(session);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = detailsRef.current;

      if (!container) {
        return;
      }

      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpen(false);
      triggerRef.current?.focus();
    }

    function handleFocusIn(event: FocusEvent) {
      const container = detailsRef.current;

      if (!container) {
        return;
      }

      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  return (
    <details
      className="fg-console-profile"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={detailsRef}
    >
      <summary aria-expanded={open} className="fg-console-profile__trigger" ref={triggerRef}>
        <span className="fg-console-profile__avatar" aria-hidden="true">
          {readMonogram(sessionLabel)}
        </span>
        <span className="fg-console-profile__summary">
          <strong>{sessionLabel}</strong>
          <span>{session.email}</span>
        </span>
      </summary>

      <div className="fg-console-profile__menu">
        <div className="fg-console-profile__menu-head">
          <strong>{sessionLabel}</strong>
          <span>{session.email}</span>
        </div>

        <div className="fg-console-inline-status">
          {isAdmin ? <StatusBadge tone="info">Admin</StatusBadge> : null}
          <StatusBadge tone="neutral">{readProviderLabel(session.provider)}</StatusBadge>
          <StatusBadge tone={session.verified ? "positive" : "warning"}>
            {readVerificationLabel(session.verified)}
          </StatusBadge>
        </div>

        <form action="/api/auth/sign-out" className="fg-signout-form" method="post">
          <Button className="fg-button--full-width" size="compact" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </details>
  );
}

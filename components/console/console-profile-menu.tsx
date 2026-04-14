"use client";

import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import {
  readAuthMethodLabel,
  readSessionLabel,
  readSessionMonogram,
  readVerificationLabel,
} from "@/lib/auth/presenters";
import type { SessionUser } from "@/lib/auth/session";

export function ConsoleProfileMenu({
  isAdmin = false,
  session,
}: {
  isAdmin?: boolean;
  session: SessionUser;
}) {
  const { locale, t } = useI18n();
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
          {readSessionMonogram(sessionLabel)}
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
          {isAdmin ? <StatusBadge tone="info">{t("Admin")}</StatusBadge> : null}
          <StatusBadge tone="neutral">
            {readAuthMethodLabel(session.authMethod, session.provider, locale)}
          </StatusBadge>
          <StatusBadge tone={session.verified ? "positive" : "warning"}>
            {readVerificationLabel(session.verified, locale)}
          </StatusBadge>
        </div>

        <div className="fg-console-profile__section">
          <p className="fg-console-profile__section-label fg-mono">{t("Interface language")}</p>
          <LocaleSwitcher
            className="fg-console-profile__locale-switcher"
            onChangeComplete={() => setOpen(false)}
            variant="pill"
          />
        </div>

        <ButtonLink className="fg-button--full-width" href="/app/settings/profile" size="compact" variant="secondary">
          {t("Profile and security")}
        </ButtonLink>

        <form action="/api/auth/sign-out" className="fg-signout-form" method="post">
          <Button className="fg-button--full-width" size="compact" type="submit" variant="secondary">
            {t("Sign out")}
          </Button>
        </form>
      </div>
    </details>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import {
  readAuthMethodLabel,
  readSessionLabel,
  readSessionMonogram,
  readVerificationLabel,
} from "@/lib/auth/presenters";
import type { SessionUser } from "@/lib/auth/session";
import { cx } from "@/lib/ui/cx";
import { useTransitionPresence } from "@/lib/ui/transition-presence";

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
  const {
    close: closeProfileMenu,
    closing: profileMenuClosing,
    open: profileMenuOpen,
    present: profileMenuPresent,
    toggle: toggleProfileMenu,
  } = useTransitionPresence({
    closePropertyName: "--dropdown-close-dur",
    fallbackCloseMs: 150,
  });
  const sessionLabel = readSessionLabel(session);

  useEffect(() => {
    if (!profileMenuOpen) {
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

      closeProfileMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      closeProfileMenu();
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

      closeProfileMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [closeProfileMenu, profileMenuOpen]);

  return (
    <details
      className="fg-console-profile"
      open={profileMenuPresent}
      ref={detailsRef}
    >
      <summary
        aria-expanded={profileMenuOpen}
        className="fg-console-profile__trigger"
        onClick={(event) => {
          event.preventDefault();
          toggleProfileMenu();
        }}
        ref={triggerRef}
      >
        <span className="fg-console-profile__avatar" aria-hidden="true">
          {readSessionMonogram(sessionLabel)}
        </span>
        <span className="fg-console-profile__summary">
          <strong>{sessionLabel}</strong>
          <span>{session.email}</span>
        </span>
      </summary>

      <div
        className={cx(
          "fg-console-profile__menu",
          "t-dropdown",
          profileMenuOpen && "is-open",
          profileMenuClosing && "is-closing",
        )}
        data-origin="top-right"
      >
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
          <p className="fg-console-profile__section-label fg-mono">{t("Theme")}</p>
          <ThemeSwitcher
            className="fg-console-profile__theme-switcher"
            onChangeComplete={() => closeProfileMenu()}
            variant="pill"
          />
        </div>

        <div className="fg-console-profile__section">
          <p className="fg-console-profile__section-label fg-mono">{t("Interface language")}</p>
          <LocaleSwitcher
            className="fg-console-profile__locale-switcher"
            onChangeComplete={() => closeProfileMenu()}
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

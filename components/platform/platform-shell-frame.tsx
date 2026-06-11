"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { PlatformIcon } from "@/components/platform/platform-icon";
import { cx } from "@/lib/ui/cx";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "fugue:platform-sidebar-collapsed";

export function PlatformShellFrame({
  children,
  className,
  collapseSidebarLabel,
  expandSidebarLabel,
  mobileNavigation,
  mobileNavigationLabel,
  sidebar,
  topbar,
}: {
  children: ReactNode;
  className?: string;
  collapseSidebarLabel: string;
  expandSidebarLabel: string;
  mobileNavigation?: ReactNode;
  mobileNavigationLabel: string;
  sidebar: ReactNode;
  topbar: ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    try {
      setIsSidebarCollapsed(
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true",
      );
    } catch {
      setIsSidebarCollapsed(false);
    } finally {
      setHasLoadedPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPreference) {
      return;
    }

    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        String(isSidebarCollapsed),
      );
    } catch {
      // Persistence is best-effort; the control should still work in-memory.
    }
  }, [hasLoadedPreference, isSidebarCollapsed]);

  return (
    <main
      className={cx(
        "app-shell fp-app-shell",
        isSidebarCollapsed && "sidebar-collapsed fp-app-shell--sidebar-collapsed",
        className,
      )}
    >
      <aside
        aria-hidden={isSidebarCollapsed}
        className="sidebar fp-sidebar fp-sidebar--desktop"
        id="platform-sidebar"
      >
        <button
          aria-controls="platform-sidebar"
          aria-expanded={!isSidebarCollapsed}
          aria-label={collapseSidebarLabel}
          className="fp-button fp-button--ghost fp-icon-button fp-icon-button--sm fp-sidebar-toggle fp-sidebar-toggle--collapse"
          onClick={() => setIsSidebarCollapsed(true)}
          title={collapseSidebarLabel}
          type="button"
        >
          <PlatformIcon name="chevron-left" />
        </button>
        {sidebar}
      </aside>
      <section className="main-pane fp-main">
        <header className="topbar fp-topbar">
          {isSidebarCollapsed ? (
            <button
              aria-controls="platform-sidebar"
              aria-expanded="false"
              aria-label={expandSidebarLabel}
              className="fp-button fp-button--ghost fp-icon-button fp-icon-button--sm fp-sidebar-toggle fp-sidebar-toggle--expand"
              onClick={() => setIsSidebarCollapsed(false)}
              title={expandSidebarLabel}
              type="button"
            >
              <PlatformIcon name="chevron-right" />
            </button>
          ) : null}
          {mobileNavigation ? (
            <details className="fp-mobile-nav">
              <summary className="fp-button fp-icon-button fp-icon-button--sm fp-mobile-nav__trigger">
                <PlatformIcon name="menu" />
                <span className="fg-visually-hidden">{mobileNavigationLabel}</span>
              </summary>
              <div className="fp-mobile-nav__backdrop" />
              <div className="fp-mobile-nav__panel">{mobileNavigation}</div>
            </details>
          ) : null}
          {topbar}
        </header>
        {children}
      </section>
    </main>
  );
}

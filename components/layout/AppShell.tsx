"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale, LocalePreference } from "@/lib/i18n/core";
import type { ThemePreference } from "@/lib/theme";
import { PublicFooter } from "@/components/landing/public-shell";
import UserMenu from "@/components/layout/UserMenu";
import Icon, { type IconName } from "@/components/ui/Icon";

export type AppShellUser = {
  name: string | null;
  email: string;
  pictureUrl: string | null;
  isAdmin: boolean;
};

type NavDef = { href: string; labelKey: string; icon: IconName };

const consoleNav: NavDef[] = [
  { href: "/storage", labelKey: "Object storage", icon: "Storage" },
  { href: "/projects", labelKey: "Projects", icon: "Projects" },
  { href: "/billing", labelKey: "Billing", icon: "Billing" },
  { href: "/keys", labelKey: "Access keys", icon: "Keys" },
  { href: "/servers", labelKey: "Servers", icon: "Servers" },
];

const platformNav: NavDef[] = [
  { href: "/admin/settings", labelKey: "Platform settings", icon: "Settings" },
  { href: "/admin/storage", labelKey: "Platform object storage", icon: "Storage" },
  { href: "/admin/users", labelKey: "Users", icon: "Users" },
  { href: "/admin/cluster", labelKey: "Cluster", icon: "Cluster" },
  { href: "/admin/services", labelKey: "Services", icon: "Services" },
];

function ShellInner({
  children,
  user,
  themePreference,
  localePreference,
}: {
  children: React.ReactNode;
  user: AppShellUser;
  themePreference: ThemePreference;
  localePreference: LocalePreference;
}) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const navId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const navOpen = openPath === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const labels = locale === "zh-CN"
    ? { navigation: "主导航", workspace: "工作区" }
    : { navigation: "Main navigation", workspace: "Workspace" };

  useEffect(() => {
    if (!navOpen) return;
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuButton.current?.contains(target) && !navigation.current?.contains(target)) {
        setOpenPath(null);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [navOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  function renderGroup(items: NavDef[], label: string) {
    return (
      <div className="rail-group">
        <div className="rail-label">{label}</div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${isActive(item.href) ? " active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
            onClick={() => setOpenPath(null)}
          >
            <Icon name={item.icon} />
            {t(item.labelKey)}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          ref={menuButton}
          type="button"
          className="mobile-nav-trigger"
          aria-label={labels.navigation}
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={() => {
            setOpenPath(navOpen ? null : pathname);
            if (!navOpen) requestAnimationFrame(() => navigation.current?.querySelector("a")?.focus());
          }}
        >
          <Icon name={navOpen ? "Close" : "Menu"} />
        </button>
        <Link href="/projects" className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
          <span className="name">
            <b>fugue</b>
          </span>
        </Link>
        <div className="top-spacer"></div>
        <UserMenu
          name={user.name}
          email={user.email}
          pictureUrl={user.pictureUrl}
          themePreference={themePreference}
          localePreference={localePreference}
        />
      </header>

      <nav
        id={navId}
        ref={navigation}
        className={`rail${navOpen ? " rail-open" : ""}`}
        aria-label={labels.navigation}
        onKeyDown={(event) => {
          if (event.key === "Escape" && navOpen) {
            setOpenPath(null);
            menuButton.current?.focus();
          }
        }}
      >
        {renderGroup(consoleNav, labels.workspace)}
        {user.isAdmin && renderGroup(platformNav, t("Platform"))}
      </nav>

      <main className="main">
        {children}
        <PublicFooter locale={locale} compact />
      </main>
    </div>
  );
}

export default function AppShell({
  children,
  user,
  locale,
  themePreference,
  localePreference,
}: {
  children: React.ReactNode;
  user: AppShellUser;
  locale: Locale;
  themePreference: ThemePreference;
  localePreference: LocalePreference;
}) {
  return (
    <I18nProvider locale={locale} preference={localePreference}>
      <ShellInner
        user={user}
        themePreference={themePreference}
        localePreference={localePreference}
      >
        {children}
      </ShellInner>
    </I18nProvider>
  );
}

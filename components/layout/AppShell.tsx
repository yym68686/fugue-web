"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale, LocalePreference } from "@/lib/i18n/core";
import type { ThemePreference } from "@/lib/theme";
import UserMenu from "@/components/layout/UserMenu";

export type AppShellUser = {
  name: string | null;
  email: string;
  pictureUrl: string | null;
  isAdmin: boolean;
};

type NavDef = { href: string; labelKey: string; icon: React.ReactNode };

const consoleNav: NavDef[] = [
  {
    href: "/projects",
    labelKey: "Projects",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/billing",
    labelKey: "Billing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </svg>
    ),
  },
  {
    href: "/keys",
    labelKey: "Access keys",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="5" />
        <path d="M11.5 11.5L21 21M18 18l-2 2M15 15l-2 2" />
      </svg>
    ),
  },
  {
    href: "/servers",
    labelKey: "Servers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="7" rx="1" />
        <rect x="3" y="13" width="18" height="7" rx="1" />
        <path d="M7 7.5v.01M7 16.5v.01" />
      </svg>
    ),
  },
];

const platformNav: NavDef[] = [
  {
    href: "/admin/users",
    labelKey: "Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/cluster",
    labelKey: "Cluster",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 12v.01" />
        <path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13" />
      </svg>
    ),
  },
  {
    href: "/admin/services",
    labelKey: "Services",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
  },
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
  const { t } = useI18n();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
          <span className="name">
            <b>fugue</b>
          </span>
          <span className="badge">CLOUD</span>
        </div>
        <div className="top-spacer"></div>
        <UserMenu
          name={user.name}
          email={user.email}
          pictureUrl={user.pictureUrl}
          themePreference={themePreference}
          localePreference={localePreference}
        />
      </header>

      <aside className="rail">
        <div className="rail-group">
          <div className="eyebrow">
            {t("Console")} <span className="role">{t("Developer")}</span>
          </div>
          {consoleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? " active" : ""}`}
            >
              {item.icon}
              {t(item.labelKey)}
            </Link>
          ))}
        </div>

        {user.isAdmin && (
          <div className="rail-group">
            <div className="eyebrow">
              {t("Platform")} <span className="role">{t("Platform admin")}</span>
            </div>
            {platformNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
              >
                {item.icon}
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        )}

        <div className="rail-foot">
          <div className="row">
            <span className="dot ok"></span> {t("control-plane")}
          </div>
          <div className="row" style={{ marginTop: "5px" }}>
            v2.4.1 · {t("api healthy")}
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
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

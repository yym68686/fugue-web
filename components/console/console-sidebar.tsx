"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { PlatformCommand, PlatformSidebar, PlatformSidebarBrand } from "@/components/platform/platform-layout";
import { PlatformIcon, type PlatformIconName } from "@/components/platform/platform-icon";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";
import type { ConsoleNavIcon } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

function toPlatformIcon(icon: ConsoleNavIcon): PlatformIconName {
  return icon;
}

function ConsoleSidebarNav({
  displayPathname,
  isAdmin,
  locale,
}: {
  displayPathname: string;
  isAdmin: boolean;
  locale: ReturnType<typeof useI18n>["locale"];
}) {
  const { beginRouteTransition } = useConsoleRouteTransition();
  const groups = useMemo(
    () => getConsoleNavGroups({ isAdmin, locale }),
    [displayPathname, isAdmin, locale],
  );

  return (
    <>
      {groups.map((group) => (
        <section className="fp-nav-section" key={group.kind}>
          <h2 className="fp-nav-section__label">{group.label}</h2>
          {group.items.map((item) => {
            const active = isConsoleNavHrefActive(displayPathname, item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cx("fp-nav-item", active && "is-active")}
                href={item.href}
                key={item.href}
                onNavigate={() => {
                  beginRouteTransition(item.href, item.label);
                }}
                prefetch={false}
                title={item.description ?? item.meta}
              >
                <PlatformIcon className="fp-nav-item__icon" name={toPlatformIcon(item.icon)} />
                <span className="fp-nav-item__copy">
                  <span className="fp-nav-item__title">{item.label}</span>
                  <span className="fp-nav-item__meta">{item.meta}</span>
                </span>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}

export function ConsoleSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const { locale, t } = useI18n();
  const { displayPathname } = useConsoleRouteTransition();

  return (
    <PlatformSidebar
      brand={<PlatformSidebarBrand meta={t("Console")} title="Fugue" />}
      command={<PlatformCommand>{t("Search commands")}</PlatformCommand>}
      footer={
        <div className="fp-sidebar-utility">
          <span>{t("Route is the product")}</span>
        </div>
      }
    >
      <ConsoleSidebarNav
        displayPathname={displayPathname}
        isAdmin={isAdmin}
        locale={locale}
      />
    </PlatformSidebar>
  );
}


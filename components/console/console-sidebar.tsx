"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { PlatformSidebar, PlatformSidebarBrand } from "@/components/platform/platform-layout";
import { PlatformIcon, type PlatformIconName } from "@/components/platform/platform-icon";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";
import type { ConsoleNavGroup, ConsoleNavIcon } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

function toPlatformIcon(icon: ConsoleNavIcon): PlatformIconName {
  return icon;
}

function ConsoleSidebarNav({
  displayPathname,
  groups,
}: {
  displayPathname: string;
  groups: ConsoleNavGroup[];
}) {
  const { beginRouteTransition } = useConsoleRouteTransition();
  const regularGroups = groups.filter((group) => group.kind !== "admin");
  const adminGroup = groups.find((group) => group.kind === "admin");

  function renderNavItem(item: ConsoleNavGroup["items"][number]) {
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
  }

  return (
    <>
      <section className="fp-nav-section" key="primary">
        {regularGroups.flatMap((group) => group.items).map(renderNavItem)}
      </section>
      {adminGroup ? (
        <section className="fp-nav-section" key={adminGroup.kind}>
          <h2 className="fp-nav-section__label">{adminGroup.label}</h2>
          {adminGroup.items.map(renderNavItem)}
        </section>
      ) : null}
    </>
  );
}

export function ConsoleSidebar({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) {
  const { locale, t } = useI18n();
  const { displayPathname } = useConsoleRouteTransition();
  const groups = useMemo(
    () => getConsoleNavGroups({ isAdmin, locale }),
    [isAdmin, locale],
  );

  return (
    <PlatformSidebar
      brand={<PlatformSidebarBrand meta={t("Console")} title="Fugue" />}
      footer={
        <div className="fp-sidebar-utility">
          <span>{t("Route is the product")}</span>
        </div>
      }
    >
      <ConsoleSidebarNav
        displayPathname={displayPathname}
        groups={groups}
      />
    </PlatformSidebar>
  );
}

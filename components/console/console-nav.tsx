"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { beginRouteTransition } = useConsoleRouteTransition();
  const items = useMemo(
    () => getConsoleNavGroups({ isAdmin, locale }).flatMap((group) => group.items),
    [isAdmin, locale],
  );

  return (
    <ScrollableControlStrip
      activeSelector='[aria-current="page"]'
      className="fg-console-nav-shell"
      variant="pill"
      viewportClassName="fg-console-nav__viewport"
      watchKey={pathname}
    >
      <PillNav ariaLabel={t("Console")} className="fg-console-nav">
        {items.map((item) => {
          const active = isConsoleNavHrefActive(pathname, item.href);

          return (
            <PillNavLink
              active={active}
              className="fg-console-nav__link"
              href={item.href}
              key={item.href}
              onNavigate={() => {
                beginRouteTransition(item.href, item.label);
              }}
              prefetch={false}
            >
              <span className="fg-console-nav__title">{item.label}</span>
            </PillNavLink>
          );
        })}
      </PillNav>
    </ScrollableControlStrip>
  );
}

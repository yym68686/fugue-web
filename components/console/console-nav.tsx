"use client";

import { useMemo } from "react";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { useI18n } from "@/components/providers/i18n-provider";
import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const { locale, t } = useI18n();
  const { beginRouteTransition, displayPathname } = useConsoleRouteTransition();
  const items = useMemo(
    () => getConsoleNavGroups({ isAdmin, locale }).flatMap((group) => group.items),
    [isAdmin, locale],
  );

  return (
    <ScrollableControlStrip
      activeSelector='[aria-current="page"]'
      className="console-nav-shell"
      variant="pill"
      viewportClassName="console-nav-viewport"
      watchKey={displayPathname}
    >
      <PillNav ariaLabel={t("Console")}>
        {items.map((item) => {
          const active = isConsoleNavHrefActive(displayPathname, item.href);

          return (
            <PillNavLink
              active={active}
              href={item.href}
              key={item.href}
              onNavigate={() => {
                beginRouteTransition(item.href, item.label);
              }}
              prefetch={false}
            >
              <span>{item.label}</span>
            </PillNavLink>
          );
        })}
      </PillNav>
    </ScrollableControlStrip>
  );
}

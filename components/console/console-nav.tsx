"use client";

import { usePathname } from "next/navigation";

import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { getConsoleNavGroups } from "@/lib/console/nav";

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = getConsoleNavGroups({ isAdmin }).flatMap((group) => group.items);

  return (
    <ScrollableControlStrip
      activeSelector='[aria-current="page"]'
      className="fg-console-nav-shell"
      variant="pill"
      viewportClassName="fg-console-nav__viewport"
      watchKey={pathname}
    >
      <PillNav ariaLabel="Console" className="fg-console-nav">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <PillNavLink
              active={active}
              className="fg-console-nav__link"
              href={item.href}
              key={item.href}
            >
              <span className="fg-console-nav__title">{item.label}</span>
            </PillNavLink>
          );
        })}
      </PillNav>
    </ScrollableControlStrip>
  );
}

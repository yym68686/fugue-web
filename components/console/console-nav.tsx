"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { getConsoleNavGroups } from "@/lib/console/nav";
import { warmConsoleRouteData } from "@/lib/console/page-snapshot-client";

type ConsoleNavigator = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useMemo(
    () => getConsoleNavGroups({ isAdmin }).flatMap((group) => group.items),
    [isAdmin],
  );
  const routeHrefs = useMemo(() => items.map((item) => item.href), [items]);
  const prefetchedRoutesRef = useRef(new Set<string>());
  const itemHrefKey = routeHrefs.join("|");

  function prefetchRoute(href: string) {
    if (prefetchedRoutesRef.current.has(href)) {
      return;
    }

    prefetchedRoutesRef.current.add(href);
    router.prefetch(href);
  }

  function prepareRoute(href: string) {
    prefetchRoute(href);
    void warmConsoleRouteData(href);
  }

  useEffect(() => {
    const navigatorWithHints =
      typeof navigator === "undefined" ? null : (navigator as ConsoleNavigator);

    if (navigatorWithHints?.connection?.saveData) {
      return;
    }

    const queue = routeHrefs.filter((href) => !isActivePath(pathname, href));

    if (!queue.length) {
      return;
    }

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

      const warmRoutes = () => {
        idleHandle = null;
        timeoutHandle = null;

        queue.forEach((href) => {
          prepareRoute(href);
        });
      };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(
        () => {
          warmRoutes();
        },
        { timeout: 1400 },
      );
    } else {
      timeoutHandle = window.setTimeout(() => {
        warmRoutes();
      }, 180);
    }

    return () => {
      if (
        idleHandle !== null &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [itemHrefKey, pathname, routeHrefs, router]);

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
              onFocus={() => prepareRoute(item.href)}
              onMouseEnter={() => prepareRoute(item.href)}
              onPointerDown={() => prepareRoute(item.href)}
              prefetch
            >
              <span className="fg-console-nav__title">{item.label}</span>
            </PillNavLink>
          );
        })}
      </PillNav>
    </ScrollableControlStrip>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { PillNav, PillNavLink } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { getConsoleNavGroups, isConsoleNavHrefActive } from "@/lib/console/nav";
import { warmConsoleRouteData } from "@/lib/console/page-snapshot-client";

type ConsoleNavigator = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

const ROUTE_PREFETCH_TTL_MS = 45_000;

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { beginRouteTransition } = useConsoleRouteTransition();
  const items = useMemo(
    () => getConsoleNavGroups({ isAdmin }).flatMap((group) => group.items),
    [isAdmin],
  );
  const routeHrefs = useMemo(() => items.map((item) => item.href), [items]);
  const prefetchedRoutesRef = useRef(new Map<string, number>());
  const itemHrefKey = routeHrefs.join("|");

  function prefetchRoute(href: string, options?: { force?: boolean }) {
    const lastPrefetchedAt = prefetchedRoutesRef.current.get(href) ?? 0;

    if (
      !options?.force &&
      Date.now() - lastPrefetchedAt < ROUTE_PREFETCH_TTL_MS
    ) {
      return;
    }

    prefetchedRoutesRef.current.set(href, Date.now());
    router.prefetch(href);
  }

  function prepareRoute(href: string, options?: { force?: boolean }) {
    prefetchRoute(href, options);
    void warmConsoleRouteData(href);
  }

  useEffect(() => {
    const navigatorWithHints =
      typeof navigator === "undefined" ? null : (navigator as ConsoleNavigator);

    if (navigatorWithHints?.connection?.saveData) {
      return;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let pauseHandle: number | null = null;
    let pauseResolve: (() => void) | null = null;
    let timeoutHandle: number | null = null;
    let warmRunId = 0;

    const pauseBetweenRoutes = () =>
      new Promise<void>((resolve) => {
        pauseResolve = resolve;
        pauseHandle = window.setTimeout(() => {
          pauseHandle = null;
          pauseResolve = null;
          resolve();
        }, 140);
      });

    const clearWarmupHandles = () => {
      if (
        idleHandle !== null &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleHandle);
        idleHandle = null;
      }

      if (pauseHandle !== null) {
        window.clearTimeout(pauseHandle);
        pauseHandle = null;
      }

      if (pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const warmRoutes = async (
      runId: number,
      options?: {
        force?: boolean;
      },
    ) => {
      idleHandle = null;
      timeoutHandle = null;
      const queue = routeHrefs.filter(
        (href) => !isConsoleNavHrefActive(pathname, href),
      );

      if (!queue.length) {
        return;
      }

      for (const href of queue) {
        prefetchRoute(href, options);
      }

      for (const href of queue) {
        if (cancelled || runId !== warmRunId) {
          return;
        }

        await warmConsoleRouteData(href);

        if (cancelled || runId !== warmRunId) {
          return;
        }

        await pauseBetweenRoutes();
      }
    };

    const scheduleWarmRoutes = (options?: { force?: boolean }) => {
      warmRunId += 1;
      const runId = warmRunId;
      clearWarmupHandles();

      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(
          () => {
            void warmRoutes(runId, options);
          },
          { timeout: options?.force ? 400 : 1400 },
        );
        return;
      }

      timeoutHandle = window.setTimeout(() => {
        void warmRoutes(runId, options);
      }, options?.force ? 0 : 180);
    };

    const handleReturnToTab = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      scheduleWarmRoutes({ force: true });
    };

    scheduleWarmRoutes();
    window.addEventListener("focus", handleReturnToTab);
    document.addEventListener("visibilitychange", handleReturnToTab);

    return () => {
      cancelled = true;
      warmRunId += 1;
      clearWarmupHandles();
      window.removeEventListener("focus", handleReturnToTab);
      document.removeEventListener("visibilitychange", handleReturnToTab);
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
          const active = isConsoleNavHrefActive(pathname, item.href);

          return (
            <PillNavLink
              active={active}
              className="fg-console-nav__link"
              href={item.href}
              key={item.href}
              onFocus={() => prepareRoute(item.href)}
              onMouseEnter={() => prepareRoute(item.href)}
              onNavigate={() => {
                prepareRoute(item.href);
                beginRouteTransition(item.href, item.label);
              }}
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

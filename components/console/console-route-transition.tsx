"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  ConsoleLoadingState,
  ConsoleProjectGalleryTransitionSkeleton,
} from "@/components/console/console-page-skeleton";
import { isConsoleNavHrefActive } from "@/lib/console/nav";

type PendingRouteTransition = {
  fromPathname: string;
  href: string;
  label: string;
} | null;

type ConsoleRouteTransitionContextValue = {
  beginRouteTransition: (href: string, label: string) => void;
  pendingRouteTransition: PendingRouteTransition;
};

const ConsoleRouteTransitionContext =
  createContext<ConsoleRouteTransitionContextValue | null>(null);

export function ConsoleRouteTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [pendingRouteTransition, setPendingRouteTransition] =
    useState<PendingRouteTransition>(null);

  useEffect(() => {
    if (
      pendingRouteTransition &&
      pathname !== pendingRouteTransition.fromPathname
    ) {
      setPendingRouteTransition(null);
    }
  }, [pathname, pendingRouteTransition]);

  return (
    <ConsoleRouteTransitionContext.Provider
      value={{
        beginRouteTransition: (href, label) => {
          if (isConsoleNavHrefActive(pathname, href)) {
            return;
          }

          setPendingRouteTransition({
            fromPathname: pathname,
            href,
            label,
          });
        },
        pendingRouteTransition,
      }}
    >
      {children}
    </ConsoleRouteTransitionContext.Provider>
  );
}

export function ConsoleRouteTransitionContent({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const context = useConsoleRouteTransition();

  if (
    context.pendingRouteTransition &&
    pathname === context.pendingRouteTransition.fromPathname
  ) {
    return (
      <div className="fg-console-content">
        <ConsoleLoadingState
          label={`Loading ${context.pendingRouteTransition.label}`}
        >
          <ConsoleProjectGalleryTransitionSkeleton />
        </ConsoleLoadingState>
      </div>
    );
  }

  return <div className="fg-console-content">{children}</div>;
}

export function useConsoleRouteTransition() {
  const context = useContext(ConsoleRouteTransitionContext);

  if (!context) {
    throw new Error(
      "useConsoleRouteTransition must be used within ConsoleRouteTransitionProvider",
    );
  }

  return context;
}

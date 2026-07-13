"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ShellMessages } from "@/lib/i18n/ui-messages";

export function ConsoleRouteLink({
  children,
  href,
  matchPrefixes = [],
}: {
  children: ReactNode;
  href: string;
  matchPrefixes?: string[];
}) {
  const pathname = usePathname();
  const current =
    pathname === href ||
    (href !== "/app" && pathname.startsWith(`${href}/`)) ||
    matchPrefixes.some((prefix) => pathname.startsWith(prefix));

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className="coss-sidebar__link"
      data-active={current || undefined}
      href={href}
    >
      {children}
    </Link>
  );
}

type BreadcrumbItem = {
  href?: string;
  label: string;
};

export type ConsoleBreadcrumbMessages = Pick<
  ShellMessages,
  | "accessKeys"
  | "account"
  | "billing"
  | "breadcrumb"
  | "console"
  | "dns"
  | "profileAndSecurity"
  | "projects"
  | "servers"
  | "workspace"
> &
  Partial<Pick<ShellMessages, "admin" | "apps" | "cluster" | "users">>;

function knownBreadcrumbs(
  messages: ConsoleBreadcrumbMessages,
): Record<string, BreadcrumbItem[]> {
  const breadcrumbs: Record<string, BreadcrumbItem[]> = {
    "/app": [{ href: "/app", label: messages.workspace }, { label: messages.projects }],
    "/app/api-keys": [
      { href: "/app", label: messages.workspace },
      { label: messages.accessKeys },
    ],
    "/app/billing": [
      { href: "/app", label: messages.workspace },
      { label: messages.billing },
    ],
    "/app/cluster-nodes": [
      { href: "/app", label: messages.workspace },
      { label: messages.servers },
    ],
    "/app/dns": [{ href: "/app", label: messages.workspace }, { label: messages.dns }],
    "/app/settings/profile": [
      { href: "/app/settings/profile", label: messages.account },
      { label: messages.profileAndSecurity },
    ],
  };

  if (messages.admin && messages.apps && messages.cluster && messages.users) {
    breadcrumbs["/app/apps"] = [
      { href: "/app/apps", label: messages.admin },
      { label: messages.apps },
    ];
    breadcrumbs["/app/cluster"] = [
      { href: "/app/apps", label: messages.admin },
      { label: messages.cluster },
    ];
    breadcrumbs["/app/users"] = [
      { href: "/app/apps", label: messages.admin },
      { label: messages.users },
    ];
  }

  return breadcrumbs;
}

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function breadcrumbsForPathname(
  pathname: string,
  messages: ConsoleBreadcrumbMessages,
): BreadcrumbItem[] {
  const known = knownBreadcrumbs(messages)[pathname];

  if (known) {
    return known;
  }

  const projectMatch = pathname.match(/^\/app\/projects\/([^/]+)$/);

  if (projectMatch?.[1]) {
    return [
      { href: "/app", label: messages.workspace },
      { href: "/app", label: messages.projects },
      { label: safeDecodeSegment(projectMatch[1]).slice(0, 120) },
    ];
  }

  return [{ href: "/app", label: messages.workspace }, { label: messages.console }];
}

export function ConsoleBreadcrumbs({
  messages,
}: {
  messages: ConsoleBreadcrumbMessages;
}) {
  const pathname = usePathname();
  const items = breadcrumbsForPathname(pathname, messages);

  return (
    <nav className="coss-breadcrumbs" aria-label={messages.breadcrumb}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;

          return (
            <li key={`${item.href ?? "current"}-${item.label}`}>
              {item.href && !current ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

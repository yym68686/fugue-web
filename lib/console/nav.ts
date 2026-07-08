import type { ConsoleNavGroup } from "@/lib/console/types";
import { translate, type Locale } from "@/lib/i18n/core";

export function isConsoleNavHrefActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href || pathname.startsWith("/app/projects/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getConsoleNavGroups(options?: { isAdmin?: boolean; locale?: Locale }) {
  const locale = options?.locale ?? "en";
  const groups: ConsoleNavGroup[] = [
    {
      kind: "work",
      label: translate(locale, "Work"),
      items: [
        {
          description: translate(locale, "Projects, services, routes, and deploy controls"),
          href: "/app",
          icon: "project",
          label: translate(locale, "Projects"),
          meta: translate(locale, "Gallery / Services / Controls"),
        },
        {
          description: translate(locale, "Hosted DNS zones, records, and delegation health"),
          href: "/app/dns",
          icon: "dns",
          label: translate(locale, "DNS"),
          meta: translate(locale, "Zones / Records / Preflight"),
        },
      ],
    },
    {
      kind: "runtime",
      label: translate(locale, "Runtime"),
      items: [
        {
          description: translate(locale, "Server health, heartbeat, and workloads"),
          href: "/app/cluster-nodes",
          icon: "server",
          label: translate(locale, "Servers"),
          meta: translate(locale, "Health / Heartbeat / Workloads"),
        },
      ],
    },
    {
      kind: "access",
      label: translate(locale, "Access"),
      items: [
        {
          description: translate(locale, "Create, rebuild, and scope API keys"),
          href: "/app/api-keys",
          icon: "access",
          label: translate(locale, "Access keys"),
          meta: translate(locale, "Create / Rebuild / Scopes"),
        },
      ],
    },
    {
      kind: "commercial",
      label: translate(locale, "Commercial"),
      items: [
        {
          description: translate(locale, "Balance, metering, and capacity"),
          href: "/app/billing",
          icon: "billing",
          label: translate(locale, "Billing"),
          meta: translate(locale, "Envelope / Balance / Metering"),
        },
      ],
    },
    {
      kind: "settings",
      label: translate(locale, "Settings"),
      items: [
        {
          description: translate(locale, "Profile, account, and workspace preferences"),
          href: "/app/settings/profile",
          icon: "settings",
          label: translate(locale, "Profile"),
          meta: translate(locale, "Account / Preferences"),
        },
      ],
    },
  ];

  if (options?.isAdmin) {
    groups.push({
      kind: "admin",
      label: translate(locale, "Admin"),
      items: [
        {
          description: translate(locale, "Control-plane nodes, pressure, and workloads"),
          href: "/app/cluster",
          icon: "cluster",
          label: translate(locale, "Cluster"),
          meta: translate(locale, "Nodes / Pressure / Workloads"),
          permission: "admin",
        },
        {
          description: translate(locale, "Cluster apps, rebuilds, and deletes"),
          href: "/app/apps",
          icon: "apps",
          label: translate(locale, "Apps"),
          meta: translate(locale, "Cluster / Rebuild / Delete"),
          permission: "admin",
        },
        {
          description: translate(locale, "Admins, quotas, and access"),
          href: "/app/users",
          icon: "user",
          label: translate(locale, "Users"),
          meta: translate(locale, "Admins / Quotas / Access"),
          permission: "admin",
        },
      ],
    });
  }

  return groups;
}

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
  const groups = [
    {
      label: translate(locale, "Primary"),
      items: [
        { href: "/app", label: translate(locale, "Projects"), meta: translate(locale, "Gallery / Services / Controls") },
        { href: "/app/billing", label: translate(locale, "Billing"), meta: translate(locale, "Envelope / Balance / Metering") },
        { href: "/app/cluster-nodes", label: translate(locale, "Servers"), meta: translate(locale, "Health / Heartbeat / Workloads") },
        { href: "/app/api-keys", label: translate(locale, "Access keys"), meta: translate(locale, "Create / Rebuild / Scopes") },
      ],
    },
  ] satisfies ConsoleNavGroup[];

  if (options?.isAdmin) {
    groups[0].items.push(
      { href: "/app/cluster", label: translate(locale, "Cluster"), meta: translate(locale, "Nodes / Pressure / Workloads") },
      { href: "/app/apps", label: translate(locale, "Apps"), meta: translate(locale, "Cluster / Rebuild / Delete") },
      { href: "/app/users", label: translate(locale, "Users"), meta: translate(locale, "Admins / Quotas / Access") },
    );
  }

  return groups;
}

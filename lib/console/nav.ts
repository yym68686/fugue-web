import type { ConsoleNavGroup } from "@/lib/console/types";

export function getConsoleNavGroups(options?: { isAdmin?: boolean }) {
  const groups = [
    {
      label: "Primary",
      items: [
        { href: "/app", label: "Projects", meta: "Gallery / Services / Controls" },
        { href: "/app/api-keys", label: "Access keys", meta: "Create / Rebuild / Scopes" },
      ],
    },
  ] satisfies ConsoleNavGroup[];

  if (options?.isAdmin) {
    groups[0].items.push(
      { href: "/app/cluster", label: "Cluster", meta: "Nodes / Pressure / Workloads" },
      { href: "/app/apps", label: "Apps", meta: "Cluster / Rebuild / Delete" },
      { href: "/app/users", label: "Users", meta: "Admins / Block / Delete" },
    );
  }

  return groups;
}

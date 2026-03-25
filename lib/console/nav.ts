import type { ConsoleNavGroup } from "@/lib/console/types";

export function getConsoleNavGroups(options?: { isAdmin?: boolean }) {
  const groups = [
    {
      label: "Primary",
      items: [
        { href: "/app", label: "Projects", meta: "gallery / services / controls" },
        { href: "/app/api-keys", label: "API Keys", meta: "create / rebuild / scopes" },
      ],
    },
  ] satisfies ConsoleNavGroup[];

  if (options?.isAdmin) {
    groups[0].items.push(
      { href: "/app/cluster", label: "Cluster", meta: "nodes / pressure / workloads" },
      { href: "/app/apps", label: "Apps", meta: "cluster / rebuild / delete" },
      { href: "/app/users", label: "Users", meta: "admins / block / delete" },
    );
  }

  return groups;
}

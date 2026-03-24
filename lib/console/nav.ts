import type { ConsoleNavGroup } from "@/lib/console/types";

export const consoleNavGroups = [
  {
    label: "Control",
    items: [
      { href: "/app", label: "Projects", meta: "gallery / services / controls" },
      { href: "/app/apps", label: "Apps", meta: "routes / source / phase" },
      { href: "/app/runtimes", label: "Runtimes", meta: "shared / attached / heartbeat" },
      { href: "/app/operations", label: "Operations", meta: "queue / imports / deploys" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/app/api-keys", label: "API Keys", meta: "create / copy / local revoke" },
      { href: "/app/settings/workspace", label: "Workspace", meta: "identity / key / tenant" },
    ],
  },
] satisfies ConsoleNavGroup[];

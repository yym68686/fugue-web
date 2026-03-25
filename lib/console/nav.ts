import type { ConsoleNavGroup } from "@/lib/console/types";

export const consoleNavGroups = [
  {
    label: "Primary",
    items: [
      { href: "/app", label: "Projects", meta: "gallery / services / controls" },
      { href: "/app/api-keys", label: "API Keys", meta: "create / rebuild / scopes" },
    ],
  },
] satisfies ConsoleNavGroup[];

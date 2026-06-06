export type ConsoleTone = "positive" | "warning" | "danger" | "info" | "neutral";

export type ConsoleNavIcon =
  | "access"
  | "apps"
  | "billing"
  | "cluster"
  | "project"
  | "server"
  | "settings"
  | "user";

export type ConsoleNavGroupKind =
  | "access"
  | "admin"
  | "commercial"
  | "runtime"
  | "settings"
  | "work";

export type ConsoleNavGroup = {
  kind: ConsoleNavGroupKind;
  label: string;
  items: {
    description?: string;
    href: string;
    icon: ConsoleNavIcon;
    label: string;
    meta: string;
    permission?: "admin";
  }[];
};

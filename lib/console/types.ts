export type ConsoleTone = "positive" | "warning" | "danger" | "info" | "neutral";

export type ConsoleNavGroup = {
  label: string;
  items: {
    href: string;
    label: string;
    meta: string;
  }[];
};

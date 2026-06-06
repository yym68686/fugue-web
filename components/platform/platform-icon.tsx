import type { HTMLAttributes } from "react";

import { cx } from "@/lib/ui/cx";

export type PlatformIconName =
  | "access"
  | "apps"
  | "billing"
  | "chevron-right"
  | "cluster"
  | "command"
  | "deploy"
  | "docs"
  | "domain"
  | "error"
  | "files"
  | "image"
  | "logs"
  | "menu"
  | "observability"
  | "plus"
  | "project"
  | "route"
  | "search"
  | "server"
  | "settings"
  | "storage"
  | "success"
  | "user"
  | "warning";

const ICON_PATHS: Record<PlatformIconName, string[]> = {
  access: [
    "M7 10V8a5 5 0 0 1 10 0v2",
    "M6 10h12v9H6z",
    "M10 14h4",
  ],
  apps: [
    "M5 5h6v6H5z",
    "M13 5h6v6h-6z",
    "M5 13h6v6H5z",
    "M13 13h6v6h-6z",
  ],
  billing: [
    "M4 7h16v12H4z",
    "M4 10h16",
    "M8 15h5",
  ],
  "chevron-right": ["M9 6l6 6-6 6"],
  cluster: [
    "M12 4v5",
    "M6 18l6-4 6 4",
    "M6 14v4",
    "M18 14v4",
    "M9 9h6l3 5-6 4-6-4z",
  ],
  command: [
    "M9 9H6a3 3 0 1 1 3-3v12a3 3 0 1 1-3-3h12a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3H9z",
  ],
  deploy: [
    "M12 4v10",
    "M8 8l4-4 4 4",
    "M5 14v5h14v-5",
  ],
  docs: [
    "M7 4h8l4 4v16H7z",
    "M15 4v5h5",
    "M10 13h7",
    "M10 17h7",
  ],
  domain: [
    "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z",
    "M4 12h16",
    "M12 4a12 12 0 0 1 0 16",
    "M12 4a12 12 0 0 0 0 16",
  ],
  error: [
    "M12 4l9 16H3z",
    "M12 9v5",
    "M12 18h.01",
  ],
  files: [
    "M6 5h7l5 5v14H6z",
    "M13 5v6h6",
    "M9 16h7",
  ],
  image: [
    "M5 6h14v14H5z",
    "M8 16l3-3 3 3 2-2 3 3",
    "M9 10h.01",
  ],
  logs: [
    "M5 6h14",
    "M5 10h14",
    "M5 14h10",
    "M5 18h7",
  ],
  menu: ["M5 7h14", "M5 12h14", "M5 17h14"],
  observability: [
    "M4 13s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z",
    "M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  project: [
    "M5 6h14v13H5z",
    "M8 10h8",
    "M8 14h5",
  ],
  route: [
    "M5 6h5v5H5z",
    "M14 13h5v5h-5z",
    "M10 8h3a3 3 0 0 1 3 3v2",
  ],
  search: ["M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z", "M16 16l5 5"],
  server: [
    "M5 5h14v6H5z",
    "M5 13h14v6H5z",
    "M8 8h.01",
    "M8 16h.01",
  ],
  settings: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    "M12 3v3",
    "M12 18v3",
    "M4.8 7.2l2.1 2.1",
    "M17.1 16.9l2.1 2.1",
    "M3 12h3",
    "M18 12h3",
    "M4.8 19.2l2.1-2.1",
    "M17.1 7.1l2.1-2.1",
  ],
  storage: [
    "M5 7c0-2 14-2 14 0v10c0 2-14 2-14 0z",
    "M5 7c0 2 14 2 14 0",
    "M5 12c0 2 14 2 14 0",
  ],
  success: [
    "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z",
    "M8.5 12.5l2.5 2.5 5-6",
  ],
  user: [
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M5 21a7 7 0 0 1 14 0",
  ],
  warning: [
    "M12 4l9 16H3z",
    "M12 9v5",
    "M12 18h.01",
  ],
};

export function PlatformIcon({
  className,
  name,
  ...rest
}: {
  name: PlatformIconName;
} & HTMLAttributes<SVGSVGElement>) {
  return (
    <svg
      {...rest}
      aria-hidden="true"
      className={cx("fp-icon", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      {ICON_PATHS[name].map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}


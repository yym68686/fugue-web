"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const AdminAppsConsole = dynamic(
  () =>
    import("@/components/fugue-coss/admin-apps-console").then(
      (module) => module.AdminAppsConsole,
    ),
  { loading: ConsoleIslandLoading },
);

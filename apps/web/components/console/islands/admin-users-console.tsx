"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const AdminUsersConsole = dynamic(
  () =>
    import("@/components/fugue-coss/admin-users-console").then(
      (module) => module.AdminUsersConsole,
    ),
  { loading: ConsoleIslandLoading },
);

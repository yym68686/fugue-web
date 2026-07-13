"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const AdminClusterConsole = dynamic(
  () =>
    import("@/components/fugue-coss/admin-cluster-console").then(
      (module) => module.AdminClusterConsole,
    ),
  { loading: ConsoleIslandLoading },
);

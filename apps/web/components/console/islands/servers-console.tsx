"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const ServersConsole = dynamic(
  () =>
    import("@/components/fugue-coss/servers-console").then(
      (module) => module.ServersConsole,
    ),
  { loading: ConsoleIslandLoading },
);

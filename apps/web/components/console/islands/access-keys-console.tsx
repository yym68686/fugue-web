"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const AccessKeysConsole = dynamic(
  () =>
    import("@/components/fugue-coss/access-keys-console").then(
      (module) => module.AccessKeysConsole,
    ),
  { loading: ConsoleIslandLoading },
);

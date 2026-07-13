"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const BillingConsole = dynamic(
  () =>
    import("@/components/fugue-coss/billing-console").then(
      (module) => module.BillingConsole,
    ),
  { loading: ConsoleIslandLoading },
);

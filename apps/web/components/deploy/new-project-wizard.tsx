"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const NewProjectWizard = dynamic(
  () =>
    import("@/components/fugue-coss/new-project-wizard").then(
      (module) => module.NewProjectWizard,
    ),
  { loading: ConsoleIslandLoading },
);

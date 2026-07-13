"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const ProjectWorkbench = dynamic(
  () =>
    import("@/components/fugue-coss/project-workbench").then(
      (module) => module.ProjectWorkbench,
    ),
  { loading: ConsoleIslandLoading },
);

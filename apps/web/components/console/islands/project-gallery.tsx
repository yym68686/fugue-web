"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const ProjectGallery = dynamic(
  () =>
    import("@/components/fugue-coss/project-gallery").then(
      (module) => module.ProjectGallery,
    ),
  { loading: ConsoleIslandLoading },
);

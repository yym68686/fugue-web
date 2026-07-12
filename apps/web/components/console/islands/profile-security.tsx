"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";

export const ProfileSecurity = dynamic(
  () =>
    import("@/components/fugue-coss/profile-security").then(
      (module) => module.ProfileSecurity,
    ),
  { loading: ConsoleIslandLoading },
);

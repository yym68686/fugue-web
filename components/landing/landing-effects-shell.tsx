"use client";

import dynamic from "next/dynamic";

const LandingEffects = dynamic(
  () =>
    import("@/components/landing/landing-effects").then(
      (module) => module.LandingEffects,
    ),
  { ssr: false },
);

export function LandingEffectsShell() {
  return <LandingEffects />;
}

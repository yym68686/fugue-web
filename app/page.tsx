import { LandingEffectsShell } from "@/components/landing/landing-effects-shell";
import { LandingPage } from "@/components/landing/landing-page";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";

import "./landing.css";

export default async function HomePage() {
  const authenticatedAppPath = await readAuthenticatedAppPath();

  return (
    <>
      <LandingPage authenticatedAppPath={authenticatedAppPath} />
      <LandingEffectsShell />
    </>
  );
}

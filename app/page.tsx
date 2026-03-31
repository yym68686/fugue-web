import { LandingPage } from "@/components/landing/landing-page";
import { LandingEffects } from "@/components/landing/landing-effects";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";

export default async function HomePage() {
  const authenticatedAppPath = await readAuthenticatedAppPath();

  return (
    <>
      <LandingPage authenticatedAppPath={authenticatedAppPath} />
      <LandingEffects />
    </>
  );
}

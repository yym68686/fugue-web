import { LandingPage } from "@/components/landing/landing-page";
import { LandingV8Effects } from "@/components/landing/v8-effects";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";

export default async function HomePage() {
  const authenticatedAppPath = await readAuthenticatedAppPath();

  return (
    <>
      <LandingPage authenticatedAppPath={authenticatedAppPath} />
      <LandingV8Effects />
    </>
  );
}

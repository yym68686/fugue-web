import { LandingV8Effects } from "@/components/landing/v8-effects";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { getLandingV8Markup } from "@/lib/landing/v8";

export default async function HomePage() {
  const authenticatedAppPath = await readAuthenticatedAppPath();
  const markup = getLandingV8Markup(Boolean(authenticatedAppPath));

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <LandingV8Effects />
    </>
  );
}

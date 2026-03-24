import { LandingV8Effects } from "@/components/landing/v8-effects";
import { getLandingV8Markup } from "@/lib/landing/v8";

export default function HomePage() {
  const markup = getLandingV8Markup();

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <LandingV8Effects />
    </>
  );
}

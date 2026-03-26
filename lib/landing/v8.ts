import { readFileSync } from "node:fs";
import path from "node:path";

const sourcePath = path.join(process.cwd(), "versions", "v8-unicorn-template", "index.html");
const sourceHtml = readFileSync(sourcePath, "utf8");
const bodyMatch = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

if (!bodyMatch?.[1]) {
  throw new Error("Could not extract v8 landing body content.");
}

const bodyContent: string = bodyMatch[1];

function replaceCompareLinks(markup: string) {
  return markup.replace(
    /<p class="compare-links mono">[\s\S]*?<\/p>/,
    `<p class="compare-links mono">
                Auth /
                <a href="/auth/sign-up">Sign up</a> /
                <a href="/auth/sign-in">Sign in</a> /
                <a href="/app">Control shell</a>
              </p>`,
  );
}

export function getLandingV8Markup(isAuthenticated = false) {
  const handoffHref = isAuthenticated ? "/app" : "/auth/sign-up";
  const handoffLabel = isAuthenticated ? "Open app" : "Get started";
  const secondaryHref = isAuthenticated ? "/app" : "/auth/sign-in";
  const secondaryLabel = isAuthenticated ? "Open app" : "Sign in";
  const handoffCopy = isAuthenticated
    ? "Touch the public route, then enter the control shell."
    : "Touch the public route, then continue into auth.";

  return replaceCompareLinks(bodyContent)
    .replaceAll(`href="#quickstart"`, `href="${handoffHref}"`)
    .replaceAll(`Inspect quickstart`, handoffLabel)
    .replace(`Touch the control plane before auth ships.`, `Touch the public route, then open auth.`)
    .replace(
      `When auth arrives, it should feel like the next room, not a banner over the stage.`,
      `Auth is live. It should feel like the next room, not a banner over the stage.`,
    )
    .replace(
      `Google sign-in and email signup should ship as real routes with real loading,
                validation, empty, and failure states. The landing page stops at the public edge,
                then hands off without pretending the next room is already built.`,
      `Google sign-in and email signup now live as real routes with loading, validation, and
                failure handling. The landing page still stops at the public edge, then hands off
                into the next room without pretending the whole console is already finished.`,
    )
    .replace(
      `<a class="button button--ghost" href="#top">`,
      `<a class="button button--ghost" href="${secondaryHref}">`,
    )
    .replace(`Back to top`, secondaryLabel)
    .replace(
      `Touch the public route, then open auth.`,
      handoffCopy,
    );
}

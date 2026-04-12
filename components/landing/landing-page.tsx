import { Brand } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { LocaleMenuButton } from "@/components/ui/locale-switcher";
import { PillNav, PillNavAnchor } from "@/components/ui/pill-nav";
import { ProofShell, ProofShellRibbon } from "@/components/ui/proof-shell";
import { RouteNote } from "@/components/ui/route-note";
import { getRequestI18n } from "@/lib/i18n/server";

type LandingPageProps = {
  authenticatedAppPath: string | null;
};

type LandingRouteNote = {
  index: string;
  title: string;
  meta: string;
  toneClassName?: string;
};

type RouteChapter = {
  index: string;
  label: string;
  title: string;
  description: string;
  meta: string;
};

type SurfaceColumn = {
  label: string;
  items: Array<{
    label: string;
    meta: string;
  }>;
};

const heroRouteNotes: LandingRouteNote[] = [
  {
    index: "01",
    title: "Source intake",
    meta: "Repository / Image / Upload",
    toneClassName: "fg-landing-route-note--repo",
  },
  {
    index: "02",
    title: "Shared runtime",
    meta: "Build / Deploy / Route",
    toneClassName: "fg-landing-route-note--shared",
  },
  {
    index: "03",
    title: "Attached machine",
    meta: "Node key / Heartbeat / Migrate",
    toneClassName: "fg-landing-route-note--attached",
  },
];

const routeChapters: RouteChapter[] = [
  {
    index: "01",
    label: "Source intake",
    title: "Start from a repository, Docker image, or uploaded bundle.",
    description:
      "Source location, access mode, and build metadata define the app before the first deploy. GitHub repositories, Docker images, and local uploads all enter the same route-first operating model.",
    meta: "GitHub / Docker image / Upload / Builder",
  },
  {
    index: "02",
    label: "Shared runtime",
    title: "Go live on shared infrastructure first.",
    description:
      "Shared runtime gets the app public quickly while preserving deploy history, route state, and logs from the first run.",
    meta: "Managed shared runtime / Logs / Route / Deploy ops",
  },
  {
    index: "03",
    label: "Attached machine",
    title: "Attach your own machine later without changing the workflow.",
    description:
      "Issue a node key, confirm heartbeat, and move the same app onto your own machine. The route and operating model stay consistent.",
    meta: "Node key / Heartbeat / Migrate / Same control model",
  },
];

const surfaceColumns: SurfaceColumn[] = [
  {
    label: "Public route",
    items: [
      { label: "Source import", meta: "GitHub, Docker image, local upload" },
      { label: "Shared runtime", meta: "Managed first path" },
      { label: "Node key setup", meta: "Attach a server later" },
      { label: "Logs and audit trail", meta: "Build / Runtime / Operations" },
      { label: "Migration", meta: "Shared -> Attached" },
    ],
  },
  {
    label: "Sign-in and handoff",
    items: [
      { label: "Sign-in route", meta: "/auth/sign-in" },
      { label: "Sign-up route", meta: "/auth/sign-up" },
      { label: "Google sign-in", meta: "Live provider flow" },
      { label: "Email access", meta: "Validation / Failure / Retry" },
      { label: "App handoff", meta: "Auth -> App" },
    ],
  },
];

const runwayStops = [
  "Start from a repository, image, or uploaded bundle.",
  "Go live on shared infrastructure first.",
  "Move to your own machine without changing the route.",
];

const objectBeltItems = ["Workspace", "Project", "App", "Runtime", "Operation"];

const landingNav = [
  { href: "#route", label: "How it works" },
  { href: "#surface", label: "Available now" },
  { href: "#quickstart", label: "Quickstart" },
  { href: "#launch", label: "Sign in" },
];

const quickstartCode = `export FUGUE_BASE_URL="https://api.fugue.pro"

curl -sS "\${FUGUE_BASE_URL}/healthz"

curl -sS "\${FUGUE_BASE_URL}/v1/apps/import-github" \\
  -H "Authorization: Bearer <tenant-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo_url":"https://github.com/example/app",
    "runtime_id":"runtime_managed_shared"
  }'`;

function RouteSignal() {
  return (
    <svg className="fg-route-signal fg-landing-route-signal" viewBox="0 0 1200 170" aria-hidden="true">
      <path className="fg-route-signal__base" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
      <path className="fg-route-signal__active" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
      <circle className="fg-route-signal__dot" cx="40" cy="118" r="7" />
      <circle className="fg-route-signal__dot" cx="538" cy="96" r="7" />
      <circle className="fg-route-signal__dot" cx="1160" cy="36" r="7" />
    </svg>
  );
}

function GhostAnchorButton({
  children,
  href,
}: {
  children: string;
  href: string;
}) {
  return (
    <a className="fg-button fg-button--ghost" href={href}>
      <span className="fg-button__label">{children}</span>
      <span aria-hidden="true" className="fg-button__icon is-plain is-trailing">
        -&gt;
      </span>
    </a>
  );
}

export async function LandingPage({ authenticatedAppPath }: LandingPageProps) {
  const { locale, t } = await getRequestI18n();
  const isCjkLocale = locale.startsWith("zh");
  const primaryHref = authenticatedAppPath ?? "/auth/sign-up";
  const primaryLabel = t(authenticatedAppPath ? "Open app" : "Get started");
  const proofHeading = t(
    authenticatedAppPath
      ? "Verify the public route, then open the app."
      : "Verify the public route, then continue to sign in.",
  );
  const heroHeadingLines = [t("Start shared."), t("Move cleanly.")];

  return (
    <div className="fg-landing-page" data-landing-root="">
      <a className="fg-landing-skip-link" href="#main">
        {t("Skip to content")}
      </a>

      <header className="fg-landing-masthead">
        <div className="fg-shell fg-landing-masthead__shell">
          <Brand meta={t("Deploy apps from source")} />

          <PillNav ariaLabel={t("Primary")} className="fg-landing-nav">
            {landingNav.map((item) => (
              <PillNavAnchor href={item.href} key={item.href}>
                {t(item.label)}
              </PillNavAnchor>
            ))}
          </PillNav>

          <div className="fg-landing-masthead__actions">
            <LocaleMenuButton />
            <ButtonLink className="fg-landing-topbar-action" href={primaryHref} size="compact" variant="route">
              {primaryLabel}
            </ButtonLink>
          </div>

          <button
            aria-controls="fg-landing-mobile-menu"
            aria-expanded="false"
            aria-label={t("Open menu")}
            className="fg-landing-menu-toggle"
            type="button"
          >
            <span />
            <span />
          </button>
        </div>

        <div className="fg-landing-mobile-sheet" id="fg-landing-mobile-menu" hidden>
          <nav aria-label={t("Mobile")} className="fg-landing-mobile-nav">
            {landingNav.map((item) => (
              <a href={item.href} key={item.href}>
                {t(item.label)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="fg-landing-main" id="main">
        <section className="fg-landing-hero" data-landing-hero="" data-tilt-root="" id="top">
          <div aria-hidden="true" className="fg-landing-hero-media">
            <div
              className="fg-landing-scene-container"
              data-us-project="9QSqoDWkMs8NffWH18AF"
              id="fg-landing-scene"
            />
            <div aria-hidden="true" className="fg-landing-overlay-radial" />
            <div aria-hidden="true" className="fg-landing-overlay-gradient" />
            <div aria-hidden="true" className="fg-landing-overlay-noise" />
            <div aria-hidden="true" className="fg-landing-overlay-scan" />
            <div aria-hidden="true" className="fg-landing-stage-glare" />
          </div>

          <div className="fg-shell fg-landing-hero-shell">
            <p aria-hidden="true" className="fg-landing-hero-ghost">
              Fugue
            </p>

            <div className={`fg-landing-hero-copy${isCjkLocale ? " is-cjk" : ""}`}>
              <p className="fg-label fg-mono" data-stagger="1">
                {t("Deploy from source, shared first")}
              </p>
              <h1 className="fg-display-heading" data-stagger="2">
                {heroHeadingLines.map((line) => (
                  <span className="fg-landing-hero-title-line" key={line}>
                    {line}
                  </span>
                ))}
              </h1>
              <p className="fg-copy fg-landing-hero-lead" data-stagger="3">
                {t(
                  "Start from a GitHub repository, a published Docker image, or a local upload on managed shared k3s first. The same app can move onto your own machine later without rebuilding the route or changing the workflow.",
                )}
              </p>

              <div className="fg-landing-hero-actions" data-stagger="4">
                <ButtonLink href={primaryHref} variant="route">
                  {primaryLabel}
                </ButtonLink>
                <GhostAnchorButton href="#route">{t("See the route")}</GhostAnchorButton>
              </div>
            </div>

            <div className="fg-landing-hero-rail" data-stagger="5">
              <p className="fg-label fg-mono fg-landing-hero-rail__kicker">{t("One route, two runtimes")}</p>

              {heroRouteNotes.map((note) => (
                <RouteNote
                  className={note.toneClassName}
                  index={note.index}
                  key={note.index}
                  meta={t(note.meta)}
                  title={t(note.title)}
                />
              ))}
            </div>
          </div>

          <div className="fg-shell fg-landing-runway">
            {runwayStops.map((title, index) => (
              <article className="fg-landing-runway-stop" key={title}>
                <p className="fg-label fg-mono">
                  {String(index + 1).padStart(2, "0")} / {t(index === 0 ? "source" : index === 1 ? "shared" : "attached")}
                </p>
                <h2>{t(title)}</h2>
              </article>
            ))}
          </div>
        </section>

        <section className="fg-landing-section fg-landing-section--route" data-landing-section="" id="route">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-section-head">
              <p className="fg-label fg-mono">{t("Route model")}</p>
              <h2 className="fg-display-heading">{t("The route is the product.")}</h2>
              <p className="fg-copy fg-landing-section-copy">
                {t(
                  "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.",
                )}
              </p>
            </div>

            <RouteSignal />

            <div className="fg-landing-chapter-stack">
              {routeChapters.map((chapter) => (
                <article className="fg-landing-chapter" key={chapter.index}>
                  <p className="fg-landing-chapter__number">{chapter.index}</p>

                  <div className="fg-landing-chapter__body">
                    <p className="fg-label fg-mono">{t(chapter.label)}</p>
                    <h3>{t(chapter.title)}</h3>
                    <p className="fg-copy">{t(chapter.description)}</p>
                  </div>

                  <p className="fg-landing-chapter__meta fg-mono">{t(chapter.meta)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fg-landing-section" data-landing-section="" id="surface">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-surface-intro">
              <p className="fg-label fg-mono">{t("Available now")}</p>
              <h2 className="fg-display-heading">
                {t("Route, sign-in, and the app already share one system.")}
              </h2>
            </div>

            <div className="fg-landing-surface-grid">
              {surfaceColumns.map((column) => (
                <article className="fg-landing-surface-column" key={column.label}>
                  <p className="fg-label fg-mono">{t(column.label)}</p>

                  <ul className="fg-landing-surface-list">
                    {column.items.map((item) => (
                      <li key={item.label}>
                        <span>{t(item.label)}</span>
                        <span className="fg-mono">{t(item.meta)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div aria-label={t("Core objects")} className="fg-object-belt">
              {objectBeltItems.map((item) => (
                <span key={item}>{t(item)}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="fg-landing-section" data-landing-section="" id="quickstart">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-proof-head">
              <div>
                <p className="fg-label fg-mono">{t("Quickstart")}</p>
                <h2 className="fg-display-heading">{proofHeading}</h2>
              </div>

              <Button
                className="fg-landing-copy-button"
                data-copy-target="quickstart-code"
                size="compact"
                type="button"
                variant="ghost"
              >
                {t("Copy command")}
              </Button>
            </div>

            <ProofShell className="fg-landing-proof-shell">
              <ProofShellRibbon>
                <span>{t("GitHub import example")}</span>
                <span>{t("Docker image import also available")}</span>
                <span>{t("Managed shared runtime")}</span>
                <span>api.fugue.pro</span>
              </ProofShellRibbon>

              <pre id="quickstart-code">
                <code>{quickstartCode}</code>
              </pre>
            </ProofShell>
          </div>
        </section>

        <section className="fg-landing-section" data-landing-section="" id="launch">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-launch-layout">
              <div className="fg-landing-launch-copy">
                <p className="fg-label fg-mono">{t("Sign-in handoff")}</p>
                <h2 className="fg-display-heading">{t("Sign in without breaking the product flow.")}</h2>
              </div>

              <div className="fg-landing-launch-meta">
                <p className="fg-copy">
                  {t(
                    "Google sign-in and email sign-up run as full routes with loading, validation, retry, and failure states. The public page hands off directly into the app instead of restarting the journey in a different shell.",
                  )}
                </p>

                <div className="fg-landing-hero-actions fg-landing-hero-actions--left">
                  <ButtonLink href={primaryHref} variant="route">
                    {primaryLabel}
                  </ButtonLink>
                  {authenticatedAppPath ? (
                    <GhostAnchorButton href="#top">{t("Back to top")}</GhostAnchorButton>
                  ) : (
                    <ButtonLink href="/auth/sign-in" variant="secondary">
                      {t("Sign in")}
                    </ButtonLink>
                  )}
                </div>

                <p className="fg-landing-compare-links fg-mono">
                  Routes /
                  <a href="/auth/sign-up">{t("Sign up")}</a> /
                  <a href="/auth/sign-in">{t("Sign in")}</a> /
                  <a href="/app">{t("App")}</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fg-landing-footer">
        <div className="fg-content-shell fg-landing-footer__shell">
          <p className="fg-copy fg-landing-footer__copy">
            {t(
              "Fugue keeps the public route, sign-in handoff, and app shell inside one product. The same route and workflow continue from the first deploy to the signed-in workspace.",
            )}
          </p>

          <nav aria-label={t("Footer")} className="fg-landing-footer__nav">
            {landingNav.map((item) => (
              <a href={item.href} key={item.href}>
                {t(item.label)}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

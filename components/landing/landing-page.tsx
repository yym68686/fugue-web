import { Brand } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { PillNav, PillNavAnchor } from "@/components/ui/pill-nav";
import { ProofShell, ProofShellRibbon } from "@/components/ui/proof-shell";
import { RouteNote } from "@/components/ui/route-note";

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
    title: "GitHub intake",
    meta: "Repository / Branch / Builder",
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
    label: "GitHub intake",
    title: "Import a public repository, not a vague project idea.",
    description:
      "Repository location, branch, and builder establish the app before deployment begins. The identity starts at the repo and survives every later transition.",
    meta: "Repository / Branch / Builder / App identity",
  },
  {
    index: "02",
    label: "Shared runtime",
    title: "Use managed shared k3s as the first public landing.",
    description:
      "The shortest route to a live address should also preserve logs, deploy operations, and route history. Fast does not need to mean disposable.",
    meta: "Managed shared runtime / Logs / Route / Deploy ops",
  },
  {
    index: "03",
    label: "Attached machine",
    title: "Attach your own machine later without resetting the mental model.",
    description:
      "Issue a node key, confirm heartbeat, and migrate the same app onto your own machine. The control plane remains the same even when the runtime changes.",
    meta: "Node key / Heartbeat / Migrate / Same control model",
  },
];

const surfaceColumns: SurfaceColumn[] = [
  {
    label: "Public wrapper",
    items: [
      { label: "GitHub import", meta: "Public repositories" },
      { label: "Shared runtime", meta: "Managed first path" },
      { label: "Node key onboarding", meta: "Attach a server later" },
      { label: "Logs and audit", meta: "Build / Runtime / Operations" },
      { label: "Migration", meta: "Shared -> Attached" },
    ],
  },
  {
    label: "Product shell",
    items: [
      { label: "Sign-in route", meta: "/auth/sign-in" },
      { label: "Sign-up route", meta: "/auth/sign-up" },
      { label: "Google auth", meta: "Live provider state" },
      { label: "Email auth", meta: "Validation / Failure / Retry" },
      { label: "Workspace handoff", meta: "Auth -> App" },
    ],
  },
];

const runwayStops = [
  "Import code as the first durable object.",
  "Use managed shared runtime to get public signal fast.",
  "Migrate to your own machine without discarding the route.",
];

const objectBeltItems = ["Workspace", "Project", "App", "Runtime", "Operation"];

const landingNav = [
  { href: "#route", label: "Route" },
  { href: "#surface", label: "Surface" },
  { href: "#quickstart", label: "Proof" },
  { href: "#launch", label: "Auth" },
];

const quickstartCode = `export FUGUE_BASE_URL="https://api.fugue.pro"

curl -sS "\${FUGUE_BASE_URL}/healthz"

curl -sS "\${FUGUE_BASE_URL}/v1/apps/import-github" \\
  -H "Authorization: Bearer <tenant-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo_url":"https://github.com/example/static-site",
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

export function LandingPage({ authenticatedAppPath }: LandingPageProps) {
  const primaryHref = authenticatedAppPath ?? "/auth/sign-up";
  const primaryLabel = authenticatedAppPath ? "Open app" : "Get started";
  const proofHeading = authenticatedAppPath
    ? "Touch the public route, then enter the control shell."
    : "Touch the public route, then open auth.";

  return (
    <div className="fg-landing-page" data-landing-root="">
      <a className="fg-landing-skip-link" href="#main">
        Skip to content
      </a>

      <header className="fg-landing-masthead">
        <div className="fg-shell fg-landing-masthead__shell">
          <Brand meta="Open current / v8" />

          <PillNav ariaLabel="Primary" className="fg-landing-nav">
            {landingNav.map((item) => (
              <PillNavAnchor href={item.href} key={item.href}>
                {item.label}
              </PillNavAnchor>
            ))}
          </PillNav>

          <ButtonLink className="fg-landing-topbar-action" href={primaryHref} size="compact" variant="route">
            {primaryLabel}
          </ButtonLink>

          <button
            aria-controls="fg-landing-mobile-menu"
            aria-expanded="false"
            aria-label="Open menu"
            className="fg-landing-menu-toggle"
            type="button"
          >
            <span />
            <span />
          </button>
        </div>

        <div className="fg-landing-mobile-sheet" id="fg-landing-mobile-menu" hidden>
          <nav aria-label="Mobile" className="fg-landing-mobile-nav">
            {landingNav.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
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
              id="unicorn-scene"
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

            <div className="fg-landing-hero-copy">
              <p className="fg-label fg-mono" data-stagger="1">
                Shared-first deployment control plane
              </p>
              <h1 className="fg-display-heading" data-stagger="2">
                Start shared.
                <br />
                Leave clean.
              </h1>
              <p className="fg-copy fg-landing-hero-lead" data-stagger="3">
                Deploy a public GitHub repository on managed k3s immediately. When your own machine
                starts to matter, move the same app onto your own machine without switching to a
                second product grammar.
              </p>

              <div className="fg-landing-hero-actions" data-stagger="4">
                <ButtonLink href={primaryHref} variant="route">
                  {primaryLabel}
                </ButtonLink>
                <GhostAnchorButton href="#route">See the route</GhostAnchorButton>
              </div>
            </div>

            <div className="fg-landing-hero-rail" data-stagger="5">
              <p className="fg-label fg-mono fg-landing-hero-rail__kicker">Route held constant</p>

              {heroRouteNotes.map((note) => (
                <RouteNote
                  className={note.toneClassName}
                  index={note.index}
                  key={note.index}
                  meta={note.meta}
                  title={note.title}
                />
              ))}
            </div>
          </div>

          <div className="fg-shell fg-landing-runway">
            {runwayStops.map((title, index) => (
              <article className="fg-landing-runway-stop" key={title}>
                <p className="fg-label fg-mono">
                  {String(index + 1).padStart(2, "0")} / {index === 0 ? "repo" : index === 1 ? "shared" : "attached"}
                </p>
                <h2>{title}</h2>
              </article>
            ))}
          </div>
        </section>

        <section className="fg-landing-section fg-landing-section--route" data-landing-section="" id="route">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-section-head">
              <p className="fg-label fg-mono">Route thesis</p>
              <h2 className="fg-display-heading">The route is the product.</h2>
              <p className="fg-copy fg-landing-section-copy">
                Fugue should not sell abstraction in the abstract. It should sell one visible,
                low-risk sentence: import code, go live on shared infrastructure fast, then keep
                the right to leave cleanly when your own machine matters more than convenience.
              </p>
            </div>

            <RouteSignal />

            <div className="fg-landing-chapter-stack">
              {routeChapters.map((chapter) => (
                <article className="fg-landing-chapter" key={chapter.index}>
                  <p className="fg-landing-chapter__number">{chapter.index}</p>

                  <div className="fg-landing-chapter__body">
                    <p className="fg-label fg-mono">{chapter.label}</p>
                    <h3>{chapter.title}</h3>
                    <p className="fg-copy">{chapter.description}</p>
                  </div>

                  <p className="fg-landing-chapter__meta fg-mono">{chapter.meta}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fg-landing-section" data-landing-section="" id="surface">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-surface-intro">
              <p className="fg-label fg-mono">Current boundary</p>
              <h2 className="fg-display-heading">
                Only show what is real today. Everything else waits its turn.
              </h2>
            </div>

            <div className="fg-landing-surface-grid">
              {surfaceColumns.map((column) => (
                <article className="fg-landing-surface-column" key={column.label}>
                  <p className="fg-label fg-mono">{column.label}</p>

                  <ul className="fg-landing-surface-list">
                    {column.items.map((item) => (
                      <li key={item.label}>
                        <span>{item.label}</span>
                        <span className="fg-mono">{item.meta}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div aria-label="Core objects" className="fg-object-belt">
              {objectBeltItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="fg-landing-section" data-landing-section="" id="quickstart">
          <div className="fg-content-shell fg-landing-section-shell">
            <div className="fg-landing-proof-head">
              <div>
                <p className="fg-label fg-mono">Proof</p>
                <h2 className="fg-display-heading">{proofHeading}</h2>
              </div>

              <Button
                className="fg-landing-copy-button"
                data-copy-target="quickstart-code"
                size="compact"
                type="button"
                variant="ghost"
              >
                Copy command
              </Button>
            </div>

            <ProofShell className="fg-landing-proof-shell">
              <ProofShellRibbon>
                <span>Public repos only</span>
                <span>Managed shared runtime</span>
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
                <p className="fg-label fg-mono">Auth handoff</p>
                <h2 className="fg-display-heading">
                  Auth is live. It should feel like the next room, not a banner over the stage.
                </h2>
              </div>

              <div className="fg-landing-launch-meta">
                <p className="fg-copy">
                  Google sign-in and email signup now live as real routes with loading, validation,
                  and failure handling. The landing page still stops at the public edge, then hands
                  off into the next room without pretending the whole console is already finished.
                </p>

                <div className="fg-landing-hero-actions fg-landing-hero-actions--left">
                  <ButtonLink href={primaryHref} variant="route">
                    {primaryLabel}
                  </ButtonLink>
                  {authenticatedAppPath ? (
                    <GhostAnchorButton href="#top">Back to top</GhostAnchorButton>
                  ) : (
                    <ButtonLink href="/auth/sign-in" variant="secondary">
                      Sign in
                    </ButtonLink>
                  )}
                </div>

                <p className="fg-landing-compare-links fg-mono">
                  Auth /
                  <a href="/auth/sign-up">Sign up</a> /
                  <a href="/auth/sign-in">Sign in</a> /
                  <a href="/app">Control shell</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fg-landing-footer">
        <div className="fg-content-shell fg-landing-footer__shell">
          <p className="fg-copy fg-landing-footer__copy">
            Fugue Web keeps the public route, auth handoff, and control shell inside one product
            wrapper. The landing now speaks in the same material and object language as the routes
            behind it.
          </p>

          <nav aria-label="Footer" className="fg-landing-footer__nav">
            {landingNav.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

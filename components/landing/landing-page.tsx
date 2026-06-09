import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { LocaleUtilityMenu } from "@/components/ui/locale-switcher";
import { ThemeUtilityMenu } from "@/components/ui/theme-switcher";
import { getRequestI18n } from "@/lib/i18n/server";
import { marketingPrimaryNav } from "@/lib/site/navigation";

type LandingPageProps = {
  authenticatedAppPath: string | null;
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

const quickstartCode = `export FUGUE_BASE_URL="https://api.fugue.pro"

curl -sS "\${FUGUE_BASE_URL}/healthz"

curl -sS "\${FUGUE_BASE_URL}/v1/apps/import-github" \\
  -H "Authorization: Bearer <tenant-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo_url":"https://github.com/example/app",
    "runtime_id":"runtime_managed_shared"
  }'`;

function TextLink({
  children,
  href,
}: {
  children: string;
  href: string;
}) {
  return (
    <a className="ml-text-link" href={href}>
      {children}
    </a>
  );
}

export async function LandingPage({ authenticatedAppPath }: LandingPageProps) {
  const { t } = await getRequestI18n();
  const primaryHref = authenticatedAppPath ?? "/auth/sign-up";
  const primaryLabel = t(authenticatedAppPath ? "Open app" : "Get started");

  return (
    <div className="ml-page ml-marketing">
      <a className="ml-skip-link" href="#main">
        {t("Skip to content")}
      </a>

      <header className="ml-marketing-nav">
        <Brand meta={t("Deploy apps from source")} />

        <nav aria-label={t("Primary")} className="ml-marketing-nav__links">
          {marketingPrimaryNav.map((item) => (
            <a href={item.href} key={item.href}>
              {t(item.label)}
            </a>
          ))}
        </nav>

        <div className="ml-marketing-nav__actions">
          <ThemeUtilityMenu className="ml-utility-menu" />
          <LocaleUtilityMenu className="ml-utility-menu" />
          <ButtonLink href={primaryHref} size="compact" variant="primary">
            {primaryLabel}
          </ButtonLink>
        </div>
      </header>

      <main className="ml-marketing-main" id="main">
        <section className="ml-marketing-hero" id="top">
          <div className="ml-marketing-hero__copy">
            <p className="ml-eyebrow">{t("Deploy from source, shared first")}</p>
            <h1>{t("Start shared. Move cleanly.")}</h1>
            <p>
              {t(
                "Start from a GitHub repository, a published Docker image, or a local upload on managed shared k3s first. The same app can move onto your own machine later without rebuilding the route or changing the workflow.",
              )}
            </p>
            <div className="ml-action-row">
              <ButtonLink href={primaryHref} variant="primary">
                {primaryLabel}
              </ButtonLink>
              <TextLink href="#route">{t("See the route")}</TextLink>
            </div>
          </div>

          <aside className="ml-terminal" aria-label={t("Route summary")}>
            <div className="ml-terminal__bar">
              <span>{t("One route, two runtimes")}</span>
              <code>api.fugue.pro</code>
            </div>
            <ol className="ml-route-list">
              {routeChapters.map((chapter) => (
                <li key={chapter.index}>
                  <span>{chapter.index}</span>
                  <strong>{t(chapter.label)}</strong>
                  <code>{t(chapter.meta)}</code>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="ml-section" id="route">
          <div className="ml-section__head">
            <p className="ml-eyebrow">{t("Route model")}</p>
            <h2>{t("The route is the product.")}</h2>
            <p>
              {t(
                "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.",
              )}
            </p>
          </div>

          <div className="ml-chapter-grid">
            {routeChapters.map((chapter) => (
              <article className="ml-card" key={chapter.index}>
                <span className="ml-card__index">{chapter.index}</span>
                <h3>{t(chapter.title)}</h3>
                <p>{t(chapter.description)}</p>
                <code>{t(chapter.meta)}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="ml-section" id="surface">
          <div className="ml-section__head">
            <p className="ml-eyebrow">{t("Available now")}</p>
            <h2>{t("Route, sign-in, and the app already share one system.")}</h2>
          </div>

          <div className="ml-surface-grid">
            {surfaceColumns.map((column) => (
              <article className="ml-card" key={column.label}>
                <h3>{t(column.label)}</h3>
                <ul className="ml-key-list">
                  {column.items.map((item) => (
                    <li key={item.label}>
                      <span>{t(item.label)}</span>
                      <code>{t(item.meta)}</code>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="ml-section" id="quickstart">
          <div className="ml-section__head">
            <p className="ml-eyebrow">{t("Quickstart")}</p>
            <h2>
              {t(
                authenticatedAppPath
                  ? "Verify the public route, then open the app."
                  : "Verify the public route, then continue to sign in.",
              )}
            </h2>
          </div>

          <pre className="ml-code-block" id="quickstart-code">
            <code>{quickstartCode}</code>
          </pre>
        </section>

        <section className="ml-section ml-section--split" id="launch">
          <div className="ml-section__head">
            <p className="ml-eyebrow">{t("Sign-in handoff")}</p>
            <h2>{t("Sign in without breaking the product flow.")}</h2>
          </div>

          <div className="ml-card">
            <p>
              {t(
                "Google sign-in and email sign-up run as full routes with loading, validation, retry, and failure states. The public page hands off directly into the app instead of restarting the journey in a different shell.",
              )}
            </p>
            <div className="ml-action-row">
              <ButtonLink href={primaryHref} variant="primary">
                {primaryLabel}
              </ButtonLink>
              {authenticatedAppPath ? (
                <TextLink href="#top">{t("Back to top")}</TextLink>
              ) : (
                <ButtonLink href="/auth/sign-in" variant="secondary">
                  {t("Sign in")}
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="ml-marketing-footer">
        <p>
          {t(
            "Fugue keeps the public route, sign-in handoff, and app shell inside one product. The same route and workflow continue from the first deploy to the signed-in workspace.",
          )}
        </p>
        <nav aria-label={t("Footer")}>
          {marketingPrimaryNav.map((item) => (
            <a href={item.href} key={item.href}>
              {t(item.label)}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

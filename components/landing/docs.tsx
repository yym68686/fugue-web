import type { ReactNode } from "react";

import { getRequestI18n } from "@/lib/i18n/server";

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function CodeBlock({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="doc-code-wrap">
      {label ? <div className="doc-code-label">{label}</div> : null}
      <pre className="doc-code">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default async function Docs() {
  const { t } = await getRequestI18n();
  return (
    <div className="lp">
      <header className="lp-top">
        <a className="lp-brand" href="/">
          <BrandMark />
          <b>fugue</b>
          <span className="lp-badge">DOCS</span>
        </a>
        <nav className="lp-nav">
          <a href="/">{t("Home")}</a>
          <a className="lp-nav-cta" href="/auth/sign-in">
            {t("Sign in")}
          </a>
        </nav>
      </header>

      <main className="lp-main doc-main">
        <section className="doc-hero">
          <div className="lp-eyebrow">Docs</div>
          <h1>{t("Deploy from your terminal")}</h1>
          <p className="lp-lede">
            {t(
              "Install the fugue CLI, create your first API key, and ship a service from your terminal in a few minutes.",
            )}
          </p>
          <nav className="doc-toc" aria-label={t("On this page")}>
            <a href="#install">{t("Install the CLI")}</a>
            <a href="#key">{t("Get your first API key")}</a>
            <a href="#purpose">{t("What the API key is for")}</a>
            <a href="#deploy">{t("Authenticate and deploy")}</a>
            <a href="#nodes">{t("Connect your own server")}</a>
            <a href="#commands">{t("Handy commands")}</a>
          </nav>
        </section>

        <section className="doc-section" id="install">
          <h2>
            <span className="doc-num">01</span>
            {t("Install the CLI")}
          </h2>
          <p className="doc-p">
            {t(
              "The fugue CLI is a semantic wrapper over the Fugue control-plane API. Install it with a single command.",
            )}
          </p>
          <CodeBlock label={t("macOS / Linux")}>
            curl -fsSL
            https://raw.githubusercontent.com/yym68686/fugue/main/scripts/install_fugue_cli.sh
            | sh
          </CodeBlock>
          <CodeBlock label={t("Windows PowerShell")}>
            powershell -NoProfile -ExecutionPolicy Bypass -Command &quot;irm
            https://raw.githubusercontent.com/yym68686/fugue/main/scripts/install_fugue_cli.ps1
            | iex&quot;
          </CodeBlock>
          <p className="doc-p">{t("Confirm it is on your PATH:")}</p>
          <CodeBlock>fugue version</CodeBlock>
        </section>

        <section className="doc-section" id="key">
          <h2>
            <span className="doc-num">02</span>
            {t("Get your first API key")}
          </h2>
          <p className="doc-p">
            {t(
              "You authenticate the CLI with an API key minted from the console. For security the secret is shown only once, so copy it right away.",
            )}
          </p>
          <ol className="doc-ol">
            <li>{t("Sign in to the console.")}</li>
            <li>{t("Open the Access keys page from the sidebar.")}</li>
            <li>{t("Click New key, give it a name, pick the scopes it needs, and create it.")}</li>
            <li>{t("Copy the secret from the dialog — it will not be shown again.")}</li>
          </ol>
          <a className="doc-link" href="/keys">
            {t("Go to Access keys")} →
          </a>
          <div className="doc-note">
            {t(
              "Self-hosting Fugue? The Access keys page lives at your own console URL followed by /keys.",
            )}
          </div>
        </section>

        <section className="doc-section" id="purpose">
          <h2>
            <span className="doc-num">03</span>
            {t("What the API key is for")}
          </h2>
          <p className="doc-p">
            {t(
              "The API key authenticates the CLI — and any direct API calls — to your tenant on the control plane. Every command you run, from deploy to logs to scaling, is authorized by the key you provide. Nothing runs against your workspace without one.",
            )}
          </p>
          <ul className="doc-ul">
            <li>
              <b>{t("Tenant API key")}</b>
              {t(
                " — for everyday work: deploy apps, read logs, and manage services inside your workspace. Each key is limited to the scopes you grant it.",
              )}
            </li>
            <li>
              <b>{t("Workspace admin key")}</b>
              {t(
                " — your workspace's built-in high-privilege key. It is what mints and manages the other keys, so it is never shown for deletion.",
              )}
            </li>
            <li>
              <b>{t("Platform / bootstrap key")}</b>
              {t(
                " — reserved for cluster-wide admin commands. Keep it secret and use it only when an operation truly requires it.",
              )}
            </li>
          </ul>
          <div className="doc-note">
            {t(
              "Keys are sealed and encrypted at rest. You can disable or delete any key from the Access keys page at any time.",
            )}
          </div>
        </section>

        <section className="doc-section" id="deploy">
          <h2>
            <span className="doc-num">04</span>
            {t("Authenticate and deploy")}
          </h2>
          <p className="doc-p">
            {t(
              "Save the key once, then deploy straight from a project directory. The CLI resolves your tenant, project, and app by name.",
            )}
          </p>
          <CodeBlock>
            {`# save the key once (stored in your fugue config)
fugue auth login --token <your-api-key>

# …or export it for the current shell only
export FUGUE_API_KEY=<your-api-key>

# build and deploy the current directory
fugue deploy .

# list apps and stream logs
fugue app ls
fugue app logs <app-name>`}
          </CodeBlock>
          <div className="doc-note">
            {t(
              "On Fugue Cloud the base URL is detected automatically. For a self-hosted control plane, set FUGUE_API_URL (or FUGUE_BASE_URL) to your API endpoint before running commands.",
            )}
          </div>
        </section>

        <section className="doc-section" id="nodes">
          <h2>
            <span className="doc-num">05</span>
            {t("Connect your own server")}
          </h2>
          <p className="doc-p">
            {t(
              "Want Fugue to schedule workloads onto your own VPS? Open Servers, click Connect node, name the machine, and run the generated one-line command on it as root. The node joins the cluster in about a minute and then appears in your node list.",
            )}
          </p>
          <a className="doc-link" href="/servers">
            {t("Go to Servers")} →
          </a>
        </section>

        <section className="doc-section" id="commands">
          <h2>
            <span className="doc-num">06</span>
            {t("Handy commands")}
          </h2>
          <table className="doc-cmds">
            <tbody>
              <tr>
                <td>
                  <code>fugue deploy .</code>
                </td>
                <td>{t("Build and deploy the current directory")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue app ls</code>
                </td>
                <td>{t("List your applications")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue app logs &lt;name&gt;</code>
                </td>
                <td>{t("Stream logs for an app")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue find &lt;name&gt;</code>
                </td>
                <td>{t("Resolve and inspect a resource by name")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue version --check-latest</code>
                </td>
                <td>{t("Check whether a newer CLI is available")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue upgrade</code>
                </td>
                <td>{t("Upgrade the CLI in place")}</td>
              </tr>
              <tr>
                <td>
                  <code>fugue --help</code>
                </td>
                <td>{t("Show the full command reference")}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lp-final">
          <h2>{t("Ready to deploy?")}</h2>
          <p>{t("From blank to a live service in minutes.")}</p>
          <a className="btn primary" href="/auth/sign-up">
            {t("Create account")}
          </a>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Fugue</span>
        <span className="lp-foot-mono">multi-tenant PaaS · k3s</span>
      </footer>
    </div>
  );
}

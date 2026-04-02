import { Brand } from "@/components/brand";
import { DeployWizard } from "@/components/deploy/deploy-wizard";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { ProofShell, ProofShellEmpty, ProofShellRibbon } from "@/components/ui/proof-shell";
import { RouteNote } from "@/components/ui/route-note";
import { buildReturnToHref } from "@/lib/auth/validation";
import type { DeployPageData } from "@/lib/deploy/page-data";
import type { DeploySearchState } from "@/lib/deploy/query";
import { buildDeployHref } from "@/lib/deploy/query";
import { isGitHubRepoUrl } from "@/lib/github/repository";

function shortCommit(value?: string | null) {
  return value?.trim() ? value.slice(0, 7) : "Unknown";
}

type DeployPageProps = DeployPageData & {
  currentPath: string;
  requestedTemplateSlug?: string | null;
  routeMode: "repository" | "template";
  search: DeploySearchState;
};

export function DeployPage({
  currentPath,
  inspection,
  inspectionError,
  requestedTemplateSlug = null,
  routeMode,
  search,
  sessionPresent,
  workspaceInventory,
}: DeployPageProps) {
  const isValidRepositoryUrl = search.repositoryUrl
    ? isGitHubRepoUrl(search.repositoryUrl)
    : false;
  const template = inspection?.template ?? null;
  const manifest = inspection?.fugueManifest ?? null;
  const templateHref = template
    ? buildDeployHref(`/new/template/${template.slug}`, search)
    : null;
  const panelAction =
    routeMode === "template" && requestedTemplateSlug
      ? `/new/template/${requestedTemplateSlug}`
      : "/new/repository";
  const title =
    routeMode === "template"
      ? template?.name || "Deploy template."
      : inspection?.repository.repoName
        ? `Deploy ${inspection.repository.repoName}.`
        : "Deploy from GitHub.";
  const description = template?.description
    ? template.description
    : manifest
      ? "Fugue found fugue.yaml and can import the declared topology without losing the route model."
      : "Paste a GitHub repository link, inspect the source, and queue the first deployment onto shared or attached infrastructure.";
  const notes = [
    {
      index: "01",
      meta: search.repoVisibility === "private" ? "Private / Token handoff" : "Public / Anonymous read",
      title: "Repository access",
    },
    {
      index: "02",
      meta: template
        ? `Template / ${template.slug}`
        : manifest
          ? `Manifest / ${manifest.manifestPath}`
          : "Generic repo / Build strategy",
      title: template ? "Template metadata" : "Deploy shape",
    },
    {
      index: "03",
      meta: sessionPresent ? "Signed in / Workspace route" : "Auth handoff / ReturnTo preserved",
      title: sessionPresent ? "Deploy ready" : "Sign in",
    },
  ];

  return (
    <main className="fg-auth-page fg-deploy-page">
      <div className="fg-auth-grid fg-deploy-grid">
        <section className="fg-auth-stage fg-deploy-stage">
          <div className="fg-auth-stage__top">
            <Brand meta={routeMode === "template" ? "Template deploy" : "Repository deploy"} />
          </div>

          <div className="fg-auth-stage__copy">
            <p className="fg-label">
              {routeMode === "template" ? "Deploy / Template" : "Deploy / Repository"}
            </p>
            <h1 className="fg-display-heading">{title}</h1>
            <p className="fg-copy">{description}</p>
          </div>

          <svg className="fg-route-signal fg-auth-stage__signal" viewBox="0 0 1200 170" aria-hidden="true">
            <path className="fg-route-signal__base" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
            <path className="fg-route-signal__active" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
            <circle className="fg-route-signal__dot" cx="40" cy="118" r="7" />
            <circle className="fg-route-signal__dot" cx="538" cy="96" r="7" />
            <circle className="fg-route-signal__dot" cx="1160" cy="36" r="7" />
          </svg>

          <div className="fg-auth-stage__notes">
            {notes.map((note) => (
              <RouteNote
                index={note.index}
                key={note.index}
                meta={note.meta}
                title={note.title}
              />
            ))}
          </div>

          <ProofShell className="fg-deploy-proof">
            <ProofShellRibbon>
              {inspection ? "Inspection result" : "Repository intake"}
            </ProofShellRibbon>

            {inspection ? (
              <div className="fg-deploy-proof__content">
                <div className="fg-deploy-proof__head">
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Repository</span>
                    <strong>{inspection.repository.repoOwner}/{inspection.repository.repoName}</strong>
                    <span>{inspection.repository.repoVisibility} access</span>
                  </div>
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Branch</span>
                    <strong>{inspection.repository.branch}</strong>
                    <span>Commit {shortCommit(inspection.repository.commitSha)}</span>
                  </div>
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Deploy mode</span>
                    <strong>
                      {template
                        ? template.name
                        : manifest
                          ? "fugue.yaml"
                          : "Generic repository"}
                    </strong>
                    <span>
                      {template?.defaultRuntime
                        ? `Default runtime ${template.defaultRuntime}`
                        : manifest?.primaryService
                          ? `Primary service ${manifest.primaryService}`
                          : "Build inputs required"}
                    </span>
                  </div>
                </div>

                {template ? (
                  <div className="fg-deploy-template-actions">
                    {routeMode === "repository" && templateHref ? (
                      <ButtonAnchor href={templateHref} size="compact" variant="secondary">
                        Open template route
                      </ButtonAnchor>
                    ) : null}
                    {template.demoUrl ? (
                      <ButtonAnchor
                        href={template.demoUrl}
                        rel="noreferrer"
                        size="compact"
                        target="_blank"
                        variant="secondary"
                      >
                        Open demo
                      </ButtonAnchor>
                    ) : null}
                    {template.docsUrl ? (
                      <ButtonAnchor
                        href={template.docsUrl}
                        rel="noreferrer"
                        size="compact"
                        target="_blank"
                        variant="secondary"
                      >
                        Read docs
                      </ButtonAnchor>
                    ) : null}
                  </div>
                ) : null}

                {manifest?.services?.length ? (
                  <ul className="fg-deploy-service-list">
                    {manifest.services.map((service) => (
                      <li className="fg-deploy-service-item" key={`${service.service}-${service.kind}`}>
                        <strong>{service.service}</strong>
                        <span>
                          {service.kind} · {service.published ? "public" : "internal"} · port{" "}
                          {service.internalPort}
                        </span>
                        <span>
                          {service.buildStrategy || "auto"}
                          {service.sourceDir ? ` / ${service.sourceDir}` : ""}
                          {service.dockerfilePath ? ` / ${service.dockerfilePath}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ProofShellEmpty
                    description="No fugue.yaml services were detected. Fugue will fall back to the generic GitHub import path."
                    title="Generic repository deploy"
                  />
                )}
              </div>
            ) : (
              <ProofShellEmpty
                description={
                  inspectionError ||
                  "Paste a GitHub repository URL to inspect manifest metadata, template variables, and default runtime hints before you sign in."
                }
                title={inspectionError ? "Inspection unavailable" : "Waiting for a repository"}
              />
            )}
          </ProofShell>

          <div className="fg-object-belt" aria-label="Deploy path">
            <span>Repository</span>
            <span>Template</span>
            <span>Workspace</span>
            <span>Runtime</span>
            <span>Operation</span>
          </div>
        </section>

        <section className="fg-auth-panel-slot fg-deploy-panel-slot">
          <Panel>
            <PanelSection>
              <p className="fg-label fg-panel__eyebrow">
                {routeMode === "template" ? "Template intake" : "Repository intake"}
              </p>
              <PanelTitle>
                {search.repositoryUrl
                  ? "Review the repository and continue."
                  : "Paste a GitHub repository link."}
              </PanelTitle>
              <PanelCopy>
                Public repositories can be inspected immediately. Private repositories can be authorized after sign-in with a GitHub token.
              </PanelCopy>

              <form action={panelAction} className="fg-deploy-entry-form" method="GET">
                <div className="fg-deploy-entry-row">
                  <FormField
                    hint="Use https://github.com/owner/repo."
                    htmlFor="deploy-entry-repository"
                    label="Repository link"
                  >
                    <input
                      autoCapitalize="none"
                      className="fg-input"
                      defaultValue={search.repositoryUrl}
                      id="deploy-entry-repository"
                      name="repository-url"
                      placeholder="https://github.com/owner/repo"
                      spellCheck={false}
                      type="url"
                    />
                  </FormField>

                  <FormField
                    hint="Optional override for the default branch."
                    htmlFor="deploy-entry-branch"
                    label="Branch"
                    optionalLabel="Optional"
                  >
                    <input
                      autoCapitalize="none"
                      className="fg-input"
                      defaultValue={search.branch}
                      id="deploy-entry-branch"
                      name="branch"
                      placeholder={inspection?.repository.branch ?? "main"}
                      spellCheck={false}
                    />
                  </FormField>
                </div>

                {search.repoVisibility !== "public" ? (
                  <input name="repo-visibility" type="hidden" value={search.repoVisibility} />
                ) : null}

                <div className="fg-deploy-inline-actions">
                  <Button type="submit" variant="route">
                    Inspect repository
                  </Button>
                </div>
                <p className="fg-deploy-inline-copy">
                  The deploy link is stable. Auth handoff preserves this exact route and returns here after sign-in.
                </p>
              </form>
            </PanelSection>

            {inspectionError ? (
              <PanelSection>
                <InlineAlert variant="error">{inspectionError}</InlineAlert>
              </PanelSection>
            ) : null}

            {routeMode === "template" && search.repositoryUrl && !template && !inspectionError ? (
              <PanelSection>
                <InlineAlert variant="info">
                  This repository does not expose template metadata in <code>fugue.yaml</code>. Fugue can still deploy it as a repository import.
                </InlineAlert>
              </PanelSection>
            ) : null}

            {!search.repositoryUrl || !isValidRepositoryUrl ? (
              <PanelSection>
                <PanelCopy>
                  Use a GitHub repository URL to unlock inspection, auth handoff, and the deploy wizard.
                </PanelCopy>
              </PanelSection>
            ) : sessionPresent ? (
              workspaceInventory.workspaceError ? (
                <PanelSection>
                  <InlineAlert variant="error">{workspaceInventory.workspaceError}</InlineAlert>
                </PanelSection>
              ) : (
                <DeployWizard
                  initialBranch={search.branch || inspection?.repository.branch || ""}
                  initialRepoVisibility={search.repoVisibility}
                  inspection={inspection}
                  projectInventoryError={workspaceInventory.projectInventoryError}
                  projects={workspaceInventory.projects}
                  repositoryUrl={search.repositoryUrl}
                  runtimeTargetInventoryError={workspaceInventory.runtimeTargetInventoryError}
                  runtimeTargets={workspaceInventory.runtimeTargets}
                  workspaceDefaultProjectId={workspaceInventory.workspace?.defaultProjectId}
                  workspaceDefaultProjectName={workspaceInventory.workspace?.defaultProjectName}
                />
              )
            ) : (
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">Sign in</p>
                <PanelTitle>Authenticate before the deploy is queued.</PanelTitle>
                <PanelCopy>
                  Fugue keeps the repository link in <code>returnTo</code>, creates a first-party session, and sends you back to this exact deploy route.
                </PanelCopy>

                <div className="fg-deploy-auth-actions">
                  <ButtonAnchor href={buildReturnToHref("/auth/sign-in", currentPath)} variant="route">
                    Sign in to deploy
                  </ButtonAnchor>
                  <ButtonAnchor
                    href={buildReturnToHref("/auth/sign-up", currentPath)}
                    variant="secondary"
                  >
                    Create account
                  </ButtonAnchor>
                </div>
                <p className="fg-deploy-inline-copy">
                  After sign-in, the wizard reopens with the same repository and branch already filled in.
                </p>
              </PanelSection>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

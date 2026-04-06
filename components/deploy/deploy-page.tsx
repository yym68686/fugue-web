import { DeployCreateProjectForm } from "@/components/deploy/deploy-create-project-form";
import { DeployRepositoryLinkField } from "@/components/deploy/deploy-repository-link-field";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PillNav, PillNavAnchor } from "@/components/ui/pill-nav";
import {
  Panel,
  PanelCopy,
  PanelSection,
  PanelTitle,
} from "@/components/ui/panel";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { buildReturnToHref } from "@/lib/auth/validation";
import type { DeployPageData } from "@/lib/deploy/page-data";
import type { DeploySearchState } from "@/lib/deploy/query";
import { buildDeployHref } from "@/lib/deploy/query";
import { isGitHubRepoUrl } from "@/lib/github/repository";

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
  const effectiveSourceMode =
    routeMode === "repository" ? search.sourceMode : "repository";
  const isImageMode = effectiveSourceMode === "docker-image";
  const isLocalUploadMode = effectiveSourceMode === "local-upload";
  const hasImageRef = Boolean(search.imageRef.trim());
  const isValidRepositoryUrl = search.repositoryUrl
    ? isGitHubRepoUrl(search.repositoryUrl)
    : false;
  const repositoryUrlError =
    effectiveSourceMode === "repository" &&
    search.repositoryUrl &&
    !isValidRepositoryUrl
      ? "GitHub repository links must use https://github.com/owner/repo."
      : null;
  const template = inspection?.template ?? null;
  const repositoryModeHref =
    routeMode === "repository"
      ? buildDeployHref("/new/repository", {
          ...search,
          sourceMode: "repository",
        })
      : null;
  const localUploadModeHref =
    routeMode === "repository"
      ? buildDeployHref("/new/repository", {
          ...search,
          sourceMode: "local-upload",
        })
      : null;
  const dockerImageModeHref =
    routeMode === "repository"
      ? buildDeployHref("/new/repository", {
          ...search,
          sourceMode: "docker-image",
        })
      : null;
  const panelAction =
    routeMode === "template" && requestedTemplateSlug
      ? `/new/template/${requestedTemplateSlug}`
      : "/new/repository";
  const sourceModeSwitch =
    !sessionPresent && routeMode === "repository" ? (
      <ScrollableControlStrip
        activeSelector='[aria-current="page"]'
        className="fg-deploy-source-switch"
        variant="pill"
        watchKey={effectiveSourceMode}
      >
        <PillNav ariaLabel="Deploy source mode" className="fg-console-nav">
          <PillNavAnchor
            active={!isLocalUploadMode && !isImageMode}
            className="fg-console-nav__link"
            href={repositoryModeHref ?? "/new/repository"}
          >
            <span className="fg-console-nav__title">GitHub repository</span>
          </PillNavAnchor>
          <PillNavAnchor
            active={isLocalUploadMode}
            className="fg-console-nav__link"
            href={localUploadModeHref ?? "/new/repository?source-mode=local-upload"}
          >
            <span className="fg-console-nav__title">Local upload</span>
          </PillNavAnchor>
          <PillNavAnchor
            active={isImageMode}
            className="fg-console-nav__link"
            href={dockerImageModeHref ?? "/new/repository?source-mode=docker-image"}
          >
            <span className="fg-console-nav__title">Docker image</span>
          </PillNavAnchor>
        </PillNav>
      </ScrollableControlStrip>
    ) : null;

  return (
    <main className="fg-auth-page fg-deploy-page fg-deploy-page--repository">
      <div className="fg-auth-grid fg-deploy-grid fg-deploy-grid--solo fg-deploy-grid--repository">
        <section className="fg-auth-panel-slot fg-deploy-panel-slot fg-console-dialog-shell fg-project-dialog-shell fg-deploy-dialog-shell">
          <Panel className="fg-console-dialog-panel">
            <PanelSection>
              <p className="fg-label fg-panel__eyebrow">Create project</p>
              <PanelTitle className="fg-console-dialog__title">
                Create project
              </PanelTitle>
              <PanelCopy>
                Give the project a name, then point Fugue at the first GitHub
                repository, local folder, or Docker image.
              </PanelCopy>
            </PanelSection>

            <PanelSection className="fg-console-dialog__body">
              <div className="fg-console-dialog__grid">
                {sourceModeSwitch}

                {sessionPresent ? (
                  workspaceInventory.workspaceError ? (
                    <InlineAlert variant="error">
                      {workspaceInventory.workspaceError}
                    </InlineAlert>
                  ) : (
                    <DeployCreateProjectForm
                      currentPath={currentPath}
                      initialInspection={inspection}
                      initialInspectionError={inspectionError}
                      projects={workspaceInventory.projects}
                      requestedTemplateSlug={requestedTemplateSlug}
                      routeMode={routeMode}
                      runtimeTargetInventoryError={
                        workspaceInventory.runtimeTargetInventoryError
                      }
                      runtimeTargets={workspaceInventory.runtimeTargets}
                      search={search}
                    />
                  )
                ) : isLocalUploadMode ? (
                  <>
                    <InlineAlert variant="info">
                      Local files are selected after sign-in, not before the auth
                      redirect.
                    </InlineAlert>
                    <div className="fg-console-dialog__actions">
                      <ButtonAnchor
                        href={buildReturnToHref("/auth/sign-in", currentPath)}
                        variant="primary"
                      >
                        Sign in to upload
                      </ButtonAnchor>
                      <ButtonAnchor
                        href={buildReturnToHref("/auth/sign-up", currentPath)}
                        variant="secondary"
                      >
                        Create account
                      </ButtonAnchor>
                    </div>
                    <p className="fg-deploy-inline-copy">
                      After sign-in, this page reopens in Local upload mode so you
                      can drag the folder directly into the browser.
                    </p>
                  </>
                ) : isImageMode ? (
                  <>
                    <form
                      action="/new/repository"
                      className="fg-console-dialog__form"
                      method="GET"
                    >
                      <input
                        name="source-mode"
                        type="hidden"
                        value="docker-image"
                      />
                      {Object.entries(search.env).map(([key, value]) => (
                        <input
                          key={key}
                          name={`env[${key}]`}
                          type="hidden"
                          value={value}
                        />
                      ))}

                      <div className="fg-console-dialog__grid">
                        <FormField
                          htmlFor="deploy-entry-image-ref"
                          label="Image reference"
                        >
                          <input
                            autoCapitalize="none"
                            className="fg-input"
                            defaultValue={search.imageRef}
                            id="deploy-entry-image-ref"
                            name="image-ref"
                            placeholder="ghcr.io/example/api:1.2.3"
                            spellCheck={false}
                          />
                        </FormField>

                        <FormField
                          htmlFor="deploy-entry-image-name"
                          label="App name"
                          optionalLabel="Optional"
                        >
                          <input
                            className="fg-input"
                            defaultValue={search.appName}
                            id="deploy-entry-image-name"
                            name="name"
                            placeholder="chatgpt"
                          />
                        </FormField>

                        <FormField
                          htmlFor="deploy-entry-service-port"
                          label="Service port"
                          optionalLabel="Optional"
                        >
                          <input
                            className="fg-input"
                            defaultValue={search.servicePort}
                            id="deploy-entry-service-port"
                            inputMode="numeric"
                            name="service-port"
                            placeholder="8080"
                          />
                        </FormField>
                      </div>

                      <div className="fg-console-dialog__actions">
                        <Button type="submit" variant="primary">
                          Review image
                        </Button>
                      </div>
                    </form>

                    {hasImageRef ? (
                      <>
                        <InlineAlert variant="info">
                          Sign in to continue with this image.
                        </InlineAlert>
                        <div className="fg-console-dialog__actions">
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-in", currentPath)}
                            variant="primary"
                          >
                            Sign in
                          </ButtonAnchor>
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-up", currentPath)}
                            variant="secondary"
                          >
                            Create account
                          </ButtonAnchor>
                        </div>
                      </>
                    ) : (
                      <PanelCopy>
                        Use a public image reference to unlock the deploy form
                        after sign-in.
                      </PanelCopy>
                    )}
                  </>
                ) : (
                  <>
                    <form
                      action={panelAction}
                      className="fg-console-dialog__form"
                      method="GET"
                    >
                      <DeployRepositoryLinkField
                        autoFocus
                        defaultValue={search.repositoryUrl}
                        id="deploy-entry-repository"
                        name="repository-url"
                      />

                      {search.branch ? (
                        <input name="branch" type="hidden" value={search.branch} />
                      ) : null}

                      {Object.entries(search.env).map(([key, value]) => (
                        <input
                          key={key}
                          name={`env[${key}]`}
                          type="hidden"
                          value={value}
                        />
                      ))}

                      {search.repoVisibility !== "public" ? (
                        <input
                          name="repo-visibility"
                          type="hidden"
                          value={search.repoVisibility}
                        />
                      ) : null}
                    </form>

                    {repositoryUrlError ? (
                      <InlineAlert variant="error">{repositoryUrlError}</InlineAlert>
                    ) : null}

                    {inspectionError ? (
                      <InlineAlert variant="error">{inspectionError}</InlineAlert>
                    ) : null}

                    {routeMode === "template" &&
                    search.repositoryUrl &&
                    !template &&
                    !inspectionError ? (
                      <InlineAlert variant="info">
                        This repository does not expose template metadata in{" "}
                        <code>fugue.yaml</code>. Fugue can still deploy it as a
                        repository import.
                      </InlineAlert>
                    ) : null}

                    {search.repositoryUrl && isValidRepositoryUrl ? (
                      <>
                        <InlineAlert variant="info">
                          Sign in to continue with this repository.
                        </InlineAlert>
                        <div className="fg-console-dialog__actions">
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-in", currentPath)}
                            variant="primary"
                          >
                            Sign in
                          </ButtonAnchor>
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-up", currentPath)}
                            variant="secondary"
                          >
                            Create account
                          </ButtonAnchor>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </PanelSection>
          </Panel>
        </section>
      </div>
    </main>
  );
}

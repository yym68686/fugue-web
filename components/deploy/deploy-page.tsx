import { DeployImageWizard } from "@/components/deploy/deploy-image-wizard";
import { DeployRepositoryLinkField } from "@/components/deploy/deploy-repository-link-field";
import { DeployUploadWizard } from "@/components/deploy/deploy-upload-wizard";
import { DeployWizard } from "@/components/deploy/deploy-wizard";
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
import { cx } from "@/lib/ui/cx";

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
  const isValidRepositoryUrl =
    effectiveSourceMode === "repository" && search.repositoryUrl
      ? isGitHubRepoUrl(search.repositoryUrl)
      : false;
  const repositoryUrlError =
    search.repositoryUrl && !isValidRepositoryUrl
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
  const useCompactRepositoryLayout = !isLocalUploadMode && !isImageMode;
  const sourceModeSwitch =
    routeMode === "repository" ? (
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
    <main
      className={cx(
        "fg-auth-page fg-deploy-page",
        useCompactRepositoryLayout && "fg-deploy-page--repository",
      )}
    >
      <div
        className={cx(
          "fg-auth-grid fg-deploy-grid",
          "fg-deploy-grid--solo",
          useCompactRepositoryLayout && "fg-deploy-grid--repository",
        )}
      >
        <section
          className={cx(
            "fg-auth-panel-slot fg-deploy-panel-slot",
            useCompactRepositoryLayout &&
              "fg-console-dialog-shell fg-project-dialog-shell fg-deploy-dialog-shell",
          )}
        >
          <Panel
            className={cx(
              useCompactRepositoryLayout
                ? "fg-console-dialog-panel"
                : "fg-deploy-panel",
            )}
          >
            {useCompactRepositoryLayout ? (
              <>
                <PanelSection>
                  <p className="fg-label fg-panel__eyebrow">Create project</p>
                  <PanelTitle className="fg-console-dialog__title">
                    Create project
                  </PanelTitle>
                  <PanelCopy>
                    Give the project a name, then point Fugue at the first
                    GitHub repository, local folder, or Docker image.
                  </PanelCopy>
                </PanelSection>

                <PanelSection className="fg-console-dialog__body">
                  <div className="fg-console-dialog__grid">
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

                    {search.repositoryUrl && isValidRepositoryUrl ? (
                      sessionPresent ? (
                        workspaceInventory.workspaceError ? (
                          <InlineAlert variant="error">
                            {workspaceInventory.workspaceError}
                          </InlineAlert>
                        ) : (
                          <DeployWizard
                            initialBranch={
                              search.branch || inspection?.repository.branch || ""
                            }
                            initialRepoVisibility={search.repoVisibility}
                            inspection={inspection}
                            projectInventoryError={
                              workspaceInventory.projectInventoryError
                            }
                            projects={workspaceInventory.projects}
                            repositoryUrl={search.repositoryUrl}
                            runtimeTargetInventoryError={
                              workspaceInventory.runtimeTargetInventoryError
                            }
                            runtimeTargets={workspaceInventory.runtimeTargets}
                            workspaceDefaultProjectId={
                              workspaceInventory.workspace?.defaultProjectId
                            }
                            workspaceDefaultProjectName={
                              workspaceInventory.workspace?.defaultProjectName
                            }
                          />
                        )
                      ) : (
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
                      )
                    ) : null}
                  </div>
                </PanelSection>
              </>
            ) : (
              <>
                {routeMode === "repository" ? (
                  <PanelSection>
                    <p className="fg-label fg-panel__eyebrow">Deploy mode</p>
                    <PanelTitle>Choose the source you want to route.</PanelTitle>
                    <PanelCopy>
                      GitHub repository keeps preflight inspection and template
                      discovery. Local upload handles folders and one-off source
                      files directly from the browser. Docker image mode starts
                      from a published container reference.
                    </PanelCopy>
                    {sourceModeSwitch}
                  </PanelSection>
                ) : null}

                {isLocalUploadMode ? (
                  <>
                    <PanelSection>
                      <p className="fg-label fg-panel__eyebrow">
                        Local upload intake
                      </p>
                      <PanelTitle>
                        {sessionPresent
                          ? "Choose a folder or source files."
                          : "Authenticate before choosing files."}
                      </PanelTitle>
                      <PanelCopy>
                        {sessionPresent
                          ? "Drag a local folder, compose file, fugue manifest, Dockerfile, or multiple source files. Fugue packages them on the server, then queues the deploy into your workspace."
                          : "Browser uploads stay on this machine until you sign in. After auth, this page reopens in Local upload mode so you can drag the folder directly."}
                      </PanelCopy>

                      {!sessionPresent ? (
                        <InlineAlert variant="info">
                          Local files are selected after sign-in, not before the
                          auth redirect.
                        </InlineAlert>
                      ) : null}
                    </PanelSection>

                    {sessionPresent ? (
                      workspaceInventory.workspaceError ? (
                        <PanelSection>
                          <InlineAlert variant="error">
                            {workspaceInventory.workspaceError}
                          </InlineAlert>
                        </PanelSection>
                      ) : (
                        <DeployUploadWizard
                          projectInventoryError={
                            workspaceInventory.projectInventoryError
                          }
                          projects={workspaceInventory.projects}
                          runtimeTargetInventoryError={
                            workspaceInventory.runtimeTargetInventoryError
                          }
                          runtimeTargets={workspaceInventory.runtimeTargets}
                          workspaceDefaultProjectId={
                            workspaceInventory.workspace?.defaultProjectId
                          }
                          workspaceDefaultProjectName={
                            workspaceInventory.workspace?.defaultProjectName
                          }
                        />
                      )
                    ) : (
                      <PanelSection>
                        <p className="fg-label fg-panel__eyebrow">Sign in</p>
                        <PanelTitle>
                          Authenticate before the upload is queued.
                        </PanelTitle>
                        <PanelCopy>
                          Fugue keeps this local-upload route in{" "}
                          <code>returnTo</code>, creates a first-party session,
                          and sends you back here to choose the folder.
                        </PanelCopy>

                        <div className="fg-deploy-auth-actions">
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-in", currentPath)}
                            variant="route"
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
                          After sign-in, this page reopens in Local upload mode
                          so you can drag the folder directly into the browser.
                        </p>
                      </PanelSection>
                    )}
                  </>
                ) : isImageMode ? (
                  <>
                    <PanelSection>
                      <p className="fg-label fg-panel__eyebrow">Image intake</p>
                      <PanelTitle>
                        {hasImageRef
                          ? "Review the image and continue."
                          : "Paste a container image reference."}
                      </PanelTitle>
                      <PanelCopy>
                        Use a pullable public image reference. After sign-in,
                        choose the project, runtime, and optional service port
                        before the deploy is queued.
                      </PanelCopy>

                      <form
                        action="/new/repository"
                        className="fg-deploy-entry-form"
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

                        <div className="fg-deploy-entry-row">
                          <FormField
                            hint="Use a published image such as ghcr.io/example/api:1.2.3."
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
                            hint="Optional app name override."
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
                        </div>

                        <FormField
                          hint="Optional known listener port such as 8080."
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

                        <div className="fg-deploy-inline-actions">
                          <Button type="submit" variant="route">
                            Review image
                          </Button>
                        </div>
                        <p className="fg-deploy-inline-copy">
                          The deploy link is stable. Auth handoff preserves this
                          exact image route and returns here after sign-in.
                        </p>
                      </form>
                    </PanelSection>

                    {!hasImageRef ? (
                      <PanelSection>
                        <PanelCopy>
                          Use a public image reference to unlock the deploy
                          wizard and auth handoff.
                        </PanelCopy>
                      </PanelSection>
                    ) : sessionPresent ? (
                      workspaceInventory.workspaceError ? (
                        <PanelSection>
                          <InlineAlert variant="error">
                            {workspaceInventory.workspaceError}
                          </InlineAlert>
                        </PanelSection>
                      ) : (
                        <DeployImageWizard
                          initialEnv={search.env}
                          initialImageRef={search.imageRef}
                          initialName={search.appName}
                          initialServicePort={search.servicePort}
                          projectInventoryError={
                            workspaceInventory.projectInventoryError
                          }
                          projects={workspaceInventory.projects}
                          runtimeTargetInventoryError={
                            workspaceInventory.runtimeTargetInventoryError
                          }
                          runtimeTargets={workspaceInventory.runtimeTargets}
                          workspaceDefaultProjectId={
                            workspaceInventory.workspace?.defaultProjectId
                          }
                          workspaceDefaultProjectName={
                            workspaceInventory.workspace?.defaultProjectName
                          }
                        />
                      )
                    ) : (
                      <PanelSection>
                        <p className="fg-label fg-panel__eyebrow">Sign in</p>
                        <PanelTitle>
                          Authenticate before the deploy is queued.
                        </PanelTitle>
                        <PanelCopy>
                          Fugue keeps the image reference in{" "}
                          <code>returnTo</code>, creates a first-party session,
                          and sends you back to this exact deploy route.
                        </PanelCopy>

                        <div className="fg-deploy-auth-actions">
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-in", currentPath)}
                            variant="route"
                          >
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
                          After sign-in, the wizard reopens with the same
                          image, app name, and port already filled in.
                        </p>
                      </PanelSection>
                    )}
                  </>
                ) : (
                  <>
                    <PanelSection>
                      <p className="fg-label fg-panel__eyebrow">
                        {routeMode === "template"
                          ? "Template intake"
                          : "Repository intake"}
                      </p>
                      <PanelTitle>
                        {search.repositoryUrl
                          ? "Review the repository and continue."
                          : "Paste a GitHub repository link."}
                      </PanelTitle>
                      <PanelCopy>
                        Public repositories can be inspected immediately.
                        Private repositories can be authorized after sign-in
                        with GitHub or a token override.
                      </PanelCopy>

                      <form
                        action={panelAction}
                        className="fg-deploy-entry-form"
                        method="GET"
                      >
                        <DeployRepositoryLinkField
                          defaultValue={search.repositoryUrl}
                          id="deploy-entry-repository"
                          name="repository-url"
                        />

                        {search.branch ? (
                          <input name="branch" type="hidden" value={search.branch} />
                        ) : null}

                        {search.repoVisibility !== "public" ? (
                          <input
                            name="repo-visibility"
                            type="hidden"
                            value={search.repoVisibility}
                          />
                        ) : null}
                      </form>
                    </PanelSection>

                    {repositoryUrlError ? (
                      <PanelSection>
                        <InlineAlert variant="error">{repositoryUrlError}</InlineAlert>
                      </PanelSection>
                    ) : null}

                    {inspectionError ? (
                      <PanelSection>
                        <InlineAlert variant="error">
                          {inspectionError}
                        </InlineAlert>
                      </PanelSection>
                    ) : null}

                    {routeMode === "template" &&
                    search.repositoryUrl &&
                    !template &&
                    !inspectionError ? (
                      <PanelSection>
                        <InlineAlert variant="info">
                          This repository does not expose template metadata in{" "}
                          <code>fugue.yaml</code>. Fugue can still deploy it as
                          a repository import.
                        </InlineAlert>
                      </PanelSection>
                    ) : null}

                    {!search.repositoryUrl ? (
                      <PanelSection>
                        <PanelCopy>
                          Use a GitHub repository URL to unlock inspection,
                          auth handoff, and the deploy wizard.
                        </PanelCopy>
                      </PanelSection>
                    ) : !isValidRepositoryUrl ? null : sessionPresent ? (
                      workspaceInventory.workspaceError ? (
                        <PanelSection>
                          <InlineAlert variant="error">
                            {workspaceInventory.workspaceError}
                          </InlineAlert>
                        </PanelSection>
                      ) : (
                        <DeployWizard
                          initialBranch={
                            search.branch || inspection?.repository.branch || ""
                          }
                          initialRepoVisibility={search.repoVisibility}
                          inspection={inspection}
                          projectInventoryError={
                            workspaceInventory.projectInventoryError
                          }
                          projects={workspaceInventory.projects}
                          repositoryUrl={search.repositoryUrl}
                          runtimeTargetInventoryError={
                            workspaceInventory.runtimeTargetInventoryError
                          }
                          runtimeTargets={workspaceInventory.runtimeTargets}
                          workspaceDefaultProjectId={
                            workspaceInventory.workspace?.defaultProjectId
                          }
                          workspaceDefaultProjectName={
                            workspaceInventory.workspace?.defaultProjectName
                          }
                        />
                      )
                    ) : (
                      <PanelSection>
                        <p className="fg-label fg-panel__eyebrow">Sign in</p>
                        <PanelTitle>
                          Authenticate before the deploy is queued.
                        </PanelTitle>
                        <PanelCopy>
                          Fugue keeps the repository link in{" "}
                          <code>returnTo</code>, creates a first-party session,
                          and sends you back to this exact deploy route.
                        </PanelCopy>

                        <div className="fg-deploy-auth-actions">
                          <ButtonAnchor
                            href={buildReturnToHref("/auth/sign-in", currentPath)}
                            variant="route"
                          >
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
                          After sign-in, the wizard reopens with the same
                          repository already filled in.
                        </p>
                      </PanelSection>
                    )}
                  </>
                )}
              </>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

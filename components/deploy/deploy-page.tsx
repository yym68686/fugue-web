import { Brand } from "@/components/brand";
import { DeployImageWizard } from "@/components/deploy/deploy-image-wizard";
import { DeployUploadWizard } from "@/components/deploy/deploy-upload-wizard";
import { DeployWizard } from "@/components/deploy/deploy-wizard";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Panel,
  PanelCopy,
  PanelSection,
  PanelTitle,
} from "@/components/ui/panel";
import {
  ProofShell,
  ProofShellEmpty,
  ProofShellRibbon,
} from "@/components/ui/proof-shell";
import { RouteNote } from "@/components/ui/route-note";
import { buildReturnToHref } from "@/lib/auth/validation";
import type { DeployPageData } from "@/lib/deploy/page-data";
import {
  describeManifestBuild,
  describeManifestServiceRole,
  humanizeDeployValue,
  pluralize,
  readInferenceTone,
  readManifestBindingTargets,
  summarizeInspectManifest,
} from "@/lib/deploy/topology-display";
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
  const effectiveSourceMode =
    routeMode === "repository" ? search.sourceMode : "repository";
  const isImageMode = effectiveSourceMode === "docker-image";
  const isLocalUploadMode = effectiveSourceMode === "local-upload";
  const hasImageRef = Boolean(search.imageRef.trim());
  const isValidRepositoryUrl =
    effectiveSourceMode === "repository" && search.repositoryUrl
      ? isGitHubRepoUrl(search.repositoryUrl)
      : false;
  const template = inspection?.template ?? null;
  const manifest = inspection?.fugueManifest ?? null;
  const manifestSummary = summarizeInspectManifest(manifest);
  const visibleInferences = manifestSummary.inferenceReport.slice(0, 6);
  const templateHref = template
    ? buildDeployHref(`/new/template/${template.slug}`, {
        ...search,
        sourceMode: "repository",
      })
    : null;
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
  const title =
    routeMode === "template"
      ? template?.name || "Deploy template."
      : isLocalUploadMode
        ? "Deploy from a local folder."
        : isImageMode
          ? search.appName
            ? `Deploy ${search.appName}.`
            : "Deploy from a Docker image."
        : inspection?.repository.repoName
          ? `Deploy ${inspection.repository.repoName}.`
          : "Deploy from GitHub.";
  const description =
    routeMode === "template" && template?.description
      ? template.description
      : isLocalUploadMode
        ? "Drag a local folder, docker-compose.yml, fugue.yaml, Dockerfile, or source files into the browser. Fugue packages the upload on the server, then imports the detected topology without losing the route model."
        : isImageMode
          ? "Paste a public image reference, choose a project and runtime, and queue the first deployment. Fugue mirrors the image into the internal registry before rollout."
        : manifest
          ? "Fugue found fugue.yaml and can import the declared topology without losing the route model."
          : "Paste a GitHub repository link, inspect the source, and queue the first deployment onto shared or attached infrastructure.";
  const notes = isLocalUploadMode
    ? [
        {
          index: "01",
          meta: "Folder / Compose / Dockerfile",
          title: "Source intake",
        },
        {
          index: "02",
          meta: "Browser drop / Server archive",
          title: "Packaging",
        },
        {
          index: "03",
          meta: sessionPresent
            ? "Signed in / Workspace route"
            : "Auth handoff / ReturnTo preserved",
          title: sessionPresent ? "Deploy ready" : "Sign in",
        },
      ]
    : isImageMode
      ? [
          {
            index: "01",
            meta: "Public image / Pullable registry",
            title: "Registry access",
          },
          {
            index: "02",
            meta: "Mirror / Internal registry",
            title: "Image import",
          },
          {
            index: "03",
            meta: sessionPresent
              ? "Signed in / Workspace route"
              : "Auth handoff / ReturnTo preserved",
            title: sessionPresent ? "Deploy ready" : "Sign in",
          },
        ]
    : [
        {
          index: "01",
          meta:
            search.repoVisibility === "private"
              ? "Private / GitHub auth"
              : "Public / Anonymous read",
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
          meta: sessionPresent
            ? "Signed in / Workspace route"
            : "Auth handoff / ReturnTo preserved",
          title: sessionPresent ? "Deploy ready" : "Sign in",
        },
      ];

  return (
    <main className="fg-auth-page fg-deploy-page">
      <div className="fg-auth-grid fg-deploy-grid">
        <section className="fg-auth-stage fg-deploy-stage">
          <div className="fg-auth-stage__top">
            <Brand
              meta={
                routeMode === "template"
                  ? "Template deploy"
                  : isLocalUploadMode
                    ? "Local upload deploy"
                    : isImageMode
                      ? "Image deploy"
                    : "Repository deploy"
              }
            />
          </div>

          <div className="fg-auth-stage__copy">
            <p className="fg-label">
              {routeMode === "template"
                ? "Deploy / Template"
                : isLocalUploadMode
                  ? "Deploy / Local upload"
                  : isImageMode
                    ? "Deploy / Docker image"
                  : "Deploy / Repository"}
            </p>
            <h1 className="fg-display-heading">{title}</h1>
            <p className="fg-copy">{description}</p>
          </div>

          <svg
            className="fg-route-signal fg-auth-stage__signal"
            viewBox="0 0 1200 170"
            aria-hidden="true"
          >
            <path
              className="fg-route-signal__base"
              d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36"
            />
            <path
              className="fg-route-signal__active"
              d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36"
            />
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
              {isLocalUploadMode
                ? "Local source intake"
                : isImageMode
                  ? "Image intake"
                : inspection
                  ? "Inspection result"
                  : "Repository intake"}
            </ProofShellRibbon>

            {isLocalUploadMode ? (
              <div className="fg-deploy-proof__content">
                <div className="fg-deploy-proof__head">
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Accepted input</span>
                    <strong>Folder or source files</strong>
                    <span>
                      Drag a directory, docker-compose.yml, fugue.yaml, or a
                      single Dockerfile.
                    </span>
                  </div>
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Packaging</span>
                    <strong>Server-built archive</strong>
                    <span>
                      The browser sends relative paths, then Fugue builds the
                      import archive on the server before queueing deploy.
                    </span>
                  </div>
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Import mode</span>
                    <strong>Topology first</strong>
                    <span>
                      fugue.yaml and compose files import the whole stack when
                      build overrides stay blank.
                    </span>
                  </div>
                </div>

                <div className="fg-deploy-topology-grid">
                  <div className="fg-deploy-topology-card">
                    <span className="fg-label">Whole-stack cases</span>
                    <ul className="fg-deploy-note-list">
                      <li className="fg-deploy-note-item">
                        <span>
                          Uploading a folder with fugue.yaml keeps the declared
                          service graph intact.
                        </span>
                      </li>
                      <li className="fg-deploy-note-item">
                        <span>
                          Uploading docker-compose.yml or a folder containing it
                          imports multi-service topology.
                        </span>
                      </li>
                      <li className="fg-deploy-note-item">
                        <span>
                          Uploading a single Dockerfile falls back to a normal
                          single-app build import.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="fg-deploy-topology-card">
                    <span className="fg-label">Deploy rules</span>
                    <ul className="fg-deploy-note-list">
                      <li className="fg-deploy-note-item">
                        <span>
                          Leave build strategy on Auto detect to preserve
                          compose or manifest imports.
                        </span>
                      </li>
                      <li className="fg-deploy-note-item">
                        <span>
                          Runtime and project are still chosen before the deploy
                          is queued.
                        </span>
                      </li>
                      <li className="fg-deploy-note-item">
                        <span>
                          The route stays stable across sign-in and returns to
                          this exact deploy path.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : isImageMode ? (
              hasImageRef ? (
                <div className="fg-deploy-proof__content">
                  <div className="fg-deploy-proof__head">
                    <div className="fg-deploy-proof__stat">
                      <span className="fg-label">Image</span>
                      <strong>{search.imageRef}</strong>
                      <span>Published reference queued for mirror.</span>
                    </div>
                    <div className="fg-deploy-proof__stat">
                      <span className="fg-label">Deploy mode</span>
                      <strong>Single app image</strong>
                      <span>
                        {search.appName
                          ? `Prefill app name ${search.appName}`
                          : "App name is optional."}
                      </span>
                    </div>
                    <div className="fg-deploy-proof__stat">
                      <span className="fg-label">Service port</span>
                      <strong>
                        {search.servicePort
                          ? `Port ${search.servicePort}`
                          : "Set in wizard"}
                      </strong>
                      <span>
                        {search.servicePort
                          ? "Prefilled from the deploy link."
                          : "Specify when the container listens on a known port."}
                      </span>
                    </div>
                  </div>

                  <div className="fg-deploy-topology-grid">
                    <div className="fg-deploy-topology-card">
                      <span className="fg-label">Registry rules</span>
                      <ul className="fg-deploy-note-list">
                        <li className="fg-deploy-note-item">
                          <span>
                            Use a pullable public image reference from Docker
                            Hub, GHCR, or another accessible registry.
                          </span>
                        </li>
                        <li className="fg-deploy-note-item">
                          <span>
                            This one-click flow does not collect registry
                            credentials before import.
                          </span>
                        </li>
                        <li className="fg-deploy-note-item">
                          <span>
                            Fugue mirrors the image into the internal registry
                            before rollout.
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="fg-deploy-topology-card">
                      <span className="fg-label">Deploy rules</span>
                      <ul className="fg-deploy-note-list">
                        <li className="fg-deploy-note-item">
                          <span>
                            Runtime and project are still chosen before the
                            deploy is queued.
                          </span>
                        </li>
                        <li className="fg-deploy-note-item">
                          <span>
                            Service port is optional but useful for known
                            container listeners like <code>8080</code>.
                          </span>
                        </li>
                        <li className="fg-deploy-note-item">
                          <span>
                            The route stays stable across sign-in and returns to
                            this exact deploy path.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <ProofShellEmpty
                  description="Paste a public image reference to prefill the deploy route, then sign in to choose the project, runtime, and optional service port."
                  title="Waiting for an image"
                />
              )
            ) : inspection ? (
              <div className="fg-deploy-proof__content">
                <div className="fg-deploy-proof__head">
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Repository</span>
                    <strong>
                      {inspection.repository.repoOwner}/
                      {inspection.repository.repoName}
                    </strong>
                    <span>{inspection.repository.repoVisibility} access</span>
                  </div>
                  <div className="fg-deploy-proof__stat">
                    <span className="fg-label">Branch</span>
                    <strong>{inspection.repository.branch}</strong>
                    <span>
                      Commit {shortCommit(inspection.repository.commitSha)}
                    </span>
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
                          ? `Primary ${manifest.primaryService} · ${pluralize(manifestSummary.serviceCount, "service")} / ${pluralize(manifestSummary.backingServiceCount, "backing service")} / ${pluralize(manifestSummary.bindingEdgeCount, "binding")}`
                          : "Build inputs required"}
                    </span>
                  </div>
                </div>

                {template ? (
                  <div className="fg-deploy-template-actions">
                    {routeMode === "repository" && templateHref ? (
                      <ButtonAnchor
                        href={templateHref}
                        size="compact"
                        variant="secondary"
                      >
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
                  <>
                    <ul className="fg-deploy-service-list">
                      {manifest.services.map((service) => {
                        const bindingTargets =
                          readManifestBindingTargets(service);

                        return (
                          <li
                            className="fg-deploy-service-item"
                            key={`${service.service}-${service.kind}`}
                          >
                            <strong>{service.service}</strong>
                            <div className="fg-deploy-service-item__pills">
                              <span className="fg-deploy-service-pill">
                                {describeManifestServiceRole(service)}
                              </span>
                              {service.backingService ? (
                                <span className="fg-deploy-service-pill">
                                  Backing service
                                </span>
                              ) : null}
                              <span className="fg-deploy-service-pill">
                                {service.published ? "Published" : "Internal"}
                              </span>
                              <span className="fg-deploy-service-pill">
                                Port {service.internalPort}
                              </span>
                            </div>
                            <span>{describeManifestBuild(service)}</span>
                            {service.composeService &&
                            service.composeService !== service.service ? (
                              <span>
                                Source service {service.composeService}
                              </span>
                            ) : null}
                            {bindingTargets.length ? (
                              <span>Bindings {bindingTargets.join(", ")}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>

                    {manifestSummary.warnings.length ||
                    visibleInferences.length ? (
                      <div className="fg-deploy-topology-grid">
                        {manifestSummary.warnings.length ? (
                          <div className="fg-deploy-topology-card">
                            <span className="fg-label">Warnings</span>
                            <ul className="fg-deploy-note-list">
                              {manifestSummary.warnings.map(
                                (warning, index) => (
                                  <li
                                    className="fg-deploy-note-item"
                                    key={`warning-${index}`}
                                  >
                                    <span>{warning}</span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}

                        {visibleInferences.length ? (
                          <div className="fg-deploy-topology-card">
                            <span className="fg-label">Inference report</span>
                            <ul className="fg-deploy-note-list">
                              {visibleInferences.map((item, index) => (
                                <li
                                  className="fg-deploy-note-item"
                                  key={`${item.service}-${item.category}-${index}`}
                                >
                                  <div className="fg-deploy-note-item__head">
                                    <span
                                      className={`fg-deploy-note-pill fg-deploy-note-pill--${readInferenceTone(item.level)}`}
                                    >
                                      {humanizeDeployValue(item.level)}
                                    </span>
                                    <strong>
                                      {humanizeDeployValue(item.service)}
                                    </strong>
                                    <span className="fg-deploy-note-pill">
                                      {humanizeDeployValue(item.category)}
                                    </span>
                                  </div>
                                  <span>{item.message}</span>
                                </li>
                              ))}
                              {manifestSummary.inferenceReport.length >
                              visibleInferences.length ? (
                                <li className="fg-deploy-note-item">
                                  <span>
                                    +
                                    {manifestSummary.inferenceReport.length -
                                      visibleInferences.length}{" "}
                                    more topology inferences
                                  </span>
                                </li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
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
                title={
                  inspectionError
                    ? "Inspection unavailable"
                    : "Waiting for a repository"
                }
              />
            )}
          </ProofShell>

          <div className="fg-object-belt" aria-label="Deploy path">
            <span>
              {isLocalUploadMode
                ? "Folder"
                : isImageMode
                  ? "Image"
                  : "Repository"}
            </span>
            <span>
              {isLocalUploadMode
                ? "Archive"
                : isImageMode
                  ? "Mirror"
                  : "Template"}
            </span>
            <span>Workspace</span>
            <span>Runtime</span>
            <span>Operation</span>
          </div>
        </section>

        <section className="fg-auth-panel-slot fg-deploy-panel-slot">
          <Panel>
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

                <div
                  aria-label="Deploy source mode"
                  className="fg-segmented fg-deploy-source-switch"
                  role="navigation"
                >
                  <a
                    aria-current={
                      !isLocalUploadMode && !isImageMode ? "page" : undefined
                    }
                    className={`fg-segmented__item${!isLocalUploadMode && !isImageMode ? " is-active" : ""}`}
                    data-state={
                      !isLocalUploadMode && !isImageMode
                        ? "active"
                        : "inactive"
                    }
                    href={repositoryModeHref ?? "/new/repository"}
                  >
                    <span className="fg-segmented__label">
                      GitHub repository
                    </span>
                  </a>
                  <a
                    aria-current={isLocalUploadMode ? "page" : undefined}
                    className={`fg-segmented__item${isLocalUploadMode ? " is-active" : ""}`}
                    data-state={isLocalUploadMode ? "active" : "inactive"}
                    href={
                      localUploadModeHref ??
                      "/new/repository?source-mode=local-upload"
                    }
                  >
                    <span className="fg-segmented__label">Local upload</span>
                  </a>
                  <a
                    aria-current={isImageMode ? "page" : undefined}
                    className={`fg-segmented__item${isImageMode ? " is-active" : ""}`}
                    data-state={isImageMode ? "active" : "inactive"}
                    href={
                      dockerImageModeHref ??
                      "/new/repository?source-mode=docker-image"
                    }
                  >
                    <span className="fg-segmented__label">Docker image</span>
                  </a>
                </div>
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
                      <code>returnTo</code>, creates a first-party session, and
                      sends you back here to choose the folder.
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
                      After sign-in, this page reopens in Local upload mode so
                      you can drag the folder directly into the browser.
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
                    Use a pullable public image reference. After sign-in, choose
                    the project, runtime, and optional service port before the
                    deploy is queued.
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
                      Use a public image reference to unlock the deploy wizard
                      and auth handoff.
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
                      Fugue keeps the image reference in <code>returnTo</code>,
                      creates a first-party session, and sends you back to this
                      exact deploy route.
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
                      After sign-in, the wizard reopens with the same image,
                      app name, and port already filled in.
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
                    Public repositories can be inspected immediately. Private
                    repositories can be authorized after sign-in with GitHub or
                    a token override.
                  </PanelCopy>

                  <form
                    action={panelAction}
                    className="fg-deploy-entry-form"
                    method="GET"
                  >
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
                      <input
                        name="repo-visibility"
                        type="hidden"
                        value={search.repoVisibility}
                      />
                    ) : null}

                    <div className="fg-deploy-inline-actions">
                      <Button type="submit" variant="route">
                        Inspect repository
                      </Button>
                    </div>
                    <p className="fg-deploy-inline-copy">
                      The deploy link is stable. Auth handoff preserves this
                      exact route and returns here after sign-in.
                    </p>
                  </form>
                </PanelSection>

                {inspectionError ? (
                  <PanelSection>
                    <InlineAlert variant="error">{inspectionError}</InlineAlert>
                  </PanelSection>
                ) : null}

                {routeMode === "template" &&
                search.repositoryUrl &&
                !template &&
                !inspectionError ? (
                  <PanelSection>
                    <InlineAlert variant="info">
                      This repository does not expose template metadata in{" "}
                      <code>fugue.yaml</code>. Fugue can still deploy it as a
                      repository import.
                    </InlineAlert>
                  </PanelSection>
                ) : null}

                {!search.repositoryUrl || !isValidRepositoryUrl ? (
                  <PanelSection>
                    <PanelCopy>
                      Use a GitHub repository URL to unlock inspection, auth
                      handoff, and the deploy wizard.
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
                      Fugue keeps the repository link in <code>returnTo</code>,
                      creates a first-party session, and sends you back to this
                      exact deploy route.
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
                      After sign-in, the wizard reopens with the same repository
                      and branch already filled in.
                    </p>
                  </PanelSection>
                )}
              </>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

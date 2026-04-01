import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  BUILD_STRATEGY_OPTIONS,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  type BuildStrategyValue,
  type ImportServiceDraft,
  type ImportSourceMode,
} from "@/lib/fugue/import-source";

const SOURCE_MODE_OPTIONS: readonly SegmentedControlOption<ImportSourceMode>[] = [
  { label: "GitHub repository", value: "github" },
  { label: "Docker image", value: "docker-image" },
];

type ImportServiceFieldProps = {
  draft: ImportServiceDraft;
  idPrefix: string;
  includeWrapper?: boolean;
  inventoryError?: string | null;
  onDraftChange: (next: ImportServiceDraft) => void;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
};

export function ImportServiceFields({
  draft,
  idPrefix,
  includeWrapper = true,
  inventoryError = null,
  onDraftChange,
  runtimeTargets,
}: ImportServiceFieldProps) {
  const supportsSourceDir = supportsGitHubSourceDir(draft.buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(draft.buildStrategy);
  const advancedDescription =
    draft.sourceMode === "github"
      ? "Branch, app name, build strategy, and optional source paths."
      : "App name plus an optional service port override.";

  function updateField<Key extends keyof ImportServiceDraft>(
    key: Key,
    value: ImportServiceDraft[Key],
  ) {
    onDraftChange({
      ...draft,
      [key]: value,
    });
  }

  function updateSourceMode(nextMode: ImportSourceMode) {
    onDraftChange({
      ...draft,
      imageRef: nextMode === "docker-image" ? draft.imageRef : "",
      repoAuthToken: nextMode === "github" ? draft.repoAuthToken : "",
      repoUrl: nextMode === "github" ? draft.repoUrl : "",
      repoVisibility: nextMode === "github" ? draft.repoVisibility : "public",
      sourceMode: nextMode,
    });
  }

  const content = (
    <>
      <div className="fg-field-stack">
        <div className="fg-field-label">
          <span>Source mode</span>
        </div>
        <div className="fg-field-control">
          <SegmentedControl
            ariaLabel="Import source mode"
            onChange={updateSourceMode}
            options={SOURCE_MODE_OPTIONS}
            value={draft.sourceMode}
          />
        </div>
        <span className="fg-field-hint">
          Choose whether Fugue builds from a tracked GitHub repository or pulls a published
          Docker image.
        </span>
      </div>

      {draft.sourceMode === "github" ? (
        <>
          <FormField
            hint="Use https://github.com/owner/repo."
            htmlFor={`${idPrefix}-repo-url`}
            label="Repository link"
          >
            <input
              autoComplete="url"
              autoCapitalize="none"
              className="fg-input"
              id={`${idPrefix}-repo-url`}
              inputMode="url"
              name="repoUrl"
              onChange={(event) => updateField("repoUrl", event.target.value)}
              placeholder="https://github.com/owner/repo"
              required
              spellCheck={false}
              type="url"
              value={draft.repoUrl}
            />
          </FormField>

          <GitHubRepositoryAccessFields
            onTokenChange={(value) => updateField("repoAuthToken", value)}
            onVisibilityChange={(value) => updateField("repoVisibility", value)}
            token={draft.repoAuthToken}
            tokenFieldId={`${idPrefix}-repo-auth-token`}
            tokenRequired={draft.repoVisibility === "private"}
            visibility={draft.repoVisibility}
          />
        </>
      ) : (
        <FormField
          hint="Use a public image reference such as ghcr.io/example/api:1.2.3. Fugue mirrors it into the internal registry before rollout."
          htmlFor={`${idPrefix}-image-ref`}
          label="Image reference"
        >
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="fg-input"
            id={`${idPrefix}-image-ref`}
            name="imageRef"
            onChange={(event) => updateField("imageRef", event.target.value)}
            placeholder="ghcr.io/example/api:1.2.3"
            required
            spellCheck={false}
            value={draft.imageRef}
          />
        </FormField>
      )}

      <DeploymentTargetField
        inventoryError={inventoryError}
        name={`${idPrefix}-runtime-target`}
        onChange={(value) => updateField("runtimeId", value)}
        targets={runtimeTargets}
        value={draft.runtimeId}
      />

      <ConsoleDisclosureSection
        className="fg-console-dialog__advanced"
        description={advancedDescription}
        summary="Advanced settings"
      >
        <div className="fg-console-dialog__advanced-grid">
          {draft.sourceMode === "github" ? (
            <FormField
              hint="Leave blank to use the default branch."
              htmlFor={`${idPrefix}-repo-branch`}
              label="Branch"
              optionalLabel="Optional"
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-repo-branch`}
                name="branch"
                onChange={(event) => updateField("branch", event.target.value)}
                placeholder="main"
                spellCheck={false}
                value={draft.branch}
              />
            </FormField>
          ) : null}

          <FormField
            hint={
              draft.sourceMode === "github"
                ? "Leave blank to reuse the repository name."
                : "Leave blank to derive the app name from the image reference."
            }
            htmlFor={`${idPrefix}-app-name`}
            label="App name"
            optionalLabel="Optional"
          >
            <input
              autoComplete="off"
              className="fg-input"
              id={`${idPrefix}-app-name`}
              name="name"
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Marketing site"
              value={draft.name}
            />
          </FormField>

          {draft.sourceMode === "github" ? (
            <FormField
              hint="This build strategy is reused for later syncs."
              htmlFor={`${idPrefix}-build-strategy`}
              label="Build strategy"
            >
              <SelectField
                autoComplete="off"
                id={`${idPrefix}-build-strategy`}
                name="buildStrategy"
                onChange={(event) =>
                  updateField("buildStrategy", event.target.value as BuildStrategyValue)
                }
                value={draft.buildStrategy}
              >
                {BUILD_STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}

          {draft.sourceMode === "github" && supportsSourceDir ? (
            <FormField
              hint="Use when the app lives below the repo root."
              htmlFor={`${idPrefix}-source-dir`}
              label="Source directory"
              optionalLabel="Optional"
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-source-dir`}
                name="sourceDir"
                onChange={(event) => updateField("sourceDir", event.target.value)}
                placeholder="apps/web"
                spellCheck={false}
                value={draft.sourceDir}
              />
            </FormField>
          ) : null}

          {draft.sourceMode === "github" && supportsDockerInputs ? (
            <FormField
              hint="Required when the Dockerfile is outside the repo root."
              htmlFor={`${idPrefix}-dockerfile-path`}
              label="Dockerfile path"
              optionalLabel="Optional"
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-dockerfile-path`}
                name="dockerfilePath"
                onChange={(event) => updateField("dockerfilePath", event.target.value)}
                placeholder="docker/Dockerfile"
                spellCheck={false}
                value={draft.dockerfilePath}
              />
            </FormField>
          ) : null}

          {draft.sourceMode === "github" && supportsDockerInputs ? (
            <FormField
              hint="Defaults to the repo root when omitted."
              htmlFor={`${idPrefix}-build-context-dir`}
              label="Build context"
              optionalLabel="Optional"
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-build-context-dir`}
                name="buildContextDir"
                onChange={(event) => updateField("buildContextDir", event.target.value)}
                placeholder="."
                spellCheck={false}
                value={draft.buildContextDir}
              />
            </FormField>
          ) : null}

          <FormField
            hint={
              draft.sourceMode === "github"
                ? "Override the public HTTP port when the image does not expose it."
                : "Leave blank to use the first exposed image port. If none is exposed, Fugue falls back to port 80."
            }
            htmlFor={`${idPrefix}-service-port`}
            label="Service port"
            optionalLabel="Optional"
          >
            <input
              autoComplete="off"
              className="fg-input"
              id={`${idPrefix}-service-port`}
              inputMode="numeric"
              name="servicePort"
              onChange={(event) => updateField("servicePort", event.target.value)}
              placeholder="3333"
              value={draft.servicePort}
            />
          </FormField>
        </div>
      </ConsoleDisclosureSection>
    </>
  );

  return includeWrapper ? (
    <div className="fg-console-dialog__grid">
      {content}
    </div>
  ) : (
    content
  );
}

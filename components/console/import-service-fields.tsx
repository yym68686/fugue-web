"use client";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { LocalUploadSourceField } from "@/components/console/local-upload-source-field";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  buildImportRuntimeTargetGroups,
  readDefaultImportRuntimeId,
  readRuntimeTargetOptionLabel,
  readSelectedRuntimeTargetGroupId,
} from "@/lib/console/runtime-targets";
import {
  BUILD_STRATEGY_OPTIONS,
  localUploadPreservesDetectedTopology,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  type BuildStrategyValue,
  type ImportServiceDraft,
  type ImportSourceMode,
} from "@/lib/fugue/import-source";
import {
  inspectLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";

const SOURCE_MODE_OPTIONS: readonly SegmentedControlOption<ImportSourceMode>[] =
  [
    { label: "GitHub repository", value: "github" },
    { label: "Local upload", value: "local-upload" },
    { label: "Docker image", value: "docker-image" },
  ];

type ImportServiceFieldProps = {
  draft: ImportServiceDraft;
  idPrefix: string;
  includeWrapper?: boolean;
  inventoryError?: string | null;
  localUpload: LocalUploadState;
  onDraftChange: (next: ImportServiceDraft) => void;
  onLocalUploadChange: (next: LocalUploadState) => void;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
};

export function ImportServiceFields({
  draft,
  idPrefix,
  includeWrapper = true,
  inventoryError = null,
  localUpload,
  onDraftChange,
  onLocalUploadChange,
  runtimeTargets,
}: ImportServiceFieldProps) {
  const supportsSourceDir = supportsGitHubSourceDir(draft.buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(draft.buildStrategy);
  const localUploadInspection = inspectLocalUploadState(localUpload);
  const localUploadKeepsTopologyImport =
    localUploadPreservesDetectedTopology(draft);
  const runtimeTargetGroups = buildImportRuntimeTargetGroups(runtimeTargets);
  const selectedRuntimeTargetGroupId = readSelectedRuntimeTargetGroupId(
    runtimeTargetGroups,
    draft.runtimeId,
  );
  const selectedRuntimeTargetGroup =
    runtimeTargetGroups.find(
      (group) => group.id === selectedRuntimeTargetGroupId,
    ) ?? null;
  const selectedRuntimeTargetOption =
    selectedRuntimeTargetGroup?.options.find(
      (option) => option.id === draft.runtimeId,
    ) ??
    selectedRuntimeTargetGroup?.options.find(
      (option) =>
        option.id ===
        readDefaultImportRuntimeId(selectedRuntimeTargetGroup.options),
    ) ??
    selectedRuntimeTargetGroup?.options[0] ??
    null;
  const deploymentSummaryParts = [
    draft.sourceMode === "github"
      ? draft.repoVisibility === "private"
        ? "Private repo"
        : "Public repo"
      : draft.sourceMode === "local-upload"
        ? localUploadInspection.itemCount > 0
          ? `${localUploadInspection.itemCount} local file${localUploadInspection.itemCount === 1 ? "" : "s"}`
          : "Local folder or files"
        : "Published image",
    selectedRuntimeTargetGroup?.summaryLabel ?? "Internal cluster",
    selectedRuntimeTargetOption
      ? readRuntimeTargetOptionLabel(selectedRuntimeTargetOption)
      : null,
  ].filter(
    (part, index, parts): part is string =>
      Boolean(part) && parts.indexOf(part) === index,
  );
  const deploymentDescription = deploymentSummaryParts.join(" · ");
  const advancedSummaryParts = [
    draft.sourceMode === "github" && draft.branch.trim()
      ? `Branch ${draft.branch.trim()}`
      : null,
    draft.sourceMode === "local-upload" && localUpload.label
      ? `Upload ${localUpload.label}`
      : null,
    draft.name.trim() ? `Name ${draft.name.trim()}` : null,
    draft.sourceMode !== "docker-image" && draft.buildStrategy !== "auto"
      ? (BUILD_STRATEGY_OPTIONS.find(
          (option) => option.value === draft.buildStrategy,
        )?.label ?? "Custom build")
      : null,
    draft.sourceDir.trim() ? `Source ${draft.sourceDir.trim()}` : null,
    draft.dockerfilePath.trim()
      ? `Dockerfile ${draft.dockerfilePath.trim()}`
      : null,
    draft.buildContextDir.trim()
      ? `Context ${draft.buildContextDir.trim()}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const advancedDescription =
    advancedSummaryParts.length > 0
      ? advancedSummaryParts.slice(0, 3).join(" · ")
      : draft.sourceMode === "docker-image"
        ? "Service name."
        : draft.sourceMode === "github"
          ? "Branch, name, build strategy, and optional paths."
          : "App name, build strategy, and optional source overrides.";
  const deploymentDisclosureSummary =
    draft.sourceMode === "github" ? "Access & deployment" : "Deployment";

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
      </div>

      {draft.sourceMode === "github" ? (
        <FormField
          hint="Use https://github.com/owner/repo."
          htmlFor={`${idPrefix}-repo-url`}
          label="Repository link"
        >
          <input
            autoCapitalize="none"
            autoComplete="url"
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
      ) : draft.sourceMode === "local-upload" ? (
        <FormField
          hint="Drag a folder, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import."
          htmlFor={`${idPrefix}-upload-folder`}
          label="Local source"
        >
          <LocalUploadSourceField
            idPrefix={idPrefix}
            onChange={onLocalUploadChange}
            value={localUpload}
          />
        </FormField>
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

      {draft.sourceMode === "local-upload" &&
      localUploadInspection.hasTopologyDefinition ? (
        <InlineAlert
          variant={localUploadKeepsTopologyImport ? "info" : "warning"}
        >
          {localUploadKeepsTopologyImport
            ? "Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose."
            : "Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose."}
        </InlineAlert>
      ) : null}

      <ConsoleDisclosureSection
        className="fg-console-dialog__advanced"
        description={deploymentDescription}
        summary={deploymentDisclosureSummary}
      >
        {draft.sourceMode === "github" ? (
          <GitHubRepositoryAccessFields
            onTokenChange={(value) => updateField("repoAuthToken", value)}
            onVisibilityChange={(value) => updateField("repoVisibility", value)}
            token={draft.repoAuthToken}
            tokenFieldId={`${idPrefix}-repo-auth-token`}
            tokenRequired={draft.repoVisibility === "private"}
            visibility={draft.repoVisibility}
          />
        ) : null}

        <DeploymentTargetField
          inventoryError={inventoryError}
          name={`${idPrefix}-runtime-target`}
          onChange={(value) => updateField("runtimeId", value)}
          targets={runtimeTargets}
          value={draft.runtimeId}
        />
      </ConsoleDisclosureSection>

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
                : draft.sourceMode === "local-upload"
                  ? "Leave blank to derive the app name from the uploaded folder or file."
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

          {draft.sourceMode !== "docker-image" ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? "This build strategy is reused for later syncs."
                  : "Leave auto on unless the upload needs a specific source or Dockerfile override."
              }
              htmlFor={`${idPrefix}-build-strategy`}
              label="Build strategy"
            >
              <SelectField
                autoComplete="off"
                id={`${idPrefix}-build-strategy`}
                name="buildStrategy"
                onChange={(event) =>
                  updateField(
                    "buildStrategy",
                    event.target.value as BuildStrategyValue,
                  )
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

          {draft.sourceMode !== "docker-image" && supportsSourceDir ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? "Use when the app lives below the repo root."
                  : "Use when the uploaded app lives below the archive root."
              }
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
                onChange={(event) =>
                  updateField("sourceDir", event.target.value)
                }
                placeholder="apps/web"
                spellCheck={false}
                value={draft.sourceDir}
              />
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" && supportsDockerInputs ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? "Required when the Dockerfile is outside the repo root."
                  : "Required when the uploaded Dockerfile is outside the archive root."
              }
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
                onChange={(event) =>
                  updateField("dockerfilePath", event.target.value)
                }
                placeholder="docker/Dockerfile"
                spellCheck={false}
                value={draft.dockerfilePath}
              />
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" && supportsDockerInputs ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? "Defaults to the repo root when omitted."
                  : "Defaults to the archive root when omitted."
              }
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
                onChange={(event) =>
                  updateField("buildContextDir", event.target.value)
                }
                placeholder="."
                spellCheck={false}
                value={draft.buildContextDir}
              />
            </FormField>
          ) : null}
        </div>
      </ConsoleDisclosureSection>
    </>
  );

  return includeWrapper ? (
    <div className="fg-console-dialog__grid">{content}</div>
  ) : (
    content
  );
}

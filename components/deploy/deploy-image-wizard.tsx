"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type { FugueProject } from "@/lib/fugue/api";
import {
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";

const NEW_PROJECT_VALUE = "__new__";

type DeployImageWizardProps = {
  initialImageRef: string;
  initialName?: string;
  initialServicePort?: string;
  projectInventoryError?: string | null;
  projects: FugueProject[];
  runtimeTargetInventoryError?: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  workspaceDefaultProjectId?: string | null;
  workspaceDefaultProjectName?: string | null;
};

type SubmitResponse = {
  error?: string;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Deploy request failed.";
}

function buildProjectOptions(
  projects: FugueProject[],
  defaultProjectId?: string | null,
  defaultProjectName?: string | null,
) {
  const deduped = new Map<string, string>();

  for (const project of projects) {
    deduped.set(project.id, project.name);
  }

  return [
    ...Array.from(deduped.entries()).map(([id, name]) => ({
      id,
      label: defaultProjectId === id ? `${name} · Default project` : name,
    })),
    {
      id: NEW_PROJECT_VALUE,
      label: `Create new project${defaultProjectName ? ` · ${defaultProjectName}` : ""}`,
    },
  ];
}

function readInitialProjectSelection(
  projects: FugueProject[],
  defaultProjectId?: string | null,
) {
  if (
    defaultProjectId &&
    projects.some((project) => project.id === defaultProjectId)
  ) {
    return defaultProjectId;
  }

  if (projects.length > 0) {
    return projects[0]?.id ?? NEW_PROJECT_VALUE;
  }

  return NEW_PROJECT_VALUE;
}

export function DeployImageWizard({
  initialImageRef,
  initialName = "",
  initialServicePort = "",
  projectInventoryError = null,
  projects,
  runtimeTargetInventoryError = null,
  runtimeTargets,
  workspaceDefaultProjectId = null,
  workspaceDefaultProjectName = null,
}: DeployImageWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState(
    readInitialProjectSelection(projects, workspaceDefaultProjectId),
  );
  const [projectName, setProjectName] = useState(
    workspaceDefaultProjectName ?? "default",
  );
  const [name, setName] = useState(initialName);
  const [imageRef, setImageRef] = useState(initialImageRef);
  const [servicePort, setServicePort] = useState(initialServicePort);
  const [runtimeId, setRuntimeId] = useState<string | null>(
    readDefaultImportRuntimeId(runtimeTargets),
  );
  const projectOptions = useMemo(
    () =>
      buildProjectOptions(
        projects,
        workspaceDefaultProjectId,
        workspaceDefaultProjectName,
      ),
    [projects, workspaceDefaultProjectId, workspaceDefaultProjectName],
  );

  useEffect(() => {
    setRuntimeId((current) =>
      current && runtimeTargets.some((target) => target.id === current)
        ? current
        : readDefaultImportRuntimeId(runtimeTargets),
    );
  }, [runtimeTargets]);

  useEffect(() => {
    setImageRef(initialImageRef);
  }, [initialImageRef]);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setServicePort(initialServicePort);
  }, [initialServicePort]);

  function validate() {
    if (!imageRef.trim()) {
      return "Image reference is required.";
    }

    if (selectedProjectId === NEW_PROJECT_VALUE) {
      const normalizedProjectName = projectName.trim();

      if (!normalizedProjectName) {
        return "Project name is required when creating a new project.";
      }

      if (findProjectByName(projects, normalizedProjectName)) {
        return DUPLICATE_PROJECT_NAME_MESSAGE;
      }
    }

    const normalizedServicePort = servicePort.trim();

    if (
      normalizedServicePort &&
      (!/^\d+$/.test(normalizedServicePort) || Number(normalizedServicePort) <= 0)
    ) {
      return "Service port must be a positive integer.";
    }

    return null;
  }

  async function submit() {
    const validationError = validate();

    if (validationError) {
      throw new Error(validationError);
    }

    const normalizedName = name.trim();
    const normalizedServicePort = servicePort.trim();
    const response = await fetch("/api/fugue/projects/create-and-import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageRef: imageRef.trim(),
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(selectedProjectId !== NEW_PROJECT_VALUE
          ? { projectId: selectedProjectId }
          : {
              projectMode: "create",
              projectName: projectName.trim(),
            }),
        ...(runtimeId ? { runtimeId } : {}),
        ...(normalizedServicePort
          ? { servicePort: Number(normalizedServicePort) }
          : {}),
        sourceMode: "docker-image",
      }),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as SubmitResponse | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Deploy request failed.");
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <form
      className="fg-deploy-form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(() => {
          void submit().catch((error) => {
            showToast({
              message: readErrorMessage(error),
              variant: "error",
            });
          });
        });
      }}
    >
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Deploy</p>
        <PanelTitle>Deploy from a Docker image.</PanelTitle>
        <PanelCopy>
          Fugue mirrors the published image into the internal registry, creates
          the app, and queues the first rollout onto the selected runtime.
        </PanelCopy>

        {projectInventoryError ? (
          <InlineAlert variant="info">
            Project inventory is unavailable right now. You can still deploy
            into a new project.
          </InlineAlert>
        ) : null}

        <div className="fg-deploy-form-grid">
          <FormField
            hint="Reuse an existing project or create a new one for this deploy."
            htmlFor="deploy-image-project"
            label="Project"
          >
            <SelectField
              id="deploy-image-project"
              onChange={(event) => setSelectedProjectId(event.target.value)}
              value={selectedProjectId}
            >
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          <FormField
            hint="Leave blank to reuse the image name."
            htmlFor="deploy-image-name"
            label="App name"
            optionalLabel="Optional"
          >
            <input
              className="fg-input"
              id="deploy-image-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="chatgpt"
              value={name}
            />
          </FormField>
        </div>

        {selectedProjectId === NEW_PROJECT_VALUE ? (
          <FormField
            hint="This project will be created before the deploy is queued."
            htmlFor="deploy-image-project-name"
            label="New project name"
          >
            <input
              className="fg-input"
              id="deploy-image-project-name"
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="default"
              value={projectName}
            />
          </FormField>
        ) : null}

        <FormField
          hint="Use a pullable public image reference such as ghcr.io/example/api:1.2.3."
          htmlFor="deploy-image-ref"
          label="Image reference"
        >
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="fg-input"
            id="deploy-image-ref"
            onChange={(event) => setImageRef(event.target.value)}
            placeholder="ghcr.io/example/api:1.2.3"
            spellCheck={false}
            value={imageRef}
          />
        </FormField>

        <FormField
          hint="Set this when the container listens on a known port."
          htmlFor="deploy-image-service-port"
          label="Service port"
          optionalLabel="Optional"
        >
          <input
            className="fg-input"
            id="deploy-image-service-port"
            inputMode="numeric"
            onChange={(event) => setServicePort(event.target.value)}
            placeholder="8080"
            value={servicePort}
          />
        </FormField>

        <InlineAlert variant="info">
          Public image references work best for one-click deploy links because
          this flow does not collect registry credentials.
        </InlineAlert>
      </PanelSection>

      <PanelSection>
        <PanelTitle>Target</PanelTitle>
        <PanelCopy>
          Choose where the mirrored image should land for the first rollout.
        </PanelCopy>

        <DeploymentTargetField
          inventoryError={runtimeTargetInventoryError}
          name="deploy-image-runtime"
          onChange={setRuntimeId}
          targets={runtimeTargets}
          value={runtimeId}
        />
      </PanelSection>

      <PanelSection>
        <div className="fg-deploy-inline-actions">
          <Button disabled={isPending} type="submit" variant="route">
            {isPending ? "Queueing image deploy..." : "Queue image deploy"}
          </Button>
        </div>
        <p className="fg-deploy-inline-copy">
          After submission, Fugue creates the app and starts the import
          operation immediately.
        </p>
      </PanelSection>
    </form>
  );
}

"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@fugue/ui/components/field";
import { Form } from "@fugue/ui/components/form";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { Textarea } from "@fugue/ui/components/textarea";
import { toastManager } from "@fugue/ui/components/toast";
import { ToggleGroup, ToggleGroupItem } from "@fugue/ui/components/toggle-group";
import { Plus, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConsoleDrawer } from "@/components/console/overlays";
import { CodeBlock } from "@/components/shared/code-block";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { useConsoleRuntimeTargetInventory } from "@/lib/console/runtime-target-inventory-client";
import type { ConsoleTone } from "@/lib/console/types";
import type { Locale } from "@/lib/i18n/core";
import {
  interpolateUiMessage,
  type NewProjectFormMessages,
} from "@/lib/i18n/ui-messages";
import {
  findDuplicateEnvRowIds,
  resolveEnvRowFocusAfterDelete,
} from "@/lib/ui/env-row-focus";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function formatBytes(
  locale: Locale,
  value: number | null | undefined,
  unknown: string,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return unknown;
  }

  if (value === 0) {
    return "0 bytes";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024)),
  );
  const amount = value / 1024 ** index;

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(amount)} ${units[index]}`;
}

type NewProjectSource = "GitHub" | "Docker image" | "Upload";

type CreateAndImportResponse = {
  app?: { id?: string | null; projectId?: string | null } | null;
  project?: { id: string; name: string } | null;
  requestInProgress?: boolean;
};

function sourceModeForProjectSource(source: NewProjectSource) {
  if (source === "Docker image") return "docker-image";
  if (source === "Upload") return "local-upload";
  return "github";
}

function parseEnvRows(rows: EnvDraftRow[]) {
  return rows.reduce<Record<string, string>>((env, row) => {
    const key = row.key.trim();

    if (key) {
      env[key] = row.value;
    }

    return env;
  }, {});
}

function isArchiveUpload(file: File) {
  const name = file.name.trim().toLowerCase();
  return name.endsWith(".zip") || name.endsWith(".tgz") || name.endsWith(".tar.gz");
}

function buildImportPayload(input: {
  appName: string;
  branch: string;
  envRows: EnvDraftRow[];
  imageRef: string;
  projectName: string;
  repoUrl: string;
  runtime: string;
  servicePort: string;
  source: NewProjectSource;
}) {
  const servicePort = input.servicePort.trim()
    ? Number(input.servicePort.trim())
    : undefined;

  return {
    ...(input.appName.trim() ? { name: input.appName.trim() } : {}),
    ...(Object.keys(parseEnvRows(input.envRows)).length
      ? { env: parseEnvRows(input.envRows) }
      : {}),
    ...(input.runtime ? { runtimeId: input.runtime } : {}),
    ...(servicePort ? { servicePort } : {}),
    networkMode: "public",
    projectMode: "create",
    projectName: input.projectName.trim(),
    sourceMode: sourceModeForProjectSource(input.source),
    ...(input.source === "GitHub"
      ? {
          branch: input.branch.trim() || undefined,
          repoUrl: input.repoUrl.trim(),
        }
      : {}),
    ...(input.source === "Docker image"
      ? {
          imageRef: input.imageRef.trim(),
        }
      : {}),
  };
}

function readRuntimeTargetDescription(target: ConsoleImportRuntimeTargetView) {
  const countryLabel = target.locationCountryLabel?.trim() ?? "";
  const locationLabel = target.locationLabel?.trim() ?? "";
  const location = [
    countryLabel || null,
    locationLabel && locationLabel.toLowerCase() !== countryLabel.toLowerCase()
      ? locationLabel
      : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return [
    target.kindLabel,
    location || target.primaryLabel || target.description,
    target.statusLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function NewProjectWizard({
  locale,
  messages,
  template,
}: {
  locale: Locale;
  messages: NewProjectFormMessages;
  template?: string;
}) {
  const [source, setSource] = useState<NewProjectSource>("GitHub");
  const [projectName, setProjectName] = useState(template ?? "");
  const [appName, setAppName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [imageRef, setImageRef] = useState("");
  const [branch, setBranch] = useState("main");
  const [servicePort, setServicePort] = useState("");
  const [runtime, setRuntime] = useState("");
  const [envRows, setEnvRows] = useState<EnvDraftRow[]>([]);
  const [envFocusRowId, setEnvFocusRowId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [drawer, setDrawer] = useState<"runtime" | "env" | "summary" | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{
    field: "image" | "project" | "repository" | "servicePort" | "upload";
    message: string;
  } | null>(null);
  const imageRefRef = useRef<HTMLInputElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const repoUrlRef = useRef<HTMLInputElement>(null);
  const servicePortRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const runtimeInventory = useConsoleRuntimeTargetInventory(true);
  const runtimeTargets = runtimeInventory.runtimeTargets;
  const toast = useToast();

  useEffect(() => {
    const saved = window.sessionStorage.getItem("fugue.pendingDeployIntent");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        appName?: string;
        branch?: string;
        imageRef?: string;
        projectName?: string;
        repoUrl?: string;
        runtime?: string;
        servicePort?: string;
        source?: NewProjectSource;
      };
      if (parsed.appName) setAppName(parsed.appName);
      if (parsed.branch) setBranch(parsed.branch);
      if (parsed.imageRef) setImageRef(parsed.imageRef);
      if (parsed.projectName) setProjectName(parsed.projectName);
      if (parsed.repoUrl) setRepoUrl(parsed.repoUrl);
      if (parsed.runtime) setRuntime(parsed.runtime);
      if (parsed.servicePort) setServicePort(parsed.servicePort);
      if (parsed.source) setSource(parsed.source);
    } catch {
      window.sessionStorage.removeItem("fugue.pendingDeployIntent");
    }
  }, []);

  useEffect(() => {
    if (!runtime && runtimeTargets[0]?.id) {
      setRuntime(runtimeTargets[0].id);
    }
  }, [runtime, runtimeTargets]);

  function clearFieldError(field: NonNullable<typeof fieldError>["field"]) {
    setFieldError((current) => (current?.field === field ? null : current));
  }

  async function deployProject() {
    const trimmedProjectName = projectName.trim();
    const trimmedRepoUrl = repoUrl.trim();
    const trimmedImageRef = imageRef.trim();

    if (!trimmedProjectName) {
      setDeployError(null);
      setFieldError({ field: "project", message: messages.projectNameRequired });
      projectNameRef.current?.focus();
      return;
    }

    if (source === "GitHub" && !trimmedRepoUrl) {
      setDeployError(null);
      setFieldError({
        field: "repository",
        message: messages.repositoryLinkRequired,
      });
      repoUrlRef.current?.focus();
      return;
    }

    if (source === "Docker image" && !trimmedImageRef) {
      setDeployError(null);
      setFieldError({ field: "image", message: messages.imageReferenceRequired });
      imageRefRef.current?.focus();
      return;
    }

    if (source === "Upload" && !uploadFile) {
      setDeployError(null);
      setFieldError({ field: "upload", message: messages.chooseSourceFirst });
      uploadRef.current?.focus();
      return;
    }

    const parsedPort = servicePort.trim() ? Number(servicePort.trim()) : null;
    if (parsedPort !== null && (!Number.isInteger(parsedPort) || parsedPort <= 0)) {
      setDeployError(null);
      setFieldError({
        field: "servicePort",
        message: messages.servicePortInvalid,
      });
      servicePortRef.current?.focus();
      return;
    }

    const duplicateRowId = findDuplicateEnvRowIds(envRows).values().next().value;

    if (duplicateRowId) {
      setDeployError(null);
      setDrawer("env");
      setEnvFocusRowId(duplicateRowId);
      return;
    }

    const payload = buildImportPayload({
      appName,
      branch,
      envRows,
      imageRef,
      projectName,
      repoUrl,
      runtime,
      servicePort,
      source,
    });

    setDeploying(true);
    setDeployError(null);
    setFieldError(null);
    window.sessionStorage.setItem(
      "fugue.pendingDeployIntent",
      JSON.stringify({
        appName,
        branch,
        imageRef,
        projectName,
        repoUrl,
        runtime,
        servicePort,
        source,
      }),
    );

    try {
      const result =
        source === "Upload" && uploadFile
          ? await requestUploadImport(payload, uploadFile)
          : await requestJson<CreateAndImportResponse>(
              "/api/fugue/projects/create-and-import",
              {
                body: JSON.stringify(payload),
                cache: "no-store",
                headers: {
                  "Content-Type": "application/json",
                },
                method: "POST",
              },
            );

      window.sessionStorage.removeItem("fugue.pendingDeployIntent");
      toast.notify(
        result.requestInProgress
          ? "Import request is already running."
          : "Project import started.",
      );

      if (result.project?.id) {
        window.location.assign(
          `/app/projects/${encodeURIComponent(result.project.id)}`,
        );
      } else {
        window.location.assign("/app");
      }
    } catch (error) {
      setDeployError(readRequestError(error));
    } finally {
      setDeploying(false);
    }
  }

  async function requestUploadImport(
    payload: ReturnType<typeof buildImportPayload>,
    file: File,
  ) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    formData.append("label", appName.trim() || projectName.trim() || file.name);

    if (isArchiveUpload(file)) {
      formData.append("archive", file, file.name);
    } else {
      formData.append("files", file, file.name);
      formData.append("paths", file.name);
    }

    return requestJson<CreateAndImportResponse>(
      "/api/fugue/projects/create-and-import-upload",
      {
        body: formData,
        cache: "no-store",
        method: "POST",
      },
    );
  }

  const selectedRuntime =
    runtimeTargets.find((target) => target.id === runtime) ?? null;

  return (
    <>
      <div className="coss-split">
        <CardFrame>
          <CardContent className="coss-stack">
            {template ? (
              <Alert variant="info" role="status">
                <AlertTitle>
                  {interpolateUiMessage(messages.templateLabel, { template })}
                </AlertTitle>
                <AlertDescription>{messages.templateDescription}</AlertDescription>
              </Alert>
            ) : null}
            <ToggleGroup
              aria-label="Source mode"
              onValueChange={(values) => {
                const nextSource = values[0];
                if (
                  nextSource === "GitHub" ||
                  nextSource === "Docker image" ||
                  nextSource === "Upload"
                ) {
                  setSource(nextSource);
                  setFieldError(null);
                }
              }}
              value={[source]}
              variant="outline"
            >
              {(["GitHub", "Docker image", "Upload"] as const).map((item) => (
                <ToggleGroupItem key={item} value={item}>
                  {item}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Form
              className="coss-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void deployProject();
              }}
            >
              <Field data-invalid={fieldError?.field === "project" || undefined}>
                <FieldLabel htmlFor="new-project-name">Project name</FieldLabel>
                <Input
                  aria-describedby={
                    fieldError?.field === "project"
                      ? "new-project-name-error"
                      : undefined
                  }
                  aria-invalid={fieldError?.field === "project" || undefined}
                  autoComplete="off"
                  id="new-project-name"
                  name="projectName"
                  placeholder="my-project…"
                  ref={projectNameRef}
                  required
                  value={projectName}
                  onChange={(event) => {
                    setProjectName(event.target.value);
                    clearFieldError("project");
                  }}
                />
                {fieldError?.field === "project" ? (
                  <FieldError id="new-project-name-error" role="alert">
                    {fieldError.message}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="new-project-app-name">App name</FieldLabel>
                <Input
                  autoComplete="off"
                  id="new-project-app-name"
                  name="appName"
                  placeholder="web…"
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
                />
              </Field>
              {source === "GitHub" ? (
                <Field data-invalid={fieldError?.field === "repository" || undefined}>
                  <FieldLabel htmlFor="new-project-repository">Repository</FieldLabel>
                  <Input
                    aria-describedby={
                      fieldError?.field === "repository"
                        ? "new-project-repository-error"
                        : undefined
                    }
                    aria-invalid={fieldError?.field === "repository" || undefined}
                    autoCapitalize="none"
                    autoComplete="off"
                    id="new-project-repository"
                    name="repository"
                    placeholder="https://github.com/owner/repo…"
                    ref={repoUrlRef}
                    required
                    spellCheck={false}
                    type="url"
                    value={repoUrl}
                    onChange={(event) => {
                      setRepoUrl(event.target.value);
                      clearFieldError("repository");
                    }}
                  />
                  {fieldError?.field === "repository" ? (
                    <FieldError id="new-project-repository-error" role="alert">
                      {fieldError.message}
                    </FieldError>
                  ) : null}
                </Field>
              ) : null}
              {source === "Docker image" ? (
                <Field data-invalid={fieldError?.field === "image" || undefined}>
                  <FieldLabel htmlFor="new-project-image">Image</FieldLabel>
                  <Input
                    aria-describedby={
                      fieldError?.field === "image"
                        ? "new-project-image-error"
                        : undefined
                    }
                    aria-invalid={fieldError?.field === "image" || undefined}
                    autoCapitalize="none"
                    autoComplete="off"
                    id="new-project-image"
                    name="imageReference"
                    placeholder="ghcr.io/org/image:tag…"
                    ref={imageRefRef}
                    required
                    spellCheck={false}
                    value={imageRef}
                    onChange={(event) => {
                      setImageRef(event.target.value);
                      clearFieldError("image");
                    }}
                  />
                  {fieldError?.field === "image" ? (
                    <FieldError id="new-project-image-error" role="alert">
                      {fieldError.message}
                    </FieldError>
                  ) : null}
                </Field>
              ) : null}
              {source === "Upload" ? (
                <Field data-invalid={fieldError?.field === "upload" || undefined}>
                  <Card className="coss-card--muted">
                    <CardContent className="coss-row">
                      <Upload aria-hidden="true" />
                      <div>
                        <strong>Source upload</strong>
                        <p className="coss-card-description">
                          {uploadFile
                            ? `${uploadFile.name} · ${formatBytes(locale, uploadFile.size, messages.unknown)}`
                            : "Choose a .zip, .tgz, Dockerfile, compose file, or source file."}
                        </p>
                      </div>
                      <Input
                        aria-describedby={
                          fieldError?.field === "upload"
                            ? "new-project-upload-error"
                            : undefined
                        }
                        aria-invalid={fieldError?.field === "upload" || undefined}
                        aria-label="Choose source upload"
                        name="sourceUpload"
                        ref={uploadRef}
                        required
                        type="file"
                        onChange={(event) => {
                          setUploadFile(event.target.files?.[0] ?? null);
                          clearFieldError("upload");
                        }}
                      />
                    </CardContent>
                  </Card>
                  {fieldError?.field === "upload" ? (
                    <FieldError id="new-project-upload-error" role="alert">
                      {fieldError.message}
                    </FieldError>
                  ) : null}
                </Field>
              ) : null}
              {template ? (
                <div className="coss-grid-2">
                  <Field>
                    <FieldLabel htmlFor="new-project-database-url">
                      DATABASE_URL
                    </FieldLabel>
                    <Input
                      autoComplete="off"
                      id="new-project-database-url"
                      name="databaseUrl"
                      placeholder="postgres://…"
                      spellCheck={false}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-project-app-secret">APP_SECRET</FieldLabel>
                    <Input
                      autoComplete="off"
                      id="new-project-app-secret"
                      name="appSecret"
                      placeholder="generated on deploy…"
                      spellCheck={false}
                    />
                  </Field>
                </div>
              ) : null}
              <div className="coss-grid-2">
                <Field>
                  <FieldLabel htmlFor="new-project-branch">Branch</FieldLabel>
                  <Input
                    autoComplete="off"
                    id="new-project-branch"
                    name="branch"
                    spellCheck={false}
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                  />
                </Field>
                <Field data-invalid={fieldError?.field === "servicePort" || undefined}>
                  <FieldLabel htmlFor="new-project-service-port">
                    Service port
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      fieldError?.field === "servicePort"
                        ? "new-project-service-port-error"
                        : undefined
                    }
                    aria-invalid={fieldError?.field === "servicePort" || undefined}
                    autoComplete="off"
                    id="new-project-service-port"
                    inputMode="numeric"
                    min={1}
                    name="servicePort"
                    pattern="[0-9]+"
                    placeholder="3000…"
                    ref={servicePortRef}
                    type="number"
                    value={servicePort}
                    onChange={(event) => {
                      setServicePort(event.target.value);
                      clearFieldError("servicePort");
                    }}
                  />
                  {fieldError?.field === "servicePort" ? (
                    <FieldError id="new-project-service-port-error" role="alert">
                      {fieldError.message}
                    </FieldError>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="new-project-runtime-trigger">
                  Runtime target
                </FieldLabel>
                <Button
                  className="coss-input-button coss-input-button--left"
                  aria-label="Open runtime target picker"
                  id="new-project-runtime-trigger"
                  onClick={() => setDrawer("runtime")}
                  variant="outline"
                >
                  {selectedRuntime?.summaryLabel ??
                    (runtime ||
                      (runtimeInventory.loading
                        ? "Loading runtime targets"
                        : "Default placement"))}
                </Button>
              </Field>
              <div className="coss-row">
                <Button
                  id="new-project-env-trigger"
                  variant="outline"
                  onClick={() => setDrawer("env")}
                >
                  Environment variables
                </Button>
                <Button
                  id="new-project-summary-trigger"
                  variant="outline"
                  onClick={() => setDrawer("summary")}
                >
                  Deploy preview
                </Button>
              </div>
              {runtimeInventory.runtimeTargetInventoryError ? (
                <Alert variant="warning" role="status">
                  <AlertTitle>{messages.runtimeTargetsUnavailable}</AlertTitle>
                  <AlertDescription>
                    {runtimeInventory.runtimeTargetInventoryError}
                  </AlertDescription>
                </Alert>
              ) : null}
              {deployError ? (
                <Alert variant="error" role="alert">
                  <AlertTitle>{messages.deployFailed}</AlertTitle>
                  <AlertDescription>{deployError}</AlertDescription>
                </Alert>
              ) : null}
              <Alert variant="warning" role="status">
                <AlertTitle>{messages.advancedSettings}</AlertTitle>
                <AlertDescription>
                  {messages.advancedSettingsDescription}
                </AlertDescription>
              </Alert>
              <Button loading={deploying} type="submit">
                Deploy project
              </Button>
            </Form>
          </CardContent>
        </CardFrame>
        <CardFrame>
          <ConsoleCardHeader
            title="Deploy preview"
            description="Source, runtime, route, and storage intent."
          />
          <CardContent className="coss-stack">
            <MetricStrip
              items={[
                { label: "Source", value: source },
                {
                  label: "Runtime",
                  value:
                    selectedRuntime?.summaryLabel ?? (runtime || "Default placement"),
                },
                { label: "Route", value: "public" },
                { label: "Env", value: `${envRows.length} variables` },
              ]}
            />
            <CodeBlock>
              {JSON.stringify(
                buildImportPayload({
                  appName,
                  branch,
                  envRows,
                  imageRef,
                  projectName,
                  repoUrl,
                  runtime,
                  servicePort,
                  source,
                }),
                null,
                2,
              )}
            </CodeBlock>
          </CardContent>
        </CardFrame>
      </div>
      <ConsoleDrawer
        title="Runtime target"
        description="Choose shared hosting first, or route directly to a registered server."
        open={drawer === "runtime"}
        returnFocusId="new-project-runtime-trigger"
        onClose={() => setDrawer(null)}
        footer={<Button onClick={() => setDrawer(null)}>Use {runtime}</Button>}
      >
        <div className="coss-stack">
          {runtimeInventory.loading && runtimeTargets.length === 0 ? (
            <ConsoleLoadingState label="Loading runtime targets">
              <Skeleton
                style={{
                  height: 64,
                }}
              />
            </ConsoleLoadingState>
          ) : null}
          {runtimeTargets.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              className="coss-service-button"
              aria-label={`Select runtime ${item.summaryLabel}`}
              aria-pressed={runtime === item.id}
              onClick={() => setRuntime(item.id)}
            >
              <span className="coss-row">
                <strong>{item.summaryLabel}</strong>
                {item.statusTone ? (
                  <Badge variant={badgeToneFromConsoleTone(item.statusTone)}>
                    {item.statusLabel ?? item.statusTone}
                  </Badge>
                ) : null}
              </span>
              <p className="coss-card-description">
                {readRuntimeTargetDescription(item) || item.description}
              </p>
            </Button>
          ))}
          {!runtimeInventory.loading && runtimeTargets.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{messages.noRuntimeTargets}</EmptyTitle>
                <EmptyDescription>
                  {messages.noRuntimeTargetsDescription}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      </ConsoleDrawer>
      <ConsoleDrawer
        title="Environment variables"
        open={drawer === "env"}
        returnFocusId="new-project-env-trigger"
        onClose={() => setDrawer(null)}
      >
        <EnvironmentEditor
          focusRowId={envFocusRowId}
          messages={messages}
          rows={envRows}
          onFocusRowHandled={() => setEnvFocusRowId(null)}
          onRowsChange={setEnvRows}
        />
      </ConsoleDrawer>
      <ConsoleDrawer
        title="Deploy preview"
        open={drawer === "summary"}
        returnFocusId="new-project-summary-trigger"
        onClose={() => setDrawer(null)}
      >
        <CodeBlock>
          {JSON.stringify(
            buildImportPayload({
              appName,
              branch,
              envRows,
              imageRef,
              projectName,
              repoUrl,
              runtime,
              servicePort,
              source,
            }),
            null,
            2,
          )}
        </CodeBlock>
      </ConsoleDrawer>
    </>
  );
}

type EnvDraftRow = {
  id: string;
  key: string;
  value: string;
};

function createEnvDraftRow(
  values?: Partial<Pick<EnvDraftRow, "key" | "value">>,
): EnvDraftRow {
  return {
    id: crypto.randomUUID(),
    key: values?.key ?? "",
    value: values?.value ?? "",
  };
}

function EnvironmentEditor({
  focusRowId,
  messages,
  rows,
  onFocusRowHandled,
  onRowsChange,
}: {
  focusRowId: string | null;
  messages: NewProjectFormMessages;
  rows: EnvDraftRow[];
  onFocusRowHandled: () => void;
  onRowsChange: (rows: EnvDraftRow[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [revealed, setRevealed] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const keyInputRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocusRef = useRef<
    { kind: "row"; rowId: string } | { kind: "add" } | null
  >(null);
  const duplicateRowIds = findDuplicateEnvRowIds(rows);
  const duplicate = duplicateRowIds.size > 0;

  useLayoutEffect(() => {
    if (focusRowId) {
      keyInputRefs.current.get(focusRowId)?.focus();
      onFocusRowHandled();
      return;
    }

    const pendingFocus = pendingFocusRef.current;

    if (!pendingFocus) {
      return;
    }

    pendingFocusRef.current = null;

    if (pendingFocus.kind === "add") {
      addButtonRef.current?.focus();
      return;
    }

    keyInputRefs.current.get(pendingFocus.rowId)?.focus();
  }, [focusRowId, onFocusRowHandled]);

  function addRow() {
    const row = createEnvDraftRow();
    pendingFocusRef.current = { kind: "row", rowId: row.id };
    onRowsChange([...rows, row]);
  }

  function deleteRow(index: number) {
    const rowId = resolveEnvRowFocusAfterDelete(rows, index);
    pendingFocusRef.current = rowId ? { kind: "row", rowId } : { kind: "add" };
    onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="coss-stack">
      {duplicate ? (
        <Alert variant="error" role="alert">
          <AlertTitle>{messages.duplicateKey}</AlertTitle>
          <AlertDescription>{messages.duplicateKeyDescription}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={["Key", "Value", "Actions"]}
        rows={rows.map((row, index) => ({ ...row, index }))}
        renderRow={(row) => {
          const duplicateKey = duplicateRowIds.has(row.id);
          const duplicateErrorId = `environmentKey-${row.id}-error`;

          return (
            <tr key={row.id}>
              <td>
                <Field data-invalid={duplicateKey || undefined} invalid={duplicateKey}>
                  <Input
                    aria-describedby={duplicateKey ? duplicateErrorId : undefined}
                    aria-invalid={duplicateKey || undefined}
                    aria-label={interpolateUiMessage(messages.variableKey, {
                      index: row.index + 1,
                    })}
                    autoCapitalize="none"
                    autoComplete="off"
                    className="coss-mono"
                    name={`environmentKey-${row.id}`}
                    ref={(input) => {
                      if (input) {
                        keyInputRefs.current.set(row.id, input);
                      } else {
                        keyInputRefs.current.delete(row.id);
                      }
                    }}
                    spellCheck={false}
                    value={row.key}
                    onChange={(event) =>
                      onRowsChange(
                        rows.map((item, index) =>
                          index === row.index
                            ? { ...item, key: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  {duplicateKey ? (
                    <FieldError id={duplicateErrorId} match role="alert">
                      {messages.duplicateKeyDescription}
                    </FieldError>
                  ) : null}
                </Field>
              </td>
              <td>
                <Input
                  aria-label={interpolateUiMessage(messages.variableValue, {
                    index: row.index + 1,
                  })}
                  autoComplete="off"
                  className="coss-mono"
                  name={`environmentValue-${row.id}`}
                  spellCheck={false}
                  value={
                    row.value.includes("•") && !revealed ? "••••••••••" : row.value
                  }
                  onChange={(event) =>
                    onRowsChange(
                      rows.map((item, index) =>
                        index === row.index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </td>
              <td className="coss-table__actions">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Reveal ${row.key || row.id}`}
                  onClick={() => setRevealed((value) => !value)}
                >
                  Reveal
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${row.key || row.id}`}
                  onClick={() => deleteRow(row.index)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          );
        }}
      />
      <Button ref={addButtonRef} variant="outline" onClick={addRow}>
        <Plus aria-hidden="true" />
        Add variable
      </Button>
      <Field>
        <FieldLabel htmlFor="new-project-env-paste">Paste .env</FieldLabel>
        <Textarea
          autoCapitalize="none"
          autoComplete="off"
          id="new-project-env-paste"
          className="coss-mono"
          name="environmentText"
          spellCheck={false}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
        />
      </Field>
      <Button
        variant="outline"
        onClick={() =>
          onRowsChange(
            raw
              .split("\n")
              .filter(Boolean)
              .map((line, index) => {
                const [key, ...value] = line.split("=");
                return createEnvDraftRow({
                  key: key || `KEY_${index + 1}`,
                  value: value.join("=") || "",
                });
              }),
          )
        }
      >
        Import pasted env
      </Button>
    </div>
  );
}

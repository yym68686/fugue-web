"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Copy,
  Database,
  FilePlus2,
  GitBranch,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Server,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardFrame,
  CardHeader,
  CodeBlock,
  DataTable,
  Empty,
  Field,
  Meter,
  MetricStrip,
  SkeletonBlock,
} from "@/components/coss/ui";
import type {
  ConsoleImportRuntimeTargetView,
  ConsoleCompactResourceItemView,
  ConsoleGalleryProjectView,
} from "@/lib/console/gallery-types";
import { useConsoleRuntimeTargetInventory } from "@/lib/console/runtime-target-inventory-client";
import { readRuntimeTargetOptionLabel } from "@/lib/console/runtime-targets";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
  CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
  CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
  CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
  invalidateConsolePageSnapshot,
  type ConsoleAdminAppsPageSnapshot,
  type ConsoleAdminClusterPageSnapshot,
  type ConsoleAdminUsersPageSnapshot,
  type ConsoleApiKeysPageSnapshot,
  type ConsoleClusterNodesPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type {
  ConsoleBillingPageSnapshot,
  ConsoleProfileSettingsPageSnapshot,
} from "@/lib/console/page-snapshot-types";
import type { ConsoleTone } from "@/lib/console/types";
import { fetchConsoleProjectDetail } from "@/lib/console/project-detail-client";
import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import type {
  FugueAppEnvResult,
  FugueAppFilesystemTreeResult,
  FugueAppImageInventoryResult,
  FugueAppObservabilityMetricsSummary,
  FugueAppObservabilityRequests,
  FugueBuildLogsResult,
  FugueRuntimeLogsResult,
} from "@/lib/fugue/api";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

function Drawer({
  title,
  description,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div className="coss-drawer-backdrop" onClick={onClose} />
      <aside className="coss-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="coss-overlay-header">
          <div>
            <h2 id="drawer-title" className="coss-card-title">
              {title}
            </h2>
            {description ? <p className="coss-card-description">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="coss-overlay-body">{children}</div>
        {footer ? <footer className="coss-overlay-footer">{footer}</footer> : null}
      </aside>
    </>
  );
}

function Dialog({
  title,
  description,
  open,
  confirmDisabled = false,
  confirmLabel = "Confirm",
  confirmLoading = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  open: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="coss-dialog-backdrop" onClick={onClose} />
      <section className="coss-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="coss-overlay-header">
          <div>
            <h2 id="dialog-title" className="coss-card-title">
              {title}
            </h2>
            <p className="coss-card-description">{description}</p>
          </div>
        </header>
        <footer className="coss-overlay-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmDisabled || confirmLoading}
            loading={confirmLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </>
  );
}

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  return {
    message,
    notify(value: string) {
      setMessage(value);
      window.setTimeout(() => setMessage(null), 1800);
    },
  };
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 80,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--popover)",
        boxShadow: "var(--shadow-sm)",
        padding: "10px 12px",
      }}
    >
      {message}
    </div>
  );
}

function copyText(value: string, notify: (message: string) => void) {
  void navigator.clipboard?.writeText(value).catch(() => undefined);
  notify("Copied to clipboard");
}

export function AuthPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [method, setMethod] = useState<"password" | "email">(
    mode === "sign-up" ? "email" : "password",
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const returnTo = typeof window === "undefined" ? "/app" : new URLSearchParams(window.location.search).get("returnTo") ?? "/app";
  const emailInvalid = Boolean(email) && !email.includes("@");

  function startOAuth(provider: "google" | "github") {
    setError(null);
    setNotice(null);
    setLoading(provider);
    window.location.href = `/api/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function submitAuth() {
    setError(null);
    setNotice(null);

    if (!email || emailInvalid) {
      setError("Enter a valid email address.");
      return;
    }

    if (method === "password" && mode === "sign-in") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      setLoading("password");

      try {
        const result = await requestJson<{ ok: boolean; redirectTo?: string }>(
          "/api/auth/password/sign-in",
          {
            body: JSON.stringify({ email, password, returnTo }),
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        window.location.href = result.redirectTo ?? returnTo;
      } catch (nextError) {
        setError(readRequestError(nextError));
        setLoading(null);
      }

      return;
    }

    setLoading("email");

    try {
      const result = await requestJson<{
        message?: string;
        ok: boolean;
        redirectTo?: string;
      }>("/api/auth/email/start", {
        body: JSON.stringify({
          email,
          mode,
          name,
          returnTo,
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (result.redirectTo) {
        window.location.href = result.redirectTo;
        return;
      }

      setNotice(result.message ?? `Verification link sent to ${email}.`);
    } catch (nextError) {
      setError(readRequestError(nextError));
    } finally {
      setLoading(null);
    }
  }

  return (
    <CardFrame>
      <CardContent className="coss-stack">
        {error ? <Alert tone="destructive" title={error} /> : null}
        {notice ? <Alert tone="success" title={notice}>Return target is preserved for the next step.</Alert> : null}
        <Alert tone="info" title="Return target preserved">
          After authentication, Fugue continues to <span className="coss-mono">{returnTo}</span>.
        </Alert>
        <div className="coss-grid-2">
          <Button
            variant="outline"
            loading={loading === "google"}
            onClick={() => startOAuth("google")}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            loading={loading === "github"}
            onClick={() => startOAuth("github")}
          >
            Continue with GitHub
          </Button>
        </div>
        <div className="coss-tabs" role="tablist" aria-label="Authentication method">
          <button className="coss-tab" aria-selected={method === "password"} onClick={() => setMethod("password")}>
            Password
          </button>
          <button className="coss-tab" aria-selected={method === "email"} onClick={() => setMethod("email")}>
            Email link
          </button>
        </div>
        <div className="coss-form">
          {mode === "sign-up" ? (
            <Field label="Display name">
              <input className="coss-input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          ) : null}
          <Field label="Email">
            <input className="coss-input" aria-invalid={emailInvalid} value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {emailInvalid ? <span className="coss-help" role="alert">Enter a valid email address.</span> : null}
          {method === "password" && mode === "sign-in" ? (
            <Field label="Password" help="Use an existing password for this account.">
              <input
                className="coss-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          ) : (
            <Alert tone="info" title="Email link mode">
              A verification link creates or resumes the session without exposing credentials.
            </Alert>
          )}
          <Button
            loading={loading === "email" || loading === "password"}
            onClick={submitAuth}
          >
            {method === "password" && mode === "sign-in" ? "Sign in" : "Send link"}
          </Button>
        </div>
      </CardContent>
    </CardFrame>
  );
}

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const toast = useToast();

  return (
    <>
      <Toast message={toast.message} />
      <Button variant="outline" size="sm" onClick={() => copyText(value, toast.notify)}>
        <Copy aria-hidden="true" />
        {label}
      </Button>
    </>
  );
}

export function FinalizePanel() {
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, "").trim());
  }, []);

  return (
    <CardFrame>
      <CardContent className="coss-stack">
        {!token ? (
          <Alert tone="warning" title="Handoff token missing">
            Start a fresh sign-in flow to receive a new browser session token.
          </Alert>
        ) : null}
        <div className="coss-stack-sm">
          <Badge tone={token ? "info" : "warning"}>{validating ? "validating" : token ? "ready" : "missing token"}</Badge>
          <p className="coss-card-description">
            Fugue validates the provider handoff token, creates a first-party session, and redirects to returnTo.
          </p>
        </div>
        <form
          action="/auth/finalize/complete"
          className="coss-row"
          method="post"
          onSubmit={() => setValidating(true)}
        >
          <input type="hidden" name="token" value={token} />
          <Button
            disabled={!token}
            loading={validating}
            type="submit"
          >
            Complete session
          </Button>
          <ButtonLink href="/auth/sign-in" variant="ghost">
            Restart sign in
          </ButtonLink>
        </form>
      </CardContent>
    </CardFrame>
  );
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
  const servicePort = input.servicePort.trim() ? Number(input.servicePort.trim()) : undefined;

  return {
    ...(input.appName.trim() ? { name: input.appName.trim() } : {}),
    ...(Object.keys(parseEnvRows(input.envRows)).length ? { env: parseEnvRows(input.envRows) } : {}),
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
  return [
    target.kindLabel,
    readRuntimeTargetOptionLabel(target),
    target.statusLabel,
  ].filter(Boolean).join(" · ");
}

export function NewProjectWizard({ template }: { template?: string }) {
  const [source, setSource] = useState<NewProjectSource>("GitHub");
  const [projectName, setProjectName] = useState(template ?? "");
  const [appName, setAppName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [imageRef, setImageRef] = useState("");
  const [branch, setBranch] = useState("main");
  const [servicePort, setServicePort] = useState("");
  const [runtime, setRuntime] = useState("");
  const [envRows, setEnvRows] = useState<EnvDraftRow[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [drawer, setDrawer] = useState<"runtime" | "env" | "summary" | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
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

  async function deployProject() {
    const trimmedProjectName = projectName.trim();
    const trimmedRepoUrl = repoUrl.trim();
    const trimmedImageRef = imageRef.trim();

    if (!trimmedProjectName) {
      setDeployError("Project name is required.");
      return;
    }

    if (source === "GitHub" && !trimmedRepoUrl) {
      setDeployError("Repository link is required.");
      return;
    }

    if (source === "Docker image" && !trimmedImageRef) {
      setDeployError("Image reference is required.");
      return;
    }

    if (source === "Upload" && !uploadFile) {
      setDeployError("Choose a source archive or source file first.");
      return;
    }

    const parsedPort = servicePort.trim() ? Number(servicePort.trim()) : null;
    if (parsedPort !== null && (!Number.isInteger(parsedPort) || parsedPort <= 0)) {
      setDeployError("Service port must be a positive integer.");
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
      toast.notify(result.requestInProgress ? "Import request is already running." : "Project import started.");

      if (result.project?.id) {
        window.location.assign(`/app/projects/${encodeURIComponent(result.project.id)}`);
      } else {
        window.location.assign("/app");
      }
    } catch (error) {
      setDeployError(readRequestError(error));
    } finally {
      setDeploying(false);
    }
  }

  async function requestUploadImport(payload: ReturnType<typeof buildImportPayload>, file: File) {
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

  const selectedRuntime = runtimeTargets.find((target) => target.id === runtime) ?? null;

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-split">
        <CardFrame>
          <CardContent className="coss-stack">
            {template ? (
              <Alert tone="info" title={`Template: ${template}`}>
                Template variables and topology preview are included in the deploy payload.
              </Alert>
            ) : null}
            <div className="coss-tabs" role="tablist" aria-label="Source mode">
              {(["GitHub", "Docker image", "Upload"] as const).map((item) => (
                <button key={item} className="coss-tab" aria-selected={source === item} onClick={() => setSource(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="coss-form">
              <Field label="Project name">
                <input className="coss-input" placeholder="my-project" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
              </Field>
              <Field label="App name">
                <input className="coss-input" placeholder="web" value={appName} onChange={(event) => setAppName(event.target.value)} />
              </Field>
              {source === "GitHub" ? (
                <Field label="Repository">
                  <input className="coss-input" placeholder="https://github.com/owner/repo" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
                </Field>
              ) : null}
              {source === "Docker image" ? (
                <Field label="Image">
                  <input className="coss-input" placeholder="ghcr.io/org/image:tag" value={imageRef} onChange={(event) => setImageRef(event.target.value)} />
                </Field>
              ) : null}
              {source === "Upload" ? (
                <Card muted>
                  <CardContent className="coss-row">
                    <Upload aria-hidden="true" />
                    <div>
                      <strong>Source upload</strong>
                      <p className="coss-card-description">{uploadFile ? `${uploadFile.name} · ${formatBytes(uploadFile.size)}` : "Choose a .zip, .tgz, Dockerfile, compose file, or source file."}</p>
                    </div>
                    <input
                      aria-label="Choose source upload"
                      className="coss-input"
                      type="file"
                      onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    />
                  </CardContent>
                </Card>
              ) : null}
              {template ? (
                <div className="coss-grid-2">
                  <Field label="DATABASE_URL">
                    <input className="coss-input" placeholder="postgres://..." />
                  </Field>
                  <Field label="APP_SECRET">
                    <input className="coss-input" placeholder="generated on deploy" />
                  </Field>
                </div>
              ) : null}
              <div className="coss-grid-2">
                <Field label="Branch">
                  <input className="coss-input" value={branch} onChange={(event) => setBranch(event.target.value)} />
                </Field>
                <Field label="Service port">
                  <input className="coss-input" inputMode="numeric" placeholder="3000" value={servicePort} onChange={(event) => setServicePort(event.target.value)} />
                </Field>
              </div>
              <Field label="Runtime target">
                <button
                  type="button"
                  className="coss-input"
                  style={{ textAlign: "left" }}
                  aria-label="Open runtime target picker"
                  onClick={() => setDrawer("runtime")}
                >
                  {selectedRuntime?.summaryLabel ?? (runtime || (runtimeInventory.loading ? "Loading runtime targets" : "Default placement"))}
                </button>
              </Field>
              <div className="coss-row">
                <Button variant="outline" onClick={() => setDrawer("env")}>
                  Environment variables
                </Button>
                <Button variant="outline" onClick={() => setDrawer("summary")}>
                  Deploy preview
                </Button>
              </div>
              {runtimeInventory.runtimeTargetInventoryError ? (
                <Alert tone="warning" title="Runtime targets unavailable">
                  {runtimeInventory.runtimeTargetInventoryError}
                </Alert>
              ) : null}
              {deployError ? (
                <Alert tone="destructive" title="Deploy failed">
                  {deployError}
                </Alert>
              ) : null}
              <Alert tone="warning" title="Advanced settings">
                Network mode and persistent storage are available after source validation.
              </Alert>
              <Button
                loading={deploying}
                onClick={() => void deployProject()}
              >
                Deploy project
              </Button>
            </div>
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Deploy preview" description="Source, runtime, route, and storage intent." />
          <CardContent className="coss-stack">
            <MetricStrip
              items={[
                { label: "Source", value: source },
                { label: "Runtime", value: selectedRuntime?.summaryLabel ?? (runtime || "Default placement") },
                { label: "Route", value: "public" },
                { label: "Env", value: `${envRows.length} variables` },
              ]}
            />
            <CodeBlock>{JSON.stringify(buildImportPayload({
              appName,
              branch,
              envRows,
              imageRef,
              projectName,
              repoUrl,
              runtime,
              servicePort,
              source,
            }), null, 2)}</CodeBlock>
          </CardContent>
        </CardFrame>
      </div>
      <Drawer
        title="Runtime target"
        description="Choose shared hosting first, or route directly to a registered server."
        open={drawer === "runtime"}
        onClose={() => setDrawer(null)}
        footer={<Button onClick={() => setDrawer(null)}>Use {runtime}</Button>}
      >
        <div className="coss-stack">
          {runtimeInventory.loading && runtimeTargets.length === 0 ? (
            <SkeletonBlock height={64} />
          ) : null}
          {runtimeTargets.map((item) => (
            <button
              key={item.id}
              className="coss-service-button"
              aria-label={`Select runtime ${item.summaryLabel}`}
              aria-selected={runtime === item.id}
              onClick={() => setRuntime(item.id)}
            >
              <span className="coss-row">
                <strong>{item.summaryLabel}</strong>
                {item.statusTone ? <Badge tone={badgeToneFromConsoleTone(item.statusTone)}>{item.statusLabel ?? item.statusTone}</Badge> : null}
              </span>
              <p className="coss-card-description">{readRuntimeTargetDescription(item) || item.description}</p>
            </button>
          ))}
          {!runtimeInventory.loading && runtimeTargets.length === 0 ? (
            <Empty title="No runtime targets" description="Fugue did not return a selectable runtime target. Leaving this blank lets the control plane choose the default placement." />
          ) : null}
        </div>
      </Drawer>
      <Drawer title="Environment variables" open={drawer === "env"} onClose={() => setDrawer(null)}>
        <EnvironmentEditor rows={envRows} onRowsChange={setEnvRows} />
      </Drawer>
      <Drawer title="Deploy preview" open={drawer === "summary"} onClose={() => setDrawer(null)}>
        <CodeBlock>{JSON.stringify(buildImportPayload({
          appName,
          branch,
          envRows,
          imageRef,
          projectName,
          repoUrl,
          runtime,
          servicePort,
          source,
        }), null, 2)}</CodeBlock>
      </Drawer>
    </>
  );
}

type EnvDraftRow = {
  key: string;
  value: string;
};

function EnvironmentEditor({
  rows,
  onRowsChange,
}: {
  rows: EnvDraftRow[];
  onRowsChange: (rows: EnvDraftRow[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [revealed, setRevealed] = useState(false);
  const nonEmptyKeys = rows.map((row) => row.key.trim()).filter(Boolean);
  const duplicate = nonEmptyKeys.length > 0 && new Set(nonEmptyKeys).size !== nonEmptyKeys.length;

  return (
    <div className="coss-stack">
      {duplicate ? <Alert tone="destructive" title="Duplicate key">Environment keys must be unique before save.</Alert> : null}
      <DataTable
        columns={["Key", "Value", "Actions"]}
        rows={rows.map((row, index) => ({ ...row, id: `${row.key}-${index}`, index }))}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>
              <input
                className="coss-input coss-mono"
                value={row.key}
                onChange={(event) => onRowsChange(rows.map((item, index) => index === row.index ? { ...item, key: event.target.value } : item))}
              />
            </td>
            <td>
              <input
                className="coss-input coss-mono"
                value={row.value.includes("•") && !revealed ? "••••••••••" : row.value}
                onChange={(event) => onRowsChange(rows.map((item, index) => index === row.index ? { ...item, value: event.target.value } : item))}
              />
            </td>
            <td className="coss-table__actions">
              <Button variant="outline" size="sm" aria-label={`Reveal ${row.key || row.id}`} onClick={() => setRevealed((value) => !value)}>
                Reveal
              </Button>
              <Button variant="ghost" size="sm" aria-label={`Delete ${row.key || row.id}`} onClick={() => onRowsChange(rows.filter((_, index) => index !== row.index))}>
                Delete
              </Button>
            </td>
          </tr>
        )}
      />
      <Button
        variant="outline"
        onClick={() => onRowsChange([...rows, { key: "", value: "" }])}
      >
        <Plus aria-hidden="true" />
        Add variable
      </Button>
      <Field label="Paste .env">
        <textarea className="coss-textarea coss-mono" value={raw} onChange={(event) => setRaw(event.target.value)} />
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
                return { key: key || `KEY_${index + 1}`, value: value.join("=") || "" };
              }),
          )
        }
      >
        Import pasted env
      </Button>
    </div>
  );
}

type ProjectGalleryApiResponse = {
  errors?: string[];
  projects?: ConsoleGalleryProjectView[];
};

type ProjectLifecycleFilter = "running" | "deploying" | "attention" | "empty" | "idle";

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";

type ProjectLifecycleState = {
  filter: ProjectLifecycleFilter;
  label: string;
  tone: ConsoleTone;
};

type ProjectListItem = {
  id: string;
  lifecycle: ProjectLifecycleState;
  runtimeLabel: string;
  project: ConsoleGalleryProjectView;
};

function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

function statusTextIncludes(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function readProjectLifecycle(project: ConsoleGalleryProjectView): ProjectLifecycleState {
  const services = project.services ?? [];

  if (services.length === 0) {
    return {
      filter: "empty",
      label: "Empty",
      tone: "neutral",
    };
  }

  let hasDanger = false;
  let hasWarning = false;
  let hasDeploying = false;
  let hasRunning = false;

  for (const service of services) {
    const tone = service.kind === "app" ? service.phaseTone : service.statusTone;
    const status = service.kind === "app" ? service.phase : service.status;
    const normalized = status.trim().toLowerCase();

    if (tone === "danger") {
      hasDanger = true;
    }

    if (tone === "warning") {
      hasWarning = true;
    }

    if (
      tone === "info" ||
      service.serviceRole === "pending" ||
      (service.kind === "backing-service" && service.databaseContinuity.live) ||
      statusTextIncludes(normalized, [
        "building",
        "deploying",
        "importing",
        "provisioning",
        "starting",
        "transferring",
        "creating",
      ])
    ) {
      hasDeploying = true;
    }

    if (
      tone === "positive" ||
      service.serviceRole === "running" ||
      statusTextIncludes(normalized, [
        "active",
        "completed",
        "deployed",
        "healthy",
        "live",
        "ready",
        "running",
      ])
    ) {
      hasRunning = true;
    }
  }

  if (hasDanger || hasWarning) {
    return {
      filter: "attention",
      label: "Attention",
      tone: hasDanger ? "danger" : "warning",
    };
  }

  if (hasDeploying) {
    return {
      filter: "deploying",
      label: "Deploying",
      tone: "info",
    };
  }

  if (hasRunning) {
    return {
      filter: "running",
      label: "Running",
      tone: "positive",
    };
  }

  return {
    filter: "idle",
    label: "Idle",
    tone: "neutral",
  };
}

function readProjectRuntimeLabel(project: ConsoleGalleryProjectView) {
  const runtimeLabels = new Set<string>();

  for (const service of project.services ?? []) {
    const runtimeLabel =
      service.locationLabel ??
      (service.kind === "app"
        ? service.currentRuntimeId ?? service.runtimeId
        : service.databaseRuntimeId);

    if (runtimeLabel?.trim()) {
      runtimeLabels.add(runtimeLabel.trim());
    }
  }

  if (runtimeLabels.size === 0 && project.defaultRuntimeId?.trim()) {
    runtimeLabels.add(project.defaultRuntimeId.trim());
  }

  const labels = [...runtimeLabels];

  if (labels.length === 0) {
    return "No runtime";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} +${labels.length - 1}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProjectGallery() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [drawer, setDrawer] = useState(false);
  const [projects, setProjects] = useState<ConsoleGalleryProjectView[]>([]);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const isRefresh = refreshKey > 0;

    setLoadError(null);
    setLoading(!isRefresh);
    setRefreshing(isRefresh);

    requestJson<ProjectGalleryApiResponse>("/api/fugue/console/projects", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((data) => {
        setProjects(data.projects ?? []);
        setApiErrors(data.errors ?? []);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setLoadError(readRequestError(error));
        setProjects([]);
        setApiErrors([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);

  const items = useMemo<ProjectListItem[]>(() => {
    return projects.map((project) => ({
      id: project.id,
      lifecycle: readProjectLifecycle(project),
      project,
      runtimeLabel: readProjectRuntimeLabel(project),
    }));
  }, [projects]);

  const deployingCount = useMemo(
    () => items.filter((item) => item.lifecycle.filter === "deploying").length,
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const searchable = [
        item.project.name,
        item.project.id,
        item.runtimeLabel,
        ...item.project.services.map((service) => service.name),
        ...item.project.serviceBadges.map((badge) => badge.label),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesStatus = status === "all" || item.lifecycle.filter === status;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, status]);

  return (
    <>
      <CardFrame className="coss-projects-panel">
        <CardContent className="coss-projects-content">
          <div className="coss-projects-toolbar" aria-label="Project controls">
            <div className="coss-projects-filterset">
              <input
                className="coss-input coss-projects-search"
                aria-label="Search projects"
                placeholder="Search projects"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="coss-select coss-projects-select"
                aria-label="Filter lifecycle"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All lifecycle</option>
                <option value="running">Running</option>
                <option value="deploying">Deploying</option>
                <option value="attention">Attention</option>
                <option value="empty">Empty</option>
                <option value="idle">Idle</option>
              </select>
              <div className="coss-tabs" role="tablist" aria-label="Project view">
                <button
                  className="coss-tab"
                  type="button"
                  role="tab"
                  aria-selected={view === "table"}
                  onClick={() => setView("table")}
                >
                  Table
                </button>
                <button
                  className="coss-tab"
                  type="button"
                  role="tab"
                  aria-selected={view === "cards"}
                  onClick={() => setView("cards")}
                >
                  Cards
                </button>
              </div>
            </div>
            <div className="coss-projects-actions">
              <span className="coss-projects-count">
                {loading ? "Loading" : `${pluralize(filtered.length, "project")} shown`}
              </span>
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
              <Button size="sm" onClick={() => setDrawer(true)}>
                <Plus aria-hidden="true" />
                New project
              </Button>
            </div>
          </div>

          {apiErrors.length ? (
            <Alert tone="warning" title="Inventory partially loaded">
              {apiErrors.join(" · ")}
            </Alert>
          ) : null}

          {deployingCount > 0 ? (
            <div className="coss-projects-notice" role="status">
              <Badge tone="info">In progress</Badge>
              <span>{pluralize(deployingCount, "project")} currently importing, building, or deploying.</span>
            </div>
          ) : null}

          {loadError ? (
            <Alert tone="destructive" title="Projects unavailable">
              {loadError}
            </Alert>
          ) : null}

          {loading ? (
            <div className="coss-stack-sm" aria-label="Loading projects">
              <SkeletonBlock height={40} />
              <SkeletonBlock height={48} />
              <SkeletonBlock height={48} />
              <SkeletonBlock height={48} />
            </div>
          ) : null}

          {!loading && !loadError && filtered.length && view === "table" ? (
            <DataTable
              columns={["Project", "Lifecycle", "Workloads", "Runtime", "Usage", "Actions"]}
              rows={filtered}
              renderRow={(item) => <ProjectRow key={item.project.id} item={item} />}
            />
          ) : null}

          {!loading && !loadError && filtered.length && view === "cards" ? (
            <div className="coss-project-card-grid">
              {filtered.map((item) => (
                <Card key={item.project.id}>
                  <CardContent className="coss-project-card">
                    <div className="coss-row" style={{ justifyContent: "space-between" }}>
                      <Badge tone={badgeToneFromConsoleTone(item.lifecycle.tone)}>{item.lifecycle.label}</Badge>
                      <span className="coss-help">{pluralize(item.project.serviceCount, "service")}</span>
                    </div>
                    <div>
                      <strong>{item.project.name}</strong>
                      <p className="coss-card-description">
                        {pluralize(item.project.appCount, "app")} · {item.runtimeLabel}
                      </p>
                    </div>
                    <ProjectUsage project={item.project} />
                    <ProjectBadges project={item.project} />
                    <ButtonLink href={`/app/projects/${item.project.id}`} variant="outline" size="sm">
                      Open
                    </ButtonLink>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {!loading && !loadError && filtered.length === 0 ? (
            <Empty
              title={projects.length === 0 ? "No projects yet" : "No projects match this filter"}
              description={projects.length === 0 ? "Create a project from a repository, image, or upload." : "Clear search or adjust the lifecycle filter."}
              action={<Button onClick={() => setDrawer(true)}>New project</Button>}
            />
          ) : null}
        </CardContent>
      </CardFrame>
      <Drawer title="Create project" open={drawer} onClose={() => setDrawer(false)}>
        <div className="coss-stack">
          <Alert tone="info" title="Full creation flow">
            The complete import wizard is available from the dedicated new project route.
          </Alert>
          <ButtonLink href="/new/repository">Open creation wizard</ButtonLink>
        </div>
      </Drawer>
    </>
  );
}

function ProjectBadges({ project }: { project: ConsoleGalleryProjectView }) {
  const badges = project.serviceBadges.slice(0, 4);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="coss-project-badges" aria-label="Service badges">
      {badges.map((badge) => (
        <span key={badge.id} title={badge.meta}>
          {badge.label}
        </span>
      ))}
      {project.serviceBadges.length > badges.length ? (
        <span>+{project.serviceBadges.length - badges.length}</span>
      ) : null}
    </div>
  );
}

function ProjectUsage({
  compact = false,
  project,
}: {
  compact?: boolean;
  project: ConsoleGalleryProjectView;
}) {
  const items = project.resourceUsage
    .filter((item) => item.primaryLabel !== "No stats")
    .slice(0, compact ? 2 : 3);

  if (items.length === 0) {
    return <span className="coss-muted">No usage stats</span>;
  }

  return (
    <div
      className={`coss-project-usage${compact ? " coss-project-usage--compact" : ""}`}
      aria-label="Project resource usage"
    >
      {items.map((item) => (
        <span key={item.id} title={item.title}>
          <span>{item.label}</span>
          <strong>{item.primaryLabel}</strong>
        </span>
      ))}
    </div>
  );
}

function ProjectRow({ item }: { item: ProjectListItem }) {
  const { lifecycle, project, runtimeLabel } = item;

  return (
    <tr>
      <td>
        <div className="coss-project-cell">
          <div className="coss-project-primary">
            <ButtonLink href={`/app/projects/${project.id}`} variant="ghost" size="sm" className="coss-project-name">
              {project.name}
            </ButtonLink>
            <ProjectBadges project={project} />
          </div>
          <span className="coss-project-meta">
            {project.id} · {pluralize(project.appCount, "app")}
          </span>
        </div>
      </td>
      <td><Badge tone={badgeToneFromConsoleTone(lifecycle.tone)}>{lifecycle.label}</Badge></td>
      <td>{pluralize(project.serviceCount, "service")}</td>
      <td className="coss-mono">{runtimeLabel}</td>
      <td><ProjectUsage project={project} compact /></td>
      <td className="coss-table__actions">
        <ButtonLink href={`/app/projects/${project.id}`} variant="outline" size="sm">
          Open
        </ButtonLink>
      </td>
    </tr>
  );
}

type WorkbenchProject = NonNullable<ConsoleProjectDetailData["project"]>;
type WorkbenchService = WorkbenchProject["services"][number];
type WorkbenchAppService = Extract<WorkbenchService, { kind: "app" }>;
type WorkbenchBackingService = Extract<WorkbenchService, { kind: "backing-service" }>;

function isWorkbenchAppService(
  service: WorkbenchService,
): service is WorkbenchAppService {
  return service.kind === "app";
}

function serviceTone(service: WorkbenchService): CossBadgeTone {
  if (isWorkbenchAppService(service)) {
    return badgeToneFromConsoleTone(service.phaseTone);
  }

  return badgeToneFromConsoleTone(service.statusTone);
}

function serviceStatusLabel(service: WorkbenchService) {
  return isWorkbenchAppService(service) ? service.phase : service.status;
}

function serviceRouteLabel(service: WorkbenchService) {
  if (!isWorkbenchAppService(service)) {
    return `${service.type} · ${service.ownerAppLabel}`;
  }

  return (
    service.routePublicUrl ||
    service.routeInternalUrl ||
    service.routeLabel ||
    "No route configured"
  );
}

function serviceRuntimeLabel(service: WorkbenchService) {
  if (isWorkbenchAppService(service)) {
    return service.locationLabel || service.runtimeId || "No runtime";
  }

  return service.locationLabel || service.databaseRuntimeId || "No runtime";
}

function workbenchTabs(service: WorkbenchService) {
  return isWorkbenchAppService(service)
    ? ["Route", "Environment", "Logs", "Files", "Images", "Observability", "Settings"]
    : ["Overview", "Failover", "Settings"];
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unknown";
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

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(amount)} ${units[index]}`;
}

function formatRelativeOrExact(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function useEndpointData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    requestJson<T>(url, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((value) => {
        setData(value);
      })
      .catch((nextError) => {
        if (isAbortRequestError(nextError)) {
          return;
        }

        setData(null);
        setError(readRequestError(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [url, refreshKey]);

  return {
    data,
    error,
    loading,
    refresh: () => setRefreshKey((value) => value + 1),
  };
}

export function ProjectWorkbench({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ConsoleProjectDetailData | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [tab, setTab] = useState("Route");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const project = detail?.project ?? null;
  const services = project?.services ?? [];
  const service =
    services.find((item) => item.id === selectedServiceId) ?? services[0] ?? null;
  const tabs = service ? workbenchTabs(service) : [];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetchConsoleProjectDetail(projectId, {
      force: refreshKey > 0,
      signal: controller.signal,
    })
      .then((nextDetail) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetail(nextDetail);
        const params = new URLSearchParams(window.location.search);
        const requestedServiceId = params.get("service");
        const nextServices = nextDetail.project?.services ?? [];
        const nextService =
          nextServices.find((item) => item.id === requestedServiceId) ??
          nextServices[0] ??
          null;
        const requestedTab = params.get("tab");
        const nextTabs = nextService ? workbenchTabs(nextService) : [];
        setSelectedServiceId(nextService?.id ?? null);
        setTab(requestedTab && nextTabs.includes(requestedTab) ? requestedTab : nextTabs[0] ?? "Route");
      })
      .catch((nextError) => {
        if (isAbortRequestError(nextError)) {
          return;
        }

        setDetail(null);
        setLoadError(readRequestError(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [projectId, refreshKey]);

  function writeWorkbenchUrl(nextService: WorkbenchService, nextTab: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("service", nextService.id);
    params.set("tab", nextTab);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="coss-stack-sm" aria-label="Loading project detail">
        <SkeletonBlock height={52} />
        <SkeletonBlock height={52} />
        <SkeletonBlock height={260} />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert tone="destructive" title="Project details unavailable">
        {loadError}
      </Alert>
    );
  }

  if (!project) {
    return (
      <Empty
        title="Project not found"
        description="The requested project does not exist in this workspace, or the current account cannot view it."
        action={<ButtonLink href="/app">Back to projects</ButtonLink>}
      />
    );
  }

  if (!service) {
    return (
      <Empty
        title="No services yet"
        description="This project exists, but Fugue is not reporting any app or backing service for it yet."
        action={
          <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>
            <RotateCcw aria-hidden="true" />
            Refresh
          </Button>
        }
      />
    );
  }

  return (
    <div className="coss-workbench">
      <aside className="coss-service-rail">
        {services.map((item) => {
          const nextTabs = workbenchTabs(item);
          const nextTab = nextTabs[0] ?? "Overview";

          return (
            <button
              key={item.id}
              className="coss-service-button"
              aria-label={`Select service ${item.name}`}
              aria-selected={service.id === item.id}
              onClick={() => {
                setSelectedServiceId(item.id);
                setTab(nextTab);
                writeWorkbenchUrl(item, nextTab);
              }}
            >
              <strong>{item.name}</strong>
              <p className="coss-card-description">
                {item.kind === "app" ? "app" : item.type} · {serviceStatusLabel(item)}
              </p>
            </button>
          );
        })}
        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>
          <RotateCcw aria-hidden="true" />
          Refresh project
        </Button>
      </aside>
      <div className="coss-stack">
        <CardFrame>
          <CardContent className="coss-row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className="coss-page-title">{service.name}</h2>
              <p className="coss-card-description">{serviceRouteLabel(service)}</p>
            </div>
            <div className="coss-actions">
              <Badge tone={serviceTone(service)}>{serviceStatusLabel(service)}</Badge>
              <Badge tone="info">{serviceRuntimeLabel(service)}</Badge>
            </div>
          </CardContent>
        </CardFrame>
        <div className="coss-tabs" role="tablist" aria-label="Service sections">
          {tabs.map((item) => (
            <button
              key={item}
              className="coss-tab"
              aria-selected={tab === item}
              onClick={() => {
                setTab(item);
                writeWorkbenchUrl(service, item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {tab === "Route" && isWorkbenchAppService(service) ? <RouteTab service={service} /> : null}
        {tab === "Environment" && isWorkbenchAppService(service) ? <EnvironmentTab service={service} /> : null}
        {tab === "Logs" && isWorkbenchAppService(service) ? <LogsTab service={service} /> : null}
        {tab === "Files" && isWorkbenchAppService(service) ? <FilesTab service={service} /> : null}
        {tab === "Images" && isWorkbenchAppService(service) ? <ImagesTab service={service} /> : null}
        {tab === "Observability" && isWorkbenchAppService(service) ? <ObservabilityTab service={service} /> : null}
        {tab === "Settings" ? <SettingsTab service={service} /> : null}
        {tab === "Overview" && !isWorkbenchAppService(service) ? <BackingOverview service={service} /> : null}
        {tab === "Failover" && !isWorkbenchAppService(service) ? <FailoverTab service={service} /> : null}
      </div>
    </div>
  );
}

function RouteTab({ service }: { service: WorkbenchAppService }) {
  const rows = service.routeHostname
    ? [
        {
          host: service.routeHostname,
          href: service.routeHref || service.routePublicUrl || "",
          id: `${service.id}:primary-route`,
          pathPrefix: service.routePathPrefix ?? "/",
          port: service.routeBaseDomain ?? "public",
          status: "active",
        },
      ]
    : [];

  return (
    <CardFrame>
      <CardHeader title="Routes" description="Public route and internal service placement from Fugue." />
      <CardContent className="coss-stack">
        <MetricStrip
          items={[
            { label: "Public route", value: rows.length ? "1" : "0" },
            { label: "Service port", value: service.routeLabel },
            { label: "Network", value: service.networkMode ?? "default" },
            { label: "Replicas", value: service.replicaCount === null ? "Unknown" : String(service.replicaCount) },
          ]}
        />
        {rows.length ? (
          <DataTable
            columns={["Host", "Path", "Target", "Status"]}
            rows={rows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{row.href ? <a href={row.href}>{row.host}</a> : row.host}</td>
                <td className="coss-mono">{row.pathPrefix}</td>
                <td className="coss-mono">{service.routeLabel}</td>
                <td><Badge tone="success">{row.status}</Badge></td>
              </tr>
            )}
          />
        ) : (
          <Empty title="No public route" description="This app does not currently expose a public route." />
        )}
        <Card muted>
          <CardContent className="coss-stack-sm">
            <strong>Internal service</strong>
            <p className="coss-card-description">
              {service.routeInternalUrl || "Internal service URL is not reported for this app."}
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </CardFrame>
  );
}

function EnvironmentTab({ service }: { service: WorkbenchAppService }) {
  const [mode, setMode] = useState<"Variables" | "Raw .env">("Variables");
  const { data, error, loading, refresh } = useEndpointData<FugueAppEnvResult>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/env`,
  );
  const rows = Object.entries(data?.env ?? {}).map(([key, value]) => ({
    id: key,
    key,
    value,
  }));
  const rawEnv = rows.map((row) => `${row.key}=${row.value}`).join("\n");

  return (
    <CardFrame>
      <CardHeader
        title="Environment"
        description="Live app environment from Fugue."
        action={<Button variant="outline" size="sm" loading={loading} onClick={refresh}>Refresh</Button>}
      />
      <CardContent className="coss-stack">
        {error ? <Alert tone="destructive" title="Environment unavailable">{error}</Alert> : null}
        <div className="coss-tabs">
          {(["Variables", "Raw .env"] as const).map((item) => (
            <button key={item} className="coss-tab" aria-selected={mode === item} onClick={() => setMode(item)}>{item}</button>
          ))}
        </div>
        {loading ? (
          <div className="coss-stack-sm">
            <SkeletonBlock height={40} />
            <SkeletonBlock height={40} />
          </div>
        ) : rows.length ? (
          mode === "Variables" ? (
            <DataTable
              columns={["Key", "Value"]}
              rows={rows}
              renderRow={(row) => (
                <tr key={row.id}>
                  <td className="coss-mono">{row.key}</td>
                  <td className="coss-mono">{row.value}</td>
                </tr>
              )}
            />
          ) : (
            <textarea className="coss-textarea coss-mono" readOnly value={rawEnv} />
          )
        ) : (
          <Empty title="No environment variables" description="Fugue returned an empty environment for this app." />
        )}
      </CardContent>
    </CardFrame>
  );
}

function LogsTab({ service }: { service: WorkbenchAppService }) {
  const [kind, setKind] = useState<"Runtime" | "Build">(
    service.preferredLogsMode === "build" ? "Build" : "Runtime",
  );
  const toast = useToast();
  const query =
    kind === "Build"
      ? `tail_lines=160${service.buildLogsOperationId ? `&operation_id=${encodeURIComponent(service.buildLogsOperationId)}` : ""}`
      : "tail_lines=160";
  const endpoint =
    kind === "Build"
      ? `/api/fugue/apps/${encodeURIComponent(service.id)}/build-logs?${query}`
      : `/api/fugue/apps/${encodeURIComponent(service.id)}/runtime-logs?${query}`;
  const { data, error, loading, refresh } = useEndpointData<
    FugueBuildLogsResult | FugueRuntimeLogsResult
  >(endpoint);
  const logs = data && "logs" in data ? data.logs : "";

  return (
    <>
      <Toast message={toast.message} />
      <CardFrame>
        <CardHeader
          title="Logs"
          description="Recent logs from Fugue for the selected app."
          action={<Button variant="outline" size="sm" loading={loading} onClick={refresh}>Refresh</Button>}
        />
        <CardContent className="coss-stack">
          {error ? <Alert tone="destructive" title="Logs unavailable">{error}</Alert> : null}
          <div className="coss-row" style={{ justifyContent: "space-between" }}>
            <div className="coss-tabs">
              {(["Runtime", "Build"] as const).map((item) => (
                <button key={item} className="coss-tab" aria-selected={kind === item} onClick={() => setKind(item)}>{item}</button>
              ))}
            </div>
            <Button variant="outline" size="sm" disabled={!logs} onClick={() => copyText(logs, toast.notify)}>Copy logs</Button>
          </div>
          {loading ? <SkeletonBlock height={220} /> : logs ? <CodeBlock>{logs}</CodeBlock> : <Empty title="No logs returned" description="Fugue did not return log lines for this app and mode." />}
        </CardContent>
      </CardFrame>
    </>
  );
}

function FilesTab({ service }: { service: WorkbenchAppService }) {
  const { data, error, loading, refresh } =
    useEndpointData<FugueAppFilesystemTreeResult>(
      `/api/fugue/apps/${encodeURIComponent(service.id)}/filesystem/tree?depth=2`,
    );
  const entries = data?.entries ?? [];
  const rows = entries.map((entry) => ({
    ...entry,
    id: entry.path,
  }));

  return (
    <CardFrame>
      <CardHeader
        title="Files"
        description="Live filesystem tree from the current runtime container."
        action={<Button variant="outline" size="sm" loading={loading} onClick={refresh}>Refresh</Button>}
      />
      <CardContent className="coss-stack">
        {error ? <Alert tone="destructive" title="Filesystem unavailable">{error}</Alert> : null}
        <div className="coss-row">
          <Badge tone="info">{data?.component ?? "app"}</Badge>
          <span className="coss-help coss-mono">{data?.pod ?? "No pod selected"}</span>
          <span className="coss-help coss-mono">{data?.workspaceRoot ?? "/"}</span>
        </div>
        {loading ? (
          <div className="coss-stack-sm">
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
            <SkeletonBlock height={38} />
          </div>
        ) : rows.length ? (
          <DataTable
            columns={["Path", "Kind", "Size", "Modified"]}
            rows={rows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{row.path}</td>
                <td>{row.kind}</td>
                <td>{formatBytes(row.size)}</td>
                <td>{formatRelativeOrExact(row.modifiedAt)}</td>
              </tr>
            )}
          />
        ) : (
          <Empty title="No files returned" description="Fugue did not return filesystem entries for this app." />
        )}
      </CardContent>
    </CardFrame>
  );
}

function ImagesTab({ service }: { service: WorkbenchAppService }) {
  const [drawer, setDrawer] = useState<FugueAppImageInventoryResult["versions"][number] | null>(null);
  const { data, error, loading, refresh } =
    useEndpointData<FugueAppImageInventoryResult>(
      `/api/fugue/apps/${encodeURIComponent(service.id)}/images`,
    );
  const versions = data?.versions ?? [];
  const rows = versions.map((version) => ({
    ...version,
    id: version.imageRef,
  }));
  const current = versions.find((version) => version.current);

  return (
    <>
      <CardFrame>
        <CardHeader
          title="Images"
          description="Image inventory reported by Fugue registry metadata."
          action={<Button variant="outline" size="sm" loading={loading} onClick={refresh}>Refresh</Button>}
        />
        <CardContent className="coss-stack">
          {error ? <Alert tone="destructive" title="Images unavailable">{error}</Alert> : null}
          {current ? (
            <Alert tone="success" title="Current image">
              {current.runtimeImageRef ?? current.imageRef}
            </Alert>
          ) : null}
          {loading ? (
            <div className="coss-stack-sm">
              <SkeletonBlock height={40} />
              <SkeletonBlock height={40} />
            </div>
          ) : rows.length ? (
            <DataTable
              columns={["Image", "Size", "State", "Deployed", "Actions"]}
              rows={rows}
              renderRow={(row) => (
                <tr key={row.id}>
                  <td className="coss-mono">{row.runtimeImageRef ?? row.imageRef}</td>
                  <td>{formatBytes(row.sizeBytes)}</td>
                  <td><Badge tone={row.current ? "success" : "default"}>{row.current ? "current" : row.status ?? "saved"}</Badge></td>
                  <td>{formatRelativeOrExact(row.lastDeployedAt)}</td>
                  <td className="coss-table__actions">
                    <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>Details</Button>
                  </td>
                </tr>
              )}
            />
          ) : (
            <Empty title="No image versions" description="Fugue did not return retained image versions for this app." />
          )}
        </CardContent>
      </CardFrame>
      <Drawer title="Image details" description={drawer?.runtimeImageRef ?? drawer?.imageRef} open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        {drawer ? (
          <CodeBlock>{JSON.stringify({
            current: drawer.current,
            digest: drawer.digest,
            imageRef: drawer.imageRef,
            lastDeployedAt: drawer.lastDeployedAt,
            runtimeImageRef: drawer.runtimeImageRef,
            status: drawer.status,
          }, null, 2)}</CodeBlock>
        ) : null}
      </Drawer>
    </>
  );
}

function ObservabilityTab({ service }: { service: WorkbenchAppService }) {
  const [windowSize, setWindowSize] = useState("1h");
  const since = encodeURIComponent(windowSize);
  const metrics = useEndpointData<FugueAppObservabilityMetricsSummary>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/observability/metrics/summary?since=${since}`,
  );
  const requests = useEndpointData<FugueAppObservabilityRequests>(
    `/api/fugue/apps/${encodeURIComponent(service.id)}/observability/requests?since=${since}&limit=20`,
  );
  const requestRows = (requests.data?.requests ?? []).map((request) => ({
    ...request,
    id: request.requestId ?? request.traceId ?? request.timestamp,
  }));

  return (
    <CardFrame>
      <CardHeader
        title="Observability"
        description="Metrics and request summaries from Fugue observability."
        action={
          <Button
            variant="outline"
            size="sm"
            loading={metrics.loading || requests.loading}
            onClick={() => {
              metrics.refresh();
              requests.refresh();
            }}
          >
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack">
        <div className="coss-row" style={{ justifyContent: "space-between" }}>
          <select className="coss-select" aria-label="Time window" value={windowSize} onChange={(event) => setWindowSize(event.target.value)} style={{ width: 120 }}>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
          </select>
          <Badge tone={metrics.data?.source.available ? "success" : "warning"}>
            {metrics.data?.source.status ?? "loading"}
          </Badge>
        </div>
        {metrics.error ? <Alert tone="destructive" title="Metrics unavailable">{metrics.error}</Alert> : null}
        {requests.error ? <Alert tone="destructive" title="Requests unavailable">{requests.error}</Alert> : null}
        {metrics.loading ? (
          <SkeletonBlock height={72} />
        ) : metrics.data?.metrics.length ? (
          <MetricStrip
            items={metrics.data.metrics.slice(0, 4).map((metric) => ({
              label: metric.name,
              value: `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`,
            }))}
          />
        ) : (
          <Empty title="No metrics returned" description="Fugue observability returned no metric samples for this window." />
        )}
        {requests.loading ? (
          <SkeletonBlock height={140} />
        ) : requestRows.length ? (
          <DataTable
            columns={["Request", "Status", "Duration", "Trace"]}
            rows={requestRows}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{[row.method, row.route].filter(Boolean).join(" ") || "request"}</td>
                <td>{row.statusCode ? <Badge tone={row.statusCode < 500 ? "success" : "destructive"}>{row.statusCode}</Badge> : "Unknown"}</td>
                <td>{row.durationMs === undefined ? "Unknown" : `${row.durationMs} ms`}</td>
                <td className="coss-mono">{row.traceId ?? "No trace"}</td>
              </tr>
            )}
          />
        ) : (
          <Empty title="No requests returned" description="Fugue observability returned no request summaries for this window." />
        )}
      </CardContent>
    </CardFrame>
  );
}

function SettingsTab({ service }: { service: WorkbenchService }) {
  if (!isWorkbenchAppService(service)) {
    return (
      <BackingOverview service={service} />
    );
  }

  return (
    <div className="coss-stack">
      <CardFrame>
        <CardHeader title="Runtime settings" description="Current app runtime settings reported by Fugue." />
        <CardContent className="coss-grid-2">
          <Field label="Startup command"><input className="coss-input" readOnly value={service.startupCommand ?? ""} placeholder="Not configured" /></Field>
          <Field label="Image retention"><input className="coss-input" readOnly value={String(service.imageMirrorLimit)} /></Field>
          <Field label="Network mode"><input className="coss-input" readOnly value={service.networkMode ?? "default"} /></Field>
          <Field label="Runtime"><input className="coss-input" readOnly value={service.runtimeId ?? ""} placeholder="No runtime" /></Field>
          <Field label="Replicas"><input className="coss-input" readOnly value={service.replicaCount === null ? "" : String(service.replicaCount)} placeholder="Unknown" /></Field>
          <Field label="Deploy behavior"><input className="coss-input" readOnly value={service.deployBehavior} /></Field>
        </CardContent>
      </CardFrame>
      <CardFrame>
        <CardHeader title="Source" description="Current build source and commit metadata." />
        <CardContent className="coss-stack-sm">
          <div className="coss-row"><span>Source</span><span className="coss-mono">{service.sourceLabel}</span></div>
          <div className="coss-row"><span>Branch</span><span className="coss-mono">{service.sourceBranchLabel ?? "Unknown"}</span></div>
          <div className="coss-row"><span>Commit</span><span className="coss-mono">{service.currentCommitLabel ?? "Unknown"}</span></div>
        </CardContent>
      </CardFrame>
    </div>
  );
}

function BackingOverview({ service }: { service: WorkbenchBackingService }) {
  return (
    <CardFrame>
      <CardHeader title="Backing service overview" description="Runtime location, owner app, continuity, and resource state from Fugue." />
      <CardContent className="coss-stack">
        <MetricStrip
          items={[
            { label: "Runtime", value: service.locationLabel ?? service.databaseRuntimeId ?? "Unknown" },
            { label: "Owner app", value: service.ownerAppLabel },
            { label: "Status", value: service.status, tone: badgeToneFromConsoleTone(service.statusTone) },
            { label: "Continuity", value: service.databaseContinuity.label, tone: badgeToneFromConsoleTone(service.databaseContinuity.tone) },
          ]}
        />
        <CodeBlock>{JSON.stringify({
          databaseInstances: service.databaseInstances,
          databaseRuntimeId: service.databaseRuntimeId,
          failoverConfigured: service.databaseFailoverConfigured,
          transferTargetRuntimeId: service.databaseTransferTargetRuntimeId,
          type: service.type,
        }, null, 2)}</CodeBlock>
      </CardContent>
    </CardFrame>
  );
}

function FailoverTab({ service }: { service: WorkbenchBackingService }) {
  return (
    <CardFrame>
      <CardHeader title="Managed failover" description="Current database continuity state from Fugue." />
      <CardContent className="coss-stack">
        <Alert tone={badgeToneFromConsoleTone(service.databaseContinuity.tone)} title={service.databaseContinuity.label}>
          {service.databaseContinuity.live
            ? "A database continuity operation is currently in progress."
            : "No live database continuity operation is reported for this backing service."}
        </Alert>
        <CodeBlock>{JSON.stringify({
          failoverConfigured: service.databaseFailoverConfigured,
          failoverTargetRuntimeId: service.databaseFailoverTargetRuntimeId,
          pendingTargetRuntimeId: service.databaseContinuity.pendingTargetRuntimeId,
          placementPendingRebalance: service.databaseContinuity.placementPendingRebalance,
          state: service.databaseContinuity.state,
        }, null, 2)}</CodeBlock>
      </CardContent>
    </CardFrame>
  );
}

type ReadyBillingSnapshot = Extract<ConsoleBillingPageSnapshot, { state: "ready" }>;
type BillingSummary = NonNullable<ReadyBillingSnapshot["data"]["billing"]>;
type BillingEventRow = BillingSummary["events"][number] & {
  id: string;
};

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

function formatCurrencyMicroCents(value: number, currency: string, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits,
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatBillingRate(value: number, currency: string) {
  const amount = value / MICRO_CENTS_PER_DOLLAR;

  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: amount < 0.01 ? 6 : 4,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function formatBillingCpu(cpuMillicores: number) {
  const cores = cpuMillicores / 1000;
  return `${Number.isInteger(cores) ? cores : cores.toFixed(2)} CPU`;
}

function formatBillingMemory(memoryMebibytes: number) {
  const gib = memoryMebibytes / 1024;
  return `${Number.isInteger(gib) ? gib : gib.toFixed(2)} GiB`;
}

function formatBillingSpec(spec: BillingSummary["managedCap"]) {
  return [
    formatBillingCpu(spec.cpuMillicores),
    formatBillingMemory(spec.memoryMebibytes),
    `${spec.storageGibibytes} GiB storage`,
  ].join(" / ");
}

function formatRunwayHours(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  if (value < 1) {
    return `${Math.round(value * 60)} min`;
  }

  if (value < 48) {
    return `${Math.round(value)} hr`;
  }

  return `${Math.round(value / 24)} days`;
}

function formatBillingDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function billingStatusTone(billing: BillingSummary): CossBadgeTone {
  if (billing.overCap || billing.status === "over-cap") return "warning";
  if (billing.balanceRestricted || billing.status === "restricted") return "warning";
  if (billing.status === "active") return "success";
  if (billing.status === "paused") return "info";
  return "default";
}

function billingEventTone(event: BillingSummary["events"][number]): CossBadgeTone {
  return event.amountMicroCents >= 0 ? "success" : "warning";
}

export function BillingConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleBillingPageSnapshot>(
      CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
      {
        ttlMs: 30_000,
      },
    );
  const ready = data?.state === "ready" ? data : null;
  const billing = ready?.data.billing ?? null;
  const [cpuCores, setCpuCores] = useState(0);
  const [memoryGiB, setMemoryGiB] = useState(0);
  const [storageGiB, setStorageGiB] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!billing || dirty) {
      return;
    }

    setCpuCores(billing.managedCap.cpuMillicores / 1000);
    setMemoryGiB(billing.managedCap.memoryMebibytes / 1024);
    setStorageGiB(billing.managedCap.storageGibibytes);
  }, [billing, dirty]);

  async function refreshBilling() {
    setActionError(null);
    invalidateConsolePageSnapshot(CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL);
    await refresh({ force: true });
  }

  async function saveBillingCap() {
    setSaving(true);
    setActionError(null);

    try {
      await requestJson<{ billing: BillingSummary }>("/api/fugue/billing", {
        body: JSON.stringify({
          managedCap: {
            cpuMillicores: Math.round(cpuCores * 1000),
            memoryMebibytes: Math.round(memoryGiB * 1024),
            storageGibibytes: Math.round(storageGiB),
          },
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      setDirty(false);
      await refreshBilling();
      toast.notify("Billing cap saved.");
    } catch (nextError) {
      setActionError(readRequestError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setActionError(null);

    try {
      const checkout = await requestJson<{ checkoutUrl: string; requestId: string }>(
        "/api/fugue/billing/top-ups/checkout",
        {
          body: JSON.stringify({ amountUsd: topUpAmount }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      window.location.assign(checkout.checkoutUrl);
    } catch (nextError) {
      setActionError(readRequestError(nextError));
      setCheckoutLoading(false);
    }
  }

  const currency = billing?.priceBook.currency ?? "USD";
  const billingSyncError = ready?.data.syncError ?? null;
  const imageStorageLabel =
    ready?.data.imageStorageBytes === null || ready?.data.imageStorageBytes === undefined
      ? "Syncing"
      : formatBytes(ready.data.imageStorageBytes);
  const eventRows: BillingEventRow[] = (billing?.events ?? []).map((event) => ({
    ...event,
    id: event.id,
  }));

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        {error ? (
          <Alert tone="destructive" title="Billing unavailable">
            {error}
          </Alert>
        ) : null}
        {actionError ? (
          <Alert tone="destructive" title="Billing action failed">
            {actionError}
          </Alert>
        ) : null}
        {data?.state === "workspace-missing" ? (
          <Empty title="Billing needs a workspace" description="Create or open a Fugue workspace before changing tenant billing." />
        ) : null}
        {loading && !ready ? (
          <div className="coss-stack-sm">
            <SkeletonBlock height={72} />
            <SkeletonBlock height={220} />
          </div>
        ) : null}
        {ready && !billing ? (
          <Alert tone="warning" title="Billing snapshot unavailable">
            {ready.data.syncError ?? "Fugue could not load the billing snapshot right now."}
          </Alert>
        ) : null}
        {billing ? (
          <>
            <MetricStrip
              items={[
                {
                  label: "Prepaid balance",
                  value: formatCurrencyMicroCents(billing.balanceMicroCents, currency),
                  tone: billingStatusTone(billing),
                },
                {
                  label: "Runway",
                  value: formatRunwayHours(billing.runwayHours),
                  tone: billing.runwayHours === null ? undefined : billing.runwayHours < 72 ? "warning" : "success",
                },
                {
                  label: "Current usage",
                  value: `${formatCurrencyMicroCents(billing.hourlyRateMicroCents, currency)}/hr`,
                },
                {
                  label: "Image storage",
                  value: imageStorageLabel,
                },
              ]}
            />
            {billingSyncError ? (
              <Alert tone="warning" title="Billing snapshot refreshed with partial live data">
                {billingSyncError}
              </Alert>
            ) : null}
            <div className="coss-split">
              <CardFrame>
                <CardHeader title="Managed capacity envelope" description="Saved CPU, memory, and storage cap for this Fugue tenant." />
                <CardContent className="coss-form">
                  <Field label="CPU cores">
                    <input
                      className="coss-input"
                      min={0}
                      step={0.1}
                      type="number"
                      value={cpuCores}
                      onChange={(event) => {
                        setDirty(true);
                        setCpuCores(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Field label="Memory GiB">
                    <input
                      className="coss-input"
                      min={0}
                      step={0.5}
                      type="number"
                      value={memoryGiB}
                      onChange={(event) => {
                        setDirty(true);
                        setMemoryGiB(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Field label="Storage GiB">
                    <input
                      className="coss-input"
                      min={0}
                      step={1}
                      type="number"
                      value={storageGiB}
                      onChange={(event) => {
                        setDirty(true);
                        setStorageGiB(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Alert tone="info" title="Current saved cap">
                    {formatBillingSpec(billing.managedCap)} · monthly estimate {formatCurrencyMicroCents(billing.monthlyEstimateMicroCents, currency)}
                  </Alert>
                  <Button loading={saving} onClick={() => void saveBillingCap()}>
                    {saving ? null : <Save aria-hidden="true" />}
                    Save envelope
                  </Button>
                </CardContent>
              </CardFrame>
              <CardFrame>
                <CardHeader title="Top up" description="Start a checkout for prepaid balance." />
                <CardContent className="coss-stack">
                  <Field label="Amount USD">
                    <input
                      className="coss-input"
                      min={5}
                      step={1}
                      type="number"
                      value={topUpAmount}
                      onChange={(event) => setTopUpAmount(Number(event.target.value))}
                    />
                  </Field>
                  <Button loading={checkoutLoading} onClick={() => void startCheckout()}>
                    Start checkout
                  </Button>
                  <div className="coss-grid-2">
                    <DetailMetric label="Status" value={billing.status} />
                    <DetailMetric label="Updated" value={formatBillingDate(billing.updatedAt)} />
                  </div>
                </CardContent>
              </CardFrame>
            </div>
            <CardFrame>
              <CardHeader title="Billing events" description="Usage, top-ups, and managed capacity changes from Fugue." />
              <CardContent>
                {eventRows.length ? (
                  <DataTable
                    columns={["Event", "Amount", "Balance", "Created"]}
                    rows={eventRows}
                    renderRow={(row) => (
                      <tr key={row.id}>
                        <td>
                          <Badge tone={billingEventTone(row)}>{row.type}</Badge>
                        </td>
                        <td>{formatCurrencyMicroCents(row.amountMicroCents, currency)}</td>
                        <td>{formatCurrencyMicroCents(row.balanceAfterMicroCents, currency)}</td>
                        <td>{formatBillingDate(row.createdAt)}</td>
                      </tr>
                    )}
                  />
                ) : (
                  <Empty title="No billing events yet" description="Fugue returned no tenant billing events for this workspace." />
                )}
              </CardContent>
            </CardFrame>
            <CardFrame>
              <CardHeader title="Price book" description="Rates from the current Fugue billing summary." />
              <CardContent>
                <DataTable
                  columns={["Resource", "Rate", "Boundary"]}
                  rows={[
                    {
                      boundary: "Managed CPU usage",
                      id: "cpu",
                      rate: `${formatBillingRate(billing.priceBook.cpuMicroCentsPerMillicoreHour * 1000, currency)}/core-hour`,
                      resource: "CPU core",
                    },
                    {
                      boundary: "Managed memory usage",
                      id: "memory",
                      rate: `${formatBillingRate(billing.priceBook.memoryMicroCentsPerMibHour * 1024, currency)}/GiB-hour`,
                      resource: "Memory GiB",
                    },
                    {
                      boundary: "Managed storage usage",
                      id: "storage",
                      rate: `${formatBillingRate(billing.priceBook.storageMicroCentsPerGibHour, currency)}/GiB-hour`,
                      resource: "Storage GiB",
                    },
                  ]}
                  renderRow={(row) => <tr key={row.id}><td>{row.resource}</td><td>{row.rate}</td><td>{row.boundary}</td></tr>}
                />
              </CardContent>
            </CardFrame>
          </>
        ) : null}
      </div>
    </>
  );
}

type ReadyAccessKeysSnapshot = Extract<
  ConsoleApiKeysPageSnapshot,
  { state: "ready" }
>;
type WorkspaceApiKey = ReadyAccessKeysSnapshot["apiKeys"]["keys"][number];
type NodeEnrollmentKey = ReadyAccessKeysSnapshot["nodeKeys"]["keys"][number];
type SecretPanelState = {
  description: string;
  title: string;
  value: string;
};
type AccessKeyConfirmState = {
  action: () => Promise<void>;
  confirmLabel: string;
  description: string;
  title: string;
};

function formatKeyTimestamp(value?: string | null, fallback = "Never") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatKeyScopes(scopes: string[]) {
  return scopes.length ? scopes.join(", ") : "No scopes";
}

function formatAttachedVpsCount(value: number | null) {
  if (value === null) {
    return "Syncing";
  }

  return `${value} VPS`;
}

function keyStatusTone(status: string): CossBadgeTone {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  return "destructive";
}

function buildNodeJoinCommand(apiBaseUrl: string, secret: string) {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  return [
    `curl -fsSL ${baseUrl}/install/join-cluster.sh | \\`,
    `  sudo FUGUE_NODE_KEY='${secret}' \\`,
    "  bash",
  ].join("\n");
}

export function AccessKeysConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
      {
        ttlMs: 15_000,
      },
    );
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [nodeLabel, setNodeLabel] = useState("");
  const [renameNode, setRenameNode] = useState<NodeEnrollmentKey | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [secretPanel, setSecretPanel] = useState<SecretPanelState | null>(null);
  const [confirm, setConfirm] = useState<AccessKeyConfirmState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();
  const ready = data?.state === "ready" ? data : null;
  const initialLoading = loading && !data;

  async function refreshAccessKeys() {
    invalidateConsolePageSnapshot(CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL);
    await refresh({ force: true });
  }

  async function runKeyAction<T>(
    key: string,
    action: () => Promise<T>,
  ) {
    setBusy(key);
    setActionError(null);

    try {
      return await action();
    } catch (nextError) {
      setActionError(readRequestError(nextError));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function revealApiKeySecret(row: WorkspaceApiKey) {
    const result = await runKeyAction(
      `api-secret:${row.id}`,
      () =>
        requestJson<{ secret: string }>(
          `/api/fugue/api-keys/${encodeURIComponent(row.id)}/secret`,
          {
            cache: "no-store",
          },
        ),
    );

    if (!result) {
      return;
    }

    setSecretPanel({
      description: "Copy this API key into your local Fugue CLI or CI secret store.",
      title: `${row.label} secret`,
      value: result.secret,
    });
  }

  async function rotateApiKey(row: WorkspaceApiKey) {
    const result = await runKeyAction(
      `api-rotate:${row.id}`,
      () =>
        requestJson<{ key: WorkspaceApiKey; secret?: string }>(
          `/api/fugue/api-keys/${encodeURIComponent(row.id)}/rotate`,
          {
            cache: "no-store",
            method: "POST",
          },
        ),
    );

    if (!result) {
      return;
    }

    if (result.secret) {
      setSecretPanel({
        description: "Copy this rotated API key before closing the panel.",
        title: `${result.key.label} rotated secret`,
        value: result.secret,
      });
    }

    await refreshAccessKeys();
    toast.notify("API key rotated.");
  }

  async function toggleApiKey(row: WorkspaceApiKey) {
    const endpoint = row.status === "disabled" ? "enable" : "disable";
    const result = await runKeyAction(
      `api-toggle:${row.id}`,
      () =>
        requestJson<{ key: WorkspaceApiKey }>(
          `/api/fugue/api-keys/${encodeURIComponent(row.id)}/${endpoint}`,
          {
            cache: "no-store",
            method: "POST",
          },
        ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify(row.status === "disabled" ? "API key enabled." : "API key disabled.");
  }

  async function deleteApiKey(row: WorkspaceApiKey) {
    const result = await runKeyAction(
      `api-delete:${row.id}`,
      () =>
        requestJson<{ key: WorkspaceApiKey }>(
          `/api/fugue/api-keys/${encodeURIComponent(row.id)}`,
          {
            cache: "no-store",
            method: "DELETE",
          },
        ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify("API key deleted.");
  }

  async function provisionWorkspaceKey() {
    const result = await runKeyAction(
      "api-create",
      () =>
        requestJson<{ key: WorkspaceApiKey; secret: string }>("/api/fugue/api-keys", {
          cache: "no-store",
          method: "POST",
        }),
    );

    if (!result) {
      return;
    }

    setSecretPanel({
      description: "Copy this workspace API key before closing the panel.",
      title: `${result.key.label} secret`,
      value: result.secret,
    });
    await refreshAccessKeys();
  }

  async function revealNodeJoinCommand(row: NodeEnrollmentKey) {
    const result = await runKeyAction(
      `node-secret:${row.id}`,
      () =>
        requestJson<{ secret: string }>(
          `/api/fugue/node-keys/${encodeURIComponent(row.id)}/secret`,
          {
            cache: "no-store",
          },
        ),
    );

    if (!result || !ready) {
      return;
    }

    setSecretPanel({
      description: "Run this command on the VPS you want to attach to this workspace.",
      title: `${row.label} join command`,
      value: buildNodeJoinCommand(ready.apiBaseUrl, result.secret),
    });
  }

  async function createNodeKey() {
    const label = nodeLabel.trim();
    const result = await runKeyAction(
      "node-create",
      () =>
        requestJson<{ key: NodeEnrollmentKey; secret: string }>("/api/fugue/node-keys", {
          body: JSON.stringify(label ? { label } : {}),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
    );

    if (!result || !ready) {
      return;
    }

    setCreateNodeOpen(false);
    setNodeLabel("");
    setSecretPanel({
      description: "Run this command on the VPS you want to attach to this workspace.",
      title: `${result.key.label} join command`,
      value: buildNodeJoinCommand(ready.apiBaseUrl, result.secret),
    });
    await refreshAccessKeys();
  }

  async function saveNodeRename() {
    if (!renameNode) {
      return;
    }

    const result = await runKeyAction(
      `node-rename:${renameNode.id}`,
      () =>
        requestJson<{ key: NodeEnrollmentKey }>(
          `/api/fugue/node-keys/${encodeURIComponent(renameNode.id)}`,
          {
            body: JSON.stringify({ label: renameLabel }),
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            method: "PATCH",
          },
        ),
    );

    if (!result) {
      return;
    }

    setRenameNode(null);
    setRenameLabel("");
    await refreshAccessKeys();
    toast.notify("Node key renamed.");
  }

  async function revokeNodeKey(row: NodeEnrollmentKey) {
    const result = await runKeyAction(
      `node-revoke:${row.id}`,
      () =>
        requestJson<{ key: NodeEnrollmentKey }>(
          `/api/fugue/node-keys/${encodeURIComponent(row.id)}/revoke`,
          {
            cache: "no-store",
            method: "POST",
          },
        ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify("Node key revoked.");
  }

  async function runConfirm() {
    const nextConfirm = confirm;

    if (!nextConfirm) {
      return;
    }

    await nextConfirm.action();
    setConfirm(null);
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        {error ? (
          <Alert tone="destructive" title="Fugue could not load access keys right now.">
            {error}
          </Alert>
        ) : null}
        {actionError ? (
          <Alert tone="destructive" title="The access key operation failed.">
            {actionError}
          </Alert>
        ) : null}
        {initialLoading ? (
          <>
            <CardFrame>
              <CardHeader title="Workspace API keys" description="Loading workspace access keys." />
              <CardContent className="coss-stack-sm">
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
              </CardContent>
            </CardFrame>
            <CardFrame>
              <CardHeader title="Node enrollment keys" description="Loading reusable VPS enrollment keys." />
              <CardContent className="coss-stack-sm">
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
              </CardContent>
            </CardFrame>
          </>
        ) : data?.state === "workspace-missing" ? (
          <CardFrame>
            <CardContent>
              <Empty
                title="Workspace is not ready"
                description="Create or open a Fugue workspace before managing API keys and node enrollment keys."
              />
            </CardContent>
          </CardFrame>
        ) : ready ? (
          <>
            {ready.apiKeys.syncError ? (
              <Alert tone="warning" title="Showing stored API key metadata while live sync is unavailable.">
                {ready.apiKeys.syncError}
              </Alert>
            ) : null}
            {ready.nodeKeys.syncError ? (
              <Alert tone="warning" title="Showing stored node key metadata while live sync is unavailable.">
                {ready.nodeKeys.syncError}
              </Alert>
            ) : null}
            <WorkspaceApiKeyTable
              keys={ready.apiKeys.keys}
              busy={busy}
              onDelete={(row) =>
                setConfirm({
                  action: () => deleteApiKey(row),
                  confirmLabel: "Delete key",
                  description: `${row.label} will stop working for API and CLI calls.`,
                  title: "Delete API key?",
                })
              }
              onProvision={provisionWorkspaceKey}
              onReveal={revealApiKeySecret}
              onRotate={rotateApiKey}
              onToggle={toggleApiKey}
            />
            <NodeEnrollmentKeyTable
              keys={ready.nodeKeys.keys}
              busy={busy}
              onCreate={() => setCreateNodeOpen(true)}
              onReveal={revealNodeJoinCommand}
              onRename={(row) => {
                setRenameNode(row);
                setRenameLabel(row.label);
              }}
              onRevoke={(row) =>
                setConfirm({
                  action: () => revokeNodeKey(row),
                  confirmLabel: "Revoke key",
                  description: `${row.label} will no longer enroll new VPS nodes. Existing attached nodes are not renamed here.`,
                  title: "Revoke node key?",
                })
              }
            />
          </>
        ) : null}
      </div>
      <Drawer
        title="Create node enrollment key"
        description="Create a reusable key for attaching a VPS to this workspace."
        open={createNodeOpen}
        onClose={() => setCreateNodeOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateNodeOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy === "node-create"} onClick={createNodeKey}>
              Create node key
            </Button>
          </>
        }
      >
        <div className="coss-form">
          <Field label="Name" help="Leave blank to let Fugue generate the node key label.">
            <input
              className="coss-input"
              value={nodeLabel}
              onChange={(event) => setNodeLabel(event.target.value)}
              placeholder="node"
            />
          </Field>
        </div>
      </Drawer>
      <Drawer
        title="Rename node key"
        description={renameNode ? `Update the display name for ${renameNode.id}.` : undefined}
        open={Boolean(renameNode)}
        onClose={() => setRenameNode(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameNode(null)}>
              Cancel
            </Button>
            <Button
              loading={renameNode ? busy === `node-rename:${renameNode.id}` : false}
              disabled={!renameLabel.trim()}
              onClick={saveNodeRename}
            >
              Save name
            </Button>
          </>
        }
      >
        <div className="coss-form">
          <Field label="Name">
            <input
              className="coss-input"
              value={renameLabel}
              onChange={(event) => setRenameLabel(event.target.value)}
            />
          </Field>
        </div>
      </Drawer>
      <Drawer
        title={secretPanel?.title ?? ""}
        description={secretPanel?.description}
        open={Boolean(secretPanel)}
        onClose={() => setSecretPanel(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setSecretPanel(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (secretPanel) {
                  copyText(secretPanel.value, toast.notify);
                }
              }}
            >
              <Copy aria-hidden="true" />
              Copy
            </Button>
          </>
        }
      >
        {secretPanel ? <CodeBlock>{secretPanel.value}</CodeBlock> : null}
      </Drawer>
      <Dialog
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        open={Boolean(confirm)}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        confirmLoading={Boolean(confirm && busy !== null)}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function WorkspaceApiKeyTable({
  keys,
  busy,
  onDelete,
  onProvision,
  onReveal,
  onRotate,
  onToggle,
}: {
  keys: WorkspaceApiKey[];
  busy: string | null;
  onDelete: (row: WorkspaceApiKey) => void;
  onProvision: () => void;
  onReveal: (row: WorkspaceApiKey) => void;
  onRotate: (row: WorkspaceApiKey) => void;
  onToggle: (row: WorkspaceApiKey) => void;
}) {
  return (
    <CardFrame>
      <CardHeader
        title="Workspace API keys"
        description="Real Fugue API keys for this workspace. Workspace admin keys are protected from disable/delete."
        action={
          !keys.length ? (
            <Button loading={busy === "api-create"} onClick={onProvision}>
              Provision workspace key
            </Button>
          ) : null
        }
      />
      <CardContent>
        {!keys.length ? (
          <Empty
            title="No API keys"
            description="Provision the workspace admin key before using the Fugue CLI or API from this account."
          />
        ) : null}
        <DataTable
          columns={["Name", "Scopes", "Status", "Last used", "Actions"]}
          rows={keys}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                <div className="coss-help coss-mono">
                  {row.prefix ? `${row.prefix}...` : row.id}
                </div>
              </td>
              <td className="coss-mono">{formatKeyScopes(row.scopes)}</td>
              <td>
                <span className="coss-row">
                  <Badge tone={keyStatusTone(row.status)}>{row.status}</Badge>
                  {row.isWorkspaceAdmin ? <Badge tone="info">workspace admin</Badge> : null}
                </span>
              </td>
              <td>{formatKeyTimestamp(row.lastUsedAt)}</td>
              <td className="coss-table__actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canCopy}
                  loading={busy === `api-secret:${row.id}`}
                  aria-label={`Copy secret for ${row.label}`}
                  onClick={() => onReveal(row)}
                >
                  Copy secret
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === `api-rotate:${row.id}`}
                  aria-label={`Rotate ${row.label}`}
                  onClick={() => onRotate(row)}
                >
                  Rotate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canDisable}
                  loading={busy === `api-toggle:${row.id}`}
                  aria-label={`${row.status === "disabled" ? "Enable" : "Disable"} ${row.label}`}
                  onClick={() => onToggle(row)}
                >
                  {row.status === "disabled" ? "Enable" : "Disable"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!row.canDelete}
                  loading={busy === `api-delete:${row.id}`}
                  aria-label={`Delete ${row.label}`}
                  onClick={() => onDelete(row)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          )}
        />
      </CardContent>
    </CardFrame>
  );
}

function NodeEnrollmentKeyTable({
  keys,
  busy,
  onCreate,
  onReveal,
  onRename,
  onRevoke,
}: {
  keys: NodeEnrollmentKey[];
  busy: string | null;
  onCreate: () => void;
  onReveal: (row: NodeEnrollmentKey) => void;
  onRename: (row: NodeEnrollmentKey) => void;
  onRevoke: (row: NodeEnrollmentKey) => void;
}) {
  return (
    <CardFrame>
      <CardHeader
        title="Node enrollment keys"
        description="Reusable tenant runtime keys used by VPS nodes attached to this workspace."
        action={<Button onClick={onCreate}>Create node key</Button>}
      />
      <CardContent>
        {!keys.length ? (
          <Empty
            title="No node keys"
            description="Create a node key, copy the join command, and run it on a VPS."
            action={<Button onClick={onCreate}>Create node key</Button>}
          />
        ) : null}
        <DataTable
          columns={["Name", "Prefix", "Attached VPS", "Status", "Last used", "Actions"]}
          rows={keys}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                <div className="coss-help coss-mono">{row.id}</div>
              </td>
              <td className="coss-mono">{row.prefix ? `${row.prefix}...` : "Unavailable"}</td>
              <td>{formatAttachedVpsCount(row.attachedVpsCount)}</td>
              <td><Badge tone={keyStatusTone(row.status)}>{row.status}</Badge></td>
              <td>{formatKeyTimestamp(row.lastUsedAt)}</td>
              <td className="coss-table__actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canCopy}
                  loading={busy === `node-secret:${row.id}`}
                  aria-label={`Copy join command for ${row.label}`}
                  onClick={() => onReveal(row)}
                >
                  Copy join command
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={row.status !== "active"}
                  loading={busy === `node-rename:${row.id}`}
                  aria-label={`Rename ${row.label}`}
                  onClick={() => onRename(row)}
                >
                  Rename
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!row.canRevoke}
                  loading={busy === `node-revoke:${row.id}`}
                  aria-label={`Revoke ${row.label}`}
                  onClick={() => onRevoke(row)}
                >
                  Revoke
                </Button>
              </td>
            </tr>
          )}
        />
      </CardContent>
    </CardFrame>
  );
}

type ClusterNodesReadySnapshot = Extract<
  ConsoleClusterNodesPageSnapshot,
  { state: "ready" }
>;
type ClusterNodeRow = ClusterNodesReadySnapshot["data"]["nodes"][number] & {
  id: string;
};
type OfflineServerRow = ClusterNodesReadySnapshot["data"]["offlineServers"][number] & {
  id: string;
};

function findNodeResource(
  node: ClusterNodesReadySnapshot["data"]["nodes"][number],
  id: "cpu" | "memory" | "storage",
) {
  return node.resources.find((resource) => resource.id === id) ?? null;
}

export function ServersConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleClusterNodesPageSnapshot>(
      CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
      {
        ttlMs: 15_000,
      },
    );
  const [drawer, setDrawer] = useState<ClusterNodeRow | null>(null);
  const [query, setQuery] = useState("");
  const ready = data?.state === "ready" ? data : null;
  const normalizedQuery = query.trim().toLowerCase();
  const rows: ClusterNodeRow[] = (ready?.data.nodes ?? [])
    .map((node) => ({
      ...node,
      id: node.name,
    }))
    .filter((node) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        node.name,
        node.runtimeLabel,
        node.ownerLabel,
        node.locationLabel,
        ...node.roleLabels,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  const offlineRows: OfflineServerRow[] = (ready?.data.offlineServers ?? []).map((server) => ({
    ...server,
    id: server.runtimeId,
  }));

  return (
    <>
      <div className="coss-stack">
        {error ? (
          <Alert tone="destructive" title="Servers unavailable">
            {error}
          </Alert>
        ) : null}
        {data?.state === "workspace-missing" ? (
          <Empty title="Workspace is not ready" description="Create or open a Fugue workspace before viewing runtime servers." />
        ) : null}
        {loading && !ready ? (
          <div className="coss-stack-sm">
            <SkeletonBlock height={72} />
            <SkeletonBlock height={220} />
          </div>
        ) : null}
        {ready ? (
          <>
        <MetricStrip items={[
          { label: "Servers", value: String(ready.data.summary.nodeCount) },
          { label: "Ready", value: String(ready.data.summary.readyCount), tone: "success" },
          { label: "Offline", value: String(ready.data.summary.offlineCount), tone: ready.data.summary.offlineCount ? "warning" : undefined },
          { label: "Workloads", value: String(ready.data.summary.workloadCount) },
        ]} />
        {ready.data.errors.length ? (
          <Alert tone="warning" title="Server inventory partially loaded">
            {ready.data.errors.join(" · ")}
          </Alert>
        ) : null}
        <CardFrame>
          <CardHeader
            title="Runtime servers"
            description="Heartbeat, roles, pressure signals, capacity, workloads, and runtime access."
            action={
              <ButtonLink href="/app/api-keys" variant="outline" size="sm">
                Open node keys
              </ButtonLink>
            }
          />
          <CardContent className="coss-stack">
            <input className="coss-input" placeholder="Search node" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 260 }} />
            {rows.length ? (
              <DataTable
                columns={["Server", "Role", "Ready", "CPU", "Memory", "Actions"]}
                rows={rows}
                renderRow={(row) => {
                  const cpu = findNodeResource(row, "cpu");
                  const memory = findNodeResource(row, "memory");

                  return (
                  <tr key={row.id}>
                    <td>
                      <strong className="coss-mono">{row.name}</strong>
                      <div className="coss-help">{row.locationLabel} · {row.runtimeLabel}</div>
                    </td>
                    <td>{row.roleLabels.join(", ") || "runtime"}</td>
                    <td>
                      <span className="coss-row">
                        <Badge tone={badgeToneFromConsoleTone(row.statusTone)}>{row.statusLabel}</Badge>
                        <Badge tone="info">{row.poolMode ?? row.ownership}</Badge>
                      </span>
                    </td>
                    <td><Meter label="cpu" value={cpu?.percentValue ?? 0} /></td>
                    <td><Meter label="memory" value={memory?.percentValue ?? 0} /></td>
                    <td className="coss-table__actions">
                      <Button variant="outline" size="sm" aria-label={`Server details ${row.name}`} onClick={() => setDrawer(row)}>Details</Button>
                    </td>
                  </tr>
                );
                }}
              />
            ) : (
              <Empty title="No servers found" description="Clear the search query or attach a new runtime node." />
            )}
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Offline servers" description="Runtime records that Fugue reports as offline." />
          <CardContent className="coss-stack">
            {offlineRows.length ? (
              <DataTable
                columns={["Server", "Runtime", "Last contact", "Status"]}
                rows={offlineRows}
                renderRow={(row) => (
                  <tr key={row.id}>
                    <td className="coss-mono">{row.name}</td>
                    <td>{row.runtimeLabel}</td>
                    <td>{row.lastContactLabel}</td>
                    <td><Badge tone={badgeToneFromConsoleTone(row.statusTone)}>{row.statusLabel}</Badge></td>
                  </tr>
                )}
              />
            ) : (
              <Empty title="No offline servers" description="Fugue is not reporting stale runtime server records for this workspace." />
            )}
          </CardContent>
        </CardFrame>
          </>
        ) : null}
      </div>
      <Drawer title={drawer?.id ?? ""} description="Runtime access and pressure details." open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        {drawer ? (
          <div className="coss-stack">
            <MetricStrip items={[
              { label: "Apps", value: String(drawer.appCount) },
              { label: "Services", value: String(drawer.serviceCount) },
              { label: "Workloads", value: String(drawer.workloadCount) },
              { label: "Heartbeat", value: drawer.heartbeatLabel },
            ]} />
            {drawer.resources.map((resource) => (
              <Card key={resource.id} muted>
                <CardContent className="coss-stack-sm">
                  <strong>{resource.label}</strong>
                  <Meter label={resource.label} value={resource.percentValue ?? 0} />
                  <p className="coss-card-description">{resource.detailLabel}</p>
                  <p className="coss-help">{resource.requestLabel}</p>
                </CardContent>
              </Card>
            ))}
            <CodeBlock>{JSON.stringify({
              accessMode: drawer.accessMode,
              internalIp: drawer.internalIpLabel,
              machine: drawer.machineLabel,
              owner: drawer.ownerLabel,
              publicIp: drawer.publicIpLabel,
              runtimeId: drawer.runtimeId,
              runtimeStatus: drawer.runtimeStatusLabel,
              zone: drawer.zoneLabel,
            }, null, 2)}</CodeBlock>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

type ProfileAuthMethod = ConsoleProfileSettingsPageSnapshot["methods"][number];
type ProfileAuthMethodKind = ProfileAuthMethod["method"];

const PROFILE_AUTH_METHODS: ProfileAuthMethodKind[] = [
  "google",
  "github",
  "email_link",
  "password",
];

function profileMethodLabel(method: ProfileAuthMethodKind) {
  switch (method) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "email_link":
      return "Email link";
    case "password":
      return "Password";
  }
}

function profileMethodSlug(method: ProfileAuthMethodKind) {
  return method === "email_link" ? "email-link" : method;
}

function displayNameFromProfile(
  snapshot: ConsoleProfileSettingsPageSnapshot | null,
) {
  return (
    snapshot?.user.name?.trim() ||
    snapshot?.session.name?.trim() ||
    snapshot?.session.email?.split("@")[0] ||
    ""
  );
}

export function ProfileSecurity() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleProfileSettingsPageSnapshot>(
      CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
    );
  const toast = useToast();
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [methodAction, setMethodAction] = useState<ProfileAuthMethodKind | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [passwordDrawer, setPasswordDrawer] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || dirty) {
      return;
    }

    setName(displayNameFromProfile(data));
  }, [data, dirty]);

  const activeMethods = data?.methods ?? [];
  const activeMethodSet = useMemo(
    () => new Set(activeMethods.map((method) => method.method)),
    [activeMethods],
  );
  const hasPassword = activeMethods.some(
    (method) => method.method === "password" && method.hasSecret,
  );
  const email = data?.session.email ?? "";
  const initialProfileLoading = loading && !data;

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);

    try {
      await requestJson<{ ok: boolean; user: ConsoleProfileSettingsPageSnapshot["user"] }>(
        "/api/auth/profile",
        {
          body: JSON.stringify({ name }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      setDirty(false);
      await refresh({ force: true });
      toast.notify("Profile saved.");
    } catch (nextError) {
      setProfileError(readRequestError(nextError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function disconnectMethod(method: ProfileAuthMethodKind) {
    setMethodAction(method);
    setMethodError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        `/api/auth/methods/${profileMethodSlug(method)}`,
        {
          cache: "no-store",
          method: "DELETE",
        },
      );
      await refresh({ force: true });
      toast.notify(`${profileMethodLabel(method)} disconnected.`);
    } catch (nextError) {
      setMethodError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  async function enableEmailLink() {
    setMethodAction("email_link");
    setMethodError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        "/api/auth/methods/email-link",
        {
          cache: "no-store",
          method: "POST",
        },
      );
      await refresh({ force: true });
      toast.notify("Email link enabled.");
    } catch (nextError) {
      setMethodError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  async function savePassword() {
    setMethodAction("password");
    setPasswordError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        "/api/auth/methods/password",
        {
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      setCurrentPassword("");
      setNewPassword("");
      setPasswordDrawer(false);
      await refresh({ force: true });
      toast.notify(hasPassword ? "Password updated." : "Password added.");
    } catch (nextError) {
      setPasswordError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  function connectMethod(method: ProfileAuthMethodKind) {
    if (method === "google" || method === "github") {
      window.location.href = `/api/auth/${method}/link/start?returnTo=${encodeURIComponent("/app/settings/profile")}`;
      return;
    }

    if (method === "email_link") {
      void enableEmailLink();
      return;
    }

    setPasswordDrawer(true);
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-split">
        <CardFrame>
          <CardHeader title="Profile" description="Display name, account email, and active session." />
          <CardContent className="coss-form">
            {error ? (
              <Alert tone="destructive" title="Fugue could not load the profile settings right now.">
                {error}
              </Alert>
            ) : null}
            {profileError ? (
              <Alert tone="destructive" title="Could not update your profile.">
                {profileError}
              </Alert>
            ) : null}
            {initialProfileLoading ? (
              <div className="coss-stack-sm" aria-label="Loading profile settings">
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
                <SkeletonBlock height={42} />
              </div>
            ) : data ? (
              <>
                <Field label="Display name">
                  <input
                    className="coss-input"
                    value={name}
                    onChange={(event) => {
                      setDirty(true);
                      setName(event.target.value);
                    }}
                    placeholder={email ? email.split("@")[0] : "Display name"}
                  />
                </Field>
                <Field label="Email">
                  <input className="coss-input" value={email} disabled />
                </Field>
                <Button
                  disabled={!data || name.trim().length > 80}
                  loading={savingProfile}
                  onClick={saveProfile}
                >
                  {savingProfile ? null : <Save aria-hidden="true" />}
                  Save profile
                </Button>
              </>
            ) : null}
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Sign-in methods" description="At least one method must remain active." />
          <CardContent className="coss-stack">
            {methodError ? (
              <Alert tone="destructive" title="Could not update sign-in methods.">
                {methodError}
              </Alert>
            ) : null}
            {initialProfileLoading ? (
              <div className="coss-stack-sm" aria-label="Loading sign-in methods">
                <SkeletonBlock height={38} />
                <SkeletonBlock height={38} />
                <SkeletonBlock height={38} />
              </div>
            ) : data && activeMethods.length ? (
              activeMethods.map((method) => (
                <div key={method.method} className="coss-row" style={{ justifyContent: "space-between" }}>
                  <span>{profileMethodLabel(method.method)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeMethods.length === 1}
                    loading={methodAction === method.method}
                    onClick={() => disconnectMethod(method.method)}
                  >
                    Disconnect
                  </Button>
                </div>
              ))
            ) : data ? (
              <Alert tone="warning" title="No sign-in method is recorded.">
                Enable email link or connect an OAuth provider before leaving this page.
              </Alert>
            ) : null}
            {data ? (
              <div className="coss-grid-2">
                {PROFILE_AUTH_METHODS.filter((method) => !activeMethodSet.has(method)).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    disabled={
                      (method === "google" && !data.availableMethods.google) ||
                      (method === "github" && !data.availableMethods.github)
                    }
                    loading={methodAction === method}
                    onClick={() => connectMethod(method)}
                  >
                    Connect / enable {profileMethodLabel(method)}
                  </Button>
                ))}
                {activeMethodSet.has("password") ? (
                  <Button variant="outline" onClick={() => setPasswordDrawer(true)}>
                    Update password
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <Drawer
        title={hasPassword ? "Update password" : "Add password"}
        description="Password access is stored on this account and protected by the active session."
        open={passwordDrawer}
        onClose={() => setPasswordDrawer(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordDrawer(false)}>
              Cancel
            </Button>
            <Button
              loading={methodAction === "password"}
              disabled={!newPassword}
              onClick={savePassword}
            >
              {hasPassword ? "Update password" : "Add password"}
            </Button>
          </>
        }
      >
        <div className="coss-form">
          {passwordError ? (
            <Alert tone="destructive" title="Could not save password.">
              {passwordError}
            </Alert>
          ) : null}
          {hasPassword ? (
            <Field label="Current password">
              <input
                className="coss-input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label="New password">
            <input
              className="coss-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
        </div>
      </Drawer>
    </>
  );
}

type AdminConfirmOperation = {
  body?: unknown;
  confirmLabel?: string;
  description: string;
  endpoint: string;
  method: "DELETE" | "PATCH" | "POST";
  successMessage: string;
  title: string;
};

type AdminAppView = ConsoleAdminAppsPageSnapshot["apps"][number];
type AdminUserView = ConsoleAdminUsersPageSnapshot["users"][number];
type AdminClusterNodeView = ConsoleAdminClusterPageSnapshot["nodes"][number];
type AdminClusterNodeRow = AdminClusterNodeView & { id: string };
type ClusterPolicyDraft = {
  allowBuilds: boolean;
  allowDns: boolean;
  allowEdge: boolean;
  allowSharedPool: boolean;
};

function adminValue(value: string | null | undefined, fallback = "Unavailable") {
  return value?.trim() ? value : fallback;
}

function matchesAdminQuery(
  query: string,
  values: Array<boolean | number | string | null | undefined>,
) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return values
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function requestAdminOperation(operation: AdminConfirmOperation) {
  const init: RequestInit = {
    cache: "no-store",
    method: operation.method,
  };

  if (operation.body !== undefined) {
    init.body = JSON.stringify(operation.body);
    init.headers = {
      "Content-Type": "application/json",
    };
  }

  return requestJson<unknown>(operation.endpoint, init);
}

function AdminSnapshotErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <Alert tone="warning" title="Snapshot partially loaded">
      {errors.join(" · ")}
    </Alert>
  );
}

function DetailMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card muted>
      <CardContent className="coss-stack-sm">
        <span className="coss-help">{label}</span>
        <strong className={mono ? "coss-mono" : undefined}>{value}</strong>
      </CardContent>
    </Card>
  );
}

function CompactResourceUsage({
  items,
  emptyLabel = "No usage stats",
}: {
  items: ConsoleCompactResourceItemView[];
  emptyLabel?: string;
}) {
  const visibleItems = items
    .filter((item) => item.primaryLabel.trim())
    .slice(0, 3);

  if (visibleItems.length === 0) {
    return <span className="coss-muted">{emptyLabel}</span>;
  }

  return (
    <div className="coss-project-usage" aria-label="Resource usage">
      {visibleItems.map((item) => (
        <span key={item.id} title={item.title}>
          <span>{item.label}</span>
          <strong>{item.primaryLabel}</strong>
        </span>
      ))}
    </div>
  );
}

function ClusterResourceMeters({ node }: { node: AdminClusterNodeView }) {
  if (node.resources.length === 0) {
    return <span className="coss-muted">No telemetry</span>;
  }

  return (
    <div className="coss-stack-sm">
      {node.resources.slice(0, 3).map((resource) => (
        <Meter
          key={resource.id}
          label={`${resource.label} ${resource.percentLabel}`}
          value={resource.percentValue ?? 0}
        />
      ))}
    </div>
  );
}

export function AdminAppsConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminAppsPageSnapshot>(
      CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
    );
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("all");
  const [drawer, setDrawer] = useState<AdminAppView | null>(null);
  const [operation, setOperation] = useState<AdminConfirmOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const apps = data?.apps ?? [];
  const summary = data?.summary;
  const phases = useMemo(
    () => Array.from(new Set(apps.map((app) => app.phase).filter(Boolean))).sort(),
    [apps],
  );
  const rows = useMemo(
    () =>
      apps.filter((app) => {
        const matchesPhase = phase === "all" || app.phase === phase;
        return (
          matchesPhase &&
          matchesAdminQuery(query, [
            app.id,
            app.name,
            app.ownerLabel,
            app.phase,
            app.projectLabel,
            app.routeLabel,
            app.serverLabel,
            app.sourceLabel,
            ...app.stack.map((item) => `${item.label} ${item.meta}`),
          ])
        );
      }),
    [apps, phase, query],
  );

  async function refreshApps() {
    setRefreshing(true);
    setOperationError(null);
    invalidateConsolePageSnapshot(CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL);

    try {
      await refresh({ force: true });
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmOperation() {
    if (!operation) {
      return;
    }

    setOperating(true);
    setOperationError(null);

    try {
      await requestAdminOperation(operation);
      invalidateConsolePageSnapshot(CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL);
      await refresh({ force: true });
      toast.notify(operation.successMessage);
      setOperation(null);
      setDrawer(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setOperating(false);
    }
  }

  function queueAppOperation(app: AdminAppView, kind: "delete" | "rebuild") {
    const encodedId = encodeURIComponent(app.id);

    if (kind === "rebuild") {
      setOperation({
        confirmLabel: "Rebuild",
        description: `${app.name} will be queued for a new build through Fugue.`,
        endpoint: `/api/admin/apps/${encodedId}/rebuild`,
        method: "POST",
        successMessage: `Rebuild queued for ${app.name}`,
        title: `Rebuild ${app.name}`,
      });
      return;
    }

    setOperation({
      confirmLabel: "Delete",
      description: `${app.name} will be deleted from Fugue. This cannot be undone from the console.`,
      endpoint: `/api/admin/apps/${encodedId}`,
      method: "DELETE",
      successMessage: `${app.name} deleted`,
      title: `Delete ${app.name}`,
    });
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Apps", value: String(summary?.appCount ?? apps.length) },
            {
              label: "Routed",
              tone: "success",
              value: String(
                summary?.routedCount ??
                  apps.filter((app) => Boolean(app.routeHref)).length,
              ),
            },
            {
              label: "Tenants",
              value: String(
                summary?.tenantCount ??
                  new Set(apps.map((app) => app.ownerLabel)).size,
              ),
            },
            {
              label: "Latest update",
              tone: summary?.latestUpdateLabel ? "info" : undefined,
              value: summary?.latestUpdateLabel ?? (loading ? "Loading" : "None"),
            },
          ]}
        />
        <CardFrame>
          <CardHeader
            title="Applications"
            description="Live cluster-wide app inventory, route placement, resource usage, rebuild, and deletion."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => {
                  void refreshApps();
                }}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <input
                aria-label="Search apps"
                className="coss-input"
                placeholder="Search app, owner, route, runtime"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ width: 300 }}
              />
              <select
                aria-label="Filter app phase"
                className="coss-select"
                value={phase}
                onChange={(event) => setPhase(event.target.value)}
                style={{ width: 180 }}
              >
                <option value="all">All phases</option>
                {phases.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {operationError ? (
              <Alert tone="destructive" title="Admin operation failed">
                {operationError}
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="destructive" title="Applications unavailable">
                {error}
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} />

            {loading && !data ? (
              <div className="coss-stack-sm" aria-label="Loading applications">
                <SkeletonBlock height={44} />
                <SkeletonBlock height={48} />
                <SkeletonBlock height={48} />
              </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty
                title={apps.length === 0 ? "No applications found" : "No applications match this filter"}
                description={apps.length === 0 ? "Fugue returned an empty cluster application inventory." : "Clear search or change the phase filter."}
              />
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={["App", "Owner", "Phase", "Route", "Runtime", "Usage", "Actions"]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.name}</strong>
                        <span className="coss-help coss-mono">{row.id}</span>
                        <span className="coss-help">{row.projectLabel} · {row.createdLabel}</span>
                      </div>
                    </td>
                    <td>{row.ownerLabel}</td>
                    <td>
                      <Badge tone={badgeToneFromConsoleTone(row.phaseTone)}>
                        {row.phase}
                      </Badge>
                    </td>
                    <td>
                      {row.routeHref ? (
                        <ButtonLink href={row.routeHref} variant="ghost" size="sm" target="_blank">
                          {row.routeLabel}
                        </ButtonLink>
                      ) : (
                        <span className="coss-muted">{row.routeLabel}</span>
                      )}
                    </td>
                    <td className="coss-mono">{row.serverLabel}</td>
                    <td>
                      <CompactResourceUsage items={row.resourceUsage} />
                    </td>
                    <td className="coss-table__actions">
                      <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!row.canRebuild || operating}
                        onClick={() => queueAppOperation(row, "rebuild")}
                      >
                        Rebuild
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={operating}
                        onClick={() => queueAppOperation(row, "delete")}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <Drawer
        title={drawer?.name ?? ""}
        description={drawer?.id}
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Owner" value={drawer.ownerLabel} />
              <DetailMetric label="Project" value={drawer.projectLabel} />
              <DetailMetric label="Runtime" value={drawer.serverLabel} mono />
              <DetailMetric label="Created" value={drawer.createdLabel} />
            </div>
            <Card muted>
              <CardContent className="coss-stack-sm">
                <span className="coss-help">Source</span>
                {drawer.sourceHref ? (
                  <ButtonLink href={drawer.sourceHref} variant="outline" size="sm" target="_blank">
                    {drawer.sourceLabel}
                  </ButtonLink>
                ) : (
                  <strong>{drawer.sourceLabel}</strong>
                )}
              </CardContent>
            </Card>
            <CompactResourceUsage items={drawer.resourceUsage} />
            {drawer.stack.length ? (
              <div className="coss-row" aria-label="Tech stack">
                {drawer.stack.map((item) => (
                  <Badge key={item.id} tone="info">
                    {item.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
      <Dialog
        title={operation?.title ?? ""}
        description={operation?.description ?? ""}
        open={Boolean(operation)}
        confirmDisabled={operating}
        confirmLabel={operation?.confirmLabel ?? "Confirm"}
        confirmLoading={operating}
        onConfirm={() => {
          void confirmOperation();
        }}
        onClose={() => {
          if (!operating) {
            setOperation(null);
          }
        }}
      />
    </>
  );
}

export function AdminUsersConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
    );
  const [drawer, setDrawer] = useState<AdminUserView | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [operation, setOperation] = useState<AdminConfirmOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const users = data?.users ?? [];
  const rows = useMemo(
    () =>
      users
        .filter((user) => {
          const normalizedStatus = user.status.trim().toLowerCase();
          const matchesStatus =
            status === "all" ||
            (status === "admin" && user.isAdmin) ||
            normalizedStatus === status;
          return (
            matchesStatus &&
            matchesAdminQuery(query, [
              user.email,
              user.name,
              user.provider,
              user.status,
              user.workspace?.tenantName,
              user.workspace?.defaultProjectName,
              user.billing.statusLabel,
              user.billing.limitLabel,
            ])
          );
        })
        .map((user) => ({
          ...user,
          id: user.email,
        })),
    [query, status, users],
  );

  async function refreshUsers() {
    setRefreshing(true);
    setOperationError(null);
    invalidateConsolePageSnapshot(CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL);

    try {
      await refresh({ force: true });
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmOperation() {
    if (!operation) {
      return;
    }

    setOperating(true);
    setOperationError(null);

    try {
      await requestAdminOperation(operation);
      invalidateConsolePageSnapshot(CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL);
      await refresh({ force: true });
      toast.notify(operation.successMessage);
      setOperation(null);
      setDrawer(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setOperating(false);
    }
  }

  function queueUserOperation(user: AdminUserView, kind: "block" | "delete" | "demote" | "promote" | "unblock") {
    const encodedEmail = encodeURIComponent(user.email);
    const baseEndpoint = `/api/admin/users/${encodedEmail}`;
    const titleName = user.name || user.email;

    if (kind === "promote") {
      setOperation({
        confirmLabel: "Promote",
        description: `${user.email} will receive administrator permissions.`,
        endpoint: `${baseEndpoint}/admin`,
        method: "POST",
        successMessage: `${titleName} promoted to admin`,
        title: `Promote ${titleName}`,
      });
      return;
    }

    if (kind === "demote") {
      setOperation({
        confirmLabel: "Demote",
        description: `${user.email} will lose administrator permissions. Last-admin protection is enforced by the server.`,
        endpoint: `${baseEndpoint}/admin`,
        method: "DELETE",
        successMessage: `${titleName} demoted`,
        title: `Demote ${titleName}`,
      });
      return;
    }

    if (kind === "block") {
      setOperation({
        confirmLabel: "Block",
        description: `${user.email} will be blocked from the product.`,
        endpoint: `${baseEndpoint}/block`,
        method: "POST",
        successMessage: `${titleName} blocked`,
        title: `Block ${titleName}`,
      });
      return;
    }

    if (kind === "unblock") {
      setOperation({
        confirmLabel: "Unblock",
        description: `${user.email} will be restored to active status.`,
        endpoint: `${baseEndpoint}/unblock`,
        method: "POST",
        successMessage: `${titleName} unblocked`,
        title: `Unblock ${titleName}`,
      });
      return;
    }

    setOperation({
      confirmLabel: "Delete",
      description: `${user.email} will be marked deleted. This action is destructive.`,
      endpoint: baseEndpoint,
      method: "DELETE",
      successMessage: `${titleName} deleted`,
      title: `Delete ${titleName}`,
    });
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Users", value: String(data?.summary.userCount ?? users.length) },
            { label: "Admins", tone: "warning", value: String(data?.summary.adminCount ?? users.filter((user) => user.isAdmin).length) },
            { label: "Blocked", tone: "destructive", value: String(data?.summary.blockedCount ?? users.filter((user) => user.status === "blocked").length) },
            { label: "Deleted", value: String(data?.summary.deletedCount ?? users.filter((user) => user.status === "deleted").length) },
          ]}
        />
        <CardFrame>
          <CardHeader
            title="Users"
            description="Live user directory, workspace ownership, billing state, admin permissions, blocking, and deletion."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => {
                  void refreshUsers();
                }}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <input
                aria-label="Search users"
                className="coss-input"
                placeholder="Search users, workspace, billing"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ width: 300 }}
              />
              <select
                aria-label="Filter users"
                className="coss-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                style={{ width: 180 }}
              >
                <option value="all">All users</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="deleted">Deleted</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {data?.enrichmentState === "pending" ? (
              <Alert tone="info" title="Usage enrichment in progress">
                User billing and service usage may update after the background snapshot finishes.
              </Alert>
            ) : null}
            {operationError ? (
              <Alert tone="destructive" title="Admin operation failed">
                {operationError}
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="destructive" title="Users unavailable">
                {error}
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} />

            {loading && !data ? (
              <div className="coss-stack-sm" aria-label="Loading users">
                <SkeletonBlock height={44} />
                <SkeletonBlock height={48} />
                <SkeletonBlock height={48} />
              </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty
                title={users.length === 0 ? "No users found" : "No users match this filter"}
                description={users.length === 0 ? "Fugue returned an empty user directory." : "Clear search or change the user filter."}
              />
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={["User", "Status", "Admin", "Usage", "Billing", "Actions"]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.email}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.name || row.email}</strong>
                        <span className="coss-help">{row.email}</span>
                        <span className="coss-help">{row.provider} · {row.verified ? "verified" : "unverified"}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={badgeToneFromConsoleTone(row.statusTone)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={row.isAdmin ? "warning" : "default"}>
                        {row.isAdmin ? "admin" : "member"}
                      </Badge>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.usage.serviceCountLabel}</strong>
                        <span className="coss-help">{row.usage.cpuLabel} · {row.usage.memoryLabel}</span>
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.billing.limitLabel}</strong>
                        <span className="coss-help">{adminValue(row.billing.balanceLabel ?? row.billing.statusLabel, "No balance data")}</span>
                      </div>
                    </td>
                    <td className="coss-table__actions">
                      <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>
                        Details
                      </Button>
                      {row.isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canDemoteAdmin || operating}
                          onClick={() => queueUserOperation(row, "demote")}
                        >
                          Demote
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canPromoteToAdmin || operating}
                          onClick={() => queueUserOperation(row, "promote")}
                        >
                          Promote
                        </Button>
                      )}
                      {row.status === "blocked" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canUnblock || operating}
                          onClick={() => queueUserOperation(row, "unblock")}
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canBlock || operating}
                          onClick={() => queueUserOperation(row, "block")}
                        >
                          Block
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!row.canDelete || operating}
                        onClick={() => queueUserOperation(row, "delete")}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <Drawer
        title={drawer?.name || drawer?.email || ""}
        description="User, workspace, billing, and usage detail"
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Email" value={drawer.email} />
              <DetailMetric label="Provider" value={drawer.provider} />
              <DetailMetric label="Last login" value={drawer.lastLoginLabel} />
              <DetailMetric label="Services" value={drawer.usage.serviceCountLabel} />
              <DetailMetric label="Workspace" value={adminValue(drawer.workspace?.tenantName)} />
              <DetailMetric label="Default project" value={adminValue(drawer.workspace?.defaultProjectName)} />
            </div>
            <Card muted>
              <CardContent className="coss-stack-sm">
                <span className="coss-help">Billing</span>
                <strong>{drawer.billing.limitLabel}</strong>
                <span className="coss-help">
                  {adminValue(drawer.billing.balanceLabel ?? drawer.billing.statusLabel, "No balance data")}
                </span>
                {drawer.billing.loadError ? (
                  <Alert tone="warning" title="Billing sync error">
                    {drawer.billing.loadError}
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </Drawer>
      <Dialog
        title={operation?.title ?? ""}
        description={operation?.description ?? ""}
        open={Boolean(operation)}
        confirmDisabled={operating}
        confirmLabel={operation?.confirmLabel ?? "Confirm"}
        confirmLoading={operating}
        onConfirm={() => {
          void confirmOperation();
        }}
        onClose={() => {
          if (!operating) {
            setOperation(null);
          }
        }}
      />
    </>
  );
}

export function AdminClusterConsole() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
      CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
    );
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<AdminClusterNodeView | null>(null);
  const [policyDraft, setPolicyDraft] = useState<ClusterPolicyDraft | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [issuingKey, setIssuingKey] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const nodes = data?.nodes ?? [];
  const rows = useMemo<AdminClusterNodeRow[]>(
    () =>
      nodes
        .filter((node) =>
          matchesAdminQuery(query, [
            node.name,
            node.statusLabel,
            node.runtimeLabel,
            node.tenantLabel,
            node.locationLabel,
            node.zoneLabel,
            node.internalIpLabel,
            node.publicIpLabel,
            ...node.roleLabels,
            ...node.workloads.map((workload) => `${workload.title} ${workload.metaLabel}`),
          ]),
        )
        .map((node) => ({
          ...node,
          id: node.name,
        })),
    [nodes, query],
  );

  async function refreshCluster() {
    setRefreshing(true);
    setOperationError(null);
    invalidateConsolePageSnapshot(CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL);

    try {
      await refresh({ force: true });
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function issueJoinKey() {
    setIssuingKey(true);
    setOperationError(null);

    try {
      const result = await requestJson<{ joinCommand: string }>(
        "/api/admin/cluster/node-keys",
        {
          body: JSON.stringify({ label: "platform-node" }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      setSecret(result.joinCommand);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setIssuingKey(false);
    }
  }

  function openPolicyEditor(node: AdminClusterNodeView) {
    setDrawer(node);
    setPolicyDraft(
      node.policy
        ? {
            allowBuilds: node.policy.allowBuilds,
            allowDns: node.policy.allowDns,
            allowEdge: node.policy.allowEdge,
            allowSharedPool: node.policy.allowSharedPool,
          }
        : null,
    );
  }

  async function savePolicy() {
    if (!drawer || !policyDraft) {
      return;
    }

    setSavingPolicy(true);
    setOperationError(null);

    try {
      await requestAdminOperation({
        body: policyDraft,
        description: "",
        endpoint: `/api/admin/cluster/nodes/${encodeURIComponent(drawer.name)}/policy`,
        method: "PATCH",
        successMessage: "",
        title: "",
      });
      invalidateConsolePageSnapshot(CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL);
      await refresh({ force: true });
      toast.notify(`Policy saved for ${drawer.name}`);
      setDrawer(null);
      setPolicyDraft(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setSavingPolicy(false);
    }
  }

  function setPolicyBoolean(key: keyof ClusterPolicyDraft, value: string) {
    setPolicyDraft((draft) =>
      draft
        ? {
            ...draft,
            [key]: value === "true",
          }
        : draft,
    );
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Nodes", value: String(data?.summary.nodeCount ?? nodes.length) },
            { label: "Ready", tone: "success", value: String(data?.summary.readyCount ?? nodes.filter((node) => node.statusLabel === "Ready").length) },
            { label: "Attention", tone: data?.summary.pressuredCount ? "warning" : undefined, value: String(data?.summary.pressuredCount ?? nodes.filter((node) => node.statusTone === "warning" || node.statusTone === "danger").length) },
            { label: "Workloads", value: String(data?.summary.workloadCount ?? nodes.reduce((total, node) => total + node.workloadCount, 0)) },
          ]}
        />

        <div className="coss-split">
          <CardFrame>
            <CardHeader
              title="Control plane"
              description="Deployment status, release instance, version, and component rollout state."
              action={
                <Badge tone={badgeToneFromConsoleTone(data?.controlPlane?.statusTone ?? "neutral")}>
                  {data?.controlPlane?.statusLabel ?? "Unavailable"}
                </Badge>
              }
            />
            <CardContent className="coss-stack">
              {data?.controlPlane ? (
                <>
                  <div className="coss-grid-2">
                    <DetailMetric label="Namespace" value={data.controlPlane.namespaceLabel} mono />
                    <DetailMetric label="Version" value={data.controlPlane.versionLabel} mono />
                    <DetailMetric label="Release" value={data.controlPlane.releaseInstanceLabel} />
                    <DetailMetric label="Observed" value={data.controlPlane.observedLabel} />
                  </div>
                  <DataTable
                    columns={["Component", "Replicas", "Rollout", "Image"]}
                    rows={data.controlPlane.components.map((component) => ({
                      ...component,
                      id: component.component,
                    }))}
                    renderRow={(row) => (
                      <tr key={row.component}>
                        <td>
                          <div className="coss-stack-sm">
                            <strong>{row.componentLabel}</strong>
                            <span className="coss-help coss-mono">{row.deploymentName}</span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={badgeToneFromConsoleTone(row.statusTone)}>
                            {row.replicaLabel}
                          </Badge>
                        </td>
                        <td>{row.rolloutLabel}</td>
                        <td className="coss-mono">{row.imageTagLabel || row.imageRepositoryLabel}</td>
                      </tr>
                    )}
                  />
                </>
              ) : (
                <Empty title="Control plane status unavailable" description="The admin snapshot did not include control plane telemetry." />
              )}
            </CardContent>
          </CardFrame>

          <CardFrame>
            <CardHeader title="Platform node join" description="Issue a platform-scoped node enrollment key once." />
            <CardContent className="coss-stack">
              <Button
                disabled={Boolean(error)}
                loading={issuingKey}
                onClick={() => {
                  void issueJoinKey();
                }}
              >
                Issue join key
              </Button>
              <CodeBlock>fugue node join --api-url &lt;api-url&gt; --token &lt;visible-once&gt;</CodeBlock>
            </CardContent>
          </CardFrame>
        </div>

        <CardFrame>
          <CardHeader
            title="Cluster nodes"
            description="Live node status, runtime assignment, resource pressure, workloads, and policy controls."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => {
                  void refreshCluster();
                }}
              >
                {refreshing ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <input
              aria-label="Search cluster nodes"
              className="coss-input"
              placeholder="Search nodes, runtime, tenant, role, workload"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 340 }}
            />
            {operationError ? (
              <Alert tone="destructive" title="Cluster operation failed">
                {operationError}
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="destructive" title="Cluster unavailable">
                {error}
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} />

            {loading && !data ? (
              <div className="coss-stack-sm" aria-label="Loading cluster nodes">
                <SkeletonBlock height={44} />
                <SkeletonBlock height={56} />
                <SkeletonBlock height={56} />
              </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty
                title={nodes.length === 0 ? "No cluster nodes found" : "No cluster nodes match this filter"}
                description={nodes.length === 0 ? "Fugue returned an empty cluster node inventory." : "Clear the node search."}
              />
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={["Node", "Status", "Runtime", "Resources", "Workloads", "Policy"]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.name}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong className="coss-mono">{row.name}</strong>
                        <span className="coss-help">{row.locationLabel} · {row.zoneLabel}</span>
                        <span className="coss-help">{row.roleLabels.join(", ") || "No role labels"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <Badge tone={badgeToneFromConsoleTone(row.statusTone)}>
                          {row.statusLabel}
                        </Badge>
                        {row.statusDetail ? <span className="coss-help">{row.statusDetail}</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <span className="coss-mono">{row.runtimeLabel}</span>
                        <span className="coss-help">{row.tenantLabel}</span>
                      </div>
                    </td>
                    <td>
                      <ClusterResourceMeters node={row} />
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{pluralize(row.workloadCount, "workload")}</strong>
                        <span className="coss-help">{pluralize(row.appCount, "app")} · {pluralize(row.serviceCount, "service")}</span>
                      </div>
                    </td>
                    <td className="coss-table__actions">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!row.canManagePolicy || !row.policy || savingPolicy}
                        onClick={() => openPolicyEditor(row)}
                      >
                        Edit policy
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <Drawer
        title={drawer?.name ?? ""}
        description="Runtime node policy"
        open={Boolean(drawer)}
        onClose={() => {
          setDrawer(null);
          setPolicyDraft(null);
        }}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Internal IP" value={drawer.internalIpLabel} mono />
              <DetailMetric label="Public IP" value={drawer.publicIpLabel} mono />
              <DetailMetric label="Runtime" value={drawer.runtimeLabel} mono />
              <DetailMetric label="Machine" value={adminValue(drawer.machine?.nodeKeyLabel)} />
            </div>
            {drawer.policy && policyDraft ? (
              <div className="coss-form">
                <Field label="Build workloads">
                  <select
                    className="coss-select"
                    value={String(policyDraft.allowBuilds)}
                    onChange={(event) => setPolicyBoolean("allowBuilds", event.target.value)}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Disabled</option>
                  </select>
                </Field>
                <Field label="DNS traffic">
                  <select
                    className="coss-select"
                    value={String(policyDraft.allowDns)}
                    onChange={(event) => setPolicyBoolean("allowDns", event.target.value)}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Disabled</option>
                  </select>
                </Field>
                <Field label="Edge traffic">
                  <select
                    className="coss-select"
                    value={String(policyDraft.allowEdge)}
                    onChange={(event) => setPolicyBoolean("allowEdge", event.target.value)}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Disabled</option>
                  </select>
                </Field>
                <Field label="Shared pool">
                  <select
                    className="coss-select"
                    value={String(policyDraft.allowSharedPool)}
                    onChange={(event) => setPolicyBoolean("allowSharedPool", event.target.value)}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Disabled</option>
                  </select>
                </Field>
                <Alert tone="info" title="Effective policy">
                  Control plane role: {drawer.policy.effectiveControlPlaneRoleLabel}; schedulable: {drawer.policy.effectiveSchedulable ? "yes" : "no"}.
                </Alert>
                <Button
                  loading={savingPolicy}
                  onClick={() => {
                    void savePolicy();
                  }}
                >
                  Save policy
                </Button>
              </div>
            ) : (
              <Empty title="Policy unavailable" description="This node cannot be managed through the admin policy endpoint." />
            )}
          </div>
        ) : null}
      </Drawer>
      <Dialog
        title="Platform join command"
        description={secret ?? ""}
        open={Boolean(secret)}
        confirmLabel="Copy"
        onConfirm={() => {
          if (secret) copyText(secret, toast.notify);
          setSecret(null);
        }}
        onClose={() => setSecret(null)}
      />
    </>
  );
}

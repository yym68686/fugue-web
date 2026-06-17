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
  ConsoleCompactResourceItemView,
  ConsoleGalleryProjectView,
} from "@/lib/console/gallery-types";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
  CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
  invalidateConsolePageSnapshot,
  type ConsoleAdminAppsPageSnapshot,
  type ConsoleAdminClusterPageSnapshot,
  type ConsoleAdminUsersPageSnapshot,
  type ConsoleApiKeysPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleProfileSettingsPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  envRows,
  fileTree,
  imageVersions,
  logLines,
  requests,
  servers,
  services,
  type Service,
} from "@/lib/fugue-coss/demo-data";
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
  const [state, setState] = useState<"ready" | "validating" | "done" | "expired">("ready");

  return (
    <CardFrame>
      <CardContent className="coss-stack">
        {state === "done" ? (
          <Alert tone="success" title="Session finalized">
            You can now continue to the requested console destination.
          </Alert>
        ) : null}
        {state === "expired" ? (
          <Alert tone="warning" title="Handoff token expired">
            Start a fresh sign-in flow to receive a new handoff token.
          </Alert>
        ) : null}
        <div className="coss-stack-sm">
          <Badge tone={state === "done" ? "success" : "info"}>{state}</Badge>
          <p className="coss-card-description">
            Fugue validates the provider handoff token, creates a first-party session, and redirects to returnTo.
          </p>
        </div>
        <div className="coss-row">
          <Button
            loading={state === "validating"}
            onClick={() => {
              setState("validating");
            window.setTimeout(() => setState("done"), 700);
              window.setTimeout(() => {
                window.location.href = "/app";
              }, 1100);
            }}
          >
            Complete session
          </Button>
          <Button variant="outline" onClick={() => setState("expired")}>
            Simulate expired token
          </Button>
          <ButtonLink href="/auth/sign-in" variant="ghost">
            Restart sign in
          </ButtonLink>
        </div>
      </CardContent>
    </CardFrame>
  );
}

export function NewProjectWizard({ template }: { template?: string }) {
  const [source, setSource] = useState<"GitHub" | "Docker image" | "Upload">(template ? "GitHub" : "GitHub");
  const [projectName, setProjectName] = useState(template ?? "pulseboard");
  const [runtime, setRuntime] = useState("shared-us-west");
  const [drawer, setDrawer] = useState<"runtime" | "env" | "summary" | null>(null);
  const [deploying, setDeploying] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const saved = window.sessionStorage.getItem("fugue.pendingDeployIntent");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { projectName?: string; runtime?: string; source?: "GitHub" | "Docker image" | "Upload" };
      if (parsed.projectName) setProjectName(parsed.projectName);
      if (parsed.runtime) setRuntime(parsed.runtime);
      if (parsed.source) setSource(parsed.source);
    } catch {
      window.sessionStorage.removeItem("fugue.pendingDeployIntent");
    }
  }, []);

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
                <input className="coss-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
              </Field>
              <Field label="App name">
                <input className="coss-input" defaultValue={source === "Upload" ? "static-site" : "web"} />
              </Field>
              {source === "GitHub" ? (
                <Field label="Repository">
                  <input className="coss-input" defaultValue="yym68686/fugue-demo" />
                </Field>
              ) : null}
              {source === "Docker image" ? (
                <Field label="Image">
                  <input className="coss-input" defaultValue="ghcr.io/acme/web:latest" />
                </Field>
              ) : null}
              {source === "Upload" ? (
                <Card muted>
                  <CardContent className="coss-row">
                    <Upload aria-hidden="true" />
                    <div>
                      <strong>Drop build artifact</strong>
                      <p className="coss-card-description">Upload state is preserved before authentication.</p>
                    </div>
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
                  <input className="coss-input" defaultValue="main" />
                </Field>
                <Field label="Service port">
                  <input className="coss-input" defaultValue="3000" />
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
                  {runtime}
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
              <Alert tone="warning" title="Advanced settings">
                Network mode and persistent storage are available after source validation.
              </Alert>
              <Button
                loading={deploying}
                onClick={() => {
                  window.sessionStorage.setItem("fugue.pendingDeployIntent", JSON.stringify({ projectName, runtime, source }));
                  setDeploying(true);
                  window.setTimeout(() => {
                    setDeploying(false);
                    toast.notify("Project creation queued");
                  }, 900);
                }}
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
                { label: "Runtime", value: runtime },
                { label: "Route", value: "public" },
                { label: "Storage", value: "optional" },
              ]}
            />
            <CodeBlock>{`project: ${projectName}\nsource: ${source}\nruntime: ${runtime}\nroute: public\nstorage: /data optional`}</CodeBlock>
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
          {["shared-us-west", "alicehk2", "netcup"].map((item) => (
            <button
              key={item}
              className="coss-service-button"
              aria-label={`Select runtime ${item}`}
              aria-selected={runtime === item}
              onClick={() => setRuntime(item)}
            >
              <strong>{item}</strong>
              <p className="coss-card-description">Ready runtime target with managed route reconciliation.</p>
            </button>
          ))}
        </div>
      </Drawer>
      <Drawer title="Environment variables" open={drawer === "env"} onClose={() => setDrawer(null)}>
        <EnvironmentEditor />
      </Drawer>
      <Drawer title="Deploy preview" open={drawer === "summary"} onClose={() => setDrawer(null)}>
        <CodeBlock>{`createProject({\n  projectName: "${projectName}",\n  source: "${source}",\n  runtime: "${runtime}",\n  env: ${envRows.length} variables\n})`}</CodeBlock>
      </Drawer>
    </>
  );
}

function EnvironmentEditor() {
  const [rows, setRows] = useState(envRows);
  const [raw, setRaw] = useState(envRows.map((row) => `${row.key}=${row.value}`).join("\n"));
  const [revealed, setRevealed] = useState(false);
  const duplicate = new Set(rows.map((row) => row.key)).size !== rows.length;

  return (
    <div className="coss-stack">
      {duplicate ? <Alert tone="destructive" title="Duplicate key">Environment keys must be unique before save.</Alert> : null}
      <DataTable
        columns={["Key", "Value", "Actions"]}
        rows={rows.map((row, index) => ({ ...row, id: `${row.key}-${index}` }))}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>
              <input
                className="coss-input coss-mono"
                value={row.key}
                onChange={(event) => setRows((items) => items.map((item) => item.key === row.key ? { ...item, key: event.target.value } : item))}
              />
            </td>
            <td>
              <input
                className="coss-input coss-mono"
                value={row.value.includes("•") && !revealed ? "••••••••••" : row.value}
                onChange={(event) => setRows((items) => items.map((item) => item.key === row.key ? { ...item, value: event.target.value } : item))}
              />
            </td>
            <td className="coss-table__actions">
              <Button variant="outline" size="sm" aria-label={`Reveal ${row.key}`} onClick={() => setRevealed((value) => !value)}>
                Reveal
              </Button>
              <Button variant="ghost" size="sm" aria-label={`Delete ${row.key}`} onClick={() => setRows((items) => items.filter((item) => item.key !== row.key))}>
                Delete
              </Button>
            </td>
          </tr>
        )}
      />
      <Button
        variant="outline"
        onClick={() => setRows((items) => [...items, { key: `NEW_KEY_${items.length + 1}`, value: "pending" }])}
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
          setRows(
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

export function ProjectWorkbench() {
  const [service, setService] = useState<Service>(services[0]);
  const [tab, setTab] = useState("Route");
  const [drawer, setDrawer] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const toast = useToast();
  const tabs = service.kind === "app"
    ? ["Route", "Environment", "Logs", "Files", "Images", "Observability", "Settings"]
    : ["Overview", "Logs", "Failover", "Settings"];
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get("service");
    const tabName = params.get("tab");
    const matched = services.find((item) => item.id === serviceId);
    if (matched) setService(matched);
    if (tabName) setTab(tabName);
  }, []);

  function writeWorkbenchUrl(nextService: Service, nextTab: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("service", nextService.id);
    params.set("tab", nextTab);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-workbench">
        <aside className="coss-service-rail">
          {services.map((item) => (
            <button key={item.id} className="coss-service-button" aria-label={`Select service ${item.name}`} aria-selected={service.id === item.id} onClick={() => {
              setService(item);
              const nextTab = item.kind === "app" ? "Route" : "Overview";
              setTab(nextTab);
              writeWorkbenchUrl(item, nextTab);
            }}>
              <strong>{item.name}</strong>
              <p className="coss-card-description">{item.kind} · {item.phase}</p>
            </button>
          ))}
          <Button variant="outline" onClick={() => setDrawer("Add service")}>
            <Plus aria-hidden="true" />
            Add service
          </Button>
        </aside>
        <div className="coss-stack">
          <CardFrame>
            <CardContent className="coss-row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 className="coss-page-title">{service.name}</h2>
                <p className="coss-card-description">{service.route}</p>
              </div>
              <div className="coss-actions">
                <Badge tone={service.phase === "Running" || service.phase === "Primary" ? "success" : "info"}>{service.phase}</Badge>
                <Button variant="outline" onClick={() => toast.notify("Redeploy queued")}>
                  <RotateCcw aria-hidden="true" />
                  Redeploy
                </Button>
              </div>
            </CardContent>
          </CardFrame>
          <div className="coss-tabs" role="tablist" aria-label="Service sections">
            {tabs.map((item) => (
              <button key={item} className="coss-tab" aria-selected={tab === item} onClick={() => {
                setTab(item);
                writeWorkbenchUrl(service, item);
              }}>
                {item}
              </button>
            ))}
          </div>
          {tab === "Route" ? <RouteTab onOpen={setDrawer} onConfirm={setConfirm} /> : null}
          {tab === "Environment" ? <EnvironmentTab /> : null}
          {tab === "Logs" ? <LogsTab /> : null}
          {tab === "Files" ? <FilesTab /> : null}
          {tab === "Images" ? <ImagesTab onConfirm={setConfirm} /> : null}
          {tab === "Observability" ? <ObservabilityTab onOpen={setDrawer} /> : null}
          {tab === "Settings" ? <SettingsTab onOpen={setDrawer} onConfirm={setConfirm} /> : null}
          {tab === "Overview" ? <BackingOverview service={service} /> : null}
          {tab === "Failover" ? <FailoverTab onConfirm={setConfirm} /> : null}
        </div>
      </div>
      <Drawer title={drawer ?? ""} open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        <div className="coss-stack">
          <Alert tone="info" title="Side editor">
            This drawer preserves context while editing advanced project settings.
          </Alert>
          <CodeBlock>{`target: ${drawer}\nservice: ${service.name}\nruntime: ${service.runtime}`}</CodeBlock>
          <Button onClick={() => setDrawer(null)}>
            <Save aria-hidden="true" />
            Save changes
          </Button>
        </div>
      </Drawer>
      <Dialog
        title={confirm ?? ""}
        description="This action changes a running service. Confirm the object name before continuing in production."
        open={Boolean(confirm)}
        confirmLabel="Confirm"
        onConfirm={() => {
          toast.notify(`${confirm} confirmed`);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function RouteTab({ onOpen, onConfirm }: { onOpen: (value: string) => void; onConfirm: (value: string) => void }) {
  return (
    <CardFrame>
      <CardHeader title="Routes" description="Public routes, route table, and custom domains." action={<Button onClick={() => onOpen("Add route")}>Add route</Button>} />
      <CardContent className="coss-stack">
        <MetricStrip items={[{ label: "Active route", value: "1" }, { label: "Custom domains", value: "2" }, { label: "Service port", value: "3000" }, { label: "Mode", value: "public" }]} />
        <Alert tone="destructive" title="Route conflict guard">
          Conflicting hosts are blocked before the route table is saved.
        </Alert>
        <DataTable
          columns={["Host", "Target", "Status", "Actions"]}
          rows={[
            { id: "route-1", host: "pulseboard.fugue.dev", target: "web:3000", status: "active" },
            { id: "route-2", host: "app.example.com", target: "web:3000", status: "verifying" },
          ]}
          renderRow={(row) => (
            <tr key={row.id}>
              <td className="coss-mono">{row.host}</td>
              <td className="coss-mono">{row.target}</td>
              <td><Badge tone={row.status === "active" ? "success" : "warning"}>{row.status}</Badge></td>
              <td className="coss-table__actions">
                <Button variant="outline" size="sm" aria-label={`Edit route ${row.host}`} onClick={() => onOpen("Route table editor")}>Edit</Button>
                <Button variant="destructive" size="sm" aria-label={`Delete route ${row.host}`} onClick={() => onConfirm(`Delete route ${row.host}`)}>Delete</Button>
              </td>
            </tr>
          )}
        />
        <Card muted>
          <CardContent className="coss-stack-sm">
            <strong>Custom domains</strong>
            <div className="coss-row"><span className="coss-mono">app.example.com</span><Badge tone="warning">DNS verifying</Badge></div>
            <div className="coss-row"><span className="coss-mono">www.example.com</span><Badge tone="success">verified</Badge></div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => onOpen("Advanced route table")}>Open advanced route table</Button>
      </CardContent>
    </CardFrame>
  );
}

function EnvironmentTab() {
  const [mode, setMode] = useState<"Variables" | "Raw .env">("Variables");
  return (
    <CardFrame>
      <CardHeader title="Environment" description="Variables are validated before save and can be pasted as raw .env." />
      <CardContent className="coss-stack">
        <div className="coss-tabs">
          {(["Variables", "Raw .env"] as const).map((item) => (
            <button key={item} className="coss-tab" aria-selected={mode === item} onClick={() => setMode(item)}>{item}</button>
          ))}
        </div>
        {mode === "Variables" ? <EnvironmentEditor /> : <textarea className="coss-textarea" defaultValue={envRows.map((row) => `${row.key}=${row.value}`).join("\n")} />}
        <Alert tone="warning" title="Redeploy required">Saved environment changes are applied on the next rebuild.</Alert>
      </CardContent>
    </CardFrame>
  );
}

function LogsTab() {
  const [kind, setKind] = useState("Runtime");
  const [follow, setFollow] = useState(true);
  const [connected, setConnected] = useState(true);
  const [empty, setEmpty] = useState(false);
  const toast = useToast();
  const renderedLogs = empty ? [] : logLines.map((line) => `[${kind.toLowerCase()}] ${line}`);
  return (
    <>
      <Toast message={toast.message} />
      <CardFrame>
        <CardHeader title="Logs" description="Build and runtime streams share a dense terminal panel." />
        <CardContent className="coss-stack">
          {!connected ? <Alert tone="warning" title="Log stream disconnected">Reconnect to resume following runtime output.</Alert> : null}
          {empty ? <Empty title="No logs in this window" description="Choose a different build or reconnect the stream." /> : null}
          <div className="coss-row" style={{ justifyContent: "space-between" }}>
            <div className="coss-tabs">
              {["Build", "Runtime"].map((item) => (
                <button key={item} className="coss-tab" aria-selected={kind === item} onClick={() => setKind(item)}>{item}</button>
              ))}
            </div>
            <select className="coss-select" aria-label="Recent build" defaultValue="build-82c1" style={{ width: 160 }}>
              <option value="build-82c1">build-82c1</option>
              <option value="build-71aa">build-71aa</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              role="checkbox"
              aria-checked={follow}
              aria-label="Follow logs"
              onClick={() => setFollow((value) => !value)}
            >
              {follow ? "Pause follow" : "Follow"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => copyText(renderedLogs.join("\n"), toast.notify)}>Copy logs</Button>
            <Button variant="outline" size="sm" onClick={() => setConnected((value) => !value)}>{connected ? "Disconnect" : "Reconnect"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setEmpty((value) => !value)}>Toggle empty</Button>
          </div>
          <CodeBlock>{renderedLogs.join("\n") || "# no log lines"}</CodeBlock>
        </CardContent>
      </CardFrame>
    </>
  );
}

function FilesTab() {
  const [file, setFile] = useState(fileTree[0]);
  const [content, setContent] = useState(fileTree[0].content);
  const [rootMode, setRootMode] = useState<"Live filesystem" | "Persistent storage">("Live filesystem");
  const [conflict, setConflict] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  return (
    <>
      <CardFrame>
      <CardHeader title="Files" description="Live filesystem and persistent storage share a split editor." action={<Button variant="outline" size="sm"><FilePlus2 aria-hidden="true" /> New file</Button>} />
      <CardContent className="coss-stack">
        <div className="coss-tabs" aria-label="Filesystem root">
          {(["Live filesystem", "Persistent storage"] as const).map((item) => (
            <button key={item} className="coss-tab" aria-selected={rootMode === item} onClick={() => setRootMode(item)}>{item}</button>
          ))}
        </div>
        {conflict ? <Alert tone="warning" title="Save conflict">The file changed on the runtime. Reload or overwrite before continuing.</Alert> : null}
        {file.path.endsWith(".keep") ? <Alert tone="info" title="Read-only preview">Some runtime files are not editable through the browser editor.</Alert> : null}
        <div className="coss-split">
          <div className="coss-stack-sm">
            {fileTree.map((item) => (
              <button key={item.path} className="coss-service-button" aria-label={`Open file ${item.path}`} aria-selected={file.path === item.path} onClick={() => {
                setFile(item);
                setContent(item.content);
              }}>
                <span className="coss-mono">{item.path}</span>
              </button>
            ))}
          </div>
          <div className="coss-stack">
            <Badge tone="info">{rootMode}</Badge>
            <textarea className="coss-textarea coss-mono" value={content} onChange={(event) => setContent(event.target.value)} />
            <div className="coss-row">
              <Button onClick={() => setConflict((value) => !value)}><Save aria-hidden="true" /> Save</Button>
              <Button variant="outline" onClick={() => setMobileDrawer(true)}>Open mobile editor</Button>
              <Button variant="outline"><FilePlus2 aria-hidden="true" /> New folder</Button>
              <Button variant="destructive"><Trash2 aria-hidden="true" /> Delete</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </CardFrame>
      <Drawer title="Mobile file editor" description={file.path} open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <textarea className="coss-textarea coss-mono" value={content} onChange={(event) => setContent(event.target.value)} />
      </Drawer>
    </>
  );
}

function ImagesTab({ onConfirm }: { onConfirm: (value: string) => void }) {
  const [drawer, setDrawer] = useState<string | null>(null);
  return (
    <>
      <CardFrame>
        <CardHeader title="Images" description="Current image and retained versions." />
        <CardContent className="coss-stack">
          <Alert tone="success" title="Current image">
            {imageVersions.find((image) => image.current)?.tag}
          </Alert>
          <DataTable
            columns={["Image", "Created", "State", "Actions"]}
            rows={imageVersions}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{row.tag}</td>
                <td>{row.created}</td>
                <td><Badge tone={row.current ? "success" : "default"}>{row.current ? "current" : "saved"}</Badge></td>
                <td className="coss-table__actions">
                  <Button variant="outline" size="sm" aria-label={`Image details ${row.id}`} onClick={() => setDrawer(row.id)}>Details</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={row.current ? `Redeploy image ${row.id}` : `Delete image ${row.id}`}
                    onClick={() => onConfirm(row.current ? "Redeploy current image" : "Delete image")}
                    disabled={row.current && false}
                  >
                    {row.current ? "Redeploy" : "Delete"}
                  </Button>
                </td>
              </tr>
            )}
          />
        </CardContent>
      </CardFrame>
      <Drawer title={drawer ?? ""} description="Image digest, source, and redeploy context." open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        <CodeBlock>{`image: ${drawer}\ndigest: sha256:82c1...\nsource: github image tracking`}</CodeBlock>
      </Drawer>
    </>
  );
}

function ObservabilityTab({ onOpen }: { onOpen: (value: string) => void }) {
  const [view, setView] = useState("Overview");
  const [windowSize, setWindowSize] = useState("1h");
  const [trace, setTrace] = useState("");
  return (
    <CardFrame>
      <CardHeader title="Observability" description="Requests, traces, runtime health, and alert surface." />
      <CardContent className="coss-stack">
        <div className="coss-row" style={{ justifyContent: "space-between" }}>
          <div className="coss-tabs">
            {["Overview", "Logs", "Requests", "Trace", "Alerts"].map((item) => (
              <button key={item} className="coss-tab" aria-selected={view === item} onClick={() => setView(item)}>{item}</button>
            ))}
          </div>
          <select className="coss-select" aria-label="Time window" value={windowSize} onChange={(event) => setWindowSize(event.target.value)} style={{ width: 120 }}>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
          </select>
        </div>
        <Alert tone="warning" title="Metrics availability">
          If the runtime cannot provide metrics for {windowSize}, this panel keeps the rest of the workbench available.
        </Alert>
        <MetricStrip items={[{ label: "RPS", value: "84" }, { label: "Error rate", value: "0.2%", tone: "success" }, { label: "p95", value: "118ms" }, { label: "Alerts", value: "1", tone: "warning" }]} />
        {view === "Logs" ? <CodeBlock>{logLines.join("\n")}</CodeBlock> : null}
        {view === "Alerts" ? <Alert tone="warning" title="Latency alert">p95 latency crossed the configured warning threshold.</Alert> : null}
        {view === "Trace" ? (
          <div className="coss-form">
            <Field label="Trace id"><input className="coss-input" value={trace} onChange={(event) => setTrace(event.target.value)} placeholder="trace-123" /></Field>
            {trace && trace !== "trace-123" ? <Empty title="Trace not found" description="Try a trace id from the requests table." /> : null}
            {trace === "trace-123" ? <CodeBlock>edge → route → web:3000 → postgres</CodeBlock> : null}
          </div>
        ) : null}
        {view === "Requests" || view === "Overview" ? (
          <DataTable
            columns={["Request", "Status", "Latency", "Actions"]}
            rows={requests}
            renderRow={(row) => (
              <tr key={row.id}>
                <td className="coss-mono">{row.path}</td>
                <td><Badge tone={row.status < 300 ? "success" : "destructive"}>{row.status}</Badge></td>
                <td>{row.latency}</td>
                <td className="coss-table__actions"><Button variant="outline" size="sm" aria-label={`Open trace ${row.id}`} onClick={() => onOpen(`Request ${row.id}`)}>Open trace</Button></td>
              </tr>
            )}
          />
        ) : null}
      </CardContent>
    </CardFrame>
  );
}

function SettingsTab({ onOpen, onConfirm }: { onOpen: (value: string) => void; onConfirm: (value: string) => void }) {
  return (
    <div className="coss-stack">
      <CardFrame>
        <CardHeader title="Runtime settings" description="Startup command, retention, mounts, failover, and migration." />
        <CardContent className="coss-grid-2">
          <Field label="Startup command"><input className="coss-input" defaultValue="npm start" /></Field>
          <Field label="Image retention"><input className="coss-input" defaultValue="5" /></Field>
          <Field label="Automatic failover"><select className="coss-select" defaultValue="managed"><option value="managed">managed</option><option value="off">off</option></select></Field>
          <Button variant="outline" onClick={() => onOpen("Runtime migration")}>Runtime migration</Button>
          <Button variant="outline" onClick={() => onOpen("Persistent mounts")}>Persistent mounts</Button>
          <Button variant="outline" onClick={() => onConfirm("Start service")}>Start</Button>
          <Button variant="outline" onClick={() => onConfirm("Restart service")}>Restart</Button>
        </CardContent>
      </CardFrame>
      <CardFrame>
        <CardHeader title="Danger zone" description="Destructive operations require confirmation." />
        <CardContent className="coss-row">
          <Button variant="destructive" onClick={() => onConfirm("Delete service")}>Delete service</Button>
          <Button variant="destructive" onClick={() => onConfirm("Force delete service")}>Force delete</Button>
        </CardContent>
      </CardFrame>
    </div>
  );
}

function BackingOverview({ service }: { service: Service }) {
  return (
    <CardFrame>
      <CardHeader title="Backing service overview" description="Runtime location, managed endpoint, and resource pressure." />
      <CardContent className="coss-stack">
        <MetricStrip items={[{ label: "Runtime", value: service.runtime }, { label: "Role", value: "Primary" }, { label: "Failover", value: "managed" }, { label: "Usage", value: `${service.usage}%` }]} />
        <CodeBlock>{`psql ${service.route}\n# credentials are visible only through active workspace access`}</CodeBlock>
        <Alert tone="info" title="Backing service settings">
          Runtime, retention, and deletion controls are available from the Settings tab.
        </Alert>
      </CardContent>
    </CardFrame>
  );
}

function FailoverTab({ onConfirm }: { onConfirm: (value: string) => void }) {
  return (
    <CardFrame>
      <CardHeader title="Managed failover" description="Primary/standby state and controlled switchover." />
      <CardContent className="coss-stack">
        <Alert tone="info" title="Primary is healthy">Standby can be promoted through a confirmed switchover.</Alert>
        <Button variant="destructive" onClick={() => onConfirm("Promote replica")}>Promote replica</Button>
      </CardContent>
    </CardFrame>
  );
}

export function BillingConsole() {
  const [cpu, setCpu] = useState(4);
  const [memory, setMemory] = useState(8);
  const [checkout, setCheckout] = useState("idle");
  const [dialog, setDialog] = useState<"payment" | "export" | null>(null);
  return (
    <>
      <div className="coss-stack">
        <MetricStrip items={[{ label: "Prepaid balance", value: "$128.40" }, { label: "Runway", value: "21 days", tone: "success" }, { label: "Current usage", value: "$6.11/day" }, { label: "Image storage", value: "14.2GB" }]} />
        {checkout !== "idle" ? <Alert tone="success" title="Checkout status updated">{checkout}</Alert> : null}
        <div className="coss-split">
          <CardFrame>
            <CardHeader title="Managed capacity envelope" description="Adjust capacity and preview monthly cost." />
            <CardContent className="coss-form">
              <Field label={`CPU cores: ${cpu}`}>
                <input className="coss-input" type="range" min="1" max="16" value={cpu} onChange={(event) => setCpu(Number(event.target.value))} />
              </Field>
              <Field label={`Memory GB: ${memory}`}>
                <input className="coss-input" type="range" min="2" max="64" value={memory} onChange={(event) => setMemory(Number(event.target.value))} />
              </Field>
              <Alert tone="info" title="Estimated monthly cost">${(cpu * 18 + memory * 7).toFixed(2)}</Alert>
              <Button><Save aria-hidden="true" /> Save envelope</Button>
            </CardContent>
          </CardFrame>
          <CardFrame>
            <CardHeader title="Top up" description="Recharge workspace prepaid balance." />
            <CardContent className="coss-stack">
              <Field label="Amount"><input className="coss-input" defaultValue="50" /></Field>
              <Button onClick={() => setDialog("payment")}>Add payment method</Button>
              <Button variant="outline" onClick={() => setCheckout("Top-up checkout started")}>Start checkout</Button>
              <Button variant="outline" onClick={() => setDialog("export")}>Export invoices</Button>
            </CardContent>
          </CardFrame>
        </div>
        <CardFrame>
          <CardHeader title="Billing events" description="Usage, top-ups, and managed capacity changes." />
          <CardContent>
            <DataTable
              columns={["Event", "Amount", "Status"]}
              rows={[{ id: "evt-1", event: "Top-up", amount: "$50.00", status: "posted" }, { id: "evt-2", event: "Runtime usage", amount: "-$6.11", status: "pending" }]}
              renderRow={(row) => <tr key={row.id}><td>{row.event}</td><td>{row.amount}</td><td><Badge tone={row.status === "posted" ? "success" : "info"}>{row.status}</Badge></td></tr>}
            />
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Price book" description="Reference rates used by the estimate." />
          <CardContent>
            <DataTable
              columns={["Resource", "Rate", "Boundary"]}
              rows={[{ id: "cpu", resource: "CPU core", rate: "$18/mo", boundary: "managed envelope" }, { id: "memory", resource: "Memory GB", rate: "$7/mo", boundary: "managed envelope" }, { id: "image", resource: "Image storage", rate: "$0.08/GB", boundary: "retained images" }]}
              renderRow={(row) => <tr key={row.id}><td>{row.resource}</td><td>{row.rate}</td><td>{row.boundary}</td></tr>}
            />
          </CardContent>
        </CardFrame>
        <Alert tone="warning" title="Low balance guard">
          Workspaces receive a warning before prepaid balance can no longer cover the active envelope.
        </Alert>
      </div>
      <Dialog title="Payment method" description="Attach a payment method before starting checkout." open={dialog === "payment"} onConfirm={() => setDialog(null)} onClose={() => setDialog(null)} />
      <Dialog title="Export invoices" description="Download invoice CSV for the selected workspace billing period." open={dialog === "export"} onConfirm={() => setDialog(null)} onClose={() => setDialog(null)} />
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

export function ServersConsole() {
  const [drawer, setDrawer] = useState<typeof servers[number] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [query, setQuery] = useState("");
  const [attachCommand, setAttachCommand] = useState(false);
  const rows = servers.filter((server) => server.id.includes(query) || server.role.includes(query));
  return (
    <>
      <div className="coss-stack">
        <MetricStrip items={[{ label: "Servers", value: String(servers.length) }, { label: "Ready", value: "2", tone: "success" }, { label: "Attention", value: "1", tone: "warning" }, { label: "Workloads", value: "27" }]} />
        <CardFrame>
          <CardHeader
            title="Runtime servers"
            description="Heartbeat, roles, pressure signals, capacity, workloads, and runtime access."
            action={<Button onClick={() => setAttachCommand(true)}>Generate attach command</Button>}
          />
          <CardContent className="coss-stack">
            <input className="coss-input" placeholder="Search node" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 260 }} />
            {rows.length ? (
              <DataTable
                columns={["Server", "Role", "Ready", "CPU", "Memory", "Actions"]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.id}>
                    <td className="coss-mono">{row.id}</td><td>{row.role}</td><td><Badge tone={row.ready === "ready" ? "success" : "warning"}>{row.ready}</Badge> <Badge tone="info">pool shared</Badge></td><td><Meter label="cpu" value={row.cpu} /></td><td><Meter label="memory" value={row.memory} /></td>
                    <td className="coss-table__actions"><Button variant="outline" size="sm" aria-label={`Server details ${row.id}`} onClick={() => setDrawer(row)}>Details</Button></td>
                  </tr>
                )}
              />
            ) : (
              <Empty title="No servers found" description="Clear the search query or attach a new runtime node." />
            )}
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Offline servers" description="Stale runtime records can be cleaned after confirmation." />
          <CardContent className="coss-row" style={{ justifyContent: "space-between" }}>
            <span className="coss-mono">old-vps-01</span>
            <Badge tone="destructive">offline</Badge>
            <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>Clear record</Button>
          </CardContent>
        </CardFrame>
      </div>
      <Drawer title={drawer?.id ?? ""} description="Runtime access and pressure details." open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        {drawer ? <div className="coss-stack"><Meter label="disk" value={drawer.disk} /><CodeBlock>{`fugue node inspect ${drawer.id}\nworkloads: ${drawer.workloads}\nrole: ${drawer.role}`}</CodeBlock><Button variant="destructive">Clear offline record</Button></div> : null}
      </Drawer>
      <Dialog title="Clear offline server" description="This removes only the stale server record, not a running machine." open={confirm} onConfirm={() => setConfirm(false)} onClose={() => setConfirm(false)} />
      <Dialog title="Attach runtime server" description="fugue node attach --workspace fugue-production --token fgn_visible_once" open={attachCommand} onConfirm={() => setAttachCommand(false)} onClose={() => setAttachCommand(false)} />
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

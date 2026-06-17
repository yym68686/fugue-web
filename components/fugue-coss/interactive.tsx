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
} from "@/components/coss/ui";
import {
  adminApps,
  adminUsers,
  apiKeys,
  envRows,
  fileTree,
  imageVersions,
  logLines,
  nodeKeys,
  projects,
  requests,
  servers,
  services,
  type Project,
  type Service,
} from "@/lib/fugue-coss/demo-data";

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
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  open: boolean;
  confirmLabel?: string;
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
          <Button variant="destructive" onClick={onConfirm}>
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
  const [method, setMethod] = useState<"password" | "email">("password");
  const [email, setEmail] = useState("ops@fugue.dev");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const returnTo = typeof window === "undefined" ? "/app" : new URLSearchParams(window.location.search).get("returnTo") ?? "/app";
  const emailInvalid = Boolean(email) && !email.includes("@");

  function simulate(label: string, success: string) {
    setError(null);
    setLoading(label);
    window.setTimeout(() => {
      setLoading(null);
      setNotice(success);
    }, 600);
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
            onClick={() => simulate("google", "Google session handoff started")}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            loading={loading === "github"}
            onClick={() => simulate("github", "GitHub provider is available")}
          >
            Continue with GitHub
          </Button>
        </div>
        <p className="coss-help">GitHub login appears only when the provider is configured; this COSS surface keeps the availability state visible.</p>
        <div className="coss-tabs" role="tablist" aria-label="Authentication method">
          <button className="coss-tab" aria-selected={method === "password"} onClick={() => setMethod("password")}>
            Password
          </button>
          <button className="coss-tab" aria-selected={method === "email"} onClick={() => setMethod("email")}>
            Email link
          </button>
        </div>
        <div className="coss-form">
          <Field label="Email">
            <input className="coss-input" aria-invalid={emailInvalid} value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {emailInvalid ? <span className="coss-help" role="alert">Enter a valid email address.</span> : null}
          {method === "password" ? (
            <Field label="Password" help={mode === "sign-up" ? "Password can be added later in profile security." : "Use an existing password for this account."}>
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
            loading={loading === "email"}
            onClick={() => {
              if (method === "password" && password.length < 8) {
                setNotice(null);
                setError("Password must be at least 8 characters.");
                return;
              }
              simulate(
                "email",
                method === "email" ? `Verification link sent to ${email}` : "Password accepted; session created",
              );
            }}
          >
            {method === "email" ? "Send link" : mode === "sign-up" ? "Create account" : "Sign in"}
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

export function ProjectGallery() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [drawer, setDrawer] = useState(false);
  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const matchesQuery = project.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" || project.lifecycle.toLowerCase() === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <>
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Projects", value: String(projects.length) },
            { label: "Running", value: "2", tone: "success" },
            { label: "Attention", value: "1", tone: "warning" },
            { label: "Managed usage", value: "64%" },
          ]}
        />
        <CardFrame>
          <CardContent className="coss-stack">
            <div className="coss-row" style={{ justifyContent: "space-between" }}>
              <div className="coss-row">
                <input
                  className="coss-input"
                  aria-label="Search projects"
                  placeholder="Search projects"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  style={{ width: 240 }}
                />
                <select className="coss-select" aria-label="Filter lifecycle" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All lifecycle</option>
                  <option value="running">Running</option>
                  <option value="deploying">Deploying</option>
                  <option value="attention">Attention</option>
                </select>
                <div className="coss-tabs" aria-label="View switch">
                  <button className="coss-tab" aria-selected={view === "table"} onClick={() => setView("table")}>
                    Table
                  </button>
                  <button className="coss-tab" aria-selected={view === "cards"} onClick={() => setView("cards")}>
                    Cards
                  </button>
                </div>
              </div>
              <Button onClick={() => setDrawer(true)}>
                <Plus aria-hidden="true" />
                New project
              </Button>
            </div>
            <Alert tone="info" title="Project creation in progress">
              `atlas-api` is importing its first service and will move into the table when the operation finishes.
            </Alert>
            {filtered.length && view === "table" ? (
              <DataTable
                columns={["Project", "Lifecycle", "Runtime", "Usage", "Actions"]}
                rows={filtered}
                renderRow={(project) => <ProjectRow key={project.id} project={project} />}
              />
            ) : null}
            {filtered.length && view === "cards" ? (
              <div className="coss-grid-3">
                {filtered.map((project) => (
                  <Card key={project.id}>
                    <CardContent className="coss-stack-sm">
                      <Badge tone={project.lifecycle === "Running" ? "success" : project.lifecycle === "Attention" ? "warning" : "info"}>{project.lifecycle}</Badge>
                      <strong>{project.name}</strong>
                      <p className="coss-card-description">{project.runtime} · {project.services} services</p>
                      <Meter label="resource" value={project.usage} />
                      <ButtonLink href={`/app/projects/${project.id}`} variant="outline" size="sm">Open</ButtonLink>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              filtered.length ? null : <Empty title="No projects match this filter" description="Clear search or create a new project." />
            )}
          </CardContent>
        </CardFrame>
      </div>
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

function ProjectRow({ project }: { project: Project }) {
  const tone = project.lifecycle === "Running" ? "success" : project.lifecycle === "Attention" ? "warning" : "info";
  return (
    <tr>
      <td>
        <ButtonLink href={`/app/projects/${project.id}`} variant="ghost" size="sm">
          {project.name}
        </ButtonLink>
      </td>
      <td><Badge tone={tone}>{project.lifecycle}</Badge></td>
      <td className="coss-mono">{project.runtime}</td>
      <td><Meter label="resource" value={project.usage} /></td>
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

export function AccessKeysConsole() {
  const [drawer, setDrawer] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const toast = useToast();

  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        <KeyTable title="Workspace API keys" createLabel="Create workspace API key" rows={apiKeys} onCreate={() => setDrawer("Create API key")} onSecret={() => setSecret("fgw_live_••••_copy_once")} />
        <KeyTable title="Node enrollment keys" createLabel="Create node enrollment key" rows={nodeKeys.map((item) => ({ id: item.id, name: item.name, scopes: `${item.servers} servers`, status: item.status, lastUsed: item.created }))} onCreate={() => setDrawer("Create node key")} onSecret={() => setSecret("fgn_join_••••_copy_once")} />
      </div>
      <Drawer title={drawer ?? ""} open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        <div className="coss-form">
          <Field label="Name"><input className="coss-input" defaultValue={drawer?.includes("node") ? "new-server" : "workspace-admin"} /></Field>
          <Field label="Scopes"><input className="coss-input" defaultValue={drawer?.includes("node") ? "server:enroll" : "workspace:*"} /></Field>
          <Button onClick={() => {
            setSecret(drawer?.includes("node") ? "fugue node enroll --key fgn_join_123" : "fgp_live_visible_once");
            setDrawer(null);
          }}>Create key</Button>
        </div>
      </Drawer>
      <Dialog
        title="Reveal / rotate key"
        description={secret ?? ""}
        open={Boolean(secret)}
        confirmLabel="Copy and close"
        onConfirm={() => {
          if (secret) copyText(secret, toast.notify);
          setSecret(null);
        }}
        onClose={() => setSecret(null)}
      />
    </>
  );
}

function KeyTable({
  title,
  createLabel,
  rows,
  onCreate,
  onSecret,
}: {
  title: string;
  createLabel: string;
  rows: Array<{ id: string; name: string; scopes: string; status: string; lastUsed: string }>;
  onCreate: () => void;
  onSecret: () => void;
}) {
  return (
    <CardFrame>
      <CardHeader title={title} description="Create, rotate, disable, revoke, and copy join commands." action={<Button onClick={onCreate}>{createLabel}</Button>} />
      <CardContent>
        {!rows.length ? <Empty title="No keys" description="Create a key to enable API or server enrollment access." /> : null}
        <DataTable
          columns={["Name", "Scopes", "Status", "Last used", "Actions"]}
          rows={rows}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.name}</td><td className="coss-mono">{row.scopes}</td><td><Badge tone={row.status === "active" ? "success" : "destructive"}>{row.status}</Badge></td><td>{row.lastUsed}</td>
              <td className="coss-table__actions">
                <Button variant="outline" size="sm" aria-label={`Reveal or rotate ${row.name}`} onClick={onSecret}>Reveal / rotate</Button>
                <Button variant="outline" size="sm" aria-label={`Enable or disable ${row.name}`}>Enable / disable</Button>
                <Button variant="destructive" size="sm" aria-label={`Delete or revoke ${row.name}`}>Delete / revoke</Button>
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

export function ProfileSecurity() {
  const [name, setName] = useState("Ops Admin");
  const [methods, setMethods] = useState(["Google", "GitHub", "Email link", "Password"]);
  const [dialog, setDialog] = useState<"security" | "privacy" | null>(null);
  return (
    <>
      <div className="coss-split">
        <CardFrame>
          <CardHeader title="Profile" description="Display name, account email, and active session." />
          <CardContent className="coss-form">
            <Field label="Display name"><input className="coss-input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Email"><input className="coss-input" value="ops@fugue.dev" disabled /></Field>
            <Button><Save aria-hidden="true" /> Save profile</Button>
          </CardContent>
        </CardFrame>
        <CardFrame>
          <CardHeader title="Sign-in methods" description="At least one method must remain active." />
          <CardContent className="coss-stack">
            {methods.map((method) => (
              <div key={method} className="coss-row" style={{ justifyContent: "space-between" }}>
                <span>{method}</span>
                <Button variant="outline" size="sm" disabled={methods.length === 1} onClick={() => setMethods((items) => items.filter((item) => item !== method))}>Disconnect</Button>
              </div>
            ))}
            <div className="coss-grid-2">
              {["Google", "GitHub", "Email link", "Password"].map((method) => (
                <Button key={method} variant="outline" onClick={() => setMethods((items) => Array.from(new Set([...items, method])))}>
                  Connect / enable {method}
                </Button>
              ))}
            </div>
          </CardContent>
        </CardFrame>
      </div>
      <CardFrame>
        <CardHeader title="Account controls" description="Recovery email rotation and privacy record cleanup." />
        <CardContent className="coss-row">
          <Button variant="outline" onClick={() => setDialog("security")}>Rotate recovery email</Button>
          <Button variant="destructive" onClick={() => setDialog("privacy")}>Clear record</Button>
        </CardContent>
      </CardFrame>
      <Dialog title="Security operation" description="Rotate the recovery email and keep at least one verified sign-in method active." open={dialog === "security"} onConfirm={() => setDialog(null)} onClose={() => setDialog(null)} />
      <Dialog title="Privacy record" description="Clear the local account record after confirmation." open={dialog === "privacy"} onConfirm={() => setDialog(null)} onClose={() => setDialog(null)} />
    </>
  );
}

export function AdminAppsConsole() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("all");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<typeof adminApps[number] | null>(null);
  const rows = adminApps.filter((app) => (app.id.includes(query) || app.owner.includes(query)) && (phase === "all" || app.phase === phase));
  return (
    <>
      <div className="coss-stack">
        <MetricStrip items={[{ label: "Apps", value: "3" }, { label: "Routed", value: "2", tone: "success" }, { label: "Tenants", value: "3" }, { label: "Attention", value: "1", tone: "warning" }]} />
        <CardFrame>
          <CardHeader title="Applications" description="Cluster-wide app inventory and rebuild/delete operations." />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <input className="coss-input" placeholder="Search app or owner" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 260 }} />
              <select className="coss-select" value={phase} onChange={(event) => setPhase(event.target.value)} style={{ width: 160 }}>
                <option value="all">All phase</option>
                <option value="running">running</option>
                <option value="building">building</option>
                <option value="attention">attention</option>
              </select>
            </div>
            <DataTable
              columns={["App", "Owner", "Phase", "Route", "Runtime", "Actions"]}
              rows={rows}
              renderRow={(row) => <tr key={row.id}><td className="coss-mono">{row.id}</td><td>{row.owner}</td><td><Badge tone={row.phase === "running" ? "success" : row.phase === "attention" ? "warning" : "info"}>{row.phase}</Badge></td><td>{row.route}</td><td>{row.runtime}</td><td className="coss-table__actions"><Button variant="outline" size="sm" aria-label={`App details ${row.id}`} onClick={() => setDrawer(row)}>Details</Button><Button variant="outline" size="sm" aria-label={`Rebuild ${row.id}`} onClick={() => setConfirm(`Rebuild ${row.id}`)}>Rebuild</Button><Button variant="destructive" size="sm" aria-label={`Delete ${row.id}`} onClick={() => setConfirm(`Delete ${row.id}`)}>Delete</Button></td></tr>}
            />
          </CardContent>
        </CardFrame>
      </div>
      <Drawer title={drawer?.id ?? ""} description="App detail" open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        {drawer ? <CodeBlock>{JSON.stringify(drawer, null, 2)}</CodeBlock> : null}
      </Drawer>
      <Dialog title={confirm ?? ""} description="Admin operation requires confirmation." open={Boolean(confirm)} onConfirm={() => setConfirm(null)} onClose={() => setConfirm(null)} />
    </>
  );
}

export function AdminUsersConsole() {
  const [drawer, setDrawer] = useState<typeof adminUsers[number] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [confirm, setConfirm] = useState<string | null>(null);
  const rows = adminUsers.filter((user) => (user.email.includes(query) || user.name.includes(query)) && (status === "all" || user.status === status || (status === "admin" && user.admin)));
  return (
    <>
      <div className="coss-stack">
        <MetricStrip items={[{ label: "Users", value: "3" }, { label: "Admins", value: "1", tone: "warning" }, { label: "Blocked", value: "1", tone: "destructive" }, { label: "Deleted", value: "0" }]} />
        <CardFrame>
          <CardHeader title="Users" description="Directory, billing limits, admin state, block/unblock, and deletion." />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <input className="coss-input" placeholder="Search users" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 260 }} />
              <select className="coss-select" value={status} onChange={(event) => setStatus(event.target.value)} style={{ width: 160 }}>
                <option value="all">All users</option>
                <option value="active">active</option>
                <option value="blocked">blocked</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <DataTable
              columns={["Email", "Name", "Status", "Admin", "Balance", "Actions"]}
              rows={rows}
              renderRow={(row) => <tr key={row.id}><td>{row.email}</td><td>{row.name}</td><td><Badge tone={row.status === "blocked" ? "destructive" : "success"}>{row.status}</Badge></td><td>{row.admin ? "yes" : "no"}</td><td>{row.balance}</td><td className="coss-table__actions"><Button variant="outline" size="sm" aria-label={`Edit user ${row.email}`} onClick={() => setDrawer(row)}>Edit</Button><Button variant="outline" size="sm" aria-label={`Toggle admin ${row.email}`} onClick={() => setConfirm(`Toggle admin ${row.email}`)}>Admin</Button><Button variant="destructive" size="sm" aria-label={`Block or delete ${row.email}`} onClick={() => setConfirm(`Block/delete ${row.email}`)}>Block / delete</Button></td></tr>}
            />
          </CardContent>
        </CardFrame>
      </div>
      <Drawer title={drawer?.email ?? ""} description="Billing and account controls." open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        <div className="coss-form">
          <Field label="Prepaid balance"><input className="coss-input" defaultValue={drawer?.balance} /></Field>
          <Field label="Managed limit"><input className="coss-input" defaultValue="$300.00" /></Field>
          <Button>Save billing</Button>
          <Button variant="destructive">Block / delete</Button>
          <Alert tone="warning" title="Last-admin protection">The current administrator cannot remove the final admin path.</Alert>
        </div>
      </Drawer>
      <Dialog title={confirm ?? ""} description="User administration changes require confirmation." open={Boolean(confirm)} onConfirm={() => setConfirm(null)} onClose={() => setConfirm(null)} />
    </>
  );
}

export function AdminClusterConsole() {
  const [drawer, setDrawer] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  return (
    <>
      <Toast message={toast.message} />
      <div className="coss-stack">
        <MetricStrip items={[{ label: "Control plane", value: "healthy", tone: "success" }, { label: "Nodes", value: "6" }, { label: "Ready", value: "5", tone: "success" }, { label: "Attention", value: "1", tone: "warning" }]} />
        <div className="coss-split">
          <CardFrame>
            <CardHeader title="Platform node join" description="Issue a platform-scoped join key once." />
            <CardContent className="coss-stack">
              <Button onClick={() => setSecret("fugue node join --platform --key fgp_once_123")}>Issue join key</Button>
              <CodeBlock>fugue node join --platform --key &lt;visible-once&gt;</CodeBlock>
            </CardContent>
          </CardFrame>
          <CardFrame>
            <CardHeader title="Runtime node policy" description="Control plane role, build allowance, workload placement." />
            <CardContent className="coss-stack">
              <div className="coss-policy-list">
                {servers.map((server) => (
                  <div className="coss-policy-row" key={server.id}>
                    <div className="coss-policy-row__main">
                      <strong className="coss-mono">{server.id}</strong>
                      <span>{server.role}</span>
                    </div>
                    <div className="coss-policy-row__meta">
                      <Badge tone="info">allowed</Badge>
                      <Badge tone="success">ready</Badge>
                    </div>
                    <Button variant="outline" size="sm" aria-label={`Edit policy ${server.id}`} onClick={() => setDrawer(server.id)}>Edit policy</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </CardFrame>
        </div>
      </div>
      <Drawer title={drawer ?? ""} description="Policy editor" open={Boolean(drawer)} onClose={() => setDrawer(null)}>
        <div className="coss-form">
          <Field label="Control plane role"><select className="coss-select"><option>none</option><option>candidate</option></select></Field>
          <Field label="Build allowed"><select className="coss-select"><option>enabled</option><option>disabled</option></select></Field>
          <Field label="Workload placement"><select className="coss-select"><option>allowed</option><option>drain</option></select></Field>
          <Alert tone="info" title="Policy diff">build allowed: enabled → disabled; placement: allowed → drain.</Alert>
          <Button onClick={() => setConfirm(true)}>Save policy</Button>
        </div>
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
      <Dialog title="Confirm policy diff" description="Apply the pending runtime node policy diff and wait for reconcile." open={confirm} onConfirm={() => {
        setConfirm(false);
        setDrawer(null);
      }} onClose={() => setConfirm(false)} />
    </>
  );
}

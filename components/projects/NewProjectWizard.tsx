"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RuntimeTarget } from "@/lib/fugue/console";
import { useGitHubConnection } from "@/lib/github/connection-client";
import { useT } from "@/lib/i18n/client";

type Source = "github" | "image" | "upload";

type ImportResult = {
  app?: { id?: string | null; project_id?: string | null } | null;
  project?: { id?: string | null } | null;
};

type EnvRow = { id: number; key: string; value: string };

const SOURCES: { id: Source; label: string; hint: string }[] = [
  { id: "github", label: "GitHub repository", hint: "Build and deploy from a public or private repo" },
  { id: "image", label: "Container image", hint: "Reference an existing image directly" },
  { id: "upload", label: "Upload source", hint: "Upload a .zip / .tgz / .tar.gz archive" },
];

const BUILD_STRATEGIES = [
  { value: "", label: "Auto-detect" },
  { value: "buildpack", label: "Buildpack" },
  { value: "dockerfile", label: "Dockerfile" },
];

let envRowSeq = 0;
function newEnvRow(): EnvRow {
  return { id: ++envRowSeq, key: "", value: "" };
}

export default function NewProjectWizard({ runtimes }: { runtimes: RuntimeTarget[] }) {
  const router = useRouter();
  const t = useT();

  const [source, setSource] = useState<Source>("github");

  // common
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [appName, setAppName] = useState("");

  // github
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [manualToken, setManualToken] = useState("");

  // image
  const [imageRef, setImageRef] = useState("");

  // upload
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // advanced
  const [advOpen, setAdvOpen] = useState(false);
  const [runtimeId, setRuntimeId] = useState("");
  const [servicePort, setServicePort] = useState("");
  const [buildStrategy, setBuildStrategy] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContextDir, setBuildContextDir] = useState("");
  const [sourceDir, setSourceDir] = useState("");
  const [startupCommand, setStartupCommand] = useState("");
  const [envRows, setEnvRows] = useState<EnvRow[]>([newEnvRow()]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub connection — only relevant when importing a private repo.
  const gh = useGitHubConnection({
    enabled: source === "github",
    returnTo: "/projects/new",
  });

  const envObject = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of envRows) {
      const k = row.key.trim();
      if (k) out[k] = row.value;
    }
    return out;
  }, [envRows]);

  const showBuildFields = source === "github" || source === "upload";
  const needsPrivateAuth = source === "github" && visibility === "private";
  const hasSavedConnection = Boolean(gh.connection?.connected);
  const connectEnabled = Boolean(gh.connection?.authEnabled);

  function updateEnvRow(id: number, patch: Partial<EnvRow>) {
    setEnvRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addEnvRow() {
    setEnvRows((rows) => [...rows, newEnvRow()]);
  }
  function removeEnvRow(id: number) {
    setEnvRows((rows) => (rows.length <= 1 ? [newEnvRow()] : rows.filter((r) => r.id !== id)));
  }

  function pickFile(f: File | null) {
    setFile(f);
  }

  function validate(): string | null {
    if (source === "github" && !repoUrl.trim()) return t("Enter a repository URL");
    if (source === "image" && !imageRef.trim()) return t("Enter an image reference");
    if (source === "upload" && !file) return t("Select a source archive to upload");
    if (servicePort.trim()) {
      const n = Number(servicePort.trim());
      if (!Number.isInteger(n) || n <= 0) return t("Service port must be a positive integer");
    }
    if (needsPrivateAuth && !hasSavedConnection && !manualToken.trim()) {
      // These fields live in the advanced section — surface them.
      setAdvOpen(true);
      return t("Private repositories require connecting GitHub or providing an access token");
    }
    return null;
  }

  async function postJson(path: string, payload: Record<string, unknown>): Promise<ImportResult> {
    const res = await fetch(`/api/console${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error || t("Request failed ({status})", { status: res.status }));
    return (data?.result ?? data) as ImportResult;
  }

  async function postUpload(payload: Record<string, unknown>, f: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", f, f.name);
    const res = await fetch("/api/console/projects/import-upload", {
      method: "POST",
      body: form,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error || t("Request failed ({status})", { status: res.status }));
    return (data?.result ?? data) as ImportResult;
  }

  async function submit() {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setBusy(true);
    setError(null);

    const common: Record<string, unknown> = {
      projectName: projectName.trim() || undefined,
      projectDescription: projectDescription.trim() || undefined,
      appName: appName.trim() || undefined,
      runtimeId: runtimeId || undefined,
      servicePort: servicePort.trim() || undefined,
      startupCommand: startupCommand.trim() || undefined,
      env: Object.keys(envObject).length ? envObject : undefined,
    };
    const buildFields: Record<string, unknown> = {
      buildStrategy: buildStrategy || undefined,
      dockerfilePath: dockerfilePath.trim() || undefined,
      buildContextDir: buildContextDir.trim() || undefined,
      sourceDir: sourceDir.trim() || undefined,
    };

    try {
      let result: ImportResult;
      if (source === "github") {
        result = await postJson("/projects/import-github", {
          ...common,
          ...buildFields,
          repoUrl: repoUrl.trim(),
          branch: branch.trim() || undefined,
          repoVisibility: visibility,
          repoAuthToken: needsPrivateAuth && manualToken.trim() ? manualToken.trim() : undefined,
        });
      } else if (source === "image") {
        result = await postJson("/projects/import-image", {
          ...common,
          imageRef: imageRef.trim(),
        });
      } else {
        result = await postUpload({ ...common, ...buildFields }, file as File);
      }

      const projectId = result?.app?.project_id || result?.project?.id;
      if (projectId) {
        router.push(`/projects/${encodeURIComponent(projectId)}`);
      } else {
        router.push("/projects");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to create project"));
      setBusy(false);
    }
  }

  return (
    <form
      className="wizard"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) submit();
      }}
    >
      {/* source selector */}
      <section className="panel wizard-block">
        <div className="wizard-block-h">
          <span className="eyebrow">{t("Source")}</span>
          <h2>{t("Where to deploy from")}</h2>
        </div>
        <div className="wizard-src">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`src-card${source === s.id ? " active" : ""}`}
              onClick={() => setSource(s.id)}
              aria-pressed={source === s.id}
            >
              <span className="src-card-label">{t(s.label)}</span>
              <span className="src-card-hint">{t(s.hint)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* per-source fields */}
      <section className="panel wizard-block">
        <div className="wizard-block-h">
          <span className="eyebrow">{t("Source configuration")}</span>
          <h2>
            {source === "github"
              ? t("GitHub repository")
              : source === "image"
                ? t("Container image")
                : t("Source archive")}
          </h2>
        </div>

        {source === "github" && (
          <div className="form">
            <div className="form-row">
              <label>{t("Repository URL *")}</label>
              <input
                className="input mono"
                autoFocus
                value={repoUrl}
                placeholder={t("https://github.com/owner/repo or owner/repo")}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        {source === "image" && (
          <div className="form">
            <div className="form-row">
              <label>{t("Image reference *")}</label>
              <input
                className="input mono"
                autoFocus
                value={imageRef}
                placeholder={t("docker.io/library/nginx:1.27 or ghcr.io/owner/app:tag")}
                onChange={(e) => setImageRef(e.target.value)}
              />
            </div>
          </div>
        )}

        {source === "upload" && (
          <div className="form">
            <div
              className={`file-drop${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0] ?? null;
                pickFile(f);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tgz,.tar.gz"
                hidden
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="file-drop-file">
                  <span className="nm">{file.name}</span>
                  <span className="sz">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      pickFile(null);
                    }}
                  >
                    {t("Remove")}
                  </button>
                </div>
              ) : (
                <div className="file-drop-empty">
                  <div className="file-drop-title">{t("Drop or click to select an archive")}</div>
                  <div className="form-hint">{t("Supports .zip / .tgz / .tar.gz, up to 64 MB")}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* advanced */}
      <section className="panel wizard-block">
        <button
          type="button"
          className="wizard-adv-toggle"
          onClick={() => setAdvOpen((v) => !v)}
          aria-expanded={advOpen}
        >
          <span className={`chev${advOpen ? " open" : ""}`}>›</span>
          {t("Advanced configuration")}
          <span className="form-hint">{t("Runtime, port, build strategy, environment variables")}</span>
        </button>

        {advOpen && (
          <div className="wizard-adv">
            <div className="form">
              <div className="form-row">
                <label>{t("Project name")}</label>
                <input
                  className="input"
                  value={projectName}
                  placeholder={t("Optional, defaults to the source name with a suffix appended on collision")}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>{t("App name")}</label>
                <input
                  className="input"
                  value={appName}
                  placeholder={t("Optional, defaults to the project name")}
                  onChange={(e) => setAppName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>{t("Description")}</label>
                <input
                  className="input"
                  value={projectDescription}
                  placeholder={t("Optional, describe what the project is for")}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
              {source === "github" && (
                <>
                  <div className="form-row">
                    <label>{t("Branch")}</label>
                    <input
                      className="input mono"
                      value={branch}
                      placeholder={t("Optional, defaults to the repository default branch")}
                      onChange={(e) => setBranch(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>{t("Visibility")}</label>
                    <div className="wseg">
                      <button
                        type="button"
                        className={visibility === "public" ? "active" : ""}
                        onClick={() => setVisibility("public")}
                      >
                        {t("Public")}
                      </button>
                      <button
                        type="button"
                        className={visibility === "private" ? "active" : ""}
                        onClick={() => setVisibility("private")}
                      >
                        {t("Private")}
                      </button>
                    </div>
                  </div>
                  {needsPrivateAuth && (
                    <div className="form-row">
                      <label>{t("Private repository authorization")}</label>
                      <div className="gh-auth">
                        {gh.loading ? (
                          <div className="form-hint">{t("Checking GitHub connection…")}</div>
                        ) : hasSavedConnection ? (
                          <div className="gh-auth-ok">
                            {t("GitHub connected")}
                            {gh.connection?.login ? ` · @${gh.connection.login}` : ""}
                            <a className="btn ghost sm" href={gh.connectHref}>
                              {t("Reconnect")}
                            </a>
                          </div>
                        ) : (
                          <div className="gh-auth-connect">
                            {connectEnabled && (
                              <>
                                <a className="btn" href={gh.connectHref}>
                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
                                  </svg>
                                  {t("Connect GitHub account")}
                                </a>
                                <span className="form-hint">{t("Or paste an access token directly below")}</span>
                              </>
                            )}
                            <input
                              className="input mono"
                              type="password"
                              value={manualToken}
                              placeholder={t("ghp_... access token (used only for this deploy)")}
                              onChange={(e) => setManualToken(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                        )}
                        {gh.error && <div className="form-hint err">{gh.error}</div>}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="form-row">
                <label>{t("Runtime target")}</label>
                <select
                  className="input"
                  value={runtimeId}
                  onChange={(e) => setRuntimeId(e.target.value)}
                >
                  <option value="">{t("Auto-assign")}</option>
                  {runtimes.map((r) => (
                    <option key={r.id || r.name} value={r.id || ""}>
                      {r.name || r.machine_name || r.id}
                      {r.status ? ` · ${r.status}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>{t("Service port")}</label>
                <input
                  className="input mono"
                  value={servicePort}
                  placeholder={t("e.g. 8080")}
                  inputMode="numeric"
                  onChange={(e) => setServicePort(e.target.value)}
                />
              </div>
              {showBuildFields && (
                <>
                  <div className="form-row">
                    <label>{t("Build strategy")}</label>
                    <select
                      className="input"
                      value={buildStrategy}
                      onChange={(e) => setBuildStrategy(e.target.value)}
                    >
                      {BUILD_STRATEGIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {t(s.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>{t("Dockerfile path")}</label>
                    <input
                      className="input mono"
                      value={dockerfilePath}
                      placeholder={t("Optional, e.g. Dockerfile or docker/Dockerfile")}
                      onChange={(e) => setDockerfilePath(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>{t("Build context directory")}</label>
                    <input
                      className="input mono"
                      value={buildContextDir}
                      placeholder={t("Optional, e.g. .")}
                      onChange={(e) => setBuildContextDir(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>{t("Source subdirectory")}</label>
                    <input
                      className="input mono"
                      value={sourceDir}
                      placeholder={t("Optional, monorepo subdirectory")}
                      onChange={(e) => setSourceDir(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="form-row">
                <label>{t("Startup command")}</label>
                <input
                  className="input mono"
                  value={startupCommand}
                  placeholder={t("Optional, override the image default command")}
                  onChange={(e) => setStartupCommand(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>{t("Environment variables")}</label>
                <div className="kvedit">
                  {envRows.map((row) => (
                    <div className="kvedit-row" key={row.id}>
                      <input
                        className="input mono"
                        value={row.key}
                        placeholder="KEY"
                        onChange={(e) => updateEnvRow(row.id, { key: e.target.value })}
                      />
                      <input
                        className="input mono"
                        value={row.value}
                        placeholder="value"
                        onChange={(e) => updateEnvRow(row.id, { value: e.target.value })}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t("Delete")}
                        onClick={() => removeEnvRow(row.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost sm kvedit-add" onClick={addEnvRow}>
                    {t("+ Add variable")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {error && <div className="wb-alert err">{error}</div>}

      <div className="wizard-foot">
        <a className="btn ghost" href="/projects">
          {t("Cancel")}
        </a>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? t("Creating…") : t("Create project and deploy")}
        </button>
      </div>
    </form>
  );
}

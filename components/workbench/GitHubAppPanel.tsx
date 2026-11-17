"use client";
import { useEffect, useRef, useState } from "react";
import type { GitHubImageSettings } from "@/lib/github/app-types";
import { useT } from "@/lib/i18n/client";
import { ActionButton, callConsole, useEndpointData } from "./shared";

export default function GitHubAppPanel({ appId }: { appId: string }) {
  const t = useT();
  const path = `/apps/${encodeURIComponent(appId)}/github-app`;
  const { data, error, loading, refresh } = useEndpointData<GitHubImageSettings>(`/api/console${path}`);
  const [repo, setRepo] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [branch, setBranch] = useState("main");
  const [mode, setMode] = useState("workflow");
  const [packageName, setPackageName] = useState("");
  const [notice, setNotice] = useState("");
  const initialized = useRef(false);
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setRepo(data.link?.githubRepo ?? "");
    setWorkflow(data.link?.githubWorkflow ?? "");
    setBranch(data.link?.githubBranch || "main");
    setMode(data.link?.githubPackage ? "package" : "workflow");
    setPackageName(data.link?.githubPackage ?? "");
    if (new URLSearchParams(window.location.search).get("githubApp") === "installed") setNotice("GitHub App installed. Save the repository link to enable notifications.");
    if (new URLSearchParams(window.location.search).get("githubApp") === "failed") setNotice("GitHub App installation could not be verified. Check repository access and try again.");
  }, [data]);
  const hasPending = data?.jobs.some((job) => job.status === "pending" || job.status === "processing");
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15_000);
    return () => clearInterval(timer);
  }, [hasPending, refresh]);
  function returnTo() { return `${window.location.pathname}${window.location.search}`; }
  function install() {
    const params = new URLSearchParams({ githubRepo: repo, returnTo: returnTo() });
    window.location.assign(`/api/github/app/install/start?${params}`);
  }
  return <section className="panel">
    <div className="panel-h"><h3>{t("GitHub App image notifications")}</h3></div>
    <div className="form">
      <p className="sub">{t("After a successful workflow publishes your image, GitHub notifies Fugue to sync it immediately. Image polling remains a fallback.")}</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{t(notice)}</p>}
      {loading && !data && <p>{t("Loading…")}</p>}
      {data && !data.configured && <p>{t("GitHub App is not configured by this Fugue installation.")}</p>}
      {data && !data.trackingEnabled && <p>{t("Enable external image tracking for this service before linking a repository.")}</p>}
      {data?.imageRef && <div className="form-row"><label>{t("Tracked image")}</label><span className="mono">{data.imageRef}</span></div>}
      {data?.configured && <>
        <div className="form-row"><label htmlFor={`github-repo-${appId}`}>{t("GitHub repository")}</label><input id={`github-repo-${appId}`} className="input mono" placeholder="owner/repo" value={repo} onChange={(event) => setRepo(event.target.value)} /></div>
        <div className="form-row"><label htmlFor={`github-event-${appId}`}>{t("Release event")}</label><select id={`github-event-${appId}`} className="input" value={mode} onChange={(event) => setMode(event.target.value)}><option value="workflow">{t("Successful workflow")}</option><option value="package">{t("GitHub container package")}</option></select></div>
        {mode === "package" ? <>
          <div className="form-row"><label htmlFor={`github-package-${appId}`}>{t("Container package name")}</label><input id={`github-package-${appId}`} className="input mono" value={packageName} onChange={(event) => setPackageName(event.target.value)} /></div>
          <p className="sub">{t("Package events apply only to GitHub Packages. For Docker Hub images, select the publishing workflow.")}</p>
        </> : <>
        <div className="form-row"><label htmlFor={`github-branch-${appId}`}>{t("Release branch")}</label><input id={`github-branch-${appId}`} className="input mono" value={branch} onChange={(event) => setBranch(event.target.value)} /></div>
        <div className="form-row"><label htmlFor={`github-workflow-${appId}`}>{t("Release workflow")}</label><input id={`github-workflow-${appId}`} className="input mono" placeholder=".github/workflows/release.yml" value={workflow} onChange={(event) => setWorkflow(event.target.value)} /></div>
        <p className="sub">{t("Use the workflow name or file path that publishes the tracked image. Leave blank to accept successful workflows on this branch.")}</p>
        </>}
        {data.link && <p>{t(data.link.enabled ? "Repository notifications enabled" : "Repository notifications disabled")}</p>}
        {data.link?.lastWebhookReceivedAt && <p>{t("Last GitHub notification")}: <time>{data.link.lastWebhookReceivedAt}</time></p>}
        {data.link?.lastImageSyncAt && <p>{t("Last image sync request")}: <time>{data.link.lastImageSyncAt}</time></p>}
        {data.link?.lastImageSyncError && <p role="alert">{data.link.lastImageSyncError}</p>}
      </>}
      {data?.jobs.length ? <details><summary>{t("Recent GitHub notifications")}</summary>{data.jobs.map((job) => <div key={job.deliveryId} className="form-row"><span className="mono">{job.deliveryId.slice(0, 12)}</span><span>{t(job.status)} · {job.attempts} · {job.updatedAt}{job.operationId && <> · <span className="mono">{job.operationId}</span></>}{job.lastError && <p>{job.lastError}</p>}</span></div>)}</details> : null}
    </div>
    <div className="form-foot">
      <button className="btn ghost" onClick={refresh}>{t("Refresh")}</button>
      {data?.configured && !data.githubConnected && <button className="btn" onClick={() => window.location.assign(`/api/auth/github/connect/start?${new URLSearchParams({ returnTo: returnTo() })}`)}>{t("Connect GitHub")}</button>}
      {data?.configured && data.githubConnected && <>
        <button className="btn" disabled={!repo.trim()} onClick={install}>{t("Install GitHub App")}</button>
        <ActionButton className="btn primary" disabled={!data.trackingEnabled || !repo.trim() || !(mode === "package" ? packageName.trim() : branch.trim())} onAction={() => callConsole(path, { method: "PUT", body: { githubRepo: repo, githubWorkflow: mode === "workflow" ? workflow : "", githubBranch: mode === "workflow" ? branch : "", githubPackage: mode === "package" ? packageName : "" } })} onDone={() => { setNotice(""); refresh(); }}>{t("Save repository link")}</ActionButton>
      </>}
      {data?.link?.enabled && <ActionButton onAction={() => callConsole(path, { method: "DELETE" })} onDone={refresh}>{t("Disable notifications")}</ActionButton>}
      {data?.jobs.some((job) => job.status === "failed") && <ActionButton onAction={() => callConsole(path)} onDone={refresh}>{t("Retry failed notifications")}</ActionButton>}
    </div>
  </section>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import { fmtBytes, fmtMillicores } from "@/lib/format";
import ProjectSettings from "./ProjectSettings";
import {
  EnvTab,
  FilesTab,
  ImagesTab,
  LogsTab,
  ObservabilityTab,
  RouteTab,
} from "./tabs";
import { DbFailoverTab, DbOverviewTab, SettingsTab } from "./settings-tabs";

/** A workbench entry: either a deployed app or a backing (database) service. */
export type WorkbenchService =
  | { kind: "app"; id: string; name: string; app: ConsoleAppDetail; phase?: string }
  | { kind: "db"; id: string; name: string; svc: BackingService; phase?: string };

const APP_TABS = ["路由", "环境变量", "日志", "文件", "镜像", "可观测性", "设置"] as const;
const DB_TABS = ["概览", "故障转移", "设置"] as const;

const PROJECT_KEY = "__project__";

function phaseTone(phase?: string): string {
  const p = (phase ?? "").toLowerCase();
  if (["running", "ready", "deployed", "active"].includes(p)) return "ok";
  if (["deploying", "building", "queued", "updating", "pending"].includes(p)) return "run";
  if (["failed", "error"].includes(p)) return "err";
  if (["paused", "stopped", "disabled"].includes(p)) return "warn";
  return "idle";
}

function AppIcon() {
  return (
    <svg className="svc-card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function DbIcon() {
  return (
    <svg className="svc-card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}

export default function ProjectWorkbench({
  services,
  projectId,
  projectName,
  projectDescription,
  initialServiceId,
  initialTab,
}: {
  services: WorkbenchService[];
  projectId: string;
  projectName: string;
  projectDescription: string;
  initialServiceId?: string;
  initialTab?: string;
}) {
  const router = useRouter();

  // selectedId: null = overview grid; PROJECT_KEY = project settings; else a service id.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialServiceId === PROJECT_KEY) return PROJECT_KEY;
    if (initialServiceId && services.some((s) => s.id === initialServiceId)) {
      return initialServiceId;
    }
    return null;
  });

  const selected = useMemo(
    () => (selectedId && selectedId !== PROJECT_KEY
      ? services.find((s) => s.id === selectedId) ?? null
      : null),
    [services, selectedId],
  );

  const tabs = selected?.kind === "db" ? DB_TABS : APP_TABS;
  const [tab, setTab] = useState<string>(
    initialTab && (tabs as readonly string[]).includes(initialTab) ? initialTab : tabs[0],
  );

  // Keep URL in sync without a navigation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedId === null) {
      params.delete("service");
      params.delete("tab");
    } else if (selectedId === PROJECT_KEY) {
      params.set("service", PROJECT_KEY);
      params.delete("tab");
    } else {
      params.set("service", selectedId);
      params.set("tab", tab);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [selectedId, tab]);

  function openService(id: string, initialTabName?: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    const nextTabs = svc.kind === "db" ? DB_TABS : APP_TABS;
    setSelectedId(id);
    setTab(
      initialTabName && (nextTabs as readonly string[]).includes(initialTabName)
        ? initialTabName
        : nextTabs[0],
    );
  }

  // ---- Level 2: project settings ----
  if (selectedId === PROJECT_KEY) {
    return (
      <div className="wb-main">
        <div className="svc-detail-head">
          <button type="button" className="back" onClick={() => setSelectedId(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            返回
          </button>
          <h2>项目设置</h2>
        </div>
        <ProjectSettings
          projectId={projectId}
          name={projectName}
          description={projectDescription}
        />
      </div>
    );
  }

  // ---- Level 2: a single service ----
  if (selected) {
    return (
      <div className="wb-main">
        <div className="svc-detail-head">
          <button type="button" className="back" onClick={() => setSelectedId(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            返回
          </button>
          <h2>{selected.name}</h2>
          <span className={`chip ${phaseTone(selected.phase)}`}>
            {selected.phase || (selected.kind === "db" ? "database" : "app")}
          </span>
          <span className="kind">{selected.kind === "db" ? "数据库" : "应用"}</span>
        </div>

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={`tab ${t === tab ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {selected.kind === "app" && renderAppTab(tab, selected.app, () => router.push("/projects"))}
        {selected.kind === "db" && renderDbTab(tab, selected.svc)}
      </div>
    );
  }

  // ---- Level 1: overview cards ----
  return (
    <div>
      <div className="wb-sec">
        <span className="eyebrow">服务</span>
        <span className="wb-sec-n">{services.length}</span>
        <button
          type="button"
          className="btn ghost wb-sec-act"
          onClick={() => setSelectedId(PROJECT_KEY)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          项目设置
        </button>
      </div>

      {services.length === 0 ? (
        <div className="empty">该项目还没有服务</div>
      ) : (
        <div className="svc-grid">
          {services.map((s) => (
            <ServiceCard key={s.id} svc={s} onOpen={openService} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  svc,
  onOpen,
}: {
  svc: WorkbenchService;
  onOpen: (id: string, tab?: string) => void;
}) {
  const isDb = svc.kind === "db";
  const usage =
    svc.kind === "app" ? svc.app.current_resource_usage : svc.svc.current_resource_usage;

  return (
    <div className="svc-card">
      <button type="button" className="svc-card-body" onClick={() => onOpen(svc.id)}>
        <div className="svc-card-top">
          {isDb ? <DbIcon /> : <AppIcon />}
          <span className="svc-card-nm" title={svc.name}>
            {svc.name}
          </span>
        </div>
        <div className="svc-card-phase">
          <span className={`dot ${phaseTone(svc.phase)}`} />
          {isDb ? "数据库" : "应用"}
          {svc.phase ? ` · ${svc.phase}` : ""}
        </div>
        <div className="svc-card-metrics">
          <div className="svc-card-metric">
            <span className="k">CPU</span>
            <span className="v">{usage ? fmtMillicores(usage.cpu_millicores ?? 0) : "—"}</span>
          </div>
          <div className="svc-card-metric">
            <span className="k">内存</span>
            <span className="v">{usage ? fmtBytes(usage.memory_bytes ?? 0) : "—"}</span>
          </div>
          <div className="svc-card-metric">
            <span className="k">磁盘</span>
            <span className="v">
              {usage ? fmtBytes(usage.ephemeral_storage_bytes ?? 0) : "—"}
            </span>
          </div>
        </div>
      </button>
      <div className="svc-card-foot">
        <button type="button" className="btn primary" onClick={() => onOpen(svc.id)}>
          管理
        </button>
        {svc.kind === "app" && (
          <button type="button" className="btn" onClick={() => onOpen(svc.id, "日志")}>
            日志
          </button>
        )}
      </div>
    </div>
  );
}

function renderAppTab(tab: string, app: ConsoleAppDetail, onDeleted: () => void) {
  switch (tab) {
    case "路由":
      return <RouteTab app={app} />;
    case "环境变量":
      return <EnvTab app={app} />;
    case "日志":
      return <LogsTab app={app} />;
    case "文件":
      return <FilesTab app={app} />;
    case "镜像":
      return <ImagesTab app={app} />;
    case "可观测性":
      return <ObservabilityTab app={app} />;
    case "设置":
      return <SettingsTab app={app} onDeleted={onDeleted} />;
    default:
      return null;
  }
}

function renderDbTab(tab: string, svc: BackingService) {
  switch (tab) {
    case "概览":
      return <DbOverviewTab svc={svc} />;
    case "故障转移":
      return <DbFailoverTab svc={svc} />;
    case "设置":
      return <DbOverviewTab svc={svc} />;
    default:
      return null;
  }
}

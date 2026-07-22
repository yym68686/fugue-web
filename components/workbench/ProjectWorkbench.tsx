"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import {
  EnvTab,
  FilesTab,
  ImagesTab,
  LogsTab,
  ObservabilityTab,
  RouteTab,
} from "./tabs";
import {
  DbFailoverTab,
  DbOverviewTab,
  SettingsTab,
} from "./settings-tabs";

/** A workbench entry: either a deployed app or a backing (database) service. */
export type WorkbenchService =
  | { kind: "app"; id: string; name: string; app: ConsoleAppDetail; phase?: string }
  | { kind: "db"; id: string; name: string; svc: BackingService; phase?: string };

const APP_TABS = ["路由", "环境变量", "日志", "文件", "镜像", "可观测性", "设置"] as const;
const DB_TABS = ["概览", "故障转移", "设置"] as const;

function phaseTone(phase?: string): string {
  const p = (phase ?? "").toLowerCase();
  if (["running", "ready", "deployed", "active"].includes(p)) return "ok";
  if (["deploying", "building", "queued", "updating", "pending"].includes(p)) return "run";
  if (["failed", "error"].includes(p)) return "err";
  if (["paused", "stopped", "disabled"].includes(p)) return "warn";
  return "idle";
}

export default function ProjectWorkbench({
  services,
  initialServiceId,
  initialTab,
}: {
  services: WorkbenchService[];
  initialServiceId?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(
    initialServiceId && services.some((s) => s.id === initialServiceId)
      ? initialServiceId
      : services[0]?.id ?? "",
  );

  const selected = useMemo(
    () => services.find((s) => s.id === selectedId) ?? services[0],
    [services, selectedId],
  );

  const tabs = selected?.kind === "db" ? DB_TABS : APP_TABS;
  const [tab, setTab] = useState<string>(
    initialTab && (tabs as readonly string[]).includes(initialTab) ? initialTab : tabs[0],
  );

  // Keep URL in sync (?service=&tab=) without a navigation.
  useEffect(() => {
    if (!selected) return;
    const params = new URLSearchParams(window.location.search);
    params.set("service", selected.id);
    params.set("tab", tab);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, [selected, tab]);

  function selectService(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setSelectedId(id);
    const nextTabs = svc.kind === "db" ? DB_TABS : APP_TABS;
    setTab(nextTabs[0]);
  }

  if (!selected) {
    return <div className="empty">该项目还没有服务</div>;
  }

  return (
    <div className="wb">
      <aside className="wb-rail">
        <div className="wb-rail-head">
          <span className="eyebrow">服务</span>
          <span className="eyebrow">{services.length}</span>
        </div>
        {services.map((s) => (
          <button
            key={s.id}
            className={`wb-svc ${s.id === selected.id ? "active" : ""}`}
            onClick={() => selectService(s.id)}
          >
            <span className={`dot ${phaseTone(s.phase)} dot-lead`} />
            <span style={{ minWidth: 0 }}>
              <span className="wb-svc-nm">{s.name}</span>
              <span className="wb-svc-sub">
                {s.kind === "db" ? "数据库" : "应用"}
                {s.phase ? ` · ${s.phase}` : ""}
              </span>
            </span>
          </button>
        ))}
      </aside>

      <div className="wb-main">
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

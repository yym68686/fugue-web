"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import { fmtBytes, fmtMillicores, fmtStorageUsage } from "@/lib/format";
import { readRuntimeCountryCode } from "@/lib/geo/country";
import CountryLabel from "@/components/geo/CountryLabel";
import { useT } from "@/lib/i18n/client";
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

const APP_TABS = ["Route", "Environment variables", "Logs", "Files", "Images", "Observability", "Settings"] as const;
const DB_TABS = ["Overview", "Failover", "Settings"] as const;

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
  const t = useT();
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
            {t("Back")}
          </button>
          <h2>{t("Project settings")}</h2>
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
            {t("Back")}
          </button>
          <h2>{selected.name}</h2>
          <span className={`chip ${phaseTone(selected.phase)}`}>
            {selected.phase || (selected.kind === "db" ? "database" : "app")}
          </span>
          <span className="kind">{selected.kind === "db" ? t("Database") : t("App")}</span>
        </div>

        <div className="tabs">
          {tabs.map((t_) => (
            <button
              key={t_}
              className={`tab ${t_ === tab ? "active" : ""}`}
              onClick={() => setTab(t_)}
            >
              {t(t_)}
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
        <span className="eyebrow">{t("Services")}</span>
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
          {t("Project settings")}
        </button>
      </div>

      {services.length === 0 ? (
        <div className="empty">{t("This project has no services yet")}</div>
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
  const t = useT();
  const isDb = svc.kind === "db";
  const countryCode =
    svc.kind === "app"
      ? readRuntimeCountryCode(
          svc.app.status?.current_runtime_id,
          svc.app.spec?.runtime_id,
        )
      : readRuntimeCountryCode(svc.svc.database_runtime_id, svc.svc.location_label);
  const usage =
    svc.kind === "app" ? svc.app.current_resource_usage : svc.svc.current_resource_usage;
  const hasPersistentStorage =
    usage?.persistent_storage_used_bytes != null ||
    usage?.persistent_storage_capacity_bytes != null;
  const storageLabel = hasPersistentStorage ? t("Persistent disk") : t("Ephemeral disk");
  const storageValue = !usage
    ? "—"
    : hasPersistentStorage
      ? fmtStorageUsage(
          usage.persistent_storage_used_bytes,
          usage.persistent_storage_capacity_bytes,
        )
      : fmtBytes(usage.ephemeral_storage_bytes ?? 0);

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
          {isDb ? t("Database") : t("App")}
          {svc.phase ? ` · ${svc.phase}` : ""}
          {countryCode && (
            <>
              <span className="svc-card-sep">·</span>
              <CountryLabel countryCode={countryCode} className="svc-card-loc" />
            </>
          )}
        </div>
        <div className="svc-card-metrics">
          <div className="svc-card-metric">
            <span className="k">CPU</span>
            <span className="v">{usage ? fmtMillicores(usage.cpu_millicores ?? 0) : "—"}</span>
          </div>
          <div className="svc-card-metric">
            <span className="k">{t("Memory")}</span>
            <span className="v">{usage ? fmtBytes(usage.memory_bytes ?? 0) : "—"}</span>
          </div>
          <div className="svc-card-metric">
            <span className="k">{storageLabel}</span>
            <span className="v">{storageValue}</span>
          </div>
        </div>
      </button>
      <div className="svc-card-foot">
        <button type="button" className="btn primary" onClick={() => onOpen(svc.id)}>
          {t("Manage")}
        </button>
        {svc.kind === "app" && (
          <button type="button" className="btn" onClick={() => onOpen(svc.id, "Logs")}>
            {t("Logs")}
          </button>
        )}
      </div>
    </div>
  );
}

function renderAppTab(tab: string, app: ConsoleAppDetail, onDeleted: () => void) {
  switch (tab) {
    case "Route":
      return <RouteTab app={app} />;
    case "Environment variables":
      return <EnvTab app={app} />;
    case "Logs":
      return <LogsTab app={app} />;
    case "Files":
      return <FilesTab app={app} />;
    case "Images":
      return <ImagesTab app={app} />;
    case "Observability":
      return <ObservabilityTab app={app} />;
    case "Settings":
      return <SettingsTab app={app} onDeleted={onDeleted} />;
    default:
      return null;
  }
}

function renderDbTab(tab: string, svc: BackingService) {
  switch (tab) {
    case "Overview":
      return <DbOverviewTab svc={svc} />;
    case "Failover":
      return <DbFailoverTab svc={svc} />;
    case "Settings":
      return <DbOverviewTab svc={svc} />;
    default:
      return null;
  }
}

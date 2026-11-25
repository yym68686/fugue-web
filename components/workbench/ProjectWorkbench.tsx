"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import {
  observedFailureNotice,
  observedStatusLabel,
  observedStatusTone,
} from "@/lib/fugue/observed-status";
import AppFailureNotice from "./AppFailureNotice";
import { useObservedStatusNow } from "@/lib/fugue/use-observed-status-now";
import { fmtBytes, fmtMillicores, fmtStorageUsage } from "@/lib/format";
import { readRuntimeCountryCode } from "@/lib/geo/country";
import CountryLabel from "@/components/geo/CountryLabel";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/ui/Icon";
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

function serviceTone(service: WorkbenchService, now: number): string {
  return service.kind === "app"
    ? observedStatusTone(service.app, now)
    : phaseTone(service.phase);
}

function servicePhase(service: WorkbenchService): string {
  return service.kind === "app" ? observedStatusLabel(service.app) : service.phase || "database";
}

function AppIcon() {
  return <Icon name="Services" />;
}

function DbIcon() {
  return <Icon name="Storage" />;
}

export default function ProjectWorkbench({
  services,
  projectId,
  projectName,
  projectDescription,
  initialServiceId,
  initialTab,
  initialObservedNow,
}: {
  services: WorkbenchService[];
  projectId: string;
  projectName: string;
  projectDescription: string;
  initialServiceId?: string;
  initialTab?: string;
  initialObservedNow: number;
}) {
  const t = useT();
  const router = useRouter();
  const observedNow = useObservedStatusNow(initialObservedNow);
  const tabListId = useId();

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

  useEffect(() => {
    const overview = document.getElementById(`project-overview-${projectId}`);
    if (!(overview instanceof HTMLDetailsElement)) return;
    if (selectedId === null) overview.open = true;
    else if (window.matchMedia("(max-width: 768px)").matches) overview.open = false;
  }, [projectId, selectedId]);

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
      <div className="wb-main workbench-detail">
        <div className="svc-detail-head">
          <button type="button" className="back" onClick={() => setSelectedId(null)}>
            <Icon name="ChevronLeft" />
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
      <div className="wb-main workbench-detail">
        <div className="svc-detail-head">
          <button type="button" className="back" onClick={() => setSelectedId(null)}>
            <Icon name="ChevronLeft" />
            {t("Back")}
          </button>
          <h2>{selected.name}</h2>
          <span className={`chip ${serviceTone(selected, observedNow)}`}>
            {servicePhase(selected)}
          </span>
          <span className="kind">{selected.kind === "db" ? t("Database") : t("App")}</span>
        </div>

        <div className="tabs workbench-tabs" role="tablist" aria-label={t("Services")} onKeyDown={(event) => {
          const current = tabs.findIndex((name) => name === tab);
          const target = event.key === "ArrowRight" ? (current + 1) % tabs.length
            : event.key === "ArrowLeft" ? (current + tabs.length - 1) % tabs.length
            : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (target < 0) return;
          event.preventDefault();
          setTab(tabs[target]);
          event.currentTarget.querySelectorAll("button")[target]?.focus();
        }}>
          {tabs.map((t_, index) => (
            <button
              key={t_}
              type="button"
              role="tab"
              id={`${tabListId}-${index}`}
              aria-selected={t_ === tab}
              aria-controls={`${tabListId}-panel`}
              tabIndex={t_ === tab ? 0 : -1}
              className={`tab ${t_ === tab ? "active" : ""}`}
              onClick={() => setTab(t_)}
            >
              {t(t_)}
            </button>
          ))}
        </div>

        {/* App-level, so it sits once below the tabs rather than in the title row
            or inside a single tab. */}
        {selected.kind === "app" && <AppFailureNotice app={selected.app} />}

        <div id={`${tabListId}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${tabListId}-${tabs.findIndex((name) => name === tab)}`}>
          {selected.kind === "app" && renderAppTab(tab, selected.app, () => router.push("/projects"), observedNow)}
          {selected.kind === "db" && renderDbTab(tab, selected.svc)}
        </div>
      </div>
    );
  }

  // ---- Level 1: overview cards ----
  return (
    <div>
      <div className="wb-sec">
        <h2>{t("Services")}</h2>
        <span className="wb-sec-n">{services.length}</span>
        <button
          type="button"
          className="btn ghost wb-sec-act"
          onClick={() => setSelectedId(PROJECT_KEY)}
        >
          <Icon name="Settings" />
          {t("Project settings")}
        </button>
      </div>

      {services.length === 0 ? (
        <div className="empty">{t("This project has no services yet")}</div>
      ) : (
        <div className="svc-grid">
          {services.map((s) => (
            <ServiceCard key={s.id} svc={s} onOpen={openService} observedNow={observedNow} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  svc,
  onOpen,
  observedNow,
}: {
  svc: WorkbenchService;
  onOpen: (id: string, tab?: string) => void;
  observedNow: number;
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
  const cardFailure = svc.kind === "app" ? observedFailureNotice(svc.app) : null;

  return (
    <div className="svc-card intent-row">
      <button type="button" className="svc-card-body" onClick={() => onOpen(svc.id)}>
        <div className="svc-card-top">
          {isDb ? <DbIcon /> : <AppIcon />}
          <span className="svc-card-nm" title={svc.name}>
            {svc.name}
          </span>
        </div>
        <div className="svc-card-phase">
          <span className={`dot ${serviceTone(svc, observedNow)}`} />
          {isDb ? t("Database") : t("App")}
          {` · ${servicePhase(svc)}`}
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
        {svc.kind === "app" && cardFailure && (
          // Amber would claim the app is broken now. A failure a later ready
          // release has already overtaken is history, so it stays muted.
          <div
            className={`svc-card-failure ${cardFailure.superseded ? "past" : ""}`}
            title={cardFailure.summary}
          >
            {t("last failure")}: {cardFailure.summary}
          </div>
        )}
      </button>
      {svc.kind === "app" && (
        <div className="svc-card-foot">
          <button type="button" className="btn" onClick={() => onOpen(svc.id, "Logs")}>
            {t("Logs")}
          </button>
        </div>
      )}
    </div>
  );
}

function renderAppTab(tab: string, app: ConsoleAppDetail, onDeleted: () => void, observedNow: number) {
  switch (tab) {
    case "Route":
      return <RouteTab app={app} observedNow={observedNow} />;
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
      return <SettingsTab app={app} onDeleted={onDeleted} observedNow={observedNow} />;
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

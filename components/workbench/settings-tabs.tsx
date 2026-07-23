"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import { readRuntimeCountryCode } from "@/lib/geo/country";
import CountryLabel from "@/components/geo/CountryLabel";
import { useT } from "@/lib/i18n/client";
import { ActionButton, callConsole, ConfirmDialog } from "./shared";

const APP = (id: string) => `/apps/${encodeURIComponent(id)}`;

/* =========================== Settings tab (app) =========================== */

export function SettingsTab({
  app,
  onDeleted,
}: {
  app: ConsoleAppDetail;
  onDeleted: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const spec = app.spec ?? {};
  const [startupCommand, setStartupCommand] = useState(spec.command ?? "");
  const [imageMirrorLimit, setImageMirrorLimit] = useState(
    spec.image_mirror_limit != null ? String(spec.image_mirror_limit) : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const phase = app.status?.phase?.toLowerCase() ?? "";
  const paused = phase === "paused" || phase === "stopped" || app.status?.current_replicas === 0;

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h3>{t("Runtime settings")}</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>{t("Startup command")}</label>
            <input
              className="input mono"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              placeholder={t("(default)")}
            />
          </div>
          <div className="form-row">
            <label>{t("Image retention count")}</label>
            <input
              className="input mono"
              type="number"
              min={1}
              value={imageMirrorLimit}
              onChange={(e) => setImageMirrorLimit(e.target.value)}
              placeholder="5"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="form-row">
            <label>{t("Runtime")}</label>
            <span className="mono">{spec.runtime_id || "—"}</span>
          </div>
          {(() => {
            const cc = readRuntimeCountryCode(
              app.status?.current_runtime_id,
              spec.runtime_id,
            );
            return cc ? (
              <div className="form-row">
                <label>{t("Location")}</label>
                <CountryLabel countryCode={cc} />
              </div>
            ) : null;
          })()}
          <div className="form-row">
            <label>{t("Network mode")}</label>
            <span className="mono">{spec.network_mode || "default"}</span>
          </div>
          <div className="form-row">
            <label>{t("Replicas")}</label>
            <span className="mono">{spec.replicas ?? app.status?.current_replicas ?? "—"}</span>
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn primary"
            onAction={() => {
              const patch: Record<string, unknown> = { startup_command: startupCommand };
              const n = Number(imageMirrorLimit);
              if (imageMirrorLimit && Number.isFinite(n)) patch.image_mirror_limit = n;
              return callConsole(APP(app.id), { method: "PATCH", body: patch });
            }}
            onDone={() => router.refresh()}
          >
            {t("Save settings")}
          </ActionButton>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>{t("Source")}</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>{t("Origin")}</label>
            <span className="mono">{app.origin_source?.repo_url || app.origin_source?.type || "—"}</span>
          </div>
          <div className="form-row">
            <label>{t("Branch")}</label>
            <span className="mono">{app.origin_source?.repo_branch || "—"}</span>
          </div>
          <div className="form-row">
            <label>{t("Commit")}</label>
            <span className="mono">{app.build_source?.commit_sha?.slice(0, 12) || "—"}</span>
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn"
            confirm={t("Rebuild from source and deploy?")}
            onAction={() => callConsole(`${APP(app.id)}/rebuild`, { body: {} })}
            onDone={() => router.refresh()}
          >
            {t("Rebuild")}
          </ActionButton>
        </div>
      </div>

      <div className="panel danger-zone">
        <div className="panel-h">
          <h3>{t("Danger zone")}</h3>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">{t("Restart service")}</div>
            <div className="sub">{t("Rolling restart, keeping the replica count unchanged.")}</div>
          </div>
          <ActionButton
            className="btn"
            confirm={t("Restart this service?")}
            onAction={() => callConsole(`${APP(app.id)}/restart`)}
            onDone={() => router.refresh()}
          >
            {t("Restart")}
          </ActionButton>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">{paused ? t("Start service") : t("Pause service")}</div>
            <div className="sub">
              {paused
                ? t("Restore replicas to 1 and serve traffic again.")
                : t("Scale to 0, stopping external traffic but keeping the configuration.")}
            </div>
          </div>
          {paused ? (
            <ActionButton
              className="btn"
              onAction={() => callConsole(`${APP(app.id)}/scale`, { body: { replicas: 1 } })}
              onDone={() => router.refresh()}
            >
              {t("Start")}
            </ActionButton>
          ) : (
            <ActionButton
              className="btn"
              confirm={t("Pause this service? External traffic will stop.")}
              onAction={() => callConsole(`${APP(app.id)}/disable`)}
              onDone={() => router.refresh()}
            >
              {t("Pause")}
            </ActionButton>
          )}
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">{t("Delete service")}</div>
            <div className="sub">{t("Permanently delete this service and its resources. This cannot be undone.")}</div>
          </div>
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            {t("Delete")}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t("Delete service")}
          danger
          confirmLabel={t("Permanently delete")}
          body={
            <>
              {t("Delete service")} <span className="mono">{app.name}</span>
              {t("? This action cannot be undone and will remove all related resources.")}
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await callConsole(`${APP(app.id)}?force=true`, { method: "DELETE" });
            onDeleted();
          }}
        />
      )}
    </>
  );
}

/* ===================== Database (backing) service tabs ===================== */

export function DbOverviewTab({ svc }: { svc: BackingService }) {
  const t = useT();
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Overview")}</h3>
      </div>
      <div className="form">
        <div className="form-row">
          <label>{t("Type")}</label>
          <span className="mono">{svc.type || "—"}</span>
        </div>
        <div className="form-row">
          <label>{t("Status")}</label>
          <span className="mono">{svc.status || "—"}</span>
        </div>
        <div className="form-row">
          <label>{t("Owner app")}</label>
          <span className="mono">{svc.owner_app_name || svc.owner_app_id || "—"}</span>
        </div>
        <div className="form-row">
          <label>{t("Runtime")}</label>
          <span className="mono">{svc.location_label || svc.database_runtime_id || "—"}</span>
        </div>
        {(() => {
          const cc = readRuntimeCountryCode(svc.database_runtime_id, svc.location_label);
          return cc ? (
            <div className="form-row">
              <label>{t("Location")}</label>
              <CountryLabel countryCode={cc} />
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

export function DbFailoverTab({ svc }: { svc: BackingService }) {
  const t = useT();
  const tone = svc.continuity?.live ? "ok" : "idle";
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Failover")}</h3>
      </div>
      <div className="form">
        <div className="form-row">
          <label>{t("Continuity")}</label>
          <span className={`chip ${tone}`}>{svc.continuity?.label || t("Not configured")}</span>
        </div>
        <div className="form-row">
          <label>{t("Configured")}</label>
          <span className="mono">{svc.failover_configured ? t("Yes") : t("No")}</span>
        </div>
        <div className="form-row">
          <label>{t("Target runtime")}</label>
          <span className="mono">{svc.failover_target_runtime_id || "—"}</span>
        </div>
      </div>
    </div>
  );
}

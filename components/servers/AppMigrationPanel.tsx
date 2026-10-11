"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import type { RuntimeView } from "@/lib/servers/model";
import type { MoveImpact } from "@/lib/fugue/runtime-management";
import {
  callConsole,
  ConfirmDialog,
  useEndpointData,
} from "@/components/workbench/shared";
import RuntimeTargetPicker from "./RuntimeTargetPicker";

type Operation = {
  id: string;
  status: string;
  type: string;
  error?: string | null;
};
const terminal = (status: string) =>
  ["completed", "failed", "cancelled", "canceled", "rejected"].includes(status);

export default function AppMigrationPanel({
  appId,
  currentRuntimeId,
}: {
  appId: string;
  currentRuntimeId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const path = `/apps/${encodeURIComponent(appId)}/migrate`;
  const settings = useEndpointData<{
    targets: RuntimeView[];
    canMigrate: boolean;
  }>(`/api/console${path}`);
  const [target, setTarget] = useState("");
  const [impact, setImpact] = useState<MoveImpact | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [poll, setPoll] = useState(0);
  useEffect(() => {
    if (!operation || terminal(operation.status)) return;
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/console${path}?operation=${encodeURIComponent(operation.id)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Operation status is unavailable.");
        if (disposed) return;
        const next = data.result.operation as Operation;
        setOperation(next);
        setError("");
        if (terminal(next.status)) router.refresh();
      } catch (err) {
        if (!disposed)
          setError(
            t(
              err instanceof Error
                ? err.message
                : "Operation status is unavailable.",
            ),
          );
      } finally {
        if (!disposed) setPoll((n) => n + 1);
      }
    }, 5000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [operation, path, poll, router, t]);
  const running = Boolean(operation && !terminal(operation.status));
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Move service to another server")}</h3>
      </div>
      <div className="runtime-management">
        <p className="form-hint">
          {t(
            "Preview checks storage, databases, images and placement. A successful preview does not move the service.",
          )}
        </p>
        {settings.loading && <p>{t("Loading…")}</p>}
        {settings.error && (
          <div className="wb-alert err" role="alert">
            {t(settings.error)}{" "}
            <button className="btn sm ghost" onClick={settings.refresh}>
              {t("Retry")}
            </button>
          </div>
        )}
        {settings.data && (
          <>
            <RuntimeTargetPicker
              targets={settings.data.targets}
              value={target}
              excludeId={currentRuntimeId}
              allowAuto={false}
              disabled={busy || running || !settings.data.canMigrate}
              onChange={(value) => {
                setTarget(value);
                setImpact(null);
                setError("");
              }}
              label="Destination server"
            />
            {!settings.data.canMigrate && (
              <p className="form-hint">
                {t("Your access key does not allow this action.")}
              </p>
            )}
            <div className="server-inline">
              <button
                className="btn ghost"
                disabled={
                  !target || busy || running || !settings.data.canMigrate
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setImpact(null);
                  try {
                    const result = await callConsole<{ impact: MoveImpact }>(
                      path,
                      { body: { targetRuntimeId: target, dryRun: true } },
                    );
                    setImpact(result.impact);
                  } catch (err) {
                    setError(
                      t(err instanceof Error ? err.message : "Action failed."),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(busy ? "Working…" : "Preview migration")}
              </button>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  running ||
                  !impact?.pass ||
                  impact.target_runtime_id !== target ||
                  !settings.data.canMigrate
                }
                onClick={() => setConfirming(true)}
              >
                {t("Move service")}
              </button>
            </div>
          </>
        )}
        {impact && (
          <div className="server-preview">
            <strong>
              {t(
                impact.pass
                  ? "Migration preview passed"
                  : "Migration is blocked",
              )}
            </strong>
            <ul>
              {impact.blockers?.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {impact.operation_chain?.length ? (
              <p>
                {t("Planned steps")}: {impact.operation_chain.join(" → ")}
              </p>
            ) : null}
            <p>
              {t("Affected resources")}: {impact.volumes?.length ?? 0}{" "}
              {t("Volumes")} · {impact.databases?.length ?? 0} {t("Databases")}{" "}
              · {impact.routes?.length ?? 0} {t("Routes")}
            </p>
            {impact.checks?.length ? (
              <ul>
                {impact.checks.map((check) => (
                  <li key={check.name}>
                    {check.pass ? "✓" : "!"} {check.message || check.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {operation && (
          <p
            className={`wb-alert ${["failed", "rejected"].includes(operation.status) ? "err" : ""}`}
            role="status"
          >
            {t("Migration operation")}:{" "}
            <span className="mono">{operation.id}</span> · {t(operation.status)}
            {operation.status === "completed"
              ? ` · ${t("Verify the service's current readiness above.")}`
              : ""}
          </p>
        )}
        {operation?.error && (
          <p className="wb-alert err" role="alert">
            {operation.error}
          </p>
        )}
        {error && (
          <p className="wb-alert err" role="alert">
            {error}
          </p>
        )}
        {confirming && (
          <ConfirmDialog
            title={t("Move service")}
            body={
              <p>
                {t(
                  "Move this service to {name}? The backend will recheck all prerequisites before starting. Track the operation until it completes.",
                  {
                    name:
                      settings.data?.targets.find((r) => r.id === target)
                        ?.name || target,
                  },
                )}
              </p>
            }
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              const result = await callConsole<{ operation: Operation }>(path, {
                body: { targetRuntimeId: target, dryRun: false },
              });
              setOperation(result.operation);
              setImpact(null);
              setConfirming(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

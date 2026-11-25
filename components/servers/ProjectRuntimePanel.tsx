"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { RuntimeView } from "@/lib/servers/model";
import type { Reservation } from "@/lib/fugue/runtime-management";
import {
  callConsole,
  ConfirmDialog,
  useEndpointData,
} from "@/components/workbench/shared";
import RuntimeTargetPicker from "./RuntimeTargetPicker";

type Settings = {
  defaultRuntimeId: string;
  targets: RuntimeView[];
  reservations: Reservation[];
  canChangeDefault: boolean;
  canReserve: boolean;
};

export default function ProjectRuntimePanel({
  projectId,
}: {
  projectId: string;
}) {
  const t = useT();
  const path = `/projects/${encodeURIComponent(projectId)}/runtime-settings`;
  const data = useEndpointData<Settings>(`/api/console${path}`);
  const [defaultId, setDefaultId] = useState("");
  const [reserveId, setReserveId] = useState("");
  const [pending, setPending] = useState<{
    action: "default" | "reserve" | "release";
    runtimeId: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (data.data) setDefaultId(data.data.defaultRuntimeId);
  }, [data.data]);
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Project servers")}</h3>
      </div>
      <div className="runtime-management">
        {data.loading && <p>{t("Loading…")}</p>}
        {data.error && (
          <div className="wb-alert err" role="alert">
            {t(data.error)}{" "}
            <button className="btn sm ghost" onClick={data.refresh}>
              {t("Retry")}
            </button>
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        {data.data && (
          <>
            <section className="runtime-settings-group">
            <h4>{t("Default project server")}</h4>
            <p>{data.data.targets.find((target) => target.id === data.data?.defaultRuntimeId)?.name || data.data.defaultRuntimeId || t("Auto-assign")}</p>
            {data.data.canChangeDefault && <details className="runtime-edit">
            <summary>{t("Change")}</summary>
            <RuntimeTargetPicker
              targets={data.data.targets}
              value={defaultId}
              onChange={setDefaultId}
              disabled={!data.data.canChangeDefault}
              label="Default project server"
            />
            <div>
              <button
                className="btn sm primary"
                disabled={
                  !data.data.canChangeDefault ||
                  defaultId === data.data.defaultRuntimeId
                }
                onClick={() =>
                  setPending({ action: "default", runtimeId: defaultId })
                }
              >
                {t("Save default server")}
              </button>
            </div>
            </details>}
            </section>
            <section className="runtime-settings-group">
            <h4>{t("Exclusive server reservations")}</h4>
            <ul className="server-grants">
              {data.data.reservations.map((r) => (
                <li key={r.runtime_id}>
                  <span>
                    {data.data?.targets.find((s) => s.id === r.runtime_id)
                      ?.name || r.runtime_id}
                  </span>
                  {data.data?.canReserve && (
                    <button
                      className="btn sm ghost danger"
                      onClick={() =>
                        setPending({
                          action: "release",
                          runtimeId: r.runtime_id,
                        })
                      }
                    >
                      {t("Release reservation")}
                    </button>
                  )}
                </li>
              ))}
              {!data.data.reservations.length && (
                <li>{t("No exclusive reservations.")}</li>
              )}
            </ul>
            {data.data.canReserve && (
              <details className="runtime-edit">
                <summary>{t("Reserve server")}</summary>
                <RuntimeTargetPicker
                  targets={data.data.targets.filter(
                    (r) =>
                      ["managed-owned", "external-owned"].includes(r.type) &&
                      !data.data!.reservations.some(
                        (v) => v.runtime_id === r.id,
                      ),
                  )}
                  value={reserveId}
                  onChange={setReserveId}
                  allowAuto={false}
                  label="Server to reserve"
                />
                <div>
                  <button
                    className="btn sm ghost"
                    disabled={!reserveId}
                    onClick={() =>
                      setPending({ action: "reserve", runtimeId: reserveId })
                    }
                  >
                    {t("Reserve server")}
                  </button>
                </div>
              </details>
            )}
            </section>
          </>
        )}
        {pending && (
          <ConfirmDialog
            title={t(
              pending.action === "default"
                ? "Save default server"
                : pending.action === "reserve"
                  ? "Reserve server"
                  : "Release reservation",
            )}
            body={
              <>
              <p className="mono">{data.data?.targets.find((target) => target.id === pending.runtimeId)?.name || pending.runtimeId || t("Auto-assign")}</p>
              <p>
                {t(
                  pending.action === "default"
                    ? "The default applies to future deployments. Existing services are not moved."
                    : pending.action === "reserve"
                      ? "Reserve this server exclusively for this project? Conflicting workloads or reservations will block the change."
                      : "Release this project's exclusive reservation? The backend will check dependencies before accepting.",
                )}
              </p>
              </>
            }
            onCancel={() => setPending(null)}
            onConfirm={async () => {
              await callConsole(path, { body: pending });
              setPending(null);
              setReserveId("");
              setNotice(t("Project server settings saved."));
              data.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

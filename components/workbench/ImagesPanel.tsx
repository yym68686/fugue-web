"use client";

import { useMemo, useState } from "react";

import type { ImageInventory, ImageVersion, ConsoleAppDetail } from "@/lib/fugue/console";
import { fmtDate, fmtImageMeasurementTitle, fmtImageUsage } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";
import { mapWithConcurrency } from "@/lib/async/pool";

import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  RefreshButton,
  TabError,
  TabLoading,
  callConsole,
  useEndpointData,
} from "./shared";

/** Deleting many images at once still goes one request per image (the backend
 *  has no batch endpoint), so bound the fan-out rather than firing all at once. */
const DELETE_CONCURRENCY = 4;

/**
 * A version is reclaimable when the registry can actually drop it. The backend
 * rejects the current version with 409, so a "delete all" that included it
 * would always report a failure; excluding it makes the button's promise true.
 */
function isReclaimable(v: ImageVersion): boolean {
  return !v.current && Boolean(v.delete_supported);
}

/**
 * The backend reports `registry_configured: false` when the cluster runs the
 * distributed image store. In that mode it retains images itself and rejects
 * both /images/delete and /images/redeploy with 400 before doing any work, so
 * every version comes back with delete_supported=false. Hiding the buttons is
 * correct — but silently hiding them leaves the page looking broken, so say why.
 * Skipped when there are no versions at all: the empty state already explains
 * itself, and the measurement alert already fires in that case.
 */
function retentionIsAutomatic(inv: ImageInventory | null): boolean {
  return inv?.registry_configured === false && inv.versions.length > 0;
}

type DeleteOutcome = { imageRef: string; error: string | null };

/** Backend emits only "available" | "missing"; translate rather than echo raw. */
function statusLabel(status: string | undefined, t: TranslateFn): string {
  const key = (status ?? "").trim().toLowerCase();
  if (key === "available") return t("Available");
  if (key === "missing") return t("Missing");
  return status || t("Saved");
}

/**
 * This app's i18n layer interpolates but has no plural rules, so counted copy
 * needs an explicit singular source string — otherwise the last remaining
 * image reads "Delete 1 images".
 */
function deleteLabel(count: number, t: TranslateFn): string {
  return count === 1 ? t("Delete 1 image") : t("Delete {count} images", { count });
}

export default function ImagesPanel({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const base = `/apps/${encodeURIComponent(app.id)}`;
  const inv = useEndpointData<ImageInventory>(
    `/api/console/apps/${encodeURIComponent(app.id)}/images`,
  );

  const versions = inv.data?.versions ?? [];
  const reclaimable = useMemo(() => versions.filter(isReclaimable), [versions]);

  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Outcome of the last bulk run, kept visible after the refresh so a partial
  // failure is reported rather than silently leaving images behind.
  const [outcome, setOutcome] = useState<{ done: number; failures: DeleteOutcome[] } | null>(
    null,
  );

  const currentRef = useMemo(() => {
    const current = versions.find((v) => v.current);
    return current?.runtime_image_ref || current?.image_ref || "";
  }, [versions]);

  async function deleteAll() {
    const targets = reclaimable;
    setOutcome(null);
    setProgress({ done: 0, total: targets.length });

    const outcomes = await mapWithConcurrency(
      targets,
      DELETE_CONCURRENCY,
      async (v): Promise<DeleteOutcome> => {
        try {
          await callConsole(`${base}/images/delete`, { body: { image_ref: v.image_ref } });
          return { imageRef: v.image_ref, error: null };
        } catch (err) {
          // Keep going: one stuck image should not strand the rest.
          return {
            imageRef: v.image_ref,
            error: err instanceof Error ? err.message : t("Action failed."),
          };
        } finally {
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      },
    );

    const failures = outcomes.filter((o) => o.error);
    setOutcome({ done: outcomes.length - failures.length, failures });
    setProgress(null);
    setConfirming(false);
    inv.refresh();
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Images")}</h3>
        <div className="tail">
          {reclaimable.length > 0 && (
            <button
              type="button"
              className="btn danger"
              onClick={() => setConfirming(true)}
              // Also disabled while the inventory is refetching: between the
              // last delete and the fresh list the count is still the old one,
              // and a second click would retry already-deleted images.
              disabled={progress !== null || inv.loading}
            >
              {progress
                ? t("Deleted {done} of {total}…", {
                    done: progress.done,
                    total: progress.total,
                  })
                : deleteLabel(reclaimable.length, t)}
            </button>
          )}
          <RefreshButton onClick={inv.refresh} />
        </div>
      </div>

      {inv.loading && <TabLoading />}
      {inv.error && <TabError message={inv.error} />}

      {!inv.loading && !inv.error && (
        <>
          {inv.data && inv.data.measurement_status !== "complete" && (
            <div
              className={`wb-alert ${inv.data.measurement_status === "partial" ? "warn" : "err"}`}
              title={fmtImageMeasurementTitle(
                inv.data.measurement_status,
                inv.data.measurement_reasons,
                inv.data.measurement_note,
                t,
              )}
            >
              {fmtImageMeasurementTitle(
                inv.data.measurement_status,
                inv.data.measurement_reasons,
                inv.data.measurement_note,
                t,
              )}
            </div>
          )}

          {retentionIsAutomatic(inv.data) && (
            <div className="wb-alert" title={inv.data?.reclaim_note || undefined}>
              {t(
                "This cluster manages image retention automatically, so old versions cannot be deleted or redeployed from here.",
              )}
            </div>
          )}

          {outcome && (
            <div className={`wb-alert ${outcome.failures.length > 0 ? "err" : "ok"}`}>
              {outcome.failures.length === 0
                ? outcome.done === 1
                  ? t("Deleted 1 image.")
                  : t("Deleted {count} images.", { count: outcome.done })
                : `${t("Deleted {done} images; {failed} could not be deleted.", {
                    done: outcome.done,
                    failed: outcome.failures.length,
                  })} ${outcome.failures[0].error ?? ""}`}
            </div>
          )}

          {versions.length === 0 ? (
            <EmptyState message={t("No image versions")} />
          ) : (
            <ImagesTable
              inv={inv.data}
              versions={versions}
              base={base}
              onDone={inv.refresh}
              t={t}
            />
          )}
        </>
      )}

      {confirming && (
        <ConfirmDialog
          danger
          title={t("Delete all old images?")}
          body={
            <p>
              {reclaimable.length === 1
                ? t(
                    "This deletes 1 saved image version and cannot be undone. The current image ({ref}) is kept, so the running app is not affected.",
                    { ref: currentRef || "—" },
                  )
                : t(
                    "This deletes {count} saved image versions and cannot be undone. The current image ({ref}) is kept, so the running app is not affected.",
                    { count: reclaimable.length, ref: currentRef || "—" },
                  )}
            </p>
          }
          confirmLabel={deleteLabel(reclaimable.length, t)}
          onConfirm={deleteAll}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function ImagesTable({
  inv,
  versions,
  base,
  onDone,
  t,
}: {
  inv: ImageInventory | null;
  versions: ImageVersion[];
  base: string;
  onDone: () => void;
  t: TranslateFn;
}) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>{t("Image")}</th>
          <th>{t("Size")}</th>
          <th>{t("Status")}</th>
          <th>{t("Deployed")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {versions.map((v) => (
          <tr key={v.image_ref}>
            <td className="mono">{v.runtime_image_ref || v.image_ref}</td>
            <td
              title={fmtImageMeasurementTitle(
                v.size_measurement_status,
                v.size_measurement_reasons,
                inv?.measurement_note,
                t,
              )}
            >
              {fmtImageUsage(v.size_bytes, v.size_measurement_status)}
            </td>
            <td>
              {v.current ? (
                <span className="chip ok">{t("Current")}</span>
              ) : (
                <span className="chip idle">{statusLabel(v.status, t)}</span>
              )}
            </td>
            <td>{fmtDate(v.last_deployed_at)}</td>
            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {!v.current && v.redeploy_supported && (
                <ActionButton
                  className="btn ghost"
                  confirm={t("Redeploy this image?")}
                  onAction={() =>
                    callConsole(`${base}/images/redeploy`, { body: { image_ref: v.image_ref } })
                  }
                  onDone={onDone}
                >
                  {t("Redeploy")}
                </ActionButton>
              )}{" "}
              {!v.current && v.delete_supported && (
                <ActionButton
                  className="btn danger"
                  confirm={t("Delete this image version? This cannot be undone.")}
                  onAction={() =>
                    callConsole(`${base}/images/delete`, { body: { image_ref: v.image_ref } })
                  }
                  onDone={onDone}
                >
                  {t("Delete")}
                </ActionButton>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

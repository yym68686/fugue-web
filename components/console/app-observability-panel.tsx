"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  ConsolePillSwitch,
  type ConsolePillSwitchOption,
} from "@/components/console/console-pill-switch";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import type {
  FugueAppObservabilityDiagnosis,
  FugueAppObservabilityLogsQuery,
  FugueAppObservabilityMetricsSummary,
  FugueAppObservabilityRequests,
  FugueAppObservabilityTrace,
} from "@/lib/fugue/api";
import { useI18n } from "@/components/providers/i18n-provider";
import { cx } from "@/lib/ui/cx";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

type ObservabilityView = "overview" | "logs" | "requests" | "trace" | "alerts";
type ObservabilityWindow = "5m" | "15m" | "1h" | "6h" | "24h";
type LoadStatus = "idle" | "loading" | "ready" | "error";

type ObservabilityPayload = {
  diagnosis: FugueAppObservabilityDiagnosis | null;
  logs: FugueAppObservabilityLogsQuery | null;
  metrics: FugueAppObservabilityMetricsSummary | null;
  requests: FugueAppObservabilityRequests | null;
};

const OBSERVABILITY_VIEW_OPTIONS: readonly ConsolePillSwitchOption<ObservabilityView>[] =
  [
    { value: "overview", label: "Overview" },
    { value: "logs", label: "Logs" },
    { value: "requests", label: "Requests" },
    { value: "trace", label: "Trace" },
    { value: "alerts", label: "Alerts" },
  ];

const OBSERVABILITY_WINDOW_OPTIONS: readonly ConsolePillSwitchOption<ObservabilityWindow>[] =
  [
    { value: "5m", label: "5m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "6h", label: "6h" },
    { value: "24h", label: "24h" },
  ];

const EMPTY_PAYLOAD: ObservabilityPayload = {
  diagnosis: null,
  logs: null,
  metrics: null,
  requests: null,
};

function buildObservabilityURL(appId: string, path: string, params: URLSearchParams) {
  const query = params.toString();
  return `/api/fugue/apps/${encodeURIComponent(appId)}/observability/${path}${query ? `?${query}` : ""}`;
}

function readSourceStatus(payload: ObservabilityPayload) {
  return (
    payload.diagnosis?.source ??
    payload.metrics?.source ??
    payload.requests?.source ??
    payload.logs?.source ??
    null
  );
}

function readSourceTone(status: string | undefined) {
  if (status === "available") {
    return "positive";
  }

  if (status === "degraded") {
    return "warning";
  }

  if (status === "disabled") {
    return "neutral";
  }

  return "info";
}

function formatMetricValue(value: number, unit?: string) {
  const formatted =
    Math.abs(value) >= 100
      ? value.toFixed(0)
      : Math.abs(value) >= 10
        ? value.toFixed(1)
        : value.toFixed(2);

  return unit ? `${formatted} ${unit}` : formatted;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }

  return `${Math.round(value)}ms`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function readRequestRoute(
  request: FugueAppObservabilityRequests["requests"][number],
) {
  return request.route || String(request.summary?.path ?? "") || "-";
}

function readRequestStatusTone(statusCode: number | undefined) {
  if (!statusCode) {
    return "neutral";
  }

  if (statusCode >= 500) {
    return "danger";
  }

  if (statusCode >= 400) {
    return "warning";
  }

  return "positive";
}

function stringifySummary(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

export function AppObservabilityPanel({
  appId,
  appName,
}: {
  appId: string;
  appName: string;
}) {
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<ObservabilityView>("overview");
  const [windowValue, setWindowValue] = useState<ObservabilityWindow>("15m");
  const [payload, setPayload] = useState<ObservabilityPayload>(EMPTY_PAYLOAD);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [traceInput, setTraceInput] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState("");
  const [trace, setTrace] = useState<FugueAppObservabilityTrace | null>(null);
  const [traceStatus, setTraceStatus] = useState<LoadStatus>("idle");
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const commonParams = new URLSearchParams({ since: windowValue });
    const requestParams = new URLSearchParams(commonParams);
    requestParams.set("limit", "40");
    const logParams = new URLSearchParams(commonParams);
    logParams.set("limit", "80");

    setStatus("loading");
    setErrorMessage(null);

    Promise.all([
      requestJson<FugueAppObservabilityMetricsSummary>(
        buildObservabilityURL(appId, "metrics/summary", commonParams),
        { cache: "no-store", signal: controller.signal },
      ),
      requestJson<FugueAppObservabilityDiagnosis>(
        buildObservabilityURL(appId, "diagnosis", commonParams),
        { cache: "no-store", signal: controller.signal },
      ),
      requestJson<FugueAppObservabilityRequests>(
        buildObservabilityURL(appId, "requests", requestParams),
        { cache: "no-store", signal: controller.signal },
      ),
      requestJson<FugueAppObservabilityLogsQuery>(
        buildObservabilityURL(appId, "logs/query", logParams),
        { cache: "no-store", signal: controller.signal },
      ),
    ])
      .then(([metrics, diagnosis, requests, logs]) => {
        setPayload({ diagnosis, logs, metrics, requests });
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setPayload(EMPTY_PAYLOAD);
        setStatus("error");
        setErrorMessage(readRequestError(error));
      });

    return () => controller.abort();
  }, [appId, refreshToken, windowValue]);

  useEffect(() => {
    if (!selectedTraceId) {
      setTrace(null);
      setTraceStatus("idle");
      setTraceErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    setTraceStatus("loading");
    setTraceErrorMessage(null);

    requestJson<FugueAppObservabilityTrace>(
      `/api/fugue/apps/${encodeURIComponent(appId)}/observability/traces/${encodeURIComponent(selectedTraceId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then((result) => {
        setTrace(result);
        setTraceStatus("ready");
      })
      .catch((error: unknown) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setTrace(null);
        setTraceStatus("error");
        setTraceErrorMessage(readRequestError(error));
      });

    return () => controller.abort();
  }, [appId, selectedTraceId]);

  const source = readSourceStatus(payload);
  const diagnosis = payload.diagnosis?.diagnosis;
  const requests = payload.requests?.requests ?? [];
  const logs = payload.logs?.logs ?? [];
  const metrics = payload.metrics?.metrics ?? [];
  const maxStageMs = useMemo(() => {
    return Math.max(1, ...(trace?.spans ?? []).map((span) => span.stageMs ?? 0));
  }, [trace?.spans]);

  function handleTraceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTraceId = traceInput.trim();

    if (!nextTraceId) {
      return;
    }

    setSelectedTraceId(nextTraceId);
    setActiveView("trace");
  }

  function selectTrace(traceId: string | null | undefined) {
    if (!traceId) {
      return;
    }

    setTraceInput(traceId);
    setSelectedTraceId(traceId);
    setActiveView("trace");
  }

  return (
    <div className="fg-workbench-section fg-observability">
      <div className="fg-workbench-section__head fg-observability__head">
        <div className="fg-workbench-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Observability")}</p>
          <div className="fg-observability__status-row">
            <StatusBadge
              live={source?.available}
              tone={readSourceTone(source?.status)}
            >
              {source?.status ? t(source.status) : t("loading")}
            </StatusBadge>
            <span>{source?.retention ? t("Retention {value}", { value: source.retention }) : t("Retention pending")}</span>
            <span>{appName}</span>
          </div>
        </div>

        <div className="fg-workbench-section__actions fg-observability__actions">
          <ConsolePillSwitch
            ariaLabel={t("Observability window")}
            onChange={setWindowValue}
            options={OBSERVABILITY_WINDOW_OPTIONS}
            value={windowValue}
          />
          <Button
            disabled={status === "loading"}
            loading={status === "loading"}
            loadingLabel={t("Refreshing…")}
            onClick={() => setRefreshToken((value) => value + 1)}
            size="compact"
            type="button"
            variant="secondary"
          >
            {t("Refresh")}
          </Button>
        </div>
      </div>

      <ConsolePillSwitch
        ariaLabel={t("Observability views")}
        className="fg-observability__view-switch"
        onChange={setActiveView}
        options={OBSERVABILITY_VIEW_OPTIONS.map((option) => ({
          ...option,
          label: typeof option.label === "string" ? t(option.label) : option.label,
        }))}
        value={activeView}
      />

      {status === "error" ? (
        <div className="fg-inline-alert fg-inline-alert--error" role="alert">
          {errorMessage ?? t("Observability data is unavailable.")}
        </div>
      ) : null}

      {source && !source.available ? (
        <div className="fg-inline-alert fg-inline-alert--info" role="status">
          {source.reason || t("Observability source is not available.")}
        </div>
      ) : null}

      {activeView === "overview" ? (
        <div className="fg-observability__overview">
          <div className="fg-observability__metric-grid">
            {metrics.length ? (
              metrics.slice(0, 8).map((metric) => (
                <div className="fg-observability-metric" key={`${metric.name}:${stringifySummary(metric.labels)}`}>
                  <span>{metric.name}</span>
                  <strong>{formatMetricValue(metric.value, metric.unit)}</strong>
                </div>
              ))
            ) : (
              <div className="fg-observability__empty">
                <strong>{t("No metric samples")}</strong>
                <span>{status === "loading" ? t("Loading…") : source?.reason || t("No data in this window.")}</span>
              </div>
            )}
          </div>

          {diagnosis ? (
            <div className="fg-observability-diagnosis">
              <div>
                <span>{t("Bottleneck")}</span>
                <strong>{diagnosis.bottleneck}</strong>
              </div>
              <div>
                <span>{t("Confidence")}</span>
                <strong>{formatPercent(diagnosis.confidence)}</strong>
              </div>
              <ul>
                {diagnosis.evidence.slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeView === "logs" ? (
        <div className="fg-observability-list" role="list">
          {logs.length ? (
            logs.map((entry, index) => (
              <article
                className="fg-observability-log"
                key={`${entry.timestamp}:${entry.pod ?? ""}:${index}`}
                role="listitem"
              >
                <div className="fg-observability-log__meta">
                  <span>{formatTimestamp(entry.timestamp)}</span>
                  <span>{entry.container ?? entry.pod ?? "-"}</span>
                  {entry.traceId ? (
                    <button
                      className="fg-observability__link-button"
                      onClick={() => selectTrace(entry.traceId)}
                      type="button"
                    >
                      {entry.traceId}
                    </button>
                  ) : null}
                  {entry.level ? <StatusBadge>{entry.level}</StatusBadge> : null}
                </div>
                <pre>{entry.message}</pre>
              </article>
            ))
          ) : (
            <div className="fg-observability__empty">
              <strong>{t("No logs")}</strong>
              <span>{status === "loading" ? t("Loading…") : source?.reason || t("No data in this window.")}</span>
            </div>
          )}
        </div>
      ) : null}

      {activeView === "requests" ? (
        <div className="fg-console-table-wrap fg-observability-table-wrap">
          <table className="fg-console-table fg-observability-table">
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("Route")}</th>
                <th>{t("Status")}</th>
                <th>{t("TTFB")}</th>
                <th>{t("Duration")}</th>
                <th>{t("Trace")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((request, index) => (
                  <tr key={`${request.timestamp}:${request.traceId ?? index}`}>
                    <td>{formatTimestamp(request.timestamp)}</td>
                    <td>
                      <div className="fg-console-table__stack">
                        <strong>{readRequestRoute(request)}</strong>
                        <span>{request.method ?? "-"}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={readRequestStatusTone(request.statusCode)}>
                        {request.statusCode ?? "-"}
                      </StatusBadge>
                    </td>
                    <td>{formatDuration(request.ttftMs)}</td>
                    <td>{formatDuration(request.durationMs)}</td>
                    <td>
                      {request.traceId ? (
                        <button
                          className="fg-observability__link-button"
                          onClick={() => selectTrace(request.traceId)}
                          type="button"
                        >
                          {request.traceId}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    {status === "loading" ? t("Loading…") : source?.reason || t("No requests in this window.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeView === "trace" ? (
        <div className="fg-observability-trace">
          <form className="fg-observability-trace__form" onSubmit={handleTraceSubmit}>
            <FormField
              htmlFor={`observability-trace-${appId}`}
              label={t("Trace id")}
            >
              <input
                autoCapitalize="off"
                autoCorrect="off"
                className="fg-form-input"
                id={`observability-trace-${appId}`}
                onChange={(event) => setTraceInput(event.target.value)}
                spellCheck={false}
                value={traceInput}
              />
            </FormField>
            <Button
              disabled={!traceInput.trim() || traceStatus === "loading"}
              loading={traceStatus === "loading"}
              loadingLabel={t("Loading…")}
              type="submit"
              variant="primary"
            >
              {t("Load trace")}
            </Button>
          </form>

          {traceStatus === "error" ? (
            <div className="fg-inline-alert fg-inline-alert--error" role="alert">
              {traceErrorMessage ?? t("Trace data is unavailable.")}
            </div>
          ) : null}

          {trace?.spans.length ? (
            <div className="fg-observability-waterfall" role="list">
              {trace.spans.map((span, index) => {
                const width = Math.max(4, ((span.stageMs ?? 0) / maxStageMs) * 100);

                return (
                  <article
                    className="fg-observability-waterfall__row"
                    key={`${span.traceId}:${span.spanId ?? index}`}
                    role="listitem"
                  >
                    <div>
                      <strong>{span.stage}</strong>
                      <span>{span.service ?? "-"}</span>
                    </div>
                    <div className="fg-observability-waterfall__bar-track">
                      <span
                        className={cx(
                          "fg-observability-waterfall__bar",
                          span.errorType && "is-error",
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span>{formatDuration(span.stageMs)}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="fg-observability__empty">
              <strong>{t("No trace selected")}</strong>
              <span>{traceStatus === "loading" ? t("Loading…") : t("Select a request trace or enter a trace id.")}</span>
            </div>
          )}
        </div>
      ) : null}

      {activeView === "alerts" ? (
        <div className="fg-observability-alerts">
          <div className="fg-observability-diagnosis">
            <div>
              <span>{t("Source")}</span>
              <strong>{source?.status ?? "-"}</strong>
            </div>
            <div>
              <span>{t("Freshness")}</span>
              <strong>{source?.freshness ?? "-"}</strong>
            </div>
            <ul>
              {(diagnosis?.nextActions ?? [source?.reason ?? t("No alert feed exposed.")])
                .filter(Boolean)
                .slice(0, 5)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

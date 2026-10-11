import { fmtPercent } from "@/lib/format";
import type { TranslateFn } from "@/lib/i18n/translate";

export default function ResourceUsage({
  label,
  usagePct,
  requestPct,
  detail,
  t,
}: {
  label?: string;
  usagePct: number | undefined;
  requestPct: number | undefined;
  detail: string;
  t: TranslateFn;
}) {
  const usage = Number.isFinite(usagePct) ? usagePct : undefined;
  const request = Number.isFinite(requestPct) ? requestPct : undefined;
  const tone = (usage ?? 0) >= 85 ? "crit" : (usage ?? 0) >= 70 ? "hot" : "";
  return (
    <span className="usage-cell">
      {label && <span className="usage-label">{label}</span>}
      <span className="bar bar-wide" aria-hidden="true">
        <i
          className={tone}
          style={{ width: `${Math.max(0, Math.min(100, usage ?? 0))}%` }}
        />
        {request != null && (
          <span
            className="req-mark"
            style={{ left: `${Math.max(0, Math.min(100, request))}%` }}
            title={t("Requested {pct}", { pct: fmtPercent(request) })}
          />
        )}
      </span>
      <span className="usage-meta">
        <span className="bar-val">{fmtPercent(usage)}</span>
        {request != null && (
          <span className="usage-req">
            {t("Requested {pct}", { pct: fmtPercent(request) })}
          </span>
        )}
        {detail && <span className="usage-detail">{detail}</span>}
      </span>
    </span>
  );
}

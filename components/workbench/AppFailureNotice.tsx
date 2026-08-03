"use client";

import { useState } from "react";
import type { ConsoleAppDetail } from "@/lib/fugue/console";
import { observedFailureNotice } from "@/lib/fugue/observed-status";
import { fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

/**
 * The app's last failed operation, shown once at app level below the tabs.
 *
 * Two things make this awkward to place well, and both are why it is not in the
 * detail header any more: the message can be very long (a failed image import
 * quotes a full registry reference), and it is durable history that may already
 * have been overtaken by a successful release. So the summary line stays a
 * single truncated row, the full text lives behind a toggle, and a superseded
 * failure is styled as context instead of an alarm.
 */
export default function AppFailureNotice({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const notice = observedFailureNotice(app);

  if (!notice) return null;

  const meta = [notice.type, notice.occurredAt ? fmtDate(notice.occurredAt) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`wb-failure ${notice.superseded ? "past" : "live"}`} role="status">
      <div className="wb-failure-row">
        <span className="wb-failure-dot" aria-hidden="true" />
        <span className="wb-failure-lead">
          {notice.superseded
            ? t("An earlier operation failed. A later release has since deployed successfully.")
            : t("The last operation failed.")}
        </span>
        {meta && <span className="wb-failure-meta mono">{meta}</span>}
        <button
          type="button"
          className="wb-failure-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? t("Hide details") : t("Show details")}
        </button>
      </div>
      {open && (
        <div className="wb-failure-body">
          <p className="wb-failure-msg mono">{notice.summary}</p>
          {notice.id && <p className="wb-failure-id mono">{notice.id}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@fugue/ui/components/button";

import { useClientUiMessages } from "@/components/i18n/locale-select";
import type { AdminCursorPageInfo } from "@/lib/admin/service";
import { interpolateUiMessage } from "@/lib/i18n/ui-messages";

export function CursorPagination({
  disabled = false,
  onNext,
  onPrevious,
  pageInfo,
  visibleCount,
}: {
  disabled?: boolean;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  pageInfo: AdminCursorPageInfo;
  visibleCount: number;
}) {
  const messages = useClientUiMessages();

  return (
    <nav className="coss-row" aria-label={messages.tablePagination}>
      <span className="coss-help" aria-live="polite">
        {interpolateUiMessage(messages.showingOf, {
          total: pageInfo.totalItems,
          visible: visibleCount,
        })}
      </span>
      <div className="coss-row">
        <Button
          disabled={disabled || !pageInfo.hasPreviousPage || !pageInfo.previousCursor}
          size="sm"
          variant="outline"
          onClick={() => {
            if (pageInfo.previousCursor) {
              onPrevious(pageInfo.previousCursor);
            }
          }}
        >
          {messages.previous}
        </Button>
        <Button
          disabled={disabled || !pageInfo.hasNextPage || !pageInfo.nextCursor}
          size="sm"
          variant="outline"
          onClick={() => {
            if (pageInfo.nextCursor) {
              onNext(pageInfo.nextCursor);
            }
          }}
        >
          {messages.next}
        </Button>
      </div>
    </nav>
  );
}

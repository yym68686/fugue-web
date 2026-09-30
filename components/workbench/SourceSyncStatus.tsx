'use client';

import type { ConsoleAppDetail } from '@/lib/fugue/console';
import { sourceSyncView } from '@/lib/fugue/source-sync';
import { useT } from '@/lib/i18n/client';

export function SourceSyncStatus({ app, now }: { app: Pick<ConsoleAppDetail, 'origin_source' | 'build_source' | 'status' | 'stored_status' | 'spec'>; now: number }) {
  const t = useT();
  const view = sourceSyncView(app, now);
  if (!view) return null;
  const status = view.status;
  const dates = [
    ['Last GitHub check', status?.last_checked_at],
    ['Last successful GitHub check', status?.last_success_at],
    ['Next scheduled retry', status?.next_check_at],
    ['Suspended since', status?.suspended_at],
  ] as const;
  return (
    <div className="source-sync-status">
      <p><span className={`chip ${view.tone}`}>{t(view.label)}</span></p>
      <p className="faint">{t('Fugue checks this branch automatically. A new commit queues a build; no GitHub webhook is required.')}</p>
      {view.waitingForBuild && <p>{t('GitHub is bound. The running version still uses the previous build until the first GitHub deployment succeeds.')}</p>}
      <dl>
        {dates.map(([label, value]) => value && (
          <div className="form-row" key={label}>
            <dt>{t(label)}</dt><dd><time dateTime={value}>{value.replace('T', ' ').replace(/\.\d+Z$/, ' UTC').replace(/Z$/, ' UTC')}</time></dd>
          </div>
        ))}
      </dl>
      {status?.last_error_message && status.phase !== 'ok' && <p role="status">{status.last_error_message}</p>}
      {status?.needs_user_action && <p>{t('Check repository access and branch settings, then resume source sync.')}</p>}
    </div>
  );
}

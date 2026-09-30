import type { ConsoleAppDetail, ConsoleAppStatus } from '@/lib/fugue/console';

export type SourceSyncView = {
  label: string;
  tone: 'ok' | 'warn' | 'err' | 'idle';
  status: ConsoleAppStatus['source_sync'] | null;
  waitingForBuild: boolean;
};

/** Missing/old facts never assert that automatic checks are currently running. */
export function sourceSyncView(app: Pick<ConsoleAppDetail, 'origin_source' | 'build_source' | 'status' | 'stored_status' | 'spec'>, now: number): SourceSyncView | null {
  const origin = app.origin_source;
  if (!origin?.type?.startsWith('github')) return null;
  const status = app.status?.source_sync ?? app.stored_status?.source_sync ?? null;
  const build = app.build_source;
  const waitingForBuild = !build?.type?.startsWith('github') || build.repo_url !== origin.repo_url || build.repo_branch !== origin.repo_branch;
  let label = 'Waiting for first GitHub check';
  let tone: SourceSyncView['tone'] = 'idle';
  if (app.spec?.replicas === 0) {
    label = 'GitHub checks paused while service is stopped';
  } else if (status?.phase === 'suspended') {
    label = 'GitHub sync suspended'; tone = 'err';
  } else if (status?.phase === 'degraded') {
    label = 'GitHub check failed; retry pending'; tone = 'warn';
  } else if (status?.phase === 'ok') {
    const checked = Date.parse(status.last_checked_at ?? '');
    // The controller checks repositories serially; this is stale evidence,
    // not a claim that a fixed one-minute per-app deadline was violated.
    if (!Number.isFinite(checked) || checked > now + 30_000 || now - checked > 5 * 60_000) {
      label = 'GitHub check status needs refresh'; tone = 'warn';
    } else { label = 'Latest GitHub check succeeded'; tone = 'ok'; }
  }
  return { label, tone, status, waitingForBuild };
}

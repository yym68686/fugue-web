import AppLayout from '@/components/AppLayout';
import ServicesTable, { ServicesRuntimeSummary } from '@/components/admin/ServicesTable';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import {
  listAllAppsWithUsage,
  listClusterNodes,
  type ConsoleApp,
  type ConsoleAppStatus,
  type ConsoleObservedStatus,
} from '@/lib/fugue/console';
import { observedStatusLabel } from '@/lib/fugue/observed-status';
import { getRequestI18n } from '@/lib/i18n/server';
import { getWorkspaceSnapshotsByTenantIds } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

/** Everything the services table needs, resolved once server-side. */
export type ServiceRow = {
  id: string;
  name: string;
  tenantId: string | null;
  ownerEmail: string | null;
  phase: string;
  replicas: number | null;
  stack: string[];
  deployMethod: string | null;
  repo: string | null;
  nodeName: string | null;
  routeUrl: string | null;
  spec: ConsoleApp['spec'];
  observedStatus: ConsoleObservedStatus | null;
  storedStatus: ConsoleAppStatus | null;
  desiredReplicas: number | null;
};

function deployMethod(app: ConsoleApp): string | null {
  const src = app.build_source ?? app.origin_source;
  if (!src) return null;
  // build_strategy is the most specific ("dockerfile", "buildpacks", "compose"…);
  // fall back to the source type ("git", "image", "upload").
  return src.build_strategy || src.type || null;
}

function techStack(app: ConsoleApp): string[] {
  const stack = app.tech_stack ?? [];
  const names = stack.map((t) => t.name).filter(Boolean);
  if (names.length) return names;
  // Fall back to the build source's detected stack when tech_stack is empty.
  const detected = (app.build_source ?? app.origin_source)?.detected_stack;
  return detected ? [detected] : [];
}

function repoLabel(app: ConsoleApp): string | null {
  const src = app.build_source ?? app.origin_source;
  if (src?.repo_url) {
    const branch = src.repo_branch ? `@${src.repo_branch}` : '';
    // Trim the scheme/host for a compact label (owner/repo).
    const short = src.repo_url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
    return `${short}${branch}`;
  }
  if (src?.image_ref) return src.image_ref;
  if (src?.resolved_image_ref) return src.resolved_image_ref;
  return null;
}

export default async function AdminServicesPage() {
  const initialObservedNow = Date.now();
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();

  const [apps, nodes] = await Promise.all([
    listAllAppsWithUsage().catch(() => [] as ConsoleApp[]),
    listClusterNodes().catch(() => []),
  ]);

  // app id → node name, from the cluster workloads (each carries owner_app_id).
  const nodeByAppId = new Map<string, string>();
  for (const node of nodes) {
    for (const w of node.workloads ?? []) {
      if (w.owner_app_id) nodeByAppId.set(w.owner_app_id, node.name);
      // An app workload's own id is the app id too.
      if (w.kind === 'app' && w.id) nodeByAppId.set(w.id, node.name);
    }
  }

  // tenant id → owner email, from workspace snapshots.
  const tenantIds = [
    ...new Set(apps.map((a) => a.tenant_id).filter((x): x is string => Boolean(x))),
  ];
  const snapshots = tenantIds.length
    ? await getWorkspaceSnapshotsByTenantIds(tenantIds).catch(() => [])
    : [];
  const emailByTenant = new Map<string, string>();
  for (const s of snapshots) emailByTenant.set(s.tenantId, s.email);

  const rows: ServiceRow[] = apps.map((app) => ({
    id: app.id,
    name: app.name,
    tenantId: app.tenant_id ?? null,
    ownerEmail: app.tenant_id ? emailByTenant.get(app.tenant_id) ?? null : null,
    phase: observedStatusLabel(app),
    replicas:
      typeof app.observed_status?.ready_replicas === 'number'
        ? app.observed_status.ready_replicas
        : null,
    stack: techStack(app),
    deployMethod: deployMethod(app),
    repo: repoLabel(app),
    nodeName: nodeByAppId.get(app.id) ?? null,
    routeUrl: app.route?.public_url || app.route?.url || null,
    spec: app.spec,
    observedStatus: app.observed_status ?? null,
    // `status` is the legacy effective/observed projection once live status
    // is requested. Keep the durable control-plane state separate when the
    // backend supplies the explicit contract.
    storedStatus: app.stored_status ?? app.status ?? null,
    desiredReplicas:
      typeof app.observed_status?.desired_replicas === 'number'
        ? app.observed_status.desired_replicas
        : typeof app.spec?.replicas === 'number'
          ? app.spec.replicas
          : null,
  }));

  // Sort: running/degraded first, then by name.
  const phaseRank: Record<string, number> = {
    running: 0,
    updating: 1,
    degraded: 2,
    pending: 3,
    stopped: 4,
    failed: 5,
  };
  rows.sort((a, b) => {
    const ra = phaseRank[a.phase.toLowerCase()] ?? 9;
    const rb = phaseRank[b.phase.toLowerCase()] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Services</div>
            <h1>{t('All services')}</h1>
            <ServicesRuntimeSummary
              rows={rows}
              tenantCount={tenantIds.length}
              initialObservedNow={initialObservedNow}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t('Deployed services')}</h3>
            <div className="tail eyebrow">{rows.length} total</div>
          </div>
          {rows.length > 0 ? (
            <ServicesTable rows={rows} initialObservedNow={initialObservedNow} />
          ) : (
            <div className="empty">{t('No services deployed yet.')}</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

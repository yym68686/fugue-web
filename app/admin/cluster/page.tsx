import AppLayout from '@/components/AppLayout';
import ClusterNodeTable from '@/components/admin/ClusterNodeTable';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { listClusterNodes, type ClusterNode } from '@/lib/fugue/console';
import { fmtPercent } from '@/lib/format';
import { getRequestI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type ClusterData = {
  nodes: ClusterNode[];
  loadError: boolean;
};

async function getClusterData(): Promise<ClusterData> {
  try {
    const nodes = await listClusterNodes();
    return { nodes, loadError: false };
  } catch {
    return { nodes: [], loadError: true };
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default async function AdminClusterPage() {
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();
  const { nodes, loadError } = await getClusterData();

  const ready = nodes.filter((n) => {
    const s = n.status.toLowerCase();
    return s === 'ready' || s === 'active';
  }).length;
  const regions = Array.from(
    new Set(nodes.map((n) => n.region).filter((r): r is string => Boolean(r))),
  );
  const avgCpu = avg(nodes.map((n) => n.cpu?.usage_percent ?? 0));
  const avgMem = avg(nodes.map((n) => n.memory?.usage_percent ?? 0));
  const avgDisk = avg(nodes.map((n) => n.ephemeral_storage?.usage_percent ?? 0));

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Cluster</div>
            <h1>{t('Cluster')}</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {t('{ready}/{total} ready', { ready, total: nodes.length })}
              </span>
              <span>{t('{count} regions', { count: regions.length })}</span>
            </div>
          </div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi">
            <div className="k">{t('Nodes')}</div>
            <div className="v">
              {ready}
              <small> / {nodes.length}</small>
            </div>
            <div className="d up">{t('Ready')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Cluster CPU')}</div>
            <div className="v">{fmtPercent(avgCpu)}</div>
            <div className="d">{t('Average usage')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Cluster memory')}</div>
            <div className="v">{fmtPercent(avgMem)}</div>
            <div className="d">{t('Average usage')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Cluster disk')}</div>
            <div className="v">{fmtPercent(avgDisk)}</div>
            <div className="d">{t('Average usage')}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t('Cluster nodes')}</h3>
            <div className="tail eyebrow">{nodes.length} nodes</div>
          </div>
          {nodes.length > 0 && <ClusterNodeTable nodes={nodes} />}
          {nodes.length === 0 && !loadError && (
            <div className="empty">{t('No cluster nodes')}</div>
          )}
          {loadError && (
            <div className="empty">{t('Unable to load cluster data. Please try again later.')}</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

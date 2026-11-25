import AppLayout from '@/components/AppLayout';
import { withPageTiming } from '@/lib/server/with-page-timing';
import ClusterNodeTable from '@/components/admin/ClusterNodeTable';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { listClusterNodes, listEdgeInventory, type ClusterNode } from '@/lib/fugue/console';
import { fmtPercent } from '@/lib/format';
import { getRequestI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type ClusterData = {
  nodes: ClusterNode[];
  loadError: boolean;
};

async function getClusterData(): Promise<ClusterData> {
  try {
    const [nodes, edges] = await Promise.all([
      listClusterNodes(),
      listEdgeInventory().catch(() => []),
    ]);
    const observations = new Map(edges.map((edge) => [edge.id, edge.observation]));
    for (const node of nodes) node.edge_observation = observations.get(node.name);
    return { nodes, loadError: false };
  } catch {
    return { nodes: [], loadError: true };
  }
}

function avg(nums: (number | undefined | null)[]): string {
  const measured = nums.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return measured.length ? fmtPercent(measured.reduce((a, b) => a + b, 0) / measured.length) : '—';
}

export default withPageTiming('/admin/cluster', async function AdminClusterPage() {
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
  const avgCpu = avg(nodes.map((n) => n.cpu?.usage_percent));
  const avgMem = avg(nodes.map((n) => n.memory?.usage_percent));
  const avgDisk = avg(nodes.map((n) => n.ephemeral_storage?.usage_percent));

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <h1>{t('Cluster')}</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {t('{ready}/{total} ready', { ready, total: nodes.length })}
              </span>
              <span>{t('{count} regions', { count: regions.length })}</span>
            </div>
          </div>
        </div>

        <div className="kpi-row">
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
            <div className="v">{avgCpu}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Cluster memory')}</div>
            <div className="v">{avgMem}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Cluster disk')}</div>
            <div className="v">{avgDisk}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t('Cluster nodes')}</h3>
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
});

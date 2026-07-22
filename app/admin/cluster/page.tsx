import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { ClusterNode, PlatformOverview } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

export const dynamic = 'force-dynamic';

async function getSnapshot<T>(key: string): Promise<T | null> {
  const result = await queryDb<{ payload: T; updated_at: string }>(
    `SELECT payload, updated_at FROM app_admin_snapshots WHERE key = $1`,
    [key]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].payload as T;
}

function barClass(pct: number): string {
  if (pct >= 85) return 'crit';
  if (pct >= 70) return 'hot';
  return '';
}

const statusChip: Record<string, string> = {
  ready: 'ok',
  drain: 'warn',
  down: 'err',
};

export default async function AdminClusterPage() {
  await requireActivePageSession();
  const health = await getSnapshot<{ nodes: ClusterNode[]; regions: string[] }>(
    'cluster_health'
  );
  const overview = await getSnapshot<PlatformOverview>('platform_overview');

  const nodes = health?.nodes || [];
  const regions = health?.regions || [];
  const ready = nodes.filter((n) => n.status === 'ready').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Cluster</div>
            <h1>集群</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {ready}/{nodes.length} 就绪
              </span>
              <span>{regions.length} 个区域</span>
            </div>
          </div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi">
            <div className="k">节点</div>
            <div className="v">
              {ready}
              <small> / {nodes.length}</small>
            </div>
            <div className="d up">就绪</div>
          </div>
          <div className="kpi">
            <div className="k">区域</div>
            <div className="v">{regions.length}</div>
            <div className="d">{regions.join(' · ')}</div>
          </div>
          <div className="kpi">
            <div className="k">活跃节点密钥</div>
            <div className="v">{overview?.totals.activeNodes ?? '—'}</div>
            <div className="d">全平台</div>
          </div>
          <div className="kpi">
            <div className="k">近 24h 部署</div>
            <div className="v">{overview?.activity.deploysLast24h ?? '—'}</div>
            <div className="d up">正常</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>集群节点</h3>
            <div className="tail eyebrow">{nodes.length} nodes</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>节点</th>
                <th>区域</th>
                <th>角色</th>
                <th>CPU</th>
                <th>内存</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.name}>
                  <td>{n.name}</td>
                  <td>{n.region}</td>
                  <td>{n.role}</td>
                  <td>
                    <span className="bar">
                      <i className={barClass(n.cpu)} style={{ width: `${n.cpu}%` }}></i>
                    </span>
                    <span className="bar-val"> {n.cpu}%</span>
                  </td>
                  <td>
                    <span className="bar">
                      <i className={barClass(n.mem)} style={{ width: `${n.mem}%` }}></i>
                    </span>
                    <span className="bar-val"> {n.mem}%</span>
                  </td>
                  <td>
                    <span className={`chip ${statusChip[n.status] || 'idle'}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nodes.length === 0 && <div className="empty">暂无集群数据快照</div>}
        </div>
      </div>
    </AppLayout>
  );
}

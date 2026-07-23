import AppLayout from '@/components/AppLayout';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { listClusterNodes, type ClusterNode } from '@/lib/fugue/console';
import { fmtBytes, fmtMillicores, fmtPercent } from '@/lib/format';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

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

function barClass(pct: number | undefined): string {
  const v = pct ?? 0;
  if (v >= 85) return 'crit';
  if (v >= 70) return 'hot';
  return '';
}

const STATUS_CHIP: Record<string, string> = {
  ready: 'ok',
  active: 'ok',
  drain: 'warn',
  draining: 'warn',
  down: 'err',
  notready: 'err',
  unknown: 'warn',
};

function statusChipClass(status: string): string {
  return STATUS_CHIP[status.toLowerCase().replace(/\s+/g, '')] ?? 'idle';
}

// A usage bar with an overlaid request marker, so operators can compare
// actual usage against reserved (requested) capacity at a glance.
function UsageCell({
  usagePct,
  requestPct,
  detail,
  t,
}: {
  usagePct: number | undefined;
  requestPct: number | undefined;
  detail: string;
  t: TranslateFn;
}) {
  const usage = Math.max(0, Math.min(100, usagePct ?? 0));
  const request = Math.max(0, Math.min(100, requestPct ?? 0));
  return (
    <div className="usage-cell">
      <span className="bar bar-wide">
        <i className={barClass(usagePct)} style={{ width: `${usage}%` }}></i>
        {requestPct != null && (
          <span
            className="req-mark"
            style={{ left: `${request}%` }}
            title={t('Requested {pct}', { pct: fmtPercent(requestPct) })}
          ></span>
        )}
      </span>
      <span className="usage-meta">
        <span className="bar-val">{fmtPercent(usagePct)}</span>
        {requestPct != null && (
          <span className="usage-req">{t('Requested {pct}', { pct: fmtPercent(requestPct) })}</span>
        )}
        {detail && <span className="usage-detail">{detail}</span>}
      </span>
    </div>
  );
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
          <table className="tbl tbl-cluster">
            <thead>
              <tr>
                <th>{t('Node')}</th>
                <th>{t('Role')}</th>
                <th>{t('Status')}</th>
                <th>{t('CPU (usage / request)')}</th>
                <th>{t('Memory (usage / request)')}</th>
                <th>{t('Disk')}</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.name}>
                  <td>
                    <div className="node-nm">{n.name}</div>
                    {n.region && <div className="node-sub">{n.region}</div>}
                  </td>
                  <td>
                    {n.roles && n.roles.length > 0 ? (
                      <span className="node-roles">{n.roles.join(', ')}</span>
                    ) : (
                      <span className="node-sub">worker</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${statusChipClass(n.status)}`}>
                      {n.status}
                    </span>
                  </td>
                  <td>
                    <UsageCell
                      t={t}
                      usagePct={n.cpu?.usage_percent}
                      requestPct={n.cpu?.request_percent}
                      detail={
                        n.cpu?.capacity_millicores
                          ? `${fmtMillicores(n.cpu.used_millicores)} / ${fmtMillicores(n.cpu.capacity_millicores)}`
                          : ''
                      }
                    />
                  </td>
                  <td>
                    <UsageCell
                      t={t}
                      usagePct={n.memory?.usage_percent}
                      requestPct={n.memory?.request_percent}
                      detail={
                        n.memory?.capacity_bytes
                          ? `${fmtBytes(n.memory.used_bytes)} / ${fmtBytes(n.memory.capacity_bytes)}`
                          : ''
                      }
                    />
                  </td>
                  <td>
                    <UsageCell
                      t={t}
                      usagePct={n.ephemeral_storage?.usage_percent}
                      requestPct={undefined}
                      detail={
                        n.ephemeral_storage?.capacity_bytes
                          ? `${fmtBytes(n.ephemeral_storage.used_bytes)} / ${fmtBytes(n.ephemeral_storage.capacity_bytes)}`
                          : ''
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

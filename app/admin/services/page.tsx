import pool from '@/lib/db';
import AppLayout from '@/components/AppLayout';
import { PlatformOverview, AuditEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getOverview(): Promise<PlatformOverview | null> {
  const result = await pool.query(
    `SELECT payload FROM app_admin_snapshots WHERE key = 'platform_overview'`
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].payload as PlatformOverview;
}

async function getAuditEvents(): Promise<AuditEvent[]> {
  const result = await pool.query(`
    SELECT id, action, actor_email, target_email, metadata, created_at
    FROM app_security_audit_events
    ORDER BY created_at DESC
    LIMIT 20
  `);
  return result.rows;
}

function fmtMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100
  );
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

const actionMeta: Record<string, { label: string; kind: string }> = {
  'user.login': { label: '用户登录', kind: 'deploy' },
  'apikey.create': { label: '创建密钥', kind: 'deploy' },
  'apikey.revoke': { label: '吊销密钥', kind: 'incident' },
  'node.attach': { label: '接入节点', kind: 'deploy' },
  'billing.topup': { label: '账户充值', kind: 'restart' },
};

export default async function AdminServicesPage() {
  const overview = await getOverview();
  const events = await getAuditEvents();

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Services</div>
            <h1>服务与运营</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> 控制面运行中
              </span>
              <span>平台快照 · 实时</span>
            </div>
          </div>
        </div>

        <div className="kpi-row">
          <div className="kpi">
            <div className="k">用户</div>
            <div className="v">{overview?.totals.users ?? '—'}</div>
            <div className="d">注册总数</div>
          </div>
          <div className="kpi">
            <div className="k">工作空间</div>
            <div className="v">{overview?.totals.workspaces ?? '—'}</div>
            <div className="d">租户</div>
          </div>
          <div className="kpi">
            <div className="k">API 密钥</div>
            <div className="v">{overview?.totals.apiKeys ?? '—'}</div>
            <div className="d">已签发</div>
          </div>
          <div className="kpi">
            <div className="k">活跃节点</div>
            <div className="v">
              {overview?.totals.activeNodes ?? '—'}
              <small> / {overview?.totals.nodeKeys ?? '—'}</small>
            </div>
            <div className="d up">在线</div>
          </div>
          <div className="kpi">
            <div className="k">近 30 天营收</div>
            <div className="v">
              {overview ? fmtMoney(overview.revenue.last30dCents, overview.revenue.currency) : '—'}
            </div>
            <div className="d up">累计 {overview ? fmtMoney(overview.revenue.allTimeCents, overview.revenue.currency) : '—'}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>安全审计流</h3>
            <span className="eyebrow" style={{ letterSpacing: '.1em' }}>
              全平台 · 最近事件
            </span>
            <div className="tail">
              <span className="chip run">
                <span className="dot run"></span>实时
              </span>
            </div>
          </div>
          <div className="feed">
            {events.length === 0 && <div className="empty">暂无审计事件</div>}
            {events.map((ev) => {
              const meta = actionMeta[ev.action] || {
                label: ev.action,
                kind: 'deploy',
              };
              return (
                <div key={ev.id} className={`ev ${meta.kind}`}>
                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3l9 16H3z" />
                      <path d="M12 10v4M12 17v.01" />
                    </svg>
                  </span>
                  <div className="body">
                    <div className="hd">
                      <span className="svc">{meta.label}</span>
                      <span className="act mono">{ev.action}</span>
                    </div>
                    <div className="sub">
                      {ev.actor_email || '系统'}
                      {ev.target_email && ev.target_email !== ev.actor_email
                        ? ` → ${ev.target_email}`
                        : ''}
                    </div>
                  </div>
                  <span className="when">{relTime(ev.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

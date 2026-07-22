import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppLayout from '@/components/AppLayout';
import { queryDb } from '@/lib/db/pool';
import { requireActivePageSession } from '@/lib/auth/page-access';
import type { ApiKey, BillingTopup, NodeKey, Workspace } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 详情页始终按 tenant_id + user_email 双重过滤，防止拼别人的 tenant_id 越权。
async function getWorkspace(
  tenantId: string,
  userEmail: string,
): Promise<Workspace | null> {
  const result = await queryDb<Workspace>(
    `
    SELECT
      user_email, tenant_id, tenant_name, default_project_id,
      default_project_name, first_app_id, admin_key_id, admin_key_label,
      admin_key_prefix, admin_key_scopes, admin_key_secret_sealed,
      created_at, updated_at
    FROM app_workspaces
    WHERE tenant_id = $1 AND user_email = $2
    LIMIT 1
  `,
    [tenantId, userEmail],
  );
  return result.rows[0] ?? null;
}

async function getKeys(tenantId: string, userEmail: string): Promise<ApiKey[]> {
  const result = await queryDb<ApiKey>(
    `
    SELECT fugue_key_id, user_email, tenant_id, label, prefix, scopes,
           status, source, is_workspace_admin, last_used_at,
           disabled_at, deleted_at, created_at, updated_at
    FROM app_api_keys
    WHERE tenant_id = $1 AND user_email = $2 AND status != 'deleted'
    ORDER BY created_at DESC
  `,
    [tenantId, userEmail],
  );
  return result.rows;
}

async function getNodes(tenantId: string, userEmail: string): Promise<NodeKey[]> {
  const result = await queryDb<NodeKey>(
    `
    SELECT fugue_node_key_id, user_email, tenant_id, label, prefix,
           status, source, last_used_at, revoked_at, created_at, updated_at
    FROM app_node_keys
    WHERE tenant_id = $1 AND user_email = $2
    ORDER BY created_at DESC
  `,
    [tenantId, userEmail],
  );
  return result.rows;
}

async function getTopups(
  tenantId: string,
  userEmail: string,
): Promise<BillingTopup[]> {
  const result = await queryDb<BillingTopup>(
    `
    SELECT request_id, provider, user_email, tenant_id, product_id, units,
           amount_cents, status, checkout_id, order_id, currency, payer_email,
           completed_at, failed_at, created_at, updated_at
    FROM app_billing_topups
    WHERE tenant_id = $1 AND user_email = $2
    ORDER BY created_at DESC
  `,
    [tenantId, userEmail],
  );
  return result.rows;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relTime(d: Date | string | null): string {
  if (!d) return '从未使用';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

function fmtMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100,
  );
}

const keyStatusChip: Record<string, string> = {
  active: 'ok',
  disabled: 'idle',
  revoked: 'err',
  deleted: 'err',
};

const keyStatusLabel: Record<string, string> = {
  active: '启用',
  disabled: '已停用',
  revoked: '已吊销',
  deleted: '已删除',
};

const topupStatusChip: Record<string, string> = {
  completed: 'ok',
  pending: 'warn',
  processing: 'run',
  failed: 'err',
};

const topupStatusLabel: Record<string, string> = {
  completed: '已完成',
  pending: '待支付',
  processing: '处理中',
  failed: '失败',
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { session } = await requireActivePageSession();
  const { tenantId: rawTenantId } = await params;
  const tenantId = decodeURIComponent(rawTenantId);

  const ws = await getWorkspace(tenantId, session.email);
  if (!ws) {
    notFound();
  }

  const [keys, nodes, topups] = await Promise.all([
    getKeys(tenantId, session.email),
    getNodes(tenantId, session.email),
    getTopups(tenantId, session.email),
  ]);

  const completedCents = topups
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount_cents, 0);

  return (
    <AppLayout>
      <div className="page">
        <nav className="crumb">
          <Link className="seg" href="/projects">
            项目
          </Link>
          <span className="sep">/</span>
          <span className="seg">{ws.tenant_name}</span>
        </nav>

        <div className="phead">
          <div>
            <div className="eyebrow">Project</div>
            <h1>{ws.tenant_name}</h1>
            <div className="meta">
              <span className="mono">{ws.tenant_id}</span>
              <span>
                <span className="dot ok"></span> 创建于 {fmtDate(ws.created_at)}
              </span>
            </div>
          </div>
          <div className="actions">
            <Link className="btn" href="/projects">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              返回项目
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>概览</h3>
          </div>
          <div className="kv-grid">
            <div className="kv">
              <span className="kv-k">租户 ID</span>
              <span className="kv-v mono">{ws.tenant_id}</span>
            </div>
            <div className="kv">
              <span className="kv-k">默认项目</span>
              <span className="kv-v">
                {ws.default_project_name ?? '未设置'}
                {ws.default_project_id ? (
                  <span className="kv-sub mono"> · {ws.default_project_id}</span>
                ) : null}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">首个 App</span>
              <span className="kv-v mono">{ws.first_app_id ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="kv-k">管理员密钥</span>
              <span className="kv-v">
                {ws.admin_key_label}
                {ws.admin_key_prefix ? (
                  <span className="kv-sub mono"> · {ws.admin_key_prefix}</span>
                ) : null}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">密钥权限</span>
              <span className="kv-v chips">
                {ws.admin_key_scopes.length > 0 ? (
                  ws.admin_key_scopes.map((s) => (
                    <span key={s} className="chip idle">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="kv-sub">无</span>
                )}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">最近更新</span>
              <span className="kv-v">{fmtDate(ws.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>API 密钥</h3>
            <div className="tail eyebrow">{keys.length} total</div>
          </div>
          <div className="list">
            {keys.length === 0 && <div className="empty">暂无 API 密钥</div>}
            {keys.map((k) => (
              <div key={k.fugue_key_id} className="row-item">
                <span className={`dot ${keyStatusChip[k.status] ?? 'idle'} dot-lead`}></span>
                <div className="main-col">
                  <div className="nm">
                    {k.label}
                    {k.is_workspace_admin ? (
                      <span className="chip idle">管理员</span>
                    ) : null}
                  </div>
                  <div className="id">{k.prefix ?? k.fugue_key_id}</div>
                  <div className="sub">最近使用 {relTime(k.last_used_at)}</div>
                </div>
                <div className="stats">
                  <span className={`chip ${keyStatusChip[k.status] ?? 'idle'}`}>
                    {keyStatusLabel[k.status] ?? k.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>节点密钥</h3>
            <div className="tail eyebrow">{nodes.length} total</div>
          </div>
          <div className="list">
            {nodes.length === 0 && <div className="empty">暂无节点密钥</div>}
            {nodes.map((n) => (
              <div key={n.fugue_node_key_id} className="row-item">
                <span className={`dot ${keyStatusChip[n.status] ?? 'idle'} dot-lead`}></span>
                <div className="main-col">
                  <div className="nm">{n.label}</div>
                  <div className="id">{n.prefix ?? n.fugue_node_key_id}</div>
                  <div className="sub">心跳 {relTime(n.last_used_at)}</div>
                </div>
                <div className="stats">
                  <span className={`chip ${keyStatusChip[n.status] ?? 'idle'}`}>
                    {keyStatusLabel[n.status] ?? n.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>充值记录</h3>
            <div className="tail eyebrow">已完成 {fmtMoney(completedCents)}</div>
          </div>
          <div className="list">
            {topups.length === 0 && <div className="empty">暂无充值记录</div>}
            {topups.map((t) => (
              <div key={t.request_id} className="row-item">
                <span className={`dot ${topupStatusChip[t.status] ?? 'idle'} dot-lead`}></span>
                <div className="main-col">
                  <div className="nm">
                    {fmtMoney(t.amount_cents, t.currency ?? 'USD')}
                    <span className="kv-sub"> · {t.units} 单位</span>
                  </div>
                  <div className="id">{t.request_id}</div>
                  <div className="sub">
                    {t.provider} · {fmtDate(t.created_at)}
                  </div>
                </div>
                <div className="stats">
                  <span className={`chip ${topupStatusChip[t.status] ?? 'idle'}`}>
                    {topupStatusLabel[t.status] ?? t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


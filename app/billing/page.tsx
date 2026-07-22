import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { BillingTopup } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

export const dynamic = 'force-dynamic';

async function getTopups(): Promise<BillingTopup[]> {
  const result = await queryDb<BillingTopup>(`
    SELECT request_id, provider, user_email, tenant_id, product_id, units,
           amount_cents, status, checkout_id, order_id, currency, payer_email,
           completed_at, failed_at, created_at, updated_at
    FROM app_billing_topups
    ORDER BY created_at DESC
  `);
  return result.rows;
}

function fmtMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

const statusChip: Record<string, string> = {
  completed: 'ok',
  pending: 'warn',
  processing: 'run',
  failed: 'err',
};

const statusLabel: Record<string, string> = {
  completed: '已完成',
  pending: '待支付',
  processing: '处理中',
  failed: '失败',
};

export default async function BillingPage() {
  await requireActivePageSession();
  const topups = await getTopups();

  const completed = topups.filter((t) => t.status === 'completed');
  const totalCents = completed.reduce((s, t) => s + t.amount_cents, 0);
  const totalUnits = completed.reduce((s, t) => s + t.units, 0);
  const pendingCount = topups.filter((t) => t.status === 'pending').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Billing</div>
            <h1>账单与额度</h1>
            <div className="meta">
              <span>{topups.length} 笔充值记录</span>
              <span>provider · creem</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              充值额度
            </button>
          </div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi">
            <div className="k">额度余额</div>
            <div className="v">
              {totalUnits}
              <small> units</small>
            </div>
            <div className="d up">累计已购</div>
          </div>
          <div className="kpi">
            <div className="k">累计充值</div>
            <div className="v">{fmtMoney(totalCents)}</div>
            <div className="d">{completed.length} 笔已完成</div>
          </div>
          <div className="kpi">
            <div className="k">待处理</div>
            <div className="v">{pendingCount}</div>
            <div className="d">{pendingCount > 0 ? '有待支付订单' : '无'}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>充值记录</h3>
            <div className="tail eyebrow">{topups.length} total</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>请求 ID</th>
                <th>账户</th>
                <th>额度</th>
                <th>金额</th>
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {topups.map((t) => (
                <tr key={t.request_id}>
                  <td>{t.request_id}</td>
                  <td>{t.user_email}</td>
                  <td>{t.units} units</td>
                  <td>{fmtMoney(t.amount_cents, t.currency || 'USD')}</td>
                  <td>
                    <span className={`chip ${statusChip[t.status] || 'idle'}`}>
                      {statusLabel[t.status] || t.status}
                    </span>
                  </td>
                  <td className="faint">
                    {new Date(t.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topups.length === 0 && <div className="empty">暂无充值记录</div>}
        </div>
      </div>
    </AppLayout>
  );
}

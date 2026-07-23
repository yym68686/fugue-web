import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { BillingTopup } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import { getBillingSummary, type BillingSummary } from '@/lib/fugue/console';
import { BillingCapEditor } from '@/components/billing/BillingCapEditor';

export const dynamic = 'force-dynamic';

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

async function getTopups(userEmail: string): Promise<BillingTopup[]> {
  const result = await queryDb<BillingTopup>(
    `
    SELECT request_id, provider, user_email, tenant_id, product_id, units,
           amount_cents, status, checkout_id, order_id, currency, payer_email,
           completed_at, failed_at, created_at, updated_at
    FROM app_billing_topups
    WHERE user_email = $1
    ORDER BY created_at DESC
  `,
    [userEmail],
  );
  return result.rows;
}

// Best-effort: the managed-cap editor is a bonus, so a billing-sync failure or
// a workspace-less account degrades gracefully to the top-up history alone.
async function getBilling(userEmail: string): Promise<BillingSummary | null> {
  const workspace = await getCachedWorkspaceAccessByEmail(userEmail);
  if (!workspace) return null;
  try {
    return await getBillingSummary(workspace.adminKeySecret, true);
  } catch {
    return null;
  }
}

function fmtMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function fmtMicro(microcents: number, currency = 'USD', maxFractionDigits = 2) {
  const amount = microcents / MICRO_CENTS_PER_DOLLAR;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits:
      amount !== 0 && Math.abs(amount) < 0.01 ? 6 : maxFractionDigits,
  }).format(amount);
}

function fmtRunway(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  if (hours < 48) return `${Math.round(hours)} 小时`;
  return `${Math.round(hours / 24)} 天`;
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
  const { session } = await requireActivePageSession();
  const [topups, billing] = await Promise.all([
    getTopups(session.email),
    getBilling(session.email),
  ]);

  const completed = topups.filter((t) => t.status === 'completed');
  const totalCents = completed.reduce((s, t) => s + t.amount_cents, 0);
  const pendingCount = topups.filter((t) => t.status === 'pending').length;
  const currency = billing?.price_book.currency || 'USD';

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

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi">
            <div className="k">额度余额</div>
            <div className="v">
              {billing ? fmtMicro(billing.balance_microcents, currency) : fmtMoney(totalCents)}
            </div>
            <div className="d up">{billing ? '可用余额' : '累计已购'}</div>
          </div>
          <div className="kpi">
            <div className="k">当前费率</div>
            <div className="v">
              {billing ? fmtMicro(billing.hourly_rate_microcents, currency) : '—'}
              <small> /小时</small>
            </div>
            <div className="d">按资源上限计</div>
          </div>
          <div className="kpi">
            <div className="k">预计每月</div>
            <div className="v">
              {billing ? fmtMicro(billing.monthly_estimate_microcents, currency) : '—'}
            </div>
            <div className="d">{billing ? `${billing.price_book.hours_per_month} 小时/月` : '—'}</div>
          </div>
          <div className="kpi">
            <div className="k">可用时长</div>
            <div className="v">{billing ? fmtRunway(billing.runway_hours) : '—'}</div>
            <div className="d">{pendingCount > 0 ? `${pendingCount} 笔待支付` : '按当前费率'}</div>
          </div>
        </div>

        {billing && <BillingCapEditor initial={billing} />}

        {billing && (
          <div className="panel">
            <div className="panel-h">
              <h3>计费标准</h3>
              <div className="tail eyebrow">price book · {currency}</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>费率</th>
                  <th>单位</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>CPU</td>
                  <td>
                    {fmtMicro(
                      billing.price_book.cpu_microcents_per_millicore_hour * 1000,
                      currency,
                    )}
                  </td>
                  <td className="faint">每核 · 每小时</td>
                </tr>
                <tr>
                  <td>内存</td>
                  <td>
                    {fmtMicro(
                      billing.price_book.memory_microcents_per_mib_hour * 1024,
                      currency,
                    )}
                  </td>
                  <td className="faint">每 GiB · 每小时</td>
                </tr>
                <tr>
                  <td>存储</td>
                  <td>
                    {fmtMicro(billing.price_book.storage_microcents_per_gib_hour, currency)}
                  </td>
                  <td className="faint">每 GiB · 每小时</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

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

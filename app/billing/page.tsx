import { Suspense } from 'react';
import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { BillingTopup } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import { getBillingSummary, type BillingSummary } from '@/lib/fugue/console';
import { BillingCapEditor } from '@/components/billing/BillingCapEditor';
import { AddCreditsButton } from '@/components/billing/AddCreditsButton';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

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

function fmtRunway(hours: number | null | undefined, t: TranslateFn): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  if (hours < 1) return t('{count} min', { count: Math.round(hours * 60) });
  if (hours < 48) return t('{count} hr', { count: Math.round(hours) });
  return t('{count} days', { count: Math.round(hours / 24) });
}

const statusChip: Record<string, string> = {
  completed: 'ok',
  pending: 'warn',
  processing: 'run',
  failed: 'err',
};

const statusLabel: Record<string, string> = {
  completed: 'Completed',
  pending: 'Pending payment',
  processing: 'Processing',
  failed: 'Failed',
};

// Backend billing-event types → human labels + chip tone. `config-updated`
// events don't move the balance (amount 0); everything else is a real credit
// or debit against the prepaid balance.
const eventLabel: Record<string, string> = {
  'balance-adjusted': 'Admin adjustment',
  'top-up': 'Top-up',
  'config-updated': 'Cap change',
  usage: 'Usage charge',
};

const eventChip: Record<string, string> = {
  'balance-adjusted': 'run',
  'top-up': 'ok',
  'config-updated': 'idle',
  usage: 'warn',
};

// Describe a balance event's source: the admin actor, the creem note, or the
// resource spec it recorded.
function eventDetail(meta: Record<string, string> | null | undefined, t: TranslateFn): string {
  if (!meta) return '';
  if (meta.source === 'platform-admin' || meta.actor_type) {
    return meta.actor_id ? `${meta.source || 'admin'} · ${meta.actor_id}` : meta.source || '';
  }
  if (meta.note) return meta.note;
  const spec: string[] = [];
  if (meta.cpu_millicores) spec.push(`${Number(meta.cpu_millicores) / 1000} CPU`);
  if (meta.memory_mebibytes) spec.push(`${Number(meta.memory_mebibytes) / 1024} GiB`);
  if (meta.storage_gibibytes) spec.push(t('{count} GiB storage', { count: meta.storage_gibibytes }));
  return spec.join(' / ');
}

export default async function BillingPage() {
  const { session } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const [topups, billing] = await Promise.all([
    getTopups(session.email),
    getBilling(session.email),
  ]);

  const completed = topups.filter((t) => t.status === 'completed');
  const totalCents = completed.reduce((s, t) => s + t.amount_cents, 0);
  const pendingCount = topups.filter((t) => t.status === 'pending').length;
  const currency = billing?.price_book.currency || 'USD';
  // The backend ledger already merges admin adjustments (balance-adjusted) and
  // real paid top-ups. Show the newest first.
  const events = (billing?.events ?? [])
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Billing</div>
            <h1>{t('Billing & credits')}</h1>
            <div className="meta">
              <span>{billing ? t('{count} balance changes', { count: events.length }) : t('{count} top-up records', { count: topups.length })}</span>
              <span>provider · creem</span>
            </div>
          </div>
          <div className="actions">
            <Suspense fallback={
              <button className="btn primary" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('Add credits')}
              </button>
            }>
              <AddCreditsButton />
            </Suspense>
          </div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi">
            <div className="k">{t('Credit balance')}</div>
            <div className="v">
              {billing ? fmtMicro(billing.balance_microcents, currency) : fmtMoney(totalCents)}
            </div>
            <div className="d up">{billing ? t('Available balance') : t('Total purchased')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Current rate')}</div>
            <div className="v">
              {billing ? fmtMicro(billing.hourly_rate_microcents, currency) : '—'}
              <small> {t('/hr')}</small>
            </div>
            <div className="d">{t('Based on resource cap')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Monthly estimate')}</div>
            <div className="v">
              {billing ? fmtMicro(billing.monthly_estimate_microcents, currency) : '—'}
            </div>
            <div className="d">{billing ? t('{count} hr/month', { count: billing.price_book.hours_per_month }) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Runway')}</div>
            <div className="v">{billing ? fmtRunway(billing.runway_hours, t) : '—'}</div>
            <div className="d">{pendingCount > 0 ? t('{count} pending payment', { count: pendingCount }) : t('At current rate')}</div>
          </div>
        </div>

        {billing && <BillingCapEditor initial={billing} />}

        {billing && (
          <div className="panel">
            <div className="panel-h">
              <h3>{t('Pricing')}</h3>
              <div className="tail eyebrow">price book · {currency}</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('Resource')}</th>
                  <th>{t('Rate')}</th>
                  <th>{t('Unit')}</th>
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
                  <td className="faint">{t('per core · per hour')}</td>
                </tr>
                <tr>
                  <td>{t('Memory')}</td>
                  <td>
                    {fmtMicro(
                      billing.price_book.memory_microcents_per_mib_hour * 1024,
                      currency,
                    )}
                  </td>
                  <td className="faint">{t('per GiB · per hour')}</td>
                </tr>
                <tr>
                  <td>{t('Storage')}</td>
                  <td>
                    {fmtMicro(billing.price_book.storage_microcents_per_gib_hour, currency)}
                  </td>
                  <td className="faint">{t('per GiB · per hour')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {billing ? (
          <div className="panel">
            <div className="panel-h">
              <h3>{t('Balance changes')}</h3>
              <div className="tail eyebrow">{t('{count} total · includes admin adjustments', { count: events.length })}</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('Type')}</th>
                  <th>{t('Amount')}</th>
                  <th>{t('Balance after')}</th>
                  <th>{t('Details')}</th>
                  <th>{t('Time')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={`chip ${eventChip[e.type] || 'idle'}`}>
                        {eventLabel[e.type] ? t(eventLabel[e.type]) : e.type}
                      </span>
                    </td>
                    <td>
                      {e.amount_microcents === 0
                        ? '—'
                        : `${e.amount_microcents > 0 ? '+' : ''}${fmtMicro(e.amount_microcents, currency)}`}
                    </td>
                    <td>{fmtMicro(e.balance_after_microcents, currency)}</td>
                    <td className="faint">{eventDetail(e.metadata, t) || '—'}</td>
                    <td className="faint">
                      {e.created_at
                        ? new Date(e.created_at).toLocaleString('zh-CN', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && <div className="empty">{t('No balance changes')}</div>}
          </div>
        ) : (
          <div className="panel">
            <div className="panel-h">
              <h3>{t('Top-up history')}</h3>
              <div className="tail eyebrow">{topups.length} total</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('Request ID')}</th>
                  <th>{t('Account')}</th>
                  <th>{t('Credits')}</th>
                  <th>{t('Amount')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Time')}</th>
                </tr>
              </thead>
              <tbody>
                {topups.map((tp) => (
                  <tr key={tp.request_id}>
                    <td>{tp.request_id}</td>
                    <td>{tp.user_email}</td>
                    <td>{tp.units} units</td>
                    <td>{fmtMoney(tp.amount_cents, tp.currency || 'USD')}</td>
                    <td>
                      <span className={`chip ${statusChip[tp.status] || 'idle'}`}>
                        {statusLabel[tp.status] ? t(statusLabel[tp.status]) : tp.status}
                      </span>
                    </td>
                    <td className="faint">
                      {new Date(tp.created_at).toLocaleString('zh-CN', {
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
            {topups.length === 0 && <div className="empty">{t('No top-up records')}</div>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

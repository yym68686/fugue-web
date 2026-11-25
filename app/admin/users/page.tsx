import { queryDb } from '@/lib/db/pool';
import { withPageTiming } from '@/lib/server/with-page-timing';
import AppLayout from '@/components/AppLayout';
import UserRowActions from '@/components/admin/UserRowActions';
import RowActions from '@/components/ui/RowActions';
import { listAppUsers } from '@/lib/app-users/store';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';
import { listWorkspaceSnapshots } from '@/lib/workspace/store';
import {
  listTenantBillingSummaries,
  type BillingSummary,
} from '@/lib/fugue/console';

export const dynamic = 'force-dynamic';

const MICRO_CENTS_PER_DOLLAR = 100_000_000;


type TopupRow = { user_email: string; total_cents: string | number };

/** Sum of completed top-ups per user, in cents. */
async function getTopupTotals(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const result = await queryDb<TopupRow>(`
      SELECT user_email, SUM(amount_cents) AS total_cents
      FROM app_billing_topups
      WHERE status = 'completed'
      GROUP BY user_email
    `);
    for (const row of result.rows) {
      map.set(row.user_email, Number(row.total_cents) || 0);
    }
  } catch {
    // Table may be absent in some environments; treat as no top-ups.
  }
  return map;
}

const statusChip: Record<string, string> = {
  active: 'ok',
  blocked: 'err',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  blocked: 'Blocked',
  deleted: 'Deleted',
};

function relTime(d: string | null, t: TranslateFn): string {
  if (!d) return t('Never signed in');
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('{mins} min ago', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{hrs} hr ago', { hrs });
  const days = Math.floor(hrs / 24);
  return t('{days} days ago', { days });
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact CPU/memory usage line, e.g. "1.2 cores · 3.4 GiB". */
function fmtUsage(summary: BillingSummary | null): string {
  if (!summary?.current_usage) return '—';
  const u = summary.current_usage;
  const parts: string[] = [];
  if (typeof u.cpu_millicores === 'number') {
    parts.push(`${(u.cpu_millicores / 1000).toFixed(2)} cores`);
  }
  if (typeof u.memory_bytes === 'number') {
    parts.push(`${(u.memory_bytes / 1024 ** 3).toFixed(2)} GiB`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

export default withPageTiming('/admin/users', async function AdminUsersPage() {
  await requireActiveAdminPageSession();
  const { t, locale } = await getRequestI18n();

  const [users, topups, snapshots] = await Promise.all([
    listAppUsers(),
    getTopupTotals(),
    listWorkspaceSnapshots(),
  ]);

  // email → tenantId map from workspace snapshots.
  const tenantByEmail = new Map<string, string>();
  for (const snap of snapshots) {
    tenantByEmail.set(snap.email, snap.tenantId);
  }

  // The platform aggregates complete ledger and usage snapshots in one request.
  const tenantIds = [...new Set([...tenantByEmail.values()])];
  const billingByTenant = new Map<string, BillingSummary>();
  const snapshot = await listTenantBillingSummaries(tenantIds, true).catch(() => null);
  const { billings, missingTenantIds } = snapshot ?? { billings: [], missingTenantIds: [] };
  for (const summary of billings) billingByTenant.set(summary.tenant_id, summary);
  const missingTenants = new Set(missingTenantIds);
  for (const [email, tenantId] of tenantByEmail) {
    if (missingTenants.has(tenantId)) tenantByEmail.delete(email);
  }

  const adminCount = users.filter((u) => u.isAdmin).length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <h1>{t('User management')}</h1>
            <div className="meta">
              <span>{t('{count} users', { count: users.length })}</span>
              <span>{t('{count} admins', { count: adminCount })}</span>
              <span>{t('{count} active', { count: activeCount })}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t('All users')}</h3>
          </div>
          {!snapshot && <p className="form-hint" role="status">{locale === 'zh-CN' ? '暂时无法读取账单和资源用量。' : 'Billing and usage data are temporarily unavailable.'}</p>}
          <div className="table-scroll" role="region" aria-label={t('All users')} tabIndex={0}>
          <table className="tbl admin-users-table">
            <thead>
              <tr>
                <th>{t('User')}</th>
                <th>{t('Status')}</th>
                <th>{t('Balance')}</th>
                <th>{t('Topped up')}</th>
                <th>{t('Services')}</th>
                <th>{t('Current usage')}</th>
                <th>{t('Last sign-in')}</th>
                <th className="ta-r">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const tenantId = tenantByEmail.get(u.email) ?? null;
                const billing = tenantId
                  ? billingByTenant.get(tenantId) ?? null
                  : null;
                const toppedUp = topups.get(u.email) ?? 0;
                const serviceCount = billing?.app_count;
                const cap = billing?.managed_cap;

                return (
                  <tr key={u.email} className="intent-row">
                    <td>
                      <div className="user-cell">
                        <span className="user-name">{u.name || '—'}</span>
                        <span className="user-email">{u.email}</span>
                        <details className="user-mobile-detail">
                          <summary>{t('Details')}</summary>
                          <dl>
                            <dt>{t('Topped up')}</dt><dd>{toppedUp ? fmtUsd(toppedUp) : '—'}</dd>
                            <dt>{t('Services')}</dt><dd>{serviceCount ?? '—'}</dd>
                            <dt>{t('Current usage')}</dt><dd>{fmtUsage(billing)}</dd>
                            <dt>{t('Last sign-in')}</dt><dd>{relTime(u.lastLoginAt, t)}</dd>
                          </dl>
                        </details>
                      </div>
                    </td>
                    <td>
                      {u.isAdmin && (
                        <div className="role-label">
                          {t('Admin')}
                        </div>
                      )}
                      <span className={`chip ${statusChip[u.status] || 'idle'}`}>
                        {statusLabel[u.status] ? t(statusLabel[u.status]) : u.status}
                      </span>
                    </td>
                    <td className="mono">
                      {billing
                        ? fmtUsd(billing.balance_microcents / (MICRO_CENTS_PER_DOLLAR / 100))
                        : '—'}
                    </td>
                    <td className="mono">{toppedUp ? fmtUsd(toppedUp) : '—'}</td>
                    <td className="mono">{serviceCount ?? '—'}</td>
                    <td className="faint mono">{fmtUsage(billing)}</td>
                    <td className="faint">{relTime(u.lastLoginAt, t)}</td>
                    <td className="ta-r">
                      {u.status !== 'deleted' && (!u.isAdmin || billing) && <RowActions inline>
                      <UserRowActions
                        email={u.email}
                        name={u.name || ''}
                        status={u.status}
                        isAdmin={u.isAdmin}
                        tenantId={billing ? tenantId : null}
                        balanceMicrocents={billing?.balance_microcents ?? null}
                        capCpuMillicores={cap?.cpu_millicores ?? null}
                        capMemoryMebibytes={cap?.memory_mebibytes ?? null}
                        capStorageGibibytes={cap?.storage_gibibytes ?? null}
                      />
                      </RowActions>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
});

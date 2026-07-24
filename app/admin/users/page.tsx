import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import UserRowActions from '@/components/admin/UserRowActions';
import { AdminUser } from '@/lib/types';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';
import { listWorkspaceSnapshots } from '@/lib/workspace/store';
import {
  getTenantBillingSummary,
  listAllAppsWithUsage,
  type BillingSummary,
} from '@/lib/fugue/console';

export const dynamic = 'force-dynamic';

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

async function getUsers(): Promise<AdminUser[]> {
  const result = await queryDb<AdminUser>(`
    SELECT email, name, picture_url, provider, verified, is_admin,
           status, last_login_at, created_at
    FROM app_users
    ORDER BY
      CASE WHEN is_admin THEN 0 ELSE 1 END,
      CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END,
      COALESCE(last_login_at, created_at) DESC
  `);
  return result.rows;
}

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

function relTime(d: Date | null, t: TranslateFn): string {
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

export default async function AdminUsersPage() {
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();

  const [users, topups, snapshots, allApps] = await Promise.all([
    getUsers(),
    getTopupTotals(),
    listWorkspaceSnapshots().catch(() => []),
    listAllAppsWithUsage().catch(() => []),
  ]);

  // email → tenantId map from workspace snapshots.
  const tenantByEmail = new Map<string, string>();
  for (const snap of snapshots) {
    tenantByEmail.set(snap.email, snap.tenantId);
  }

  // tenantId → service count from the all-apps listing.
  const appsByTenant = new Map<string, number>();
  for (const app of allApps) {
    if (!app.tenant_id) continue;
    appsByTenant.set(app.tenant_id, (appsByTenant.get(app.tenant_id) ?? 0) + 1);
  }

  // Per-tenant billing (balance, cap, current usage), bounded parallel.
  const tenantIds = [...new Set([...tenantByEmail.values()])];
  const billingByTenant = new Map<string, BillingSummary>();
  await Promise.all(
    tenantIds.map(async (tenantId) => {
      try {
        const summary = await getTenantBillingSummary(tenantId, true);
        billingByTenant.set(tenantId, summary);
      } catch {
        // Tenant billing may be unavailable; leave it out.
      }
    }),
  );

  const adminCount = users.filter((u) => u.is_admin).length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Users</div>
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
            <div className="tail eyebrow">{users.length} total</div>
          </div>
          <table className="tbl">
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
                const serviceCount = tenantId
                  ? appsByTenant.get(tenantId) ?? 0
                  : 0;
                const cap = billing?.managed_cap;

                return (
                  <tr key={u.email}>
                    <td>
                      <div className="user-cell">
                        <span className="user-name">{u.name || '—'}</span>
                        <span className="user-email">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      {u.is_admin && (
                        <span className="chip run" style={{ marginRight: 6 }}>
                          {t('Admin')}
                        </span>
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
                    <td className="mono">{tenantId ? serviceCount : '—'}</td>
                    <td className="faint mono">{fmtUsage(billing)}</td>
                    <td className="faint">{relTime(u.last_login_at, t)}</td>
                    <td className="ta-r">
                      <UserRowActions
                        email={u.email}
                        name={u.name || ''}
                        status={u.status as 'active' | 'blocked' | 'deleted'}
                        isAdmin={u.is_admin}
                        tenantId={tenantId}
                        balanceMicrocents={billing?.balance_microcents ?? null}
                        capCpuMillicores={cap?.cpu_millicores ?? null}
                        capMemoryMebibytes={cap?.memory_mebibytes ?? null}
                        capStorageGibibytes={cap?.storage_gibibytes ?? null}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { AdminUser } from '@/lib/types';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

export const dynamic = 'force-dynamic';

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

const statusChip: Record<string, string> = {
  active: 'ok',
  blocked: 'err',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  blocked: 'Blocked',
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

export default async function AdminUsersPage() {
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();
  const users = await getUsers();
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
                <th>{t('Sign-in method')}</th>
                <th>{t('Role')}</th>
                <th>{t('Status')}</th>
                <th>{t('Last sign-in')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>
                    <div className="user-cell">
                      <span className="user-name">{u.name || '—'}</span>
                      <span className="user-email">{u.email}</span>
                    </div>
                  </td>
                  <td>
                    {u.provider}
                    {u.verified && <span className="verified"> ✓</span>}
                  </td>
                  <td>
                    {u.is_admin ? (
                      <span className="chip run">{t('Admin')}</span>
                    ) : (
                      <span className="faint">{t('User')}</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${statusChip[u.status] || 'idle'}`}>
                      {statusLabel[u.status] ? t(statusLabel[u.status]) : u.status}
                    </span>
                  </td>
                  <td className="faint">{relTime(u.last_login_at, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

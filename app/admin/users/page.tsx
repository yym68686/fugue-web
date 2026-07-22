import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { AdminUser } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

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
  active: '正常',
  blocked: '已封禁',
};

function relTime(d: Date | null): string {
  if (!d) return '从未登录';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

export default async function AdminUsersPage() {
  await requireActivePageSession();
  const users = await getUsers();
  const adminCount = users.filter((u) => u.is_admin).length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Users</div>
            <h1>用户管理</h1>
            <div className="meta">
              <span>{users.length} 个用户</span>
              <span>{adminCount} 名管理员</span>
              <span>{activeCount} 个正常</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>所有用户</h3>
            <div className="tail eyebrow">{users.length} total</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>用户</th>
                <th>登录方式</th>
                <th>角色</th>
                <th>状态</th>
                <th>最近登录</th>
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
                      <span className="chip run">管理员</span>
                    ) : (
                      <span className="faint">用户</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${statusChip[u.status] || 'idle'}`}>
                      {statusLabel[u.status] || u.status}
                    </span>
                  </td>
                  <td className="faint">{relTime(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

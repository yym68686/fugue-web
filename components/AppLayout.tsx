'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const consoleNav = [
  {
    href: '/projects',
    label: '项目',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/billing',
    label: '账单',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </svg>
    ),
  },
  {
    href: '/keys',
    label: '访问密钥',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="5" />
        <path d="M11.5 11.5L21 21M18 18l-2 2M15 15l-2 2" />
      </svg>
    ),
  },
  {
    href: '/servers',
    label: '服务器',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="7" rx="1" />
        <rect x="3" y="13" width="18" height="7" rx="1" />
        <path d="M7 7.5v.01M7 16.5v.01" />
      </svg>
    ),
  },
];

const platformNav = [
  {
    href: '/admin/users',
    label: '用户',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/cluster',
    label: '集群',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 12v.01" />
        <path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13" />
      </svg>
    ),
  },
  {
    href: '/admin/services',
    label: '服务',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
          <span className="name">
            <b>fugue</b>
          </span>
          <span className="badge">CLOUD</span>
        </div>
        <div className="top-spacer"></div>
        <div className="avatar">YM</div>
      </header>

      <aside className="rail">
        <div className="rail-group">
          <div className="eyebrow">
            Console <span className="role">开发者</span>
          </div>
          {consoleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="rail-group">
          <div className="eyebrow">
            Platform <span className="role">平台管理员</span>
          </div>
          {platformNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="rail-foot">
          <div className="row">
            <span className="dot ok"></span> control-plane
          </div>
          <div className="row" style={{ marginTop: '5px' }}>
            v2.4.1 · api healthy
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <a className="auth-brand" href="/">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
          <span>
            <b>fugue</b>
          </span>
          <span className="badge">CLOUD</span>
        </a>

        <div className="auth-aside-body">
          <div className="eyebrow">Multi-tenant PaaS on k3s</div>
          <h2>把代码交给 Fugue，专注你的产品。</h2>
          <p>
            连接 GitHub 仓库即可自动构建与部署，内建多租户隔离、密钥管理与用量计费。
          </p>
          <div className="auth-points">
            <div className="row">
              <span className="dot ok"></span> 一键从 GitHub 部署，自动构建
            </div>
            <div className="row">
              <span className="dot ok"></span> 每个工作空间独立租户与密钥
            </div>
            <div className="row">
              <span className="dot ok"></span> 实时用量、账单与集群可观测
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}

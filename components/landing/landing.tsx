import type { ReactNode } from "react";

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function Feature({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="lp-feature">
      <div className="lp-feature-code">{code}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-top">
        <a className="lp-brand" href="/">
          <BrandMark />
          <b>fugue</b>
          <span className="lp-badge">CLOUD</span>
        </a>
        <nav className="lp-nav">
          <a href="#how">工作原理</a>
          <a href="#features">能力</a>
          <a className="lp-nav-cta" href="/auth/sign-in">
            登录
          </a>
        </nav>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">Multi-tenant PaaS · on k3s</div>
            <h1>
              把代码交给 Fugue，
              <br />
              专注你的<span className="lp-hl">产品</span>。
            </h1>
            <p className="lp-lede">
              连接 GitHub 仓库即可自动构建与部署。内建多租户隔离、密钥管理、
              实时用量与集群可观测——像指挥一部赋格，每个服务都是一条独立声部。
            </p>
            <div className="lp-cta">
              <a className="btn primary block" href="/auth/sign-up">
                免费开始
              </a>
              <a className="btn block" href="/auth/sign-in">
                我已有账号
              </a>
            </div>
            <div className="lp-trust">
              <span className="dot ok"></span> Google / GitHub 一键登录，或邮箱注册
            </div>
          </div>

          <aside className="lp-score" aria-hidden="true">
            <div className="lp-score-head">
              <span>the score</span>
              <span className="lp-score-tick">live</span>
            </div>
            <div className="lp-voices">
              <div className="lp-voice">
                <span className="lp-voice-label">api</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "12%" }} />
                  <i className="lp-mark ok" style={{ left: "48%" }} />
                  <i className="lp-mark ok" style={{ left: "82%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">web</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "20%" }} />
                  <i className="lp-mark run" style={{ left: "66%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">worker</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "8%" }} />
                  <i className="lp-mark ok" style={{ left: "40%" }} />
                  <i className="lp-mark warn" style={{ left: "74%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">cron</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "30%" }} />
                  <i className="lp-mark ok" style={{ left: "90%" }} />
                </div>
              </div>
              <div className="lp-playhead" />
            </div>
          </aside>
        </section>

        <section className="lp-how" id="how">
          <div className="lp-step">
            <span className="lp-step-n">01</span>
            <div>
              <h4>连接仓库</h4>
              <p>授权 GitHub，选中一个仓库。Fugue 读取分支并准备构建。</p>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-n">02</span>
            <div>
              <h4>自动构建</h4>
              <p>推送即触发。Dockerfile 或 buildpack 自动识别，产出镜像。</p>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-n">03</span>
            <div>
              <h4>滚动上线</h4>
              <p>多副本滚动发布，健康检查通过才切流量，失败自动回滚。</p>
            </div>
          </div>
        </section>

        <section className="lp-features" id="features">
          <Feature code="TENANT" title="完整多租户隔离">
            每个工作空间独立租户、独立密钥、独立用量边界，互不可见。
          </Feature>
          <Feature code="DEPLOY" title="从 GitHub 到生产">
            github-sync 自动导入，Dockerfile 构建策略，副本滚动发布到你的域名。
          </Feature>
          <Feature code="KEYS" title="密钥与节点管理">
            API 密钥按 scope 授权，节点密钥纳管集群，密钥全程封存加密。
          </Feature>
          <Feature code="OBSERV" title="实时用量与账单">
            集群健康、服务概览、审计事件与充值账单，一屏尽览。
          </Feature>
        </section>

        <section className="lp-final">
          <h2>准备好部署了吗？</h2>
          <p>几分钟内从空白到线上服务。</p>
          <a className="btn primary" href="/auth/sign-up">
            创建账号
          </a>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Fugue</span>
        <span className="lp-foot-mono">multi-tenant PaaS · k3s</span>
      </footer>
    </div>
  );
}

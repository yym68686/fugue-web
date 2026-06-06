# Fugue Frontend Platform Migration Inventory

日期：2026-06-07

本文档记录本轮全面前端重构的页面迁移清单、旧 selector 清理边界和必须暂时保留的兼容类。它配合 `docs/frontend-platform-redesign-plan.md` 的 todo list 使用。

## Page Matrix

| Surface | Route | New platform entry | State coverage | Notes |
| --- | --- | --- | --- | --- |
| Landing | `/` | `fp-design-system fp-landing-page` | dynamic fallback, reduced motion, mobile nav, copy feedback | 保留 full-bleed scene；按钮、pill nav、proof shell、object belt、route note 已接入平台 token。 |
| Docs | `/docs` | `fp-design-system fp-docs-page` | active section, sticky rail, mobile section strip, copy feedback | code block 和 table 使用 horizontal scroll；docs effects 保持静态背景。 |
| Sign in | `/auth/sign-in` | `fp-design-system fp-auth-page` | provider loading, email/password errors, mobile form-first | 表单逻辑保留，视觉由平台 auth 覆盖层收敛。 |
| Sign up | `/auth/sign-up` | `fp-design-system fp-auth-page` | email sent/retry, provider errors, mobile form-first | 与 sign-in 共用 auth shell 和表单系统。 |
| Auth finalize | `/auth/finalize` | `fp-design-system fp-auth-page` | callback success/failure/expired/retry | finalize panel 保留逻辑，继承平台 auth shell。 |
| New repository | `/new/repository` | `PlatformWizard` | source loading/error, operation loading/error, auth handoff | wizard 内部 source controls 继续复用 deploy 表单。 |
| New template | `/new/template/[slug]` | `PlatformWizard` | template loading/error, operation loading/error, auth handoff | 同一 deploy page shell，模板数据不改 API。 |
| Console projects | `/app` | `PlatformShell`, `PlatformPage`, `PlatformResourceList`, `PlatformMetric` | loading, no workspace, no project, partial API failure, long route | 项目列表从 card shelf 改成 dense resource list。 |
| Project detail | `/app/projects/[projectId]` | `PlatformShell`, project workbench classes | loading/error/empty preserved per panel | 全局 shell 已迁移，workbench outer surface 和 local nav 接入平台规则。 |
| API keys | `/app/api-keys` | `PlatformPage`, `PlatformSection`, `PlatformErrorState` | loading, no workspace, create/rotate/revoke modal states | manager 行为保留，页面壳平台化。 |
| Billing | `/app/billing` | `PlatformPage`, `PlatformErrorState` | loading, no workspace, empty/error | billing panel 行为保留，页面壳平台化。 |
| Servers | `/app/cluster-nodes` | `PlatformPage`, `PlatformSection`, `PlatformAlert` | loading, no workspace, partial API failure, offline | online/offline sections 保留 manager 行为。 |
| Profile settings | `/app/settings/profile` | `PlatformPage`, `PlatformPageHeader`, `PlatformErrorState` | loading, profile auth flash, provider/password modal states | 账号内部复杂表单保留，页面壳平台化。 |
| Settings redirect | `/app/settings` | redirect | n/a | 继续跳转到 profile settings。 |
| Admin cluster | `/app/cluster` | `PlatformPage`, `PlatformSection`, `PlatformAlert` | loading, admin data error, partial failure | admin 仍在统一 console shell 内。 |
| Admin apps | `/app/apps` | `PlatformPage`, `PlatformSection`, `PlatformAlert` | loading, data error, partial failure, row actions | table 行为保留，页面壳平台化。 |
| Admin users | `/app/users` | `PlatformPage`, `PlatformSection`, `PlatformAlert` | loading, data error, partial failure, row actions | table 行为保留，页面壳平台化。 |

## Selector Replacement List

已替换或收敛：

- `fg-console-shell`：由 `PlatformShell` 和 `fp-app-shell--console` 替代。
- `fg-console-topbar`：由 `PlatformTopbar` 和 `ConsoleTopbar` 替代。
- `fg-console-nav-shell` / `fg-console-nav__viewport`：旧横向 console nav 已移除。
- `fg-console-page-intro`：页面级标题优先改为 `PlatformPageHeader`。
- `fg-console-metric-grid`：页面摘要优先改为 `PlatformMetricGrid`。
- `fg-project-shelf` / 项目 gallery shelf：优先改为 `PlatformResourceList`。
- docs `fg-docs-*` panel surface：由 `.fp-docs-page` 覆盖到平台 panel。
- landing `fg-button` / `fg-pill-nav` / `fg-route-note` / `fg-proof-shell`：由 `.fp-landing-page` 覆盖到平台 token。

仍需作为兼容层保留：

- `fg-console-content`：仍由 `ConsoleRouteTransitionContent` 使用。
- `fg-console-nav` / `fg-console-nav__link` / `fg-console-nav__title`：deploy source switch 和 `ConsolePillSwitch` 仍复用。
- `fg-console-topbar__primary-action`：`ConsolePrimaryAction` 当前仍使用，用 `.fp-topbar` 限定样式。
- `fg-console-profile*`：profile menu 仍使用旧类，但挂在新 topbar 内。
- `fg-panel*` / `fg-bezel*`：复杂表单、dialog、project panel 逐步由平台覆盖层收敛，未直接删除。
- `fg-status-badge`：暂时继续作为 console 状态 badge 事实源。
- `fg-route-note` / `fg-proof-shell`：public surfaces 仍使用，但已由 `fp-docs-page` / `fp-landing-page` 作用域收敛。

## State Checklist

每个迁移页面至少检查这些状态：

- loading / skeleton
- no workspace or no data
- partial API failure
- permission gated admin navigation
- destructive action confirmation
- disabled action
- long project name, long route, env key, image tag, command, URL
- desktop 1440, tablet 768, mobile 390
- dark theme, light theme
- reduced motion

## Browser Screenshot Targets

最后验证阶段保存以下 after screenshots：

- `docs/frontend-platform-screenshots/landing-desktop.png`
- `docs/frontend-platform-screenshots/landing-mobile.png`
- `docs/frontend-platform-screenshots/docs-desktop.png`
- `docs/frontend-platform-screenshots/docs-mobile.png`
- `docs/frontend-platform-screenshots/console-desktop.png`
- `docs/frontend-platform-screenshots/console-mobile.png`
- `docs/frontend-platform-screenshots/design-system-preview.png`


# WP-08 Client 模块拆分与副作用清单

日期：2026-07-12
审计对象：原 `components/fugue-coss/interactive.tsx`（5,038 行）与当前
`apps/web` runtime。

## 原导出到当前边界

| 原导出/职责 | 当前实现 | 边界 |
| --- | --- | --- |
| `AuthPanel` | `components/auth/auth-panel.tsx` | 最小 Auth client island；页面、metadata 与 Auth shell 保持 Server Component |
| `CopyButton` | `components/shared/copy-button.tsx` | 独立复制 island，统一使用 `@fugue/ui/hooks/use-copy-to-clipboard` |
| `FinalizePanel` | `components/auth/finalize-panel.tsx` | 只读取 URL fragment 并提交一次性 handoff |
| `NewProjectWizard` | `components/fugue-coss/new-project-wizard.tsx` | deploy domain client island；入口 wrapper 位于 `components/deploy/` |
| `ProjectGallery` | `components/fugue-coss/project-gallery.tsx` | gallery domain island；初始数据由 `/app` Server Component 获取并序列化传入 |
| `ProjectWorkbench` | `components/fugue-coss/project-workbench.tsx` | workbench shell；初始 detail 由项目 Server Component 获取；非首屏 panels 动态加载 |
| `BillingConsole` | `components/fugue-coss/billing-console.tsx` | billing domain island |
| `AccessKeysConsole` | `components/fugue-coss/access-keys-console.tsx` | API key / node key domain island |
| `ServersConsole` | `components/fugue-coss/servers-console.tsx` | runtime inventory domain island |
| `ProfileSecurity` | `components/fugue-coss/profile-security.tsx` | profile/auth-method domain island |
| `AdminAppsConsole` | `components/fugue-coss/admin-apps-console.tsx` | bounded admin apps island |
| `AdminUsersConsole` | `components/fugue-coss/admin-users-console.tsx` | bounded admin users island |
| `AdminClusterConsole` | `components/fugue-coss/admin-cluster-console.tsx` | cluster policy island |
| DNS 编辑行为 | `components/fugue-coss/dns-console.tsx` | DNS domain island |

所有 route island wrapper 位于 `components/console/islands/`，通过显式 dynamic import
加载具体 domain module。不存在导入全部 Console consumers 的 barrel；产品 primitive 只从
`@fugue/ui/components/*` 精确子路径导入。

## 状态与副作用归属

| Domain | 本地状态 | 外部副作用 | 约束 |
| --- | --- | --- | --- |
| Auth | method、field values、loading、retry、error | `/api/auth/*`、同源跳转 | in-flight ref 防双提交；失败保留输入并恢复焦点；429 倒计时有界 |
| Finalize | fragment token、validating | 一次 POST `/auth/finalize/complete` | token 不进入 query/referrer；handoff exact-once |
| Deploy | draft、source、env rows、upload、runtime | request-scoped upload、`sessionStorage` pending intent、同源项目跳转 | 只保存可恢复 draft；成功后删除；上传流式有界 |
| Gallery | filter、view、drawer、refresh | `/api/fugue/console/projects` | Server 初始数据避免 waterfall；refresh 可 abort；列表 identity 使用 project id |
| Workbench | selected service、tab、refresh | project detail、domains/env/log/files/images/observability endpoints、同页 history state | endpoint identity + AbortController 阻止 A 响应覆盖 B；URL 只保存 service/tab |
| Billing | cap/top-up draft、dirty/loading | billing mutations、外部 checkout 跳转 | mutation 成功同步清除 summary/image 两个 5 分钟 cache |
| Keys | drawer drafts、one-time secret、operation state | key CRUD/rotate/revoke、clipboard | secret 只在一次性 response 内显示；复制失败有明确反馈 |
| Admin | bounded filter/cursor、drawer、operation state | admin mutation/read snapshots | Server admin guard；Bearer control-plane key 只允许审计化只读 allow-list |

## Server Component 与 bundle 决策

- `app/layout.tsx`、`app/app/layout.tsx`、页面 metadata、protected authorization、导航数据、
  page header 和静态说明均在服务端。
- `/app` gallery 与 `/app/projects/[projectId]` 的首个 snapshot 在服务端读取，并仅传递可
  序列化 view model；DB row、Response、Error、secret 和 server client 不跨边界。
- workbench 的 Environment、Logs、Files、Images、Observability 是独立 lazy chunk；初始
  Route 不加载该 chunk。对应 tab 在 hover/focus 时预加载，实际选择时才 mount/fetch。
- `/docs`、`/auth/*` 与 public route 没有 Console island import 路径；bundle gate 会读取
  Next build manifest 并阻止跨 route 泄漏。
- 不活跃 panel 不 keep-mounted，因而不会在后台发请求；Base UI Tabs/Toggle 的 focus 与
  keyboard contract 由 Playwright/axe 验证。

## 行为等价与复杂度

- 拆分只改变模块加载和状态归属，不改变 URL、API、view model、操作名称或业务状态。
- 原 mega-module 的任一 consumer 都会解析整棵 client module；拆分后 public/Auth 不再有
  该依赖，Console route 也只加载当前 vertical slice。
- Admin users/apps 从无界全量扫描改为 keyset cursor + `LIMIT + 1`；数据库复杂度由全量
  `O(N)` 传输/内存降为索引 seek `O(log N + k)`，`k <= 100/200`。10,000+ rows 的
  PostgreSQL `EXPLAIN` 与遍历证据见 `wp-11-admin-pagination.md`。
- endpoint 切换使用 request identity，旧请求 completion 为 `O(1)` 丢弃，不再触发额外
  render 或跨资源数据污染。

# Fugue 前端平台化重构方案

日期：2026-06-07

本文档定义 `fugue-web` 的全面前端重构方案。目标不是给现有页面换一层皮，而是把 `design-system/` 中的新平台设计系统真正变成 Fugue 的产品级界面语言，覆盖 marketing、docs、auth、deploy、console、admin 等所有前端表面。

这次重构应当分阶段落地，但目标状态必须足够彻底：导航结构、页面骨架、组件体系、状态模型、密度、动效、响应式和可访问性都需要对齐新系统。

## 方案边界

### 本次目标

- 将当前顶部菜单式控制台重构为侧边栏平台壳。
- 将 console、admin、project detail、billing、API keys、servers 等产品页面统一为同一套平台 UI。
- 将 deploy/new 流程重构为平台 workflow，而不是沿用 auth 或 landing 的视觉壳。
- 将 auth、docs、landing 对齐到同一套 token、按钮、表单、面板和状态语言，但不强行使用控制台侧边栏。
- 把新设计系统从 CSS preview 推进到可复用 React 组件层。
- 补齐 loading、empty、error、permission、disabled、long-running、offline、mobile 等生产状态。
- 最终减少旧 `fg-*` 页面样式和一次性组件。

### 非目标

- 不重写框架，不替换 Next.js App Router。
- 不为了视觉迁移改后端 API。
- 不手改 `lib/fugue/openapi.generated.ts`。
- 不把所有 server component 改成 client component。
- 不逐像素复制 Cloudflare，也不复制 Cloudflare logo、品牌、账号数据、资源名称或私有信息。
- 不把 landing hero 直接搬进 console。
- 不为了“补完整”新增没有产品事实支撑的营销信息、统计块或说明区。

## 事实来源

### 当前设计系统

- `design-system/index.css`
- `design-system/tokens.css`
- `design-system/components.css`
- `design-system/platform.css`
- `design-system/component-specs.md`
- `design-system/cloudflare-design-dna.md`
- `design-system/preview.html`

### 当前产品实现

- `app/page.tsx`
- `app/docs/page.tsx`
- `app/auth/**`
- `app/new/**`
- `app/app/**`
- `components/ui/**`
- `components/console/**`
- `components/admin/**`
- `components/auth/**`
- `components/deploy/**`
- `components/docs/**`
- `components/landing/**`
- `app/globals.css`
- `app/console.css`
- `app/deploy.css`
- `app/docs/docs.css`
- `app/landing.css`

### API 事实来源

涉及 API 字段、请求、响应、鉴权、上传、下载、轮询或日志流时，必须优先核对：

- `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml`

本仓库派生产物只能通过脚本同步，不允许手写维护：

- `openapi/fugue.yaml`
- `lib/fugue/openapi.generated.ts`

## 设计方向

Fugue 的新前端应当像一个严肃的基础设施控制平面：

- 信息密度更高，但不拥挤。
- 导航更明确，从项目进入 route、runtime、deployment、environment 的路径更短。
- 控制台以侧边栏为主要导航，不再依赖顶部 pill nav。
- 项目详情页是 workbench，不是普通详情卡片堆叠。
- 产品页减少 marketing 式大段话，更多展示当前对象、状态、操作和反馈。
- 所有核心操作都有 loading、empty、error、permission 和 disabled 状态。
- Admin 页面属于同一个平台壳，只是权限层级不同，不再像另一个独立产品。

核心产品命题继续保持：

> Route is the product.

这个命题要体现在导航、页面命名、项目详情结构、deploy 流程、docs 示例、empty state 和操作 CTA 中。

## 当前前端盘点

### App 页面

- `app/page.tsx`：landing
- `app/docs/page.tsx`：docs
- `app/auth/sign-in/page.tsx`：登录
- `app/auth/sign-up/page.tsx`：注册
- `app/auth/finalize/page.tsx`：auth handoff / finalize
- `app/new/repository/page.tsx`：从仓库创建
- `app/new/template/[slug]/page.tsx`：从模板创建
- `app/app/page.tsx`：控制台项目列表
- `app/app/projects/[projectId]/page.tsx`：项目详情
- `app/app/api-keys/page.tsx`：API keys
- `app/app/billing/page.tsx`：billing
- `app/app/cluster-nodes/page.tsx`：servers
- `app/app/settings/page.tsx`：settings
- `app/app/settings/profile/page.tsx`：profile settings
- `app/app/cluster/page.tsx`：admin cluster
- `app/app/apps/page.tsx`：admin apps
- `app/app/users/page.tsx`：admin users

### 当前主要问题

- `fg-*` 旧视觉语言、页面局部 CSS、新的 `fp-*` 平台 CSS 同时存在，尚未形成清晰迁移边界。
- `ConsoleShell` 仍然以顶部导航为核心。
- `lib/console/nav.ts` 当前只有一个 `Primary` 分组，无法表达平台级信息架构。
- Admin 页面只是追加到同一组导航里，没有形成权限清晰的管理区。
- Deploy/new 流程仍偏 auth / landing 视觉，不像产品 workflow。
- Auth、docs、landing 和 console 共用了一些视觉 DNA，但没有共用稳定组件契约。
- 很多页面的 empty/error/loading/permission 状态需要重新补齐。

## 目标信息架构

### Public Surfaces

这些页面不使用控制台侧边栏，但必须共享 token、按钮、输入框、面板、状态和 typography：

- `/`
  - 产品叙事、真实能力、docs / sign in 入口。
  - 可以保留更强的氛围层，但视觉控制应更克制。
- `/docs`
  - 文档侧边栏 + 内容阅读列。
  - 代码块、路径图、对象引用使用平台组件。
- `/auth/sign-in`
  - 表单优先。
  - 移动端第一屏先看到表单主体。
- `/auth/sign-up`
  - 与登录共用表单系统。
  - provider、邮箱、错误、发送成功、重试状态完整。
- `/auth/finalize`
  - 明确展示 callback、过期、失败、重试、回跳状态。

### Creation / Deploy Surfaces

创建与部署流程应该是平台 workflow：

- `/new/repository`
  - source selection
  - repository access
  - project configuration
  - deploy review
- `/new/template/[slug]`
  - template summary
  - configuration
  - runtime / route
  - review / launch

已登录用户可以进入平台 shell 中完成；未登录用户使用简化 workflow shell，并在关键节点进行 auth handoff。

### Console Sidebar

控制台应从顶部菜单改为侧边栏。建议分组如下：

1. Work
   - Projects：`/app`
   - Deployments：优先作为 project-scoped 页面，不一定是全局主菜单
   - New project：作为 primary action 或 quick action

2. Runtime
   - Servers：`/app/cluster-nodes`
   - Cluster：`/app/cluster`，admin only

3. Access
   - API keys：`/app/api-keys`
   - Users：`/app/users`，admin only

4. Commercial
   - Billing：`/app/billing`

5. Settings
   - Profile：`/app/settings/profile`
   - Settings：`/app/settings`

6. Admin
   - Apps：`/app/apps`
   - Users：`/app/users`
   - Cluster：`/app/cluster`
   - 仅 admin 可见

`lib/console/nav.ts` 仍然应该是导航事实源，但需要从扁平列表升级为分组结构。

建议结构：

```ts
type ConsoleNavGroupKind =
  | "work"
  | "runtime"
  | "access"
  | "commercial"
  | "settings"
  | "admin";
```

每个 nav item 建议支持：

- `href`
- `label`
- `description`
- `icon`
- `badge`
- `permission`
- `match`
- `isPrimaryAction`

### Project Workbench

`/app/projects/[projectId]` 应重构成项目 workbench。

项目内局部导航建议：

- Overview
- Routes
- Deployments
- Environment
- Domains
- Files
- Images
- Storage
- Observability
- Runtime access
- Settings

这些不应全部进入全局侧边栏，而是作为项目详情页内部的 tabs、segmented control 或 section rail。

## 目标 Shell 架构

### Platform Shell

新增平台壳组件层：

- `components/platform/platform-shell.tsx`
- `components/platform/platform-sidebar.tsx`
- `components/platform/platform-topbar.tsx`
- `components/platform/platform-page.tsx`
- `components/platform/platform-breadcrumbs.tsx`
- `components/platform/platform-command-menu.tsx`

平台壳负责：

- 桌面侧边栏。
- 移动端 drawer。
- 当前路由匹配。
- admin-only 分组。
- 顶部 breadcrumb。
- 当前 scope。
- primary action。
- profile menu。
- theme / locale utilities。
- route transition 内容区域。

`ConsoleShell` 应变成平台壳的薄适配层：

```tsx
<PlatformShell
  sidebar={<ConsoleSidebar groups={groups} />}
  topbar={<ConsoleTopbar session={session} />}
>
  <ConsoleRouteTransitionContent>{children}</ConsoleRouteTransitionContent>
</PlatformShell>
```

### Sidebar 行为

桌面：

- 左侧固定侧边栏。
- 顶部显示 Fugue / workspace / console context。
- 分组 label 使用低对比小字号。
- 当前项使用 raised lens 状态。
- Admin group 视觉上有分区，但仍属于同一产品壳。
- 底部放 profile、settings、theme、locale 或 help。

Tablet：

- 可切换窄侧边栏或 icon rail。
- 空间不足时隐藏 label。
- icon-only 项必须有 tooltip。

Mobile：

- 不保留常驻侧边栏。
- 顶部显示 menu trigger、当前页面、主操作。
- 侧边栏以 drawer 打开。
- 关闭 drawer 后仍能看到当前页面上下文。

### Topbar 行为

新的 topbar 不再承担主导航。它只负责：

- breadcrumb / current scope
- search / command entry
- contextual primary action
- operation status
- profile menu

示例：

- Projects：New project
- Project detail：Deploy / Configure route
- API keys：Create key
- Billing：Add credits / Manage billing
- Servers：Attach server / Enrollment command

## 目标组件系统

平台组件使用 `fp-*` 命名空间。React wrapper 只负责组合、状态和语义，不应重新发明视觉规则。

### Layout

- `PlatformShell`
- `PlatformSidebar`
- `PlatformTopbar`
- `PlatformPage`
- `PlatformPageHeader`
- `PlatformSection`
- `PlatformSplit`
- `PlatformStack`
- `PlatformGrid`

### Navigation

- `SidebarNav`
- `Breadcrumbs`
- `SegmentedControl`
- `Tabs`
- `CommandMenu`
- `ContextMenu`
- `Pagination`

### Actions

- `Button`
- `IconButton`
- `ButtonGroup`
- `MenuButton`
- `DangerAction`
- `InlineAction`

### Data Display

- `MetricCard`
- `MetricStrip`
- `ResourceCard`
- `ResourceList`
- `DataTable`
- `KeyValueList`
- `Timeline`
- `StatusBadge`
- `ProgressBar`

### Forms

- `FormField`
- `TextInput`
- `Textarea`
- `Select`
- `Checkbox`
- `RadioGroup`
- `Switch`
- `Slider`
- `CodeTextarea`
- `SecretField`
- `FileUpload`

### Feedback

- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `InlineAlert`
- `Toast`
- `Tooltip`
- `ConfirmDialog`
- `Modal`
- `Drawer`

### Workflow

- `Wizard`
- `StepList`
- `ReviewPanel`
- `OperationLog`
- `DeployProgress`
- `OnboardingChecklist`

## 页面迁移方案

### 1. 设计系统强化

目标：

- 让 `design-system/` 不只是 preview，而是实际产品实现的样式事实源。

动作：

- 保留 `tokens.css` 和 `components.css` 作为兼容层。
- 将 `platform.css` 作为新产品平台层。
- 新增 React wrapper，优先放在 `components/platform/`。
- 为 sidebar、topbar、page header、resource list、table、form、modal、wizard、empty/error/loading 写组件规范。
- 检查 dark / light theme 一致性。
- 检查 focus、disabled、reduced-motion、mobile 状态。

### 2. Console Shell 替换

目标：

- 将 console 顶部横向菜单迁移为侧边栏。

目标文件：

- `components/console/console-shell.tsx`
- `components/console/console-nav.tsx`
- `components/console/console-primary-action.tsx`
- `components/console/console-profile-menu.tsx`
- `lib/console/nav.ts`
- `app/console.css`

动作：

- 扩展 `lib/console/nav.ts` 的分组结构。
- 新增 `ConsoleSidebar`。
- 保留 `ConsoleRouteTransitionProvider`。
- 将原顶部 nav 行为迁移到 sidebar。
- topbar 只保留 breadcrumb、context、primary action、profile。
- 添加 mobile drawer。
- 保留 admin 可见性逻辑。

### 3. Console Home / Project Gallery

目标：

- `/app` 成为第一个完整迁移的新平台页面。

目标文件：

- `app/app/page.tsx`
- `components/console/console-project-gallery-shell.tsx`
- `components/console/console-project-gallery.tsx`
- `components/console/console-onboarding.tsx`
- `components/console/console-summary-grid.tsx`
- `components/console/console-empty-state.tsx`

动作：

- 用 `PlatformPageHeader` 替换当前 page intro。
- 用 `MetricStrip` 承载关键统计。
- 用 `ResourceList` 或 dense card grid 承载项目列表。
- 无项目状态使用平台 empty state。
- 首次部署 CTA 更明确。
- 保留现有数据获取和鉴权边界。

### 4. Project Workbench

目标：

- 将项目详情重构成 operational workbench。

目标文件：

- `app/app/projects/[projectId]/page.tsx`
- `components/console/app-route-panel.tsx`
- `components/console/app-custom-domains-panel.tsx`
- `components/console/app-images-panel.tsx`
- `components/console/app-observability-panel.tsx`
- `components/console/app-settings-panel.tsx`
- `components/console/console-files-workbench.tsx`
- `components/console/environment-editor.tsx`
- `components/console/persistent-storage-editor.tsx`
- `components/console/runtime-access-panel.tsx`

动作：

- 定义项目内 section nav。
- page header 展示项目名、route 状态、runtime 状态、主 deploy action。
- 将 route/domain/runtime/environment 按用户任务重组。
- 一次性 panel 迁移到 `PlatformCard`、`DataTable`、`KeyValueList`、`InlineAlert`。
- 删除危险动作必须走 `ConfirmDialog`。
- 检查长项目名、长 env key、长 image tag、日志输出。

### 5. Access / Billing / Runtime / Admin

目标：

- 所有运维页面使用同一个布局契约。

目标文件：

- `app/app/api-keys/page.tsx`
- `components/console/console-api-keys-page-shell.tsx`
- `components/console/api-key-manager.tsx`
- `components/console/api-key-empty-state.tsx`
- `app/app/billing/page.tsx`
- `components/console/console-billing-page-shell.tsx`
- `components/console/billing-panel.tsx`
- `app/app/cluster-nodes/page.tsx`
- `components/console/console-cluster-nodes-page-shell.tsx`
- `components/console/cluster-node-gallery.tsx`
- `app/app/cluster/page.tsx`
- `components/admin/admin-cluster-page-shell.tsx`
- `components/admin/admin-cluster-overview.tsx`
- `app/app/apps/page.tsx`
- `components/admin/admin-apps-page-shell.tsx`
- `components/admin/admin-app-manager.tsx`
- `app/app/users/page.tsx`
- `components/admin/admin-users-page-shell.tsx`
- `components/admin/admin-user-manager.tsx`

动作：

- 统一使用 page header、toolbar、table/resource list。
- 需要比较大量对象时用 `DataTable`。
- 单对象摘要、状态和操作并重时用 `ResourceList`。
- metric 只在帮助用户判断动作时使用。
- 统一 badge、status、danger action。
- Admin 页面保留在同一个 console shell 内。

### 6. Deploy / New 流程

目标：

- 将创建流程变成平台 workflow。

目标文件：

- `app/new/layout.tsx`
- `app/new/repository/page.tsx`
- `app/new/template/[slug]/page.tsx`
- `components/deploy/deploy-page.tsx`
- `components/deploy/deploy-wizard.tsx`
- `components/deploy/deploy-image-wizard.tsx`
- `components/deploy/deploy-upload-wizard.tsx`
- `components/deploy/deploy-create-project-form.tsx`
- `components/console/deployment-target-field.tsx`
- `components/console/github-repository-access-fields.tsx`
- `components/console/import-service-fields.tsx`
- `components/console/local-upload-source-field.tsx`

动作：

- 使用 `Wizard` 表达 source、config、review、launch。
- 已登录时进入平台上下文。
- 未登录时使用简化 workflow shell，并在关键点 auth handoff。
- 添加 repo access、upload、template loading、deployment creation 的错误/加载状态。

### 7. Auth

目标：

- Auth 继承平台设计系统，但保持表单优先和低密度。

目标文件：

- `app/auth/layout.tsx`
- `app/auth/sign-in/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/auth/finalize/page.tsx`
- `components/auth/auth-shell.tsx`
- `components/auth/email-auth-form.tsx`
- `components/auth/password-sign-in-form.tsx`
- `components/auth/provider-button.tsx`
- `components/auth/sign-in-method-switcher.tsx`
- `components/auth/auth-finalize-panel.tsx`

动作：

- 使用平台 form controls。
- 桌面保留 split layout。
- 移动端表单优先。
- 背景效果低于 landing。
- 补齐 provider loading、email sent、invalid token、expired link、callback failure、retry。

### 8. Docs

目标：

- Docs 以可读性和导航清晰度为先。

目标文件：

- `app/docs/page.tsx`
- `app/docs/docs.css`
- `components/docs/docs-section-nav.tsx`
- `components/docs/docs-code-block.tsx`
- `lib/docs/content.ts`

动作：

- 新增 docs sidebar。
- 增加 active section。
- 代码块使用平台样式。
- 长命令和长代码行要能滚动或正确换行。
- 动效保持静态或低频。

### 9. Landing

目标：

- 保留 Fugue 的 authored / atmospheric 气质，但将按钮、surface、badge、section rhythm 对齐平台系统。

目标文件：

- `app/page.tsx`
- `app/landing.css`
- `components/landing/landing-page.tsx`
- `components/landing/landing-effects.tsx`
- `components/landing/landing-effects-shell.tsx`
- `components/ui/proof-shell.tsx`
- `components/ui/route-note.tsx`

动作：

- Landing 不使用 console sidebar。
- 保留 full-bleed scene，但不能影响可读性。
- 按钮和局部控件对齐平台 token。
- 删除无产品语义的装饰元素。
- 保留 reduced-motion 和动态场景失败 fallback。

## 推荐 PR 拆分

1. `docs`：提交本重构方案和 todo。
2. `design-system-react`：新增 `components/platform/` React wrapper。
3. `console-shell`：控制台 top nav 改 sidebar。
4. `console-home`：迁移 `/app` 和项目列表。
5. `project-workbench`：迁移项目详情。
6. `access-billing-runtime`：迁移 API keys、billing、servers。
7. `admin`：迁移 cluster、apps、users。
8. `deploy`：迁移 new/deploy 流程。
9. `auth`：迁移登录、注册、finalize。
10. `docs`：迁移 docs shell 和 code block。
11. `landing`：对齐 landing 控件和 section。
12. `cleanup`：删除旧 CSS、重复组件和过期 `fg-*` 依赖。

每个 PR 必须保持应用可运行，不做大爆炸式重写。

## 验证矩阵

每个重构页面都要检查：

- Desktop：1440px
- Laptop：1280px
- Tablet：768px
- Mobile：390px
- Dark theme
- Light theme
- Reduced motion
- Signed out
- Signed in
- Admin user
- Empty data
- Loading
- Error
- Permission denied
- Long technical strings
- CJK 文本
- Network/API failure

常规命令：

```bash
npm run typecheck
```

只有触及 API 契约或生成类型时才运行：

```bash
npm run contract:check
```

浏览器检查：

- 打开受影响本地页面。
- 检查 console error。
- 检查 horizontal overflow。
- 检查 keyboard focus order。
- 对关键页面保存 before / after 截图。

## 风险与处理

### 大爆炸式重写

风险：

- 页面多、组件多、旧样式多，一次性改完容易引入行为回归。

处理：

- 先迁移 shell，再迁移页面组。
- `fg-*` 作为兼容层保留到对应页面完成迁移后再删除。
- 每个 PR 保持可运行。

### CSS 级联冲突

风险：

- `fg-*`、`fp-*`、页面局部 CSS 同时存在，容易互相覆盖。

处理：

- 新平台组件统一使用 `fp-*`。
- 页面不要写新的平台组件覆盖样式。
- import order 保持明确。
- 删除旧样式时按页面引用检查。

### Server / Client 边界回归

风险：

- 为了交互把服务端页面大面积改成 client component，导致 bundle 和数据加载退化。

处理：

- 保持原有 server component 数据边界。
- 只把真正需要交互的部分做 client component。
- shell 不传递大数据对象。

### 权限导航错误

风险：

- 侧边栏重构后，admin item、用户权限、active state 容易出错。

处理：

- 导航事实源集中在 `lib/console/nav.ts`。
- regular user 和 admin user 都要截图检查。
- 权限控制不分散到页面局部。

### API 漂移

风险：

- 页面重构时为了新 UI 临时猜字段。

处理：

- 涉及 API 使用时先看后端 OpenAPI。
- 不手改生成文件。
- 必要时按仓库 OpenAPI-first 流程处理。

### 长文本和中文布局

风险：

- 项目名、URL、env key、image tag、命令、中文标签容易撑破布局。

处理：

- 每个 data-heavy 页面测试长字符串。
- 表格和资源列表明确 truncation / wrap / scroll 规则。
- icon-only 控件必须有 tooltip。

## 完成标准

一个页面完成迁移，必须满足：

- 使用 platform shell 或被文档认可的 surface-specific shell。
- 核心 UI 使用 `fp-*` 平台组件或对应 React wrapper。
- 有 loading、empty、error、permission 状态。
- 移动端布局可用。
- keyboard focus 可见。
- 390px 下无横向 overflow。
- `npm run typecheck` 通过。
- 关键页面有 before / after 截图。
- API 相关变更遵守 OpenAPI-first。
- 页面旧的一次性 CSS 已删除或标记为兼容层。

## Todo List

### Phase 0：规划与基线

- [x] 将 Cloudflare-inspired 平台设计系统抽取到 `design-system/`。
- [x] 新增平台无关 `fp-*` CSS 层。
- [x] 新增 design-system preview。
- [x] 写入完整前端重构方案。
- [x] 为所有页面捕获 baseline screenshot。
- [x] 建立页面到组件/状态的迁移清单。
- [x] 标记所有应替换的页面局部 CSS selector。
- [x] 标记必须暂时保留的 `fg-*` 兼容类。

### Phase 1：Design System React Layer

- [x] 创建 `components/platform/`。
- [x] 新增 `PlatformShell`。
- [x] 新增 `PlatformSidebar`。
- [x] 新增 `PlatformTopbar`。
- [x] 新增 `PlatformPage`。
- [x] 新增 `PlatformPageHeader`。
- [x] 新增 `PlatformSection`。
- [x] 新增平台 `Button`，或改造现有 `components/ui/button.tsx`。
- [x] 新增 `IconButton`。
- [x] 新增或改造 `SegmentedControl`。
- [x] 新增 `ResourceList`。
- [x] 新增 `DataTable`。
- [x] 新增 `MetricCard`。
- [x] 新增 `MetricStrip`。
- [x] 新增 `FormField` wrappers。
- [x] 新增 `EmptyState`。
- [x] 新增 `ErrorState`。
- [x] 新增 `LoadingSkeleton`。
- [x] 新增 `Modal`。
- [x] 新增 `Drawer`。
- [x] 新增 `Wizard`。
- [x] 更新 `design-system/component-specs.md`。

### Phase 2：Console Sidebar Shell

- [x] 扩展 `lib/console/nav.ts` 为分组侧边栏导航。
- [x] 为 console nav item 增加 icon metadata。
- [x] 为 admin nav item 增加 permission metadata。
- [x] 用 `ConsoleSidebar` 替换 `ConsoleNav` 横向渲染。
- [x] 将 `ConsoleShell` 改为 `PlatformShell` adapter。
- [x] 将 profile 和 primary action 放入新 topbar。
- [x] 新增 breadcrumb/current context。
- [x] 新增 mobile drawer。
- [x] 检查 regular user 导航。
- [x] 检查 admin user 导航。
- [x] 删除过期 topbar nav CSS。

### Phase 3：Console Home

- [x] 迁移 `/app` 页面壳。
- [x] 迁移项目 gallery。
- [x] 迁移 onboarding block。
- [x] 将 summary grid 迁移为 `MetricStrip`。
- [x] 增加 no-project empty state。
- [x] 增加 project loading skeleton。
- [x] 增加 API/server failure error state。
- [x] 检查长项目名和长 route。

### Phase 4：Project Workbench

- [x] 定义 project-local section navigation。
- [x] 迁移 project overview。
- [x] 迁移 routes panel。
- [x] 迁移 domains panel。
- [x] 迁移 files workbench。
- [x] 迁移 environment editor。
- [x] 迁移 persistent storage editor。
- [x] 迁移 images panel。
- [x] 迁移 observability panel。
- [x] 迁移 runtime access panel。
- [x] 迁移 settings panel。
- [x] 为 destructive actions 增加确认。
- [x] 为每个 panel 增加 loading/error/empty 状态。
- [x] 检查长 env key、URL、image tag 和日志输出。

### Phase 5：Operational Pages

- [x] 迁移 API keys 页面。
- [x] 增加 API key create/rebuild/delete modal 状态。
- [x] 迁移 billing 页面。
- [x] 增加 billing empty/error/loading 状态。
- [x] 迁移 servers 页面。
- [x] 统一 server health/status 表示。
- [x] 迁移 cluster admin 页面。
- [x] 迁移 apps admin 页面。
- [x] 迁移 users admin 页面。
- [x] 统一 admin table 和 row actions。

### Phase 6：Deploy / Creation Flows

- [x] 将 `/new/repository` 重构为 platform workflow。
- [x] 将 `/new/template/[slug]` 重构为 platform workflow。
- [x] 将 deploy wizard 迁移到 `Wizard`。
- [x] 迁移 repository access fields。
- [x] 迁移 import service fields。
- [x] 迁移 upload source field。
- [x] 必要时增加 review step。
- [x] 增加 source connection loading/error 状态。
- [x] 增加 deploy operation loading/error 状态。
- [x] 确保未登录用户有清晰 auth handoff。

### Phase 7：Auth

- [x] 迁移 auth shell。
- [x] 迁移 sign-in form。
- [x] 迁移 sign-up form。
- [x] 迁移 provider button。
- [x] 迁移 sign-in method switcher。
- [x] 迁移 finalize panel。
- [x] 增加 expired link 状态。
- [x] 增加 callback failure 状态。
- [x] 增加 email sent/retry 状态。
- [x] 检查移动端 form-first layout。

### Phase 8：Docs

- [x] 重构 docs shell。
- [x] 增加 docs sidebar。
- [x] 增加 active section 行为。
- [x] 迁移 code block 样式。
- [x] 检查长命令 wrapping/scrolling。
- [x] 检查 docs mobile navigation。
- [x] 保持 docs effects 静态或极低动效。

### Phase 9：Landing Alignment

- [x] 将 landing nav controls 对齐平台 buttons。
- [x] 将 proof shell 对齐平台 surface 规则。
- [x] 对齐 badges 和 route notes。
- [x] 审查 landing sections，删除泛泛文案和无语义装饰。
- [x] 保留 effects fallback。
- [x] 检查 reduced-motion。
- [x] 检查 desktop/mobile first viewport。

### Phase 10：Cleanup / Hardening

- [x] 删除无用 page-local CSS。
- [x] 删除不再引用的旧 `fg-*` 类。
- [x] 删除被平台组件取代的重复 UI primitives。
- [x] 运行 `npm run typecheck`。
- [x] 若 API 使用有变，运行 `npm run contract:check`。
- [x] 对所有迁移页面做浏览器视觉检查。
- [x] 更新 `design-system/README.md`。
- [x] 更新 `design-system/component-specs.md`。
- [x] 如果核心视觉规则或设计系统采用方式变化，更新 `AGENTS.md`。

## 本方案参考的前端 Skills

本方案按仓库要求参考了 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md` 中的相关 skill：

- `redesign-existing-projects`：用于既有项目分阶段改版，不破坏产品行为。
- `normalize`：用于将所有页面收敛到同一个 design system。
- `ckm:design-system`：用于 token、语义组件和状态系统拆分。
- `vercel-composition-patterns`：用于组件组合方式和 shell API 设计。
- `vercel-react-best-practices`：用于 Next.js server/client 边界和性能约束。
- `site-architecture`：用于侧边栏 IA、路由层级、breadcrumb 和项目内导航。
- `harden`：用于 loading/error/empty/permission、长文本、中文布局和响应式检查。

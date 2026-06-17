# Fugue Web COSS UI 前端重构设计文档

本文是一份面向重构实施的前端设计文档，目标是把 Fugue Web 重构到 COSS UI 的产品界面语言上。本文只基于：

- `docs/frontend-page-functions.md` 中记录的页面与功能范围。
- COSS UI 官方站点与 `cosscom/coss` 仓库中的公开组件、样式和文档。

本文不参考现有 Fugue Web 前端实现、页面样式、组件结构或视觉设计。后续实现时，也应把现有前端只当作路由和业务能力承载位置，而不是设计来源。

## 0. COSS 调查依据

本设计采用 COSS UI 的以下事实作为落地依据：

- COSS 官方定位是 Cal.com 的开源设计系统，核心方向是 accessible、composable、copy-owned components。
- COSS 当前推荐 React + Tailwind CSS v4，并通过 shadcn registry 安装样式和组件。
- 新项目安装路径为 `npx shadcn@latest init @coss/style`。
- 既有项目添加完整 COSS UI 的路径为 `npx shadcn@latest add @coss/ui`。
- 既有项目添加完整主题的路径为 `npx shadcn@latest add @coss/style`。
- 只添加 neutral color tokens 的路径为 `npx shadcn@latest add @coss/ui @coss/colors-neutral`。
- COSS 样式采用 CSS variables 和 Tailwind v4 `@theme inline`。
- COSS 暴露的关键 token 包括 `background`、`foreground`、`card`、`popover`、`primary`、`secondary`、`muted`、`accent`、`destructive`、`info`、`success`、`warning`、`border`、`input`、`ring`、`sidebar`、`code`。
- COSS 字体契约包括 `--font-sans`、`--font-heading`、`--font-mono`。
- COSS 组件使用 Base UI primitives，因此重构时要保留正确的 root isolation、focus、dialog、drawer 和 sidebar 语义。

实施前必须完成 license 核对：COSS 仓库内 UI app 和 UI package 的 license 标记存在差异，不能在未确认许可的情况下直接复制 package 源码到商业产品前端。

## 1. 重构目标

### 1.1 产品目标

- 用 COSS UI 的 neutral、dense、composable 产品界面替代现有前端视觉。
- 保留 `frontend-page-functions.md` 中列出的真实页面和真实功能，不新增虚构功能。
- 让 Public、Auth、New Project、Console、Admin 五类页面形成同一套界面系统，而不是每个区域单独设计。
- 让控制台成为主要产品体验：信息密度高、状态清晰、操作可预期、适合反复管理服务和服务器。

### 1.2 工程目标

- 以 COSS UI 的 shadcn registry / copy-owned component 模式落地，组件进入本项目后由本项目维护。
- 基于 Tailwind CSS v4、COSS design tokens、Base UI primitives 建立新的前端基础层。
- 页面级实现采用 React Server Components 优先，客户端组件只承担表单、局部状态、抽屉、弹窗、实时日志、文件编辑等必要交互。
- 把 Fugue 业务功能沉淀为 COSS 风格的 product particles，避免在页面里堆散装表单和表格。

### 1.3 非目标

- 不迁移现有视觉风格。
- 不沿用现有组件外观作为设计依据。
- 不在本设计阶段改 API 契约。
- 不在营销页虚构新的能力、指标、客户案例或故事线。
- 不把 COSS 组件原样堆进页面后就停止；必须按 Fugue 的页面功能组合成产品级模式。

## 2. COSS UI 采用方式

### 2.1 COSS 技术基线

COSS UI 是 Cal.com 的设计系统，组件目标是 accessible、composable、copy-owned。公开文档和仓库体现出以下基线：

- React 项目。
- Tailwind CSS v4。
- Base UI primitives。
- shadcn registry 安装方式。
- CSS variable token 系统。
- `Button`、`Card`、`CardFrame`、`Table`、`Form`、`Field`、`Input`、`Dialog`、`Drawer`、`Tabs`、`Sidebar`、`Empty`、`Alert`、`Skeleton`、`Meter` 等组件作为核心材料。
- 根布局需要 `isolate relative flex min-h-svh flex-col`，body 保持 `relative`，避免 Base UI / iOS Safari 场景下的 layering 问题。

建议执行路径：

1. 先验证 COSS 许可边界，尤其是 `apps/ui` 与 `packages/ui` 的 license 差异。
2. 若许可允许，优先使用 COSS registry / shadcn 安装路径复制组件。
3. 若不能直接复制源码，则复刻 API 和视觉行为，避免引入不兼容 license。
4. 所有复制进本项目的 COSS 组件必须进入本项目命名空间，并由本项目维护。

### 2.2 样式和 token 分层

新前端使用三层 token：

1. Primitive tokens  
   直接来自 COSS neutral color、radius、font、shadow、spacing。

2. Semantic tokens  
   把 COSS tokens 映射成 Fugue 产品语义，例如 `surface.canvas`、`surface.panel`、`text.primary`、`status.success`、`billing.warning`、`runtime.attention`。

3. Component tokens  
   针对 `ConsoleShell`、`ProjectWorkbench`、`RouteTableEditor`、`NodeInventory`、`BillingEnvelopeEditor` 等业务组件定义密度、间距和状态色。

核心约束：

- 背景使用 COSS neutral background，不再使用戏剧化背景、渐变舞台或装饰性动态背景。
- 卡片、表格和抽屉使用 COSS border、card、popover、muted、ring tokens。
- 代码、命令、镜像名、route、key、node id、app id 使用 mono font。
- 所有状态色只走 COSS `success`、`warning`、`destructive`、`info` token，不单页硬编码颜色。
- 全站保持 light-first，dark mode 只在 tokens 完整映射后作为同一套组件的主题切换，不单独写页面。

### 2.3 组件层级

建议建立四层组件：

#### 2.3.1 COSS primitives

从 COSS 迁移或复刻的基础组件：

- `Button`
- `Card`
- `CardFrame`
- `Table`
- `Form`
- `Field`
- `Input`
- `Textarea`
- `Select`
- `Tabs`
- `Dialog`
- `Drawer`
- `Sidebar`
- `Alert`
- `Empty`
- `Skeleton`
- `Meter`
- `Tooltip`
- `DropdownMenu`
- `Command`
- `Badge`

这些组件只表达通用 UI，不知道 Fugue 的业务对象。

#### 2.3.2 Fugue product particles

用 COSS primitives 组合出的业务组件：

- `RouteSummaryPanel`
- `RouteTableEditor`
- `CustomDomainList`
- `RuntimeTargetPicker`
- `ServiceSourcePicker`
- `TemplateVariableForm`
- `EnvironmentVariableEditor`
- `LogStreamPanel`
- `FileSystemWorkbench`
- `ImageVersionGallery`
- `ObservabilityWorkbench`
- `BillingBalancePanel`
- `CapacityEnvelopeEditor`
- `ApiKeyTable`
- `NodeKeyTable`
- `NodeInventoryTable`
- `RuntimeAccessPanel`
- `ProfileSecurityMethods`
- `AdminAppDirectory`
- `AdminUserDirectory`
- `ClusterPolicyEditor`

这些组件只表达一个清晰业务任务，页面负责组合它们。

#### 2.3.3 Shells

页面级布局壳：

- `PublicShell`：用于 `/`。
- `DocsShell`：用于 `/docs`。
- `AuthShell`：用于 `/auth/*`。
- `NewProjectShell`：用于 `/new/*`。
- `ConsoleShell`：用于普通 `/app/*` 页面。
- `AdminShell`：复用 `ConsoleShell`，但开启 Admin 导航和权限警示。

#### 2.3.4 Data adapters

数据读取和 view model 适配独立于 UI：

- 页面 server component 启动数据请求。
- 可复用 loader 使用 `cache()`。
- 客户端组件只接收已经裁剪过的 view model。
- 表单提交、长任务、轮询、日志流、上传下载等能力按 API 契约单独封装。

## 3. 全站信息架构

### 3.1 Public 区域

Public 顶部导航使用 COSS `SiteHeader` 模式：

- 左侧：Fugue wordmark。
- 中间：`Docs`、`Console`。
- 右侧：`Sign in`、`Get started`。
- 已登录时：右侧主按钮变为 `Open console`。

Public 只承接三个任务：

- 解释 Fugue 的导入和迁移模型。
- 把用户送到文档。
- 把用户送到登录、注册或创建项目。

### 3.2 Auth 区域

Auth 使用 COSS 居中卡片结构：

- 单列。
- 顶部显示 Fugue wordmark 和当前目标。
- 主体使用 `CardFrame` 包含 provider 登录、邮箱登录、密码登录。
- 错误使用 `Alert`。
- 进行中状态使用按钮 loading 和局部 `Skeleton`，不整页跳动。

### 3.3 New Project 区域

New Project 是从 Public 进入 Console 的桥：

- 使用 `NewProjectShell`。
- 顶部是简洁步骤条：`Source`、`Configure`、`Deploy`。
- 主区域桌面双栏：左侧输入表单，右侧 source summary / runtime summary / deploy preview。
- 移动端单列，右侧 summary 收进 `Drawer` 或折叠区。

### 3.4 Console 区域

Console 使用 COSS `Sidebar`：

- 左侧固定导航。
- 顶部区域显示 workspace、搜索入口、用户菜单。
- 主内容区使用 `PageHeader` + `CardFrame` + `Table`。

导航分组：

- Workspace
  - Projects
  - Servers
  - Access keys
  - Billing
- Account
  - Profile and security
- Admin
  - Apps
  - Users
  - Cluster

Admin 分组只在用户具备管理员权限时出现。

### 3.5 项目详情区

项目详情是全站最复杂页面，采用 `ProjectWorkbench`：

- 左侧：项目内服务 rail。
- 顶部：项目名称、生命周期、默认 runtime、主要操作。
- 主区域：服务详情 tabs。
- 右侧：按需打开 Drawer，承载 route table、runtime migration、文件详情、策略编辑等深层编辑任务。

服务分两类：

- App service：route、env、logs、files、images、observability、settings。
- Backing service：runtime、logs、failover、switchover、settings。

## 4. 全局交互规范

### 4.1 Button 分层

- Primary：创建、部署、保存、充值、签发 key。
- Secondary：刷新、重新加载、查看详情、复制命令。
- Ghost：页面内轻量导航、关闭、更多。
- Destructive：删除、撤销、停用、block、force delete。
- Destructive outline：危险操作的二级入口，例如打开删除确认。

所有异步按钮必须显示 loading，loading 期间保持按钮宽度稳定。

### 4.2 Dialog 和 Drawer

- Dialog 只用于确认、短表单、不可忽略的状态。
- Drawer 用于复杂编辑、详情查看、多步骤设置。
- 桌面端复杂编辑默认右侧 Drawer。
- 移动端复杂编辑默认底部 Drawer。
- 删除、撤销、block、force delete 必须使用 Dialog 二次确认。

### 4.3 Table

- 清单页优先使用 COSS `Table` 的 card variant。
- 行点击进入详情，行内操作放在右侧 kebab menu。
- 批量操作不在本阶段新增，除非功能清单已有对应能力。
- 空数据使用 `Empty`，不能留白或显示假数据。
- 加载使用 `Skeleton` 行，不用全屏 spinner。

### 4.4 Form

- 所有表单使用 `Form` + `Field` + `Input`。
- 字段错误显示在字段下方。
- 页面级错误使用 `Alert`。
- 对象名、route、env key、镜像 tag 使用 mono 字体。
- 长表单拆成 `CardFrame` 内多个 section，不嵌套卡片。

### 4.5 状态表达

每个页面都必须覆盖：

- Loading
- Empty
- Error
- Permission denied
- Disabled
- In progress
- Success feedback

长任务不只显示“等待中”，必须显示对象名、当前阶段和可重试入口。

### 4.6 响应式

- Desktop：sidebar + 内容区，详情编辑走右 Drawer。
- Tablet：sidebar 可收起，项目 workbench 的 service rail 变窄。
- Mobile：sidebar 进入 sheet，表格切换为 stacked rows，复杂编辑走底部 Drawer。
- 主要操作按钮在移动端固定到页面底部 action bar 时，不遮挡表单字段和错误信息。

## 5. 页面设计

### 5.1 `/` 产品入口页

#### 页面目标

让新用户快速理解 Fugue 的产品模型：从 GitHub 仓库、Docker image、本地上传创建应用，先运行在共享托管 runtime，再迁移到自有机器。

#### 布局

- 使用 `PublicShell`。
- 顶部使用 COSS `SiteHeader`。
- 首屏使用 COSS `PageHeader` 的 left aligned 变体。
- 首屏主体为两栏：
  - 左侧：产品主张、两枚 CTA、快速开始入口。
  - 右侧：`RouteSummaryPanel` 风格的产品面板，展示 source、runtime、route、migration 四个真实步骤。
- 首屏下方直接露出功能面板，不做长篇 marketing storytelling。

#### 功能放置

- `Docs` 放顶部导航。
- `Sign in` / `Get started` 放顶部右侧和 hero CTA。
- 已登录用户的主要 CTA 为 `Open console`。
- 快速开始信息放在 hero 下方的 `CardFrame`，内容以命令和步骤呈现。
- GitHub 仓库、Docker image、本地上传三种导入方式放在同一组 `ServiceSourcePicker` 展示卡中。
- 共享 runtime 到自有机器迁移放在 `RuntimeMigrationPreview` 面板。

#### 交互

- 点击 `Get started` 进入 `/new/repository`。
- 点击 source card 时进入 `/new/repository` 并带上 source mode。
- 点击文档链接进入 `/docs` 对应段落。
- 命令块提供复制按钮。
- 已登录状态下不把用户送回 auth，直接进入 `/app` 或 `/new/repository`。

#### 状态

- 未登录：显示 `Sign in` 和 `Get started`。
- 已登录：显示 `Open console` 和 `Create project`。
- Public 数据加载失败：保留静态页面主体，顶部显示非阻塞 `Alert`。

#### 实现说明

- 页面本身尽量为 server component。
- 登录态读取在 server 边界完成。
- CTA 组件是小型 client component，只负责根据 session 状态跳转。

### 5.2 `/docs` 产品文档页

#### 页面目标

展示 Fugue 操作文档，覆盖 CLI 快速开始、导入方式、`fugue.yaml` 拓扑规则、计费边界、stateless migrate 与 managed failover 区别、inspect / diagnose 排障流程。

#### 布局

- 使用 `DocsShell`。
- 左侧为目录 rail。
- 中间为正文。
- 右侧桌面端显示当前页 outline。
- 移动端目录收进 Drawer。

#### 功能放置

- 文档语言读取逻辑放 server 边界。
- CLI 快速开始放第一屏。
- 导入方式使用三列 `Card`：GitHub、Docker image、本地上传。
- `fugue.yaml` 用 `CodeBlock` + 说明表格。
- 计费边界用 `Table` 展示资源和计费口径。
- stateless migrate / managed failover 用对比表，不使用营销卡片。
- inspect / diagnose 放排障章节，命令块支持复制。

#### 交互

- 目录点击滚动到对应 section。
- 代码块复制后显示 toast。
- 中英文切换通过 route 或 query 保持，不在正文里混排。
- 移动端打开目录 Drawer 后，选择条目即关闭 Drawer。

#### 状态

- 文档内容缺失：显示 `Empty`，并给出返回默认语言文档的按钮。
- 语言文件读取失败：显示 `Alert`，保留能加载的默认内容。

#### 实现说明

- 文档正文为 server-rendered content。
- 复制按钮、移动目录 Drawer 是 client components。
- 文档段落 id 由内容源稳定生成，避免刷新后锚点变化。

### 5.3 `/auth/sign-in` 登录页

#### 页面目标

提供进入 Console 的登录入口，支持 Google、GitHub、密码、邮箱验证链接，并保留 `returnTo`。

#### 布局

- 使用 `AuthShell`。
- 页面中央单张 `CardFrame`。
- 顶部显示标题 `Sign in to Fugue` 和 return target 提示。
- Provider buttons 在最上方。
- 邮箱链接和密码登录使用 `Tabs`。
- 页脚提供注册入口。

#### 功能放置

- Google 登录按钮始终在 provider 区。
- GitHub 登录仅在环境已配置时显示。
- 密码登录字段在 `Password` tab。
- 邮箱验证链接在 `Email link` tab。
- OAuth、邮箱链接、密码、账号状态、handoff 错误统一放在卡片顶部 `Alert`。

#### 交互

- Provider 登录点击后按钮进入 loading。
- 邮箱链接提交后替换表单主体为“检查邮箱”状态。
- 密码登录失败时只重置密码字段，不清空邮箱。
- `returnTo` 不可见地保留在表单提交和 provider 跳转中。
- 已登录用户进入 `returnTo`，没有 `returnTo` 时进入 `/app`。

#### 状态

- OAuth error：destructive `Alert`。
- 账号 blocked：destructive `Alert`，禁用继续登录。
- 邮箱链接已发送：success `Alert`。
- session handoff 失败：warning `Alert`，提供重新登录按钮。

#### 实现说明

- 表单为 client component。
- 登录态 redirect 在 server 边界处理。
- Provider 可用性由 server 传入，不在客户端猜测。

### 5.4 `/auth/sign-up` 注册页

#### 页面目标

提供创建账号入口，支持 Google 注册和邮箱验证链接注册，保留 `returnTo`。

#### 布局

- 使用 `AuthShell`。
- 与登录页同一结构，但标题为 `Create your account`。
- 卡片顶部显示 `Get started with Fugue`。
- 页脚提供登录入口。

#### 功能放置

- Google 注册按钮放 provider 区。
- 邮箱验证链接放主表单。
- 邮箱已验证提示放表单上方 success `Alert`。

#### 交互

- 提交邮箱后进入邮件已发送状态。
- 邮箱已验证后显示 `Continue to console`。
- 已登录用户跳转到 `returnTo` 或 `/app`。

#### 状态

- 邮箱已存在：warning `Alert`，提供转到登录。
- 验证链接发送失败：destructive `Alert`，保留邮箱。
- Provider 失败：destructive `Alert`。

#### 实现说明

- 与登录页共享 `AuthPanel` 和 `ProviderAuthButtons`。
- 注册页不要新增产品说明 section，保持任务聚焦。

### 5.5 `/auth/finalize` 登录会话完成页

#### 页面目标

把第三方 OAuth 或邮箱验证结果转换成站点一方会话，并返回 `returnTo`。

#### 布局

- 使用 `AuthShell`。
- 中央小型 `CardFrame`。
- 主体为三段状态：validating、creating session、redirecting。

#### 功能放置

- handoff token 校验进度放卡片主体。
- token 缺失或过期错误放 destructive `Alert`。
- 重新登录按钮放卡片 footer。

#### 交互

- 页面加载后自动提交 token。
- 成功后自动跳转。
- 失败后停止自动跳转，展示重试和重新登录。

#### 状态

- Loading：三行 skeleton + spinner button。
- Token missing：destructive `Alert`。
- Token expired：warning `Alert`。
- Network error：提供 retry。

#### 实现说明

- 该页可以是 client-driven finalize flow，但 token 是否存在应先由 server 读取。
- 不在 URL 或日志中展示完整 token。

### 5.6 `/new/repository` 新建项目 / 仓库导入页

#### 页面目标

用于创建新项目并导入第一个服务。未登录时允许预填，登录后继续完成创建。

#### 布局

- 使用 `NewProjectShell`。
- 顶部步骤条：`Source`、`Configure`、`Deploy`。
- 主体桌面双栏：
  - 左侧：创建表单。
  - 右侧：`DeployPreviewPanel`，展示 source、project、runtime、network、storage。
- 移动端 summary 进入底部 Drawer。

#### 功能放置

- Source mode 放最上方 segmented control：`GitHub`、`Docker image`、`Upload`。
- Project fields：
  - project name
  - app name
  - branch
  - service port
- GitHub 私有仓库授权放 GitHub source section 内。
- Docker image 输入放 Docker section。
- 本地上传 dropzone 放 Upload section。
- 环境变量放 `EnvironmentVariableEditor`，默认折叠显示摘要。
- runtime 目标放 `RuntimeTargetPicker`，可打开 Drawer 查看 runtime 细节。
- network mode 和 persistent storage 放 Advanced section。
- 提交按钮固定在表单底部。

#### 交互

- 未登录用户填写信息后点击 deploy，进入登录或注册，并保存 pending intent。
- 登录后恢复 pending intent，并继续创建。
- Source mode 切换时保留通用字段，清除不适用字段前先提示。
- Runtime picker 中选择共享 runtime 或自有 runtime。
- 环境变量支持新增、编辑、删除、粘贴 `.env`。
- 持久化存储开启后显示 mount path 和 size 字段。
- 提交后进入创建中状态，并显示创建进度占位；成功后进入项目详情。

#### 状态

- Workspace 加载中：右侧 summary skeleton，表单可先填基础字段。
- 无可用 runtime：warning `Alert`，引导使用共享 runtime 或添加服务器。
- 私有仓库授权缺失：inline warning，提供授权按钮。
- 上传失败：destructive `Alert`，保留已填字段。
- 创建中：禁用 source switch，显示 operation 阶段。

#### 实现说明

- 页面 server component 启动 workspace、project list、runtime list 请求。
- Source picker、env editor、upload dropzone、runtime drawer 为 client components。
- 表单状态需要可序列化，以便 auth redirect 后恢复。

### 5.7 `/new/template/[slug]` 模板部署页

#### 页面目标

根据模板 slug 创建项目，并额外提交模板变量和模板 slug。

#### 布局

- 复用 `NewProjectShell`。
- 顶部显示模板名称、canonical slug、source repository。
- 主体双栏：
  - 左侧：模板变量和项目配置。
  - 右侧：模板拓扑 preview。

#### 功能放置

- 模板元数据检查结果放页面顶部 `Alert`。
- 模板变量放 `TemplateVariableForm`。
- 默认 runtime 放 `RuntimeTargetPicker`。
- `fugue.yaml` 拓扑信息放 `TopologyPreviewCard`。
- 通用项目字段与 `/new/repository` 保持一致。

#### 交互

- slug 非 canonical 时自动重定向到 canonical slug。
- 模板变量输入即时更新右侧 preview。
- 缺失必填变量时 submit disabled，并在字段下显示错误。
- 点击 deploy 后创建项目并进入项目详情。

#### 状态

- 模板不存在：`Empty`，提供返回创建项目。
- 模板元数据加载失败：destructive `Alert`。
- 模板变量校验失败：字段级错误。
- 创建中：显示 operation 阶段。

#### 实现说明

- 模板元数据读取在 server boundary。
- 变量表单是 client component。
- 与 `/new/repository` 共享创建 mutation，但 payload 增加 template slug 和 variables。

### 5.8 `/app` Console 项目总览页

#### 页面目标

展示当前 workspace 项目清单、生命周期、资源使用和创建中的项目进度，并提供创建项目入口。

#### 布局

- 使用 `ConsoleShell`。
- 主内容顶部是 `PageHeader`：
  - title：Projects。
  - description：当前 workspace。
  - primary action：New project。
- 下方是 summary metrics。
- 项目列表区域使用 `CardFrame` + toolbar + `Table`。

#### 功能放置

- 项目总数、运行中、attention、资源使用放 metric cards。
- 搜索框和状态筛选放 table toolbar。
- view switch 使用 `Tabs` 或 segmented control：`Table` / `Cards`。
- 创建项目按钮打开 `NewProjectDrawer` 或进入 `/new/repository`。
- 创建中的进度占位放列表顶部。

#### 交互

- 搜索按项目名过滤。
- 状态筛选按生命周期过滤。
- 行点击进入 `/app/projects/[projectId]`。
- 项目 card 右侧提供 actions menu。
- 创建项目 drawer 中选择导入方式后可继续填写，复杂流程跳转 `/new/repository`。

#### 状态

- 无项目：`Empty`，主按钮 `Create project`。
- 加载中：metric skeleton + table skeleton。
- 项目创建中：显示 pending row，带 operation 阶段。
- 读取失败：destructive `Alert` + retry。

#### 实现说明

- 项目列表和 summary 在 server 读取。
- 搜索、筛选、view mode 是 client state。
- 如果筛选条件进入 URL query，需要保证刷新可恢复。

### 5.9 `/app/projects/[projectId]` Console 项目详情页

#### 页面目标

展示单个项目的应用服务和 backing service，提供 route、env、logs、files、images、observability、settings、failover、runtime migration 等管理能力。

#### 布局

- 使用 `ConsoleShell`。
- 页面主体为 `ProjectWorkbench`。
- 顶部：
  - breadcrumb：Projects / project name。
  - project title。
  - lifecycle badge。
  - default runtime。
  - actions：Add service、Redeploy、More。
- 左侧 service rail：
  - App services。
  - Backing services。
  - Empty project placeholder。
- 主区域根据当前 service 类型渲染 tabs。
- 右侧 Drawer 承载深层编辑。

#### 项目级功能放置

- Add service 放页面 header primary action。
- 默认 runtime 放项目 summary card。
- GitHub image tracking 放项目 settings summary。
- 项目删除和空项目保留放 project settings 危险区。

#### App service tabs

##### Route tab

功能：

- route 管理。
- 项目 route table。
- custom domain。

布局：

- 顶部 `RouteSummaryPanel`：active route、service port、network mode。
- 中部 `CardFrame`：route list table。
- 下方 `CustomDomainList`。
- route table JSON / advanced editor 放右 Drawer。

交互：

- 新增 route 用 Drawer。
- 编辑 route 行内打开 Drawer。
- 删除 route 用 Dialog 确认。
- Custom domain 添加时显示 DNS / verification 状态。
- 高级 route table 打开 Drawer，保存前做校验。

状态：

- 无 route：`Empty`，按钮 `Add route`。
- domain pending verification：warning badge。
- route conflict：destructive `Alert`。

##### Environment tab

功能：

- 环境变量管理。

布局：

- `Tabs`：`Variables`、`Raw .env`。
- Variables 使用 editable table。
- Raw 使用 textarea + parse preview。

交互：

- 新增变量行。
- 编辑 key / value。
- 删除变量行。
- 粘贴 `.env` 自动解析。
- 保存后提示需要 rebuild / redeploy 时显示 warning。

状态：

- 空变量：`Empty`。
- key 重复：字段级错误。
- secret 值默认隐藏，可点击 reveal。

##### Logs tab

功能：

- build logs。
- runtime logs。

布局：

- 顶部 segmented control：`Build` / `Runtime`。
- 右侧 time / follow control。
- 主体 `LogStreamPanel`。

交互：

- Follow 开启后滚动到底部。
- 暂停时保留当前位置。
- build log 支持选择最近构建。
- runtime log 支持刷新和复制。

状态：

- 无日志：`Empty`。
- 日志流断开：warning `Alert` + reconnect。
- 权限不足：destructive `Alert`。

##### Files tab

功能：

- 文件系统与持久化存储。

布局：

- 桌面 split view：
  - 左侧 tree。
  - 右侧 editor / preview。
- 顶部 root mode：`Live filesystem` / `Persistent storage`。
- 移动端文件编辑进入 Drawer。

交互：

- 创建文件。
- 创建文件夹。
- 编辑文件。
- 保存文件。
- 删除文件。
- 切换 root mode 时保留当前路径，若不存在则回到根目录。

状态：

- 文件树加载中：skeleton。
- 文件不可编辑：info `Alert`。
- 保存冲突：warning `Alert`，提供 reload / overwrite。

##### Images tab

功能：

- 当前镜像版本。
- 已保存镜像版本。
- 镜像保留管理。
- 重新部署。

布局：

- 当前 image 放顶部 summary card。
- 版本列表使用 `CardFrame` + table。
- 版本详情放 Drawer。

交互：

- 点击版本查看 digest、created at、source。
- Redeploy from image 用 Dialog 确认。
- 删除旧 image 用 Dialog 确认。

状态：

- 无保存版本：`Empty`。
- 删除中：行级 loading。
- 当前版本不能删除：disabled + tooltip。

##### Observability tab

功能：

- overview。
- logs。
- requests。
- trace。
- alerts。

布局：

- 顶部 time window segmented control。
- Summary metrics：request rate、error rate、latency、CPU / memory。
- 二级 tabs：`Overview`、`Logs`、`Requests`、`Trace`、`Alerts`。
- Requests 使用 table。
- Trace lookup 使用 search form + result panel。

交互：

- time window 切换刷新所有 panels。
- requests row 打开 Drawer。
- trace id 搜索后显示 trace path。
- alert rule 只展示已有能力，不新增不存在的规则系统。

状态：

- 无数据：`Empty`。
- 指标不可用：warning `Alert`。
- trace not found：inline empty。

##### Settings tab

功能：

- 启动命令。
- 镜像保留数。
- 持久化挂载。
- 自动 failover。
- runtime 迁移。
- 重建 / 重新部署。
- 启动 / 重启。
- 删除 / 强制删除。

布局：

- 常规设置放 `CardFrame`。
- Runtime / failover 放 `RuntimeSettingsPanel`。
- 危险区单独放底部 `CardFrame`。

交互：

- 启动命令保存后提示 redeploy。
- Runtime migration 用 Drawer 多步确认。
- Force delete 必须输入服务名确认。
- Failover 开关变更需要显示影响范围。

状态：

- 保存失败：destructive `Alert`。
- migration running：info `Alert` + progress。
- 删除中：禁用全部危险操作。

#### Backing service tabs

##### Overview

- 显示 runtime 位置、状态、连接信息摘要。
- 数据库连接命令使用 code block，可复制。
- 资源使用使用 `Meter`。

##### Logs

- 使用同一个 `LogStreamPanel`。
- 默认显示 backing service runtime logs。

##### Failover

- 展示 managed failover 配置。
- switchover 操作用 Dialog 确认。
- 当前 primary / standby 状态用 badges。

##### Settings

- backing service 删除、runtime 信息、保留策略放这里。
- 危险操作同样使用二次确认。

#### 项目详情状态

- 项目不存在：`Empty`，返回 projects。
- 无服务：保留 project header，主区域显示 `Empty` 和 Add service。
- 权限不足：destructive `Alert`，不展示危险操作。
- 数据部分失败：对应 tab 局部 `Alert`，不摧毁整个页面。

#### 实现说明

- Project shell 和基础项目数据 server-side 读取。
- 每个 heavy tab 独立 Suspense。
- Logs、Files、Observability、Route advanced editor 使用动态 import。
- service rail selection 进入 URL query 或 path state，保证刷新后恢复。
- Drawer 状态可以进入 URL query，用于深链到 route editor 或 file path。

### 5.10 `/app/billing` Console 计费页

#### 页面目标

展示 prepaid balance、当前用量、managed capacity envelope、image storage、价格书、预计月支出、运行时长和计费事件历史，并提供容量调整和充值。

#### 布局

- 使用 `ConsoleShell`。
- `PageHeader` title 为 Billing。
- 顶部 `BillingBalancePanel`。
- 主体两栏：
  - 左侧：capacity envelope editor、price book、image storage。
  - 右侧：checkout / estimated monthly cost。
- 底部：billing events table。

#### 功能放置

- prepaid balance 和 runway 放最上方。
- 当前用量和预计月支出放 metrics。
- managed capacity envelope 使用 `CapacityEnvelopeEditor`，包含 CPU、memory、storage 等可调字段。
- 充值 checkout 放右侧 sticky card。
- image storage 使用 summary card + usage meter。
- 计费事件历史使用 `Table`。

#### 交互

- 调整 envelope 时即时更新预计成本。
- 保存 envelope 前显示差异摘要。
- 充值提交后进入 checkout 状态。
- checkout return 后显示成功、取消或待确认状态。
- 刷新按钮重新读取计费数据。

#### 状态

- 无计费事件：`Empty`。
- checkout pending：info `Alert`。
- top-up 成功：success `Alert`。
- 余额不足：warning `Alert`。
- 价格书加载失败：destructive `Alert`，禁用 envelope 保存。

#### 实现说明

- 计费 summary server-side 读取。
- envelope editor client-side 计算预估，但最终价格以后端返回为准。
- checkout 状态从 query 或 server session 读取。

### 5.11 `/app/api-keys` Console 访问密钥页

#### 页面目标

集中管理 workspace API keys 和 node keys。

#### 布局

- 使用 `ConsoleShell`。
- 顶部 `PageHeader`：Access keys。
- 主体两段 `CardFrame`：
  - Workspace API keys。
  - Node enrollment keys。

#### 功能放置

- API keys 表展示 name、scopes、status、created、last used。
- Node keys 表展示 name、status、关联 VPS 数量、created、expires。
- 创建 API key 用右 Drawer。
- 创建 node key 用右 Drawer。
- secret reveal 和复制放创建成功 Dialog。
- 节点加入命令用 code block。

#### 交互

- 创建 key 后只显示一次 secret。
- 复制 secret 显示 toast。
- 轮换 API key 用 Dialog 确认，成功后显示新 secret。
- 停用 / 启用 / 删除在 row menu。
- Node key revoke 用 Dialog 确认。
- 复制节点加入命令使用按钮。

#### 状态

- 无 API key：`Empty`，按钮 `Create API key`。
- 无 node key：`Empty`，按钮 `Create node key`。
- secret 已关闭后不可再显示，展示 info `Alert`。
- 权限不足：禁用创建和危险操作。

#### 实现说明

- key table server-side 读取。
- 创建 / 轮换成功 secret 存在 client memory，不写入 URL。
- scopes 使用 checkbox list，默认 workspace admin key 需要显式确认。

### 5.12 `/app/cluster-nodes` Console 服务器页

#### 页面目标

展示 workspace 可见的 runtime servers，包括 ready/offline/workload 汇总、heartbeat、角色、压力信号、容量、workloads、runtime access、sharing / pool 状态，并允许清理离线服务器记录。

#### 布局

- 使用 `ConsoleShell`。
- `PageHeader` title 为 Servers。
- 顶部 summary metrics：total、ready、offline、workloads、attention。
- 主体 `NodeInventoryTable`。
- 行详情用 Drawer。

#### 功能放置

- ready/offline/workload 汇总放 metrics。
- 已连接服务器放主 table。
- 离线服务器放 table 下方单独 section。
- Runtime access 放 row detail Drawer。
- Sharing / pool 状态放 badges。
- 清理离线服务器记录放 offline section row menu。

#### 交互

- 点击服务器行打开详情 Drawer。
- Drawer 中展示 heartbeat、roles、pressure、capacity、workloads。
- 复制 runtime access 信息使用 code block copy。
- 清理离线记录用 Dialog 确认。
- 刷新按钮重新读取节点状态。

#### 状态

- 无服务器：`Empty`，引导去 Access keys 创建 node key。
- 节点 attention：warning badge。
- heartbeat stale：warning `Alert`。
- 清理失败：row-level destructive message。

#### 实现说明

- node list server-side 读取。
- pressure 和 capacity 使用 `Meter`。
- 服务器详情 Drawer client-side 打开，详情数据可按需加载。

### 5.13 `/app/settings` 设置入口重定向页

#### 页面目标

作为设置区入口，直接重定向到 `/app/settings/profile`。

#### 布局

- 无可见页面。
- 若重定向等待时间超过一帧，可显示极简 loading card。

#### 功能放置

- redirect 逻辑放 server 边界。

#### 交互

- 访问后立即跳转。

#### 状态

- 无特殊状态。

#### 实现说明

- 使用 server redirect，避免客户端闪屏。

### 5.14 `/app/settings/profile` Profile and security 页

#### 页面目标

管理当前账号资料和登录方式，保证账号至少保留一种可用登录方式。

#### 布局

- 使用 `ConsoleShell`。
- `PageHeader` title 为 Profile and security。
- 主体两栏：
  - 左侧：profile form。
  - 右侧：security methods。
- 移动端单列。

#### 功能放置

- 显示名称编辑放 profile card。
- 账号邮箱和当前会话放 account summary。
- Google、GitHub、邮箱链接、密码放 `ProfileSecurityMethods`。
- 添加 / 更新 / 移除密码使用 Dialog 或 Drawer。

#### 交互

- 更新显示名称后显示 success toast。
- 连接 provider 跳转 OAuth。
- 断开 provider 前检查是否还剩其他登录方式。
- 停用邮箱链接前检查是否还剩其他登录方式。
- 移除密码前检查是否还剩其他登录方式。
- 更新密码使用当前密码 + 新密码表单。

#### 状态

- 只剩一种登录方式：对应 disconnect/remove 操作 disabled + tooltip。
- Provider connect 失败：destructive `Alert`。
- 密码更新成功：success `Alert`。
- 会话读取失败：warning `Alert`。

#### 实现说明

- profile 初始数据 server-side 读取。
- provider 操作使用 server action 或 API mutation。
- 登录方式约束必须以后端返回为准，客户端只做提前提示。

### 5.15 `/app/apps` Admin 应用管理页

#### 页面目标

管理员查看集群范围内应用，并执行 rebuild 和 delete。

#### 布局

- 使用 `AdminShell`。
- `PageHeader` title 为 Admin apps。
- 顶部 summary metrics：apps、routed apps、tenants、updated。
- 主体 `AdminAppDirectory` table。
- 应用详情用 Drawer。

#### 功能放置

- owner、resource usage、route、phase、created、app ID、project、runtime/server、source、tech stack 放 table columns。
- resource usage 使用 compact meter。
- rebuild / delete 放 row menu。
- app detail Drawer 展示完整字段。

#### 交互

- 搜索按 app ID、project、owner。
- 筛选按 phase、runtime、tenant。
- 点击行打开详情 Drawer。
- rebuild 用 Dialog 确认。
- delete 用 destructive Dialog，要求输入 app ID。

#### 状态

- 无应用：`Empty`。
- 权限不足：destructive `Alert`。
- rebuild running：row badge + disabled action。
- delete failed：row-level destructive message。

#### 实现说明

- 管理员权限在 server boundary 校验。
- table 支持 URL query filters。
- 危险操作完成后刷新当前页数据。

### 5.16 `/app/users` Admin 用户管理页

#### 页面目标

管理员查看用户目录，编辑计费额度和余额，管理管理员权限、block / unblock 和删除用户。

#### 布局

- 使用 `AdminShell`。
- `PageHeader` title 为 Admin users。
- 顶部 summary metrics：users、admins、blocked、deleted。
- 主体 `AdminUserDirectory` table。
- 用户详情和计费编辑用 Drawer。

#### 功能放置

- email、display name、account status、admin status、provider、verified、balance、billing status、managed limit、usage、last login 放 table。
- 计费额度和余额编辑放 Drawer。
- admin toggle、block、delete 放 row menu。

#### 交互

- 搜索按 email / display name。
- 筛选按 blocked、deleted、admin、provider。
- 点击用户打开详情 Drawer。
- 编辑 billing 后显示差异确认。
- 提升 / 移除管理员权限用 Dialog。
- block / unblock 用 Dialog。
- delete 用 destructive Dialog，要求输入用户 email。

#### 状态

- 无用户：`Empty`。
- 用户已删除：行样式降级，危险操作禁用。
- 余额或额度保存失败：drawer 内 destructive `Alert`。
- 当前管理员不能移除自己的最后管理员权限：disabled + tooltip。

#### 实现说明

- 权限 server-side 校验。
- billing 编辑是 client form，提交后刷新 server data。
- service usage meter 只展示已有数据，不新增估算。

### 5.17 `/app/cluster` Admin 集群管理页

#### 页面目标

管理员查看控制平面和 runtime 集群，签发 platform-scoped node join key，管理 runtime node policy。

#### 布局

- 使用 `AdminShell`。
- `PageHeader` title 为 Admin cluster。
- 顶部 control plane status card。
- 主体三段：
  - Runtime nodes overview。
  - Platform node join。
  - Runtime node policy。
- Policy editor 用右 Drawer。

#### 功能放置

- control plane 版本与状态放首张 card。
- 节点总数、ready、attention、workload 放 metrics。
- platform node join key 和加入命令放 `PlatformJoinKeyPanel`。
- runtime node policy 放 `ClusterPolicyTable`。
- 节点容量、压力、workload 信息放 row detail Drawer。

#### 交互

- 签发 platform node join key 后显示一次 secret 和命令。
- 复制加入命令使用 code block copy。
- 点击 policy 行打开 Drawer 编辑。
- policy 编辑包含：
  - control plane role。
  - build allowed。
  - workload placement。
  - reconcile 状态。
- 保存 policy 前显示 diff。

#### 状态

- control plane 状态异常：destructive `Alert`。
- 节点 attention：warning badge。
- policy reconcile pending：info badge。
- 签发 key 失败：destructive `Alert`。

#### 实现说明

- admin 权限 server-side 校验。
- policy editor client-side，只提交差异。
- key secret 不写入 URL，不持久化到 client storage。

## 6. 共享组件设计清单

### 6.1 Shell components

- `PublicShell`
  - COSS `SiteHeader`。
  - container 宽度继承 COSS container。
  - footer 简化，只放文档和登录入口。

- `DocsShell`
  - sidebar rail。
  - content outline。
  - mobile drawer toc。

- `AuthShell`
  - centered card。
  - returnTo context。
  - provider availability。

- `NewProjectShell`
  - step indicator。
  - two-column form / preview。
  - mobile preview drawer。

- `ConsoleShell`
  - COSS sidebar。
  - workspace nav。
  - account menu。
  - content page container。

- `AdminShell`
  - wraps ConsoleShell。
  - admin nav group。
  - permission boundary。

### 6.2 Product particles

- `MetricStrip`
  - 统一显示 summary metrics。
  - 支持 loading skeleton。

- `ResourceMeter`
  - COSS `Meter` 封装。
  - 显示 CPU、memory、disk、billing usage。

- `StatusBadge`
  - lifecycle、phase、ready、offline、blocked、deleted、admin。

- `CopyableCodeBlock`
  - command、route、secret、join command。
  - 支持 copy toast。

- `DangerZone`
  - 统一危险操作布局。
  - 所有 destructive action 必须有确认方式。

- `OperationProgress`
  - 创建项目、部署、迁移、rebuild、checkout pending。
  - 显示阶段、对象名、更新时间、retry。

- `SideEditorDrawer`
  - route table、runtime migration、node policy、billing edit、user detail。

## 7. React 实现规则

### 7.1 Server-first

- 页面默认 server component。
- session、workspace、权限、主要列表数据在 server boundary 读取。
- client component 只用于交互状态和 mutation。
- 共享 loader 用 `cache()`。

### 7.2 Suspense 分区

以下区域必须独立 Suspense：

- 项目详情 tabs。
- Logs。
- Files。
- Observability。
- Billing events。
- Node detail。
- Admin tables。

### 7.3 动态加载

以下模块建议 dynamic import：

- Log stream。
- File editor。
- Observability charts / requests table。
- Route advanced JSON editor。
- Large admin table filters。

### 7.4 组件 API

- Shell 使用 compound components，不用一堆 boolean prop。
- Workbench 使用 context 管理 selected service、selected tab、drawer target。
- Form field 组件保持显式 props，不做隐式 magic。
- Table row actions 用统一 action menu schema。

### 7.5 URL 状态

需要进入 URL 的状态：

- 项目详情 selected service。
- 项目详情 selected tab。
- table search / filter / pagination。
- docs language / anchor。
- admin filters。

不进入 URL 的状态：

- secret。
- access token。
- 未保存表单值。
- drawer 内临时编辑值。

## 8. 迁移 Todo List

### 8.1 范围和准备

- [x] 确认本次重构只以 `docs/frontend-page-functions.md` 和 COSS UI 为设计依据。
- [x] 确认不从现有 Fugue Web 前端视觉和组件外观继承设计。
- [x] 核对 COSS `apps/ui` 与 `packages/ui` license，决定复制源码、registry 安装或复刻 API。
- [x] 确认项目 Tailwind CSS v4 升级路径。
- [x] 确认 Base UI 版本和 React / Next.js 版本兼容性。
- [x] 定义 COSS 组件进入本项目后的命名空间。
- [x] 定义新设计文档对应的实施 PR 拆分方式。

实施决策：当前实现采用 COSS-compatible owned components。由于 COSS package license 需要进一步确认，本轮没有直接复制 `packages/ui` 源码，也没有强制把项目迁移到 Tailwind v4 / Base UI runtime；新组件先以 COSS token、COSS component semantics、Next 16 / React RSC 兼容方式落地。Tailwind v4 / Base UI 的升级路径已确认保留为后续同命名空间替换，不影响当前 COSS-compatible 重构。PR 拆分策略调整为单次主干重构提交，以满足用户要求的删除旧前端代码并触发自动构建。

### 8.2 COSS 基础设施

- [x] 接入 COSS style tokens。
- [x] 设置 `--font-sans`、`--font-heading`、`--font-mono`。
- [x] 建立 primitive token 文件。
- [x] 建立 semantic token 文件。
- [x] 建立 component token 文件。
- [x] 添加 root wrapper：`isolate relative flex min-h-svh flex-col`。
- [x] 确认 body 保持 `relative`。
- [x] 引入或复刻 `Button`。
- [x] 引入或复刻 `Card`。
- [x] 引入或复刻 `CardFrame`。
- [x] 引入或复刻 `Table`。
- [x] 引入或复刻 `Form`、`Field`、`Input`。
- [x] 引入或复刻 `Tabs`。
- [x] 引入或复刻 `Dialog`。
- [x] 引入或复刻 `Drawer`。
- [x] 引入或复刻 `Sidebar`。
- [x] 引入或复刻 `Alert`。
- [x] 引入或复刻 `Empty`。
- [x] 引入或复刻 `Skeleton`。
- [x] 引入或复刻 `Meter`。
- [x] 建立全站 toast / copy feedback 机制。

### 8.3 Shells

- [x] 实现 `PublicShell`。
- [x] 实现 `DocsShell`。
- [x] 实现 `AuthShell`。
- [x] 实现 `NewProjectShell`。
- [x] 实现 `ConsoleShell`。
- [x] 实现 `AdminShell`。
- [x] 实现 Console sidebar 分组。
- [x] 实现 Admin 权限下才显示 Admin 导航。
- [x] 实现移动端 sidebar sheet。
- [x] 实现通用 `PageHeader` 封装。

### 8.4 Shared product particles

- [x] 实现 `MetricStrip`。
- [x] 实现 `ResourceMeter`。
- [x] 实现 `StatusBadge`。
- [x] 实现 `CopyableCodeBlock`。
- [x] 实现 `DangerZone`。
- [x] 实现 `OperationProgress`。
- [x] 实现 `RuntimeTargetPicker`。
- [x] 实现 `EnvironmentVariableEditor`。
- [x] 实现 `ServiceSourcePicker`。
- [x] 实现 `TemplateVariableForm`。
- [x] 实现 `LogStreamPanel`。
- [x] 实现 `FileSystemWorkbench`。
- [x] 实现 `ImageVersionGallery`。
- [x] 实现 `ObservabilityWorkbench`。
- [x] 实现 `BillingBalancePanel`。
- [x] 实现 `CapacityEnvelopeEditor`。
- [x] 实现 `ApiKeyTable`。
- [x] 实现 `NodeKeyTable`。
- [x] 实现 `NodeInventoryTable`。
- [x] 实现 `RuntimeAccessPanel`。
- [x] 实现 `ProfileSecurityMethods`。
- [x] 实现 `AdminAppDirectory`。
- [x] 实现 `AdminUserDirectory`。
- [x] 实现 `ClusterPolicyEditor`。

### 8.5 Public 页面

- [x] 重写 `/` 的 COSS `SiteHeader`。
- [x] 重写 `/` 的 left aligned hero。
- [x] 实现导入方式展示面板。
- [x] 实现共享 runtime 到自有机器迁移 preview。
- [x] 实现快速开始 code block。
- [x] 接入已登录 / 未登录 CTA 分支。
- [x] 实现 `/docs` 的 `DocsShell`。
- [x] 实现 `/docs` 左侧目录。
- [x] 实现 `/docs` 右侧 outline。
- [x] 实现 `/docs` 移动端目录 Drawer。
- [x] 实现文档代码块复制。
- [x] 实现文档语言读取和缺失 fallback。

### 8.6 Auth 页面

- [x] 重写 `/auth/sign-in` 为 COSS auth card。
- [x] 实现 Google 登录按钮。
- [x] 实现 GitHub 登录可用性判断。
- [x] 实现密码登录 tab。
- [x] 实现邮箱链接登录 tab。
- [x] 实现 `returnTo` 保留。
- [x] 实现登录错误 `Alert`。
- [x] 重写 `/auth/sign-up` 为同构 auth card。
- [x] 实现 Google 注册。
- [x] 实现邮箱验证链接注册。
- [x] 实现邮箱已验证状态。
- [x] 重写 `/auth/finalize` 的 finalize progress card。
- [x] 实现 token 缺失 / 过期 / 网络错误状态。
- [x] 实现 finalize 成功跳转。

### 8.7 New Project 页面

- [x] 重写 `/new/repository` 的 `NewProjectShell`。
- [x] 实现 source mode segmented control。
- [x] 实现 GitHub repository source form。
- [x] 实现 Docker image source form。
- [x] 实现 local upload dropzone。
- [x] 实现 project name / app name / branch / service port fields。
- [x] 实现 private repository authorization 状态。
- [x] 实现 runtime target picker Drawer。
- [x] 实现 environment variable editor。
- [x] 实现 network mode 和 persistent storage advanced section。
- [x] 实现未登录 pending intent 保存。
- [x] 实现登录后 pending intent 恢复。
- [x] 实现创建中 operation progress。
- [x] 重写 `/new/template/[slug]`。
- [x] 实现 template metadata check。
- [x] 实现 canonical slug redirect。
- [x] 实现 template variable form。
- [x] 实现 topology preview。
- [x] 实现 template 创建 payload。

### 8.8 Console 项目总览

- [x] 重写 `/app` 的 `ConsoleShell`。
- [x] 实现 projects page header。
- [x] 实现 summary metrics。
- [x] 实现 project search。
- [x] 实现 project lifecycle filter。
- [x] 实现 table / cards view switch。
- [x] 实现 pending project creation row。
- [x] 实现 empty projects state。
- [x] 实现 create project drawer 或跳转。
- [x] 实现项目行进入详情。

### 8.9 项目详情 Workbench

- [x] 实现 `ProjectWorkbench` 外层布局。
- [x] 实现 project header。
- [x] 实现 service rail。
- [x] 实现 app service tabs。
- [x] 实现 backing service tabs。
- [x] 实现 URL 恢复 selected service。
- [x] 实现 URL 恢复 selected tab。
- [x] 实现项目不存在状态。
- [x] 实现无服务状态。
- [x] 实现权限不足状态。

### 8.10 项目详情 Route

- [x] 实现 route summary panel。
- [x] 实现 route list table。
- [x] 实现新增 route Drawer。
- [x] 实现编辑 route Drawer。
- [x] 实现删除 route Dialog。
- [x] 实现 custom domain list。
- [x] 实现 DNS verification 状态。
- [x] 实现 advanced route table Drawer。
- [x] 实现 route conflict error。

### 8.11 项目详情 Environment

- [x] 实现 variables tab。
- [x] 实现 raw `.env` tab。
- [x] 实现新增 env row。
- [x] 实现编辑 env key / value。
- [x] 实现删除 env row。
- [x] 实现粘贴 `.env` 解析。
- [x] 实现 duplicate key validation。
- [x] 实现 secret reveal。
- [x] 实现保存后 redeploy warning。

### 8.12 项目详情 Logs

- [x] 实现 build / runtime segmented control。
- [x] 实现 log stream panel。
- [x] 实现 follow / pause。
- [x] 实现选择最近 build。
- [x] 实现复制日志。
- [x] 实现日志流断线重连。
- [x] 实现无日志状态。

### 8.13 项目详情 Files

- [x] 实现 live filesystem / persistent storage root mode。
- [x] 实现文件树。
- [x] 实现文件 editor。
- [x] 实现移动端 editor Drawer。
- [x] 实现创建文件。
- [x] 实现创建文件夹。
- [x] 实现保存文件。
- [x] 实现删除文件。
- [x] 实现保存冲突处理。
- [x] 实现不可编辑文件提示。

### 8.14 项目详情 Images

- [x] 实现 current image summary。
- [x] 实现 image versions table。
- [x] 实现 image version detail Drawer。
- [x] 实现 redeploy from image Dialog。
- [x] 实现删除旧 image Dialog。
- [x] 实现当前 image 禁止删除状态。

### 8.15 项目详情 Observability

- [x] 实现 time window segmented control。
- [x] 实现 overview metrics。
- [x] 实现 logs panel。
- [x] 实现 requests table。
- [x] 实现 request detail Drawer。
- [x] 实现 trace lookup。
- [x] 实现 alerts tab。
- [x] 实现指标不可用状态。
- [x] 实现 trace not found 状态。

### 8.16 项目详情 Settings 和 Backing Service

- [x] 实现启动命令设置。
- [x] 实现镜像保留数设置。
- [x] 实现持久化挂载设置。
- [x] 实现自动 failover 设置。
- [x] 实现 runtime migration Drawer。
- [x] 实现 rebuild / redeploy 操作。
- [x] 实现 start / restart 操作。
- [x] 实现 delete / force delete 危险区。
- [x] 实现 backing service overview。
- [x] 实现 backing service logs。
- [x] 实现 backing service failover。
- [x] 实现 backing service switchover Dialog。
- [x] 实现 backing service settings。

### 8.17 Billing

- [x] 重写 `/app/billing` page header。
- [x] 实现 balance / runway panel。
- [x] 实现 current usage metrics。
- [x] 实现 managed capacity envelope editor。
- [x] 实现 estimated monthly cost。
- [x] 实现 top-up checkout card。
- [x] 实现 checkout return status。
- [x] 实现 image storage card。
- [x] 实现 price book table。
- [x] 实现 billing events table。
- [x] 实现余额不足 warning。

### 8.18 Access Keys

- [x] 重写 `/app/api-keys`。
- [x] 实现 workspace API keys table。
- [x] 实现 node enrollment keys table。
- [x] 实现 create API key Drawer。
- [x] 实现 create node key Drawer。
- [x] 实现 secret one-time Dialog。
- [x] 实现复制 secret。
- [x] 实现复制 node join command。
- [x] 实现 API key rotate。
- [x] 实现 API key enable / disable。
- [x] 实现 key delete / revoke。
- [x] 实现无 key empty state。

### 8.19 Servers

- [x] 重写 `/app/cluster-nodes`。
- [x] 实现 node summary metrics。
- [x] 实现 connected server table。
- [x] 实现 offline server section。
- [x] 实现 node detail Drawer。
- [x] 实现 heartbeat / roles / pressure 展示。
- [x] 实现 capacity meters。
- [x] 实现 workloads list。
- [x] 实现 runtime access panel。
- [x] 实现 sharing / pool badges。
- [x] 实现清理离线服务器 Dialog。

### 8.20 Settings

- [x] 实现 `/app/settings` server redirect。
- [x] 重写 `/app/settings/profile`。
- [x] 实现 display name form。
- [x] 实现 account email summary。
- [x] 实现 current session summary。
- [x] 实现 Google connect / disconnect。
- [x] 实现 GitHub connect / disconnect。
- [x] 实现邮箱链接启用 / 停用。
- [x] 实现密码添加 / 更新 / 移除。
- [x] 实现至少一种登录方式约束。

### 8.21 Admin Apps

- [x] 重写 `/app/apps`。
- [x] 实现 admin permission boundary。
- [x] 实现 apps summary metrics。
- [x] 实现 apps table。
- [x] 实现 app search。
- [x] 实现 phase / runtime / tenant filters。
- [x] 实现 app detail Drawer。
- [x] 实现 rebuild Dialog。
- [x] 实现 delete Dialog。

### 8.22 Admin Users

- [x] 重写 `/app/users`。
- [x] 实现 users summary metrics。
- [x] 实现 users table。
- [x] 实现 user search。
- [x] 实现 status / admin / provider filters。
- [x] 实现 user detail Drawer。
- [x] 实现 billing edit form。
- [x] 实现 admin promote / demote Dialog。
- [x] 实现 block / unblock Dialog。
- [x] 实现 delete user Dialog。
- [x] 实现 self last-admin protection。

### 8.23 Admin Cluster

- [x] 重写 `/app/cluster`。
- [x] 实现 control plane status card。
- [x] 实现 cluster summary metrics。
- [x] 实现 runtime nodes table。
- [x] 实现 platform node join key panel。
- [x] 实现 platform join secret one-time Dialog。
- [x] 实现 copy join command。
- [x] 实现 runtime node policy table。
- [x] 实现 policy editor Drawer。
- [x] 实现 policy diff confirm。
- [x] 实现 reconcile pending state。

### 8.24 质量检查

- [x] 每个页面有 loading 状态。
- [x] 每个页面有 empty 状态。
- [x] 每个页面有 error 状态。
- [x] 每个受保护页面有 permission denied 状态。
- [x] 所有 destructive action 有二次确认。
- [x] 所有 secret 只显示一次或按产品规则 reveal。
- [x] 所有 copy action 有反馈。
- [x] 所有表单字段有 label。
- [x] 所有字段错误显示在字段附近。
- [x] 移动端 sidebar 可用。
- [x] 移动端表格可读。
- [x] 抽屉和弹窗不会遮挡主要操作。
- [x] keyboard focus ring 可见。
- [x] `prefers-reduced-motion` 下不保留非必要 motion。
- [x] 关键页面通过无鼠标键盘导航。
- [x] Console heavy panels 使用 Suspense。
- [x] Logs / Files / Observability 动态加载。
- [x] 搜索、筛选、分页 URL 状态可恢复。
- [x] secret、token、未保存表单值不进入 URL。
- [x] 路由和 API payload 对照权威 OpenAPI 契约。
- [x] `npm run typecheck` 通过。
- [x] `npm run contract:check` 通过。
- [x] 桌面视口截图检查通过。
- [x] 移动视口截图检查通过。

## 9. 实施顺序建议

1. COSS 基础设施和 token。
2. COSS primitives。
3. Shells。
4. Auth 和 Public。
5. New Project。
6. Console 项目总览。
7. Project Workbench 骨架。
8. Project Workbench 各 tabs。
9. Billing、Access Keys、Servers、Profile。
10. Admin pages。
11. 全站状态、响应式、可访问性和性能检查。

这个顺序能先建立稳定设计语言，再逐步迁移高复杂度页面，避免一开始就在项目详情页内混合太多未稳定的基础组件。

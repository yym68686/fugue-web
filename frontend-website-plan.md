# Fugue Web 完整产品层方案

## 1. 先评估现有 `frontend-website-plan.md`

### 1.1 现有方案已经做对的部分

- 它正确抓住了 Fugue 当前最有辨识度的产品主线：
  - GitHub 导入
  - shared runtime
  - attach your own VPS
  - migrate between runtimes
  - operation + audit
- 它没有把 Fugue 包装成一个泛泛的“云平台官网”，而是围绕真实对象设计：
  - tenant
  - project
  - app
  - runtime
  - node key
  - operation
  - audit event
- 它对信息架构的直觉基本正确：
  - 官网、文档、控制台应当同一代码库管理
  - docs 不必一开始单独起站
  - 控制台应该围绕 app / runtime / operation 展开
- 它对当前 Fugue MVP 的边界判断也基本准确：
  - 不要假装已有成熟 billing
  - 不要做假三栏价格页
  - 不要夸大 autoscaling / quotas / scheduling

### 1.2 现有方案不完备的关键点

现有文档是一个不错的“官网 + token 控制台 IA 草案”，但还不是你现在要的“独立产品层方案”。缺的不是几页页面，而是整层产品能力。

主要缺口有 8 个：

1. **没有解决你明确提出的账号体系**
   - 你现在要的是“Google 登录 + 邮箱注册”。
   - 现有方案把控制台入口定义成 `baseUrl + bearer token`，这和“用户注册后直接使用产品”不是同一件事。

2. **没有定义 `fugue-web` 自己的后端职责**
   - 现有方案只有 BFF / token proxy 思路。
   - 但产品层真正需要的是：
     - 用户系统
     - session
     - workspace / member / invite
     - Fugue tenant 自动开通
     - token 加密存储
     - 产品层审计

3. **没有定义“产品用户”与“Fugue tenant”的映射**
   - Fugue 核心只有 bearer token、tenant、scope。
   - 你要做的 web 产品有：
     - user
     - identity provider
     - workspace
     - member role
   - 这两层之间必须有清晰映射。

4. **没有给出 hosted 模式与 BYO 模式的统一产品模型**
   - 你现在实际上会有两种用户：
     - 直接注册使用你托管的 Fugue
     - 已经有 Fugue endpoint / token 的高级用户
   - 现有方案只覆盖了后者。

5. **没有讨论产品层 RBAC 与 Fugue scopes 的关系**
   - 产品里会有 owner / developer / viewer。
   - Fugue 里只有 `app.write`、`app.deploy`、`runtime.attach` 这类 scopes。
   - 没有一层明确的 role-to-scope 映射，控制台无法安全落地。

6. **没有讨论“谁在操作”这个审计问题**
   - 如果 `fugue-web` 后端代用户调用 Fugue API，Fugue audit 里看到的是某个 API key，不是具体用户。
   - 产品层必须补自己的 audit。
   - 更完整的做法还应推动 Fugue 增加 acting-user 透传能力。

7. **没有覆盖独立部署方案**
   - 你要求 `fugue-web` 独立于 `/fugue`，并且能自己部署。
   - 那就必须设计：
     - 它自己的数据库
     - 它自己的环境变量
     - 它自己如何被 Fugue 部署
     - 它和 root domain / app domain 的关系

8. **没有给出和当前 Fugue 部署兼容的域名策略**
   - 现有方案为了兼容 `appBaseDomain=fugue.pro`，只能建议 `/console` 路径式控制台。
   - 这在短期可用，但不是长期最优方案。
   - 完整方案应该同时给出：
     - 当前兼容方案
     - 长期清爽方案

### 1.3 结论

**现有文档可以保留其中的产品定位、信息架构和视觉方向，但必须升级成“官网 + 自有认证 + 工作区系统 + Fugue 集成后端”的完整产品层方案。**

下面这份文档就是按这个目标重写的版本。

---

## 2. 本方案的设计依据

## 2.1 来自 `web-design/AGENTS.md` 的最相关 skills

我没有机械地把 63 个 skill 全部套进来，而是只抽取这次真正有用的 6 个：

- `frontend-design`
  - 要求页面有明确概念方向，避免 AI 套板感。
- `site-architecture`
  - 先拆清官网、认证、控制台、文档的层级关系。
- `ckm:design-system`
  - 用 primitive -> semantic -> component 三层 token 设计系统。
- `signup-flow-cro`
  - 注册只保留最少必要字段，Google 和邮箱都要低摩擦。
- `onboarding-cro`
  - 把 activation 定义为“导入第一个 app 并跑起来”，而不是“完成注册”。
- `shadcn`
  - 控制台使用可访问、可组合、可维护的组件体系，不自己乱造基础控件。

## 2.2 来自 Fugue 源码与文档的硬约束

从 `/Users/yanyuming/Downloads/GitHub/fugue` 当前源码和 README 可以确认这些事实：

- Fugue 目前的认证模型只有 4 类凭证：
  - bootstrap admin key
  - tenant API key
  - node key
  - runtime key
- Fugue **没有**用户账号系统、OAuth、邮箱注册、session。
- Fugue 北向 API 基本都依赖 bearer token。
- 目前没有专门的 `whoami` 接口。
- `POST /v1/apps/import-github` 支持导入 **GitHub repo**，包括 public 和 private。
- `GET /v1/apps/{id}/runtime-logs` 目前只对 managed runtime 有效。
- `GET /v1/backing-services` 和 `GET /v1/apps/{id}/bindings` 当前是 **只读**。
- Fugue 已支持：
  - tenant / project / app / runtime / operation / audit
  - import / deploy / scale / migrate / disable / delete
  - env / files
  - node key + join-cluster
- `FUGUE_APP_BASE_DOMAIN` 当前可配置，默认值是 `fugue.pro`。
- 当前 API handler 没有专门的 CORS 层，所以浏览器不该直接打 Fugue API。

这意味着：

- **账号体系必须在 `fugue-web` 自己做。**
- **浏览器到 Fugue 的请求必须通过 `fugue-web` 的服务端。**
- **产品文案和 UI 必须严格贴着现有能力，不要假装 private repo import、billing、custom domain 都已完成。**

---

## 3. 产品边界定义

## 3.1 `fugue` 和 `fugue-web` 分工

| 层 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `fugue` 核心控制面 | tenant/project/app/runtime/node key/operation/audit 的真实控制逻辑；GitHub 导入；部署；迁移；VPS 接入 | 用户注册登录、Google OAuth、workspace/team、产品级 session、产品级审计、营销官网 |
| `fugue-web` 产品层 | 官网、文档、认证、workspace、team、session、BFF、Fugue 集成代理、产品级 onboarding、产品级审计 | 替代 Fugue 的核心控制逻辑，不重复实现 deploy/runtime/controller |

一句话：

**`fugue` 是 control plane，`fugue-web` 是面向最终用户的产品层外壳。**

## 3.2 最终体验不是“两层”，而是“三层”

不是简单的“官网 + 控制台”，而是三层：

1. **Marketing / Docs**
   - 解释 Fugue 是什么
   - 教用户快速开始
   - 承接 SEO 和品牌表达

2. **Product / Auth / Workspace**
   - Google 登录
   - 邮箱注册
   - workspace 创建
   - member / invite / role
   - onboarding
   - session
   - BFF / proxy

3. **Fugue Control Plane Integration**
   - 调用 `/v1/tenants`
   - `/v1/projects`
   - `/v1/apps`
   - `/v1/node-keys`
   - `/v1/runtimes`
   - `/v1/operations`
   - `/v1/audit-events`

## 3.3 支持两种使用模式

### 模式 A：Hosted Workspace（推荐默认）

这是普通用户路径，也是产品首页的主路径。

流程：

1. 用户通过 Google 或邮箱注册
2. 创建 workspace
3. `fugue-web` 后端用 bootstrap key 自动调用 Fugue：
   - 创建 tenant
   - 创建 default project
   - 创建一组 tenant API keys
4. 用户直接进入控制台，不需要看见底层 token

### 模式 B：Connect Existing Fugue（高级模式）

这是给已经有 Fugue endpoint / token 的用户。

流程：

1. 用户先登录 `fugue-web`
2. 在设置页选择 “Connect existing control plane”
3. 输入：
   - Fugue API base URL
   - bootstrap key 或 tenant API key
4. `fugue-web` 验证后建立连接

这个模式应该有，但**不应该成为首页主 CTA**。

---

## 4. 推荐产品形态

## 4.1 不是“Connect with token first”，而是“Create workspace first”

这点和现有文档最大的不同在这里。

如果你真的要做 Google 登录和邮箱注册，用户第一眼看到的不应该是：

- API Base URL
- Bearer token
- Connect

而应该是：

- Continue with Google
- Sign up with email
- Sign in

然后在进入产品后再区分：

- 这是托管 workspace
- 还是连接已有 Fugue

## 4.2 Activation 目标

产品层的 activation 不应该定义成“注册成功”，而应该定义成：

**用户在第一个 session 内完成一次 GitHub 导入，并看到第一个公开 URL。**

次级 activation 事件：

- 创建第一个 node key
- 第一台 VPS 接入
- 第一次迁移完成
- 邀请第一个 teammate

这会直接决定 onboarding 和埋点设计。

---

## 5. 账号、工作区与权限模型

## 5.1 用户身份

用户身份由 `fugue-web` 自己管理，至少支持：

- Google OAuth 登录
- 邮箱注册
- 邮箱登录
- 邮箱验证
- 忘记密码 / 重设密码
- 邀请加入 workspace

### 邮箱注册的推荐字段

只收最少字段：

- email
- password

这些字段不要在注册时强收：

- company
- role
- team size
- phone

`workspace name` 可以在注册后下一步收集。

## 5.2 工作区模型

一个 `workspace` 对应产品层的一个团队空间。

推荐映射关系：

- `workspace` 1:1 对应 Fugue 中的 `tenant`
- `workspace` 默认有一个 `default project`
- 后续可以在控制台里新建更多 project

## 5.3 角色模型

推荐产品层角色：

| 产品角色 | 能力 | 对应 Fugue scope profile |
| --- | --- | --- |
| `viewer` | 只读查看 apps / runtimes / logs / operations / audit | `[]` |
| `developer` | 导入 app、编辑 env/files、deploy、scale、migrate、delete、看日志 | `app.write app.deploy app.scale app.migrate app.delete` |
| `operator` | `developer` 全部能力 + node key / runtime attach | `app.write app.deploy app.scale app.migrate app.delete runtime.attach` |
| `owner` | `operator` 全部能力 + project 管理、成员管理、workspace 设置 | `project.write apikey.write app.write app.deploy app.scale app.migrate app.delete runtime.attach` |

### 为什么推荐这样映射

- Fugue 自己没有用户概念，只有 scopes。
- 产品层 RBAC 需要最终落在 Fugue scope 上。
- 这样后端可以按用户角色选择最小权限的 Fugue API key，而不是永远拿 tenant-admin key 乱打。

## 5.4 平台管理员

除了 workspace 内角色，还需要一层产品内部角色：

- `platform_owner`

它不是普通用户角色，不在公开 UI 中暴露。
它只给你自己或内部运维团队使用，对应 Fugue bootstrap admin key。

---

## 6. 域名与部署结构

## 6.1 长期推荐结构

这是完整产品上线后最清爽的域名结构：

- `fugue.pro`
  - 官网 + docs
- `app.fugue.pro`
  - 登录后产品控制台
- `api.fugue.pro`
  - Fugue 核心北向 API
- `*.apps.fugue.pro`
  - 用户应用默认 hostname

### 为什么推荐把 app hostname 挪到 `*.apps.fugue.pro`

因为 Fugue 当前的 app proxy 会把 `*.{appBaseDomain}` 视为用户应用 host。

如果继续使用：

- `FUGUE_APP_BASE_DOMAIN=fugue.pro`

那你之后会一直被这些问题困住：

- `console.fugue.pro` 与用户应用 host 冲突
- `app.fugue.pro` 与用户应用 host 冲突
- 所有产品子域名都要做 reserved host 例外

所以**长期最优解是把 app base domain 提前迁到 `apps.fugue.pro`**。

## 6.2 当前部署兼容方案

如果你现在的 Fugue 已经跑在：

- `api.fugue.pro`
- `FUGUE_APP_BASE_DOMAIN=fugue.pro`

那短期先采用兼容结构：

- `fugue.pro`
  - 官网
- `fugue.pro/docs`
  - 文档
- `fugue.pro/app`
  - 登录后控制台
- `api.fugue.pro`
  - Fugue API
- `*.fugue.pro`
  - 当前用户应用 host

这能先落地，但建议在正式公开发布前做一次 app domain 迁移。

## 6.3 `fugue-web` 自己如何被部署

`fugue-web` 作为独立项目，推荐最小运行单元是：

1. `fugue-web` 应用
   - Next.js 全栈应用
2. `fugue-web` 自己的 PostgreSQL
   - 存用户、session、workspace、invite、加密后的 Fugue 凭证
3. 可选 worker
   - 发邮件
   - 做异步 provisioning
   - 做同步任务

### 在 Fugue 上部署 `fugue-web`

可以分两种：

- **最简单**
  - 先把 `fugue-web` 当普通应用部署到 Fugue
  - 使用生成的默认 hostname
- **正式生产**
  - 在 edge 层把 `fugue.pro` / `app.fugue.pro` 代理到 `fugue-web`
  - 因为 Fugue 当前还不是完整的 custom-domain 产品

也就是说：

**“可以被 Fugue 独立部署”完全可行，但品牌域名通常还需要 edge 代理层配合。**

---

## 7. 关键用户流

## 7.1 Google 注册 / 登录

目标：最短路径进入产品。

流程：

1. 用户点击 `Continue with Google`
2. 完成 OAuth
3. 如果是首次登录：
   - 创建用户
   - 进入 `Create your workspace`
4. 输入 workspace name
5. 后端 provisioning Fugue tenant
6. 进入 onboarding

## 7.2 邮箱注册

推荐两步，不要更多：

1. `email + password`
2. `workspace name`

然后：

3. 发邮箱验证
4. 自动登录
5. provisioning workspace
6. 进入 onboarding

注册页文案不要写：

- Start free trial
- No credit card required

除非你真的有 trial / billing 逻辑。

推荐写：

- Create your Fugue workspace
- Deploy from GitHub, then move to your own VPS when ready

## 7.3 Hosted Workspace 自动开通

注册后后端自动执行：

1. `POST /v1/tenants`
2. `POST /v1/projects`
3. `POST /v1/api-keys`
   - viewer key
   - developer key
   - operator key
   - owner key
4. 把：
   - tenant id
   - default project id
   - role-based key secrets
   加密写入 `fugue-web` 数据库

这样普通用户看不见底层 token，但产品仍然基于 Fugue 的真实权限模型工作。

## 7.4 首次 onboarding

首页不要用 tour 轰炸用户。

应该用一个 checklist：

1. Import a GitHub repo
2. Watch the first deploy operation
3. Open the live app URL
4. Create a node key
5. Attach your first VPS

其中第 1-3 步是核心 activation 路径。

## 7.5 Connect Existing Fugue

这个入口应放在：

- 设置页
- 或首次 onboarding 的 secondary path

而不是 marketing hero 主按钮。

支持两种连接：

- 输入 bootstrap key
  - 可以创建或接管 tenant
- 输入 tenant API key
  - 只绑定已有 tenant

成功后把该连接保存为 workspace 的 `control plane connection`。

## 7.6 导入 GitHub 应用

这是产品最重要的引导流。

步骤：

1. 输入 public repo URL
2. 选 branch
3. 选 build strategy
   - auto
   - static-site
   - dockerfile
   - buildpacks
   - nixpacks
4. 预览 topology
   - 单服务导入
   - compose / fugue manifest 多服务导入
5. 确认 app name、hostname、service port、runtime
6. 提交
7. 进入 operation watch 页面

这里必须明确写出：

- 目前支持 public / private GitHub repo

不要放：

- GitHub App installation

因为当前落地是 GitHub 网页授权或手填 token，不是 GitHub App 安装流。

## 7.7 接入 VPS

`Node Keys` 页面要成为“Bring Your Own VPS”的中心页。

用户流：

1. 创建 node key
2. 只展示一次 secret
3. 提供：
   - 一行 join script
   - Docker agent 运行示例
   - 手动 env 方式
4. 等待 runtime heartbeat
5. 在 app 详情页执行 migrate

## 7.8 迁移

迁移不是隐藏功能，应该成为产品叙事的一部分。

迁移 modal 需要展示：

- current runtime
- target runtime
- current replicas
- expected downtime / behavior 说明
- operation timeline 入口

---

## 8. 网站与应用信息架构

## 8.1 总体 sitemap

```text
/
├── /
├── /product
│   ├── /product/github-import
│   ├── /product/shared-runtime
│   ├── /product/bring-your-own-vps
│   ├── /product/migrations
│   └── /product/operations-and-audit
├── /use-cases
│   ├── /use-cases/ship-on-shared-runtime
│   ├── /use-cases/move-to-your-own-vps
│   └── /use-cases/platform-admin
├── /docs
│   ├── /docs/quickstart
│   ├── /docs/deploy-fugue-on-3-vps
│   ├── /docs/import-from-github
│   ├── /docs/attach-a-vps
│   ├── /docs/migrate-an-app
│   ├── /docs/auth-and-workspaces
│   └── /docs/api
├── /architecture
├── /security
├── /roadmap
├── /changelog
├── /access
├── /auth
│   ├── /auth/sign-in
│   ├── /auth/sign-up
│   ├── /auth/verify-email
│   ├── /auth/forgot-password
│   ├── /auth/reset-password
│   └── /invite/[token]
└── /app
    ├── /app
    ├── /app/onboarding
    ├── /app/projects
    ├── /app/apps
    │   ├── /app/apps/new/import
    │   └── /app/apps/[appId]
    │       ├── /overview
    │       ├── /env
    │       ├── /files
    │       ├── /bindings
    │       ├── /build-logs
    │       ├── /runtime-logs
    │       ├── /operations
    │       └── /audit
    ├── /app/cluster-nodes
    ├── /app/node-keys
    ├── /app/audit
    ├── /app/settings
    │   ├── /workspace
    │   ├── /members
    │   ├── /security
    │   └── /connections
    └── /app/admin
        ├── /system
        ├── /tenants
        └── /support
```

## 8.2 公开站点页面重点

### 首页 `/`

Hero 主标题建议：

**Deploy from GitHub on shared k3s. Move to your own VPS when you are ready.**

首页 section 顺序：

1. Hero
2. 价值主张三联卡
   - GitHub import
   - shared runtime
   - bring your own VPS
3. 工作流时间线
   - sign up -> import -> deploy -> attach -> migrate
4. 实体关系图
   - workspace -> project -> app -> runtime -> operation
5. Quickstart code block
6. 控制台截图
7. FAQ
8. CTA

### `/product`

不是 feature dump，而是按场景解释：

- Start fast on shared runtime
- Bring your own machines
- Migrate without changing the control model
- See every operation and audit trail

### `/security`

这个页面在你做 Google 登录和 workspace 后就变重要了。

至少解释：

- product-side auth and session
- how Fugue tokens are stored
- one-time secret reveal semantics
- workspace isolation
- audit logging

### `/access`

代替传统 pricing 页面。

内容可以是：

- Self-hosted Fugue
- Hosted access / pilot
- Contact for larger deployments

## 8.3 认证页面重点

认证页面设计目标：

- 明确价值
- 低摩擦
- 不像 B2C 社交产品
- 不像“免费试用漏斗页”

左侧：

- 一句话价值
- 3 个 capability bullets
- 一张简化控制台预览图

右侧：

- Google 登录按钮
- 邮箱表单
- Sign in / Sign up 切换

## 8.4 控制台页面重点

### `/app`

这是登录后的 overview。

顶部显示：

- workspace name
- connection type
  - hosted
  - external
- current environment
- 最近一次 provisioning / sync 状态

核心卡片：

- Apps
- Shared runtime status
- Attached runtimes
- Operations in progress
- Recent failures
- Audit events

### `/app/apps`

主列表字段：

- Name
- Project
- Runtime
- Public URL
- Phase
- Replicas
- Last operation
- Updated at

主操作：

- Import from GitHub
- Create app

### `/app/apps/[appId]`

tab 结构保留现有文档中的方向，但要增加产品层说明：

- `Overview`
  - app 基本信息
  - current runtime
  - public URL
  - source
  - latest operation
  - quick actions
- `Env`
- `Files`
- `Bindings`
- `Build Logs`
- `Runtime Logs`
- `Operations`
- `Audit`

### `/app/node-keys`

这个页面是 onboarding 主页面之一，不是边缘配置页。

它必须同时提供：

- list
- create
- revoke
- usage
- join command
- copy feedback
- docs shortcut

### `/app/settings/members`

这是现有文档完全没覆盖，但产品层必须有的页面。

功能：

- 邀请成员
- 改角色
- 移除成员
- 查看 pending invite

### `/app/settings/connections`

这个页面负责：

- Hosted workspace 的连接状态展示
- Connect existing Fugue
- Rotate / revalidate connection
- 显示当前 Fugue base URL

---

## 9. 视觉方向与设计系统

## 9.1 视觉概念

沿用现有文档里正确的那条线，但做得更明确：

**Orchestration Score + Control Room**

官网像“编排中的乐谱与结构图”，控制台像“克制、精密的基础设施驾驶舱”。

要求：

- 有文化感，但不文艺过头
- 有基础设施可信度，但不赛博朋克
- 有节奏和层级，不用 AI 紫色模板

## 9.2 字体

- Marketing display: `Fraunces`
- UI body: `IBM Plex Sans`
- Mono: `IBM Plex Mono`

## 9.3 色彩

Primitive tokens：

- `ink`
- `paper`
- `slate`
- `teal`
- `amber`
- `rust`

Semantic tokens：

- `bg.canvas`
- `bg.surface`
- `text.primary`
- `text.muted`
- `status.success`
- `status.warning`
- `status.error`
- `border.subtle`

Component tokens：

- `hero.grid.line`
- `sidebar.bg`
- `card.bg`
- `badge.success.bg`
- `log.viewer.bg`

## 9.4 版式

Marketing：

- 允许更大胆的留白、错位、编排线条
- 用结构化网格、细线、编号和说明块建立节奏

Console：

- 更安静
- 更高信息密度
- 大量使用 table、tabs、command palette、drawer

## 9.5 动效

只做有意义的 4 类：

1. Hero reveal
2. operation status transition
3. topology line tracing
4. copy / create / deploy success feedback

不要做：

- 满屏粒子
- 浮动玻璃球
- 夸张 3D 卡片

---

## 10. 前端技术架构

## 10.1 推荐技术栈

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zod
- MDX
- Motion

## 10.2 为什么推荐 Next.js 全栈，而不是前后端一开始硬拆

你要求这个项目有自己的前后端，但 **v1 不需要一开始拆成两个完全独立服务**。

最稳妥的做法是：

- `fugue-web` 作为一个 Next.js 全栈应用
- 前端页面、认证、session、BFF、Fugue proxy 都在同一代码库
- 需要异步任务时再加一个 worker 进程

这样能同时满足：

- 官网 SEO
- docs
- auth callback
- session cookie
- BFF 代理
- 控制台交互
- 更容易被 Fugue 作为单个产品 app 部署

### 什么时候再拆独立 API 服务

等你进入这些需求时再拆：

- org SSO / SCIM
- webhook fanout
- billing
- 大量 background jobs
- 独立水平扩展 API

## 10.3 推荐目录结构

```text
fugue-web/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (app)/
│   └── api/
│       ├── auth/
│       ├── workspace/
│       ├── fugue/
│       └── admin/
├── components/
│   ├── marketing/
│   ├── auth/
│   ├── app/
│   └── shared/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── fugue/
│   ├── rbac/
│   ├── crypto/
│   └── analytics/
├── content/
│   └── docs/
├── styles/
├── public/
└── worker/
    ├── jobs/
    └── mail/
```

## 10.4 数据获取

- Marketing / docs：Server Components
- Console：TanStack Query
- Logs / operations：轮询优先
- 不要一开始就上 WebSocket

推荐轮询节奏：

- operations：5-10 秒
- runtime / node health：15-30 秒
- logs：手动刷新 + 可选短轮询

## 10.5 状态管理

- 远程状态：TanStack Query
- 表单：React Hook Form + Zod
- 本地交互状态：React state
- 不要先上重型全局 store

## 10.6 测试

至少要有：

- Playwright
  - 注册
  - 登录
  - onboarding
  - import flow
  - node key flow
- 单元测试
  - role-to-scope 选择
  - provisioning 逻辑
  - token encryption
- 关键页面视觉回归
  - Home
  - Sign up
  - App overview
  - App detail

---

## 11. `fugue-web` 后端 / BFF 设计

## 11.1 后端模块

产品层后端至少包含这几个模块：

- `auth`
  - Google OAuth
  - email/password
  - sessions
  - password reset
- `workspace`
  - create workspace
  - membership
  - invites
- `provisioner`
  - 调用 Fugue 创建 tenant / project / API keys
- `fugue-proxy`
  - 代表当前用户调用 Fugue
- `audit`
  - 记录产品层真实操作者
- `admin`
  - 内部平台管理

## 11.2 本地数据库表

推荐最小表集：

- `users`
- `identities`
- `sessions`
- `email_verifications`
- `password_resets`
- `workspaces`
- `workspace_members`
- `workspace_invitations`
- `workspace_connections`
- `workspace_fugue_credentials`
- `workspace_onboarding`
- `product_audit_logs`
- `jobs`

## 11.3 Session 设计

推荐：

- HttpOnly cookie
- Secure
- SameSite=Lax
- 服务端 session 存储

不要：

- localStorage 存 token
- 浏览器直接存 Fugue tenant key

## 11.4 Fugue 凭证存储

`fugue-web` 数据库里需要存这些信息：

- fugue base URL
- tenant id
- default project id
- role-based Fugue API key secrets

这些 secret 必须：

- 服务端加密后存储
- 永不下发到浏览器
- 只在服务器调用 Fugue 时解密使用

## 11.5 代理策略

浏览器只请求自己域名下的产品 API：

- `/api/workspace/*`
- `/api/fugue/*`

服务端负责：

- 校验当前 session
- 解析当前 workspace 与 role
- 选择对应的 Fugue key profile
- 调用 Fugue API
- 统一错误处理
- 写 product audit

## 11.6 产品层审计

这一步必须补上。

因为 Fugue 当前只知道某个 API key 在调用，不知道真实产品用户是谁。

所以 `fugue-web` 要自己记录：

- user id
- workspace id
- product action
- mapped Fugue endpoint
- request id
- success / failure
- IP / user agent

这样未来排查问题才有闭环。

---

## 12. Fugue 集成方案

## 12.1 Hosted Workspace provisioning 顺序

产品后端对 Fugue 的自动开通顺序建议固定：

1. `POST /v1/tenants`
2. `POST /v1/projects`
3. `POST /v1/api-keys`
   - viewer
   - developer
   - operator
   - owner
4. `GET /v1/runtimes`
   - 识别 `runtime_managed_shared`
5. 保存映射关系

## 12.2 控制台页面到 Fugue API 的映射

| 产品页 | Fugue API |
| --- | --- |
| Workspace overview | `/v1/apps` `/v1/runtimes` `/v1/operations` `/v1/audit-events` |
| Projects | `/v1/projects` |
| Apps list | `/v1/apps` |
| App detail | `/v1/apps/{id}` |
| Env | `/v1/apps/{id}/env` |
| Files | `/v1/apps/{id}/files` |
| Bindings | `/v1/apps/{id}/bindings` |
| Build logs | `/v1/apps/{id}/build-logs` |
| Runtime logs | `/v1/apps/{id}/runtime-logs` |
| Import GitHub | `/v1/apps/import-github` |
| Rebuild | `/v1/apps/{id}/rebuild` |
| Deploy | `/v1/apps/{id}/deploy` |
| Restart | `/v1/apps/{id}/restart` |
| Scale / Disable | `/v1/apps/{id}/scale` `/v1/apps/{id}/disable` |
| Migrate | `/v1/apps/{id}/migrate` |
| Delete | `/v1/apps/{id}` |
| Runtimes | `/v1/runtimes` |
| Cluster nodes | `/v1/cluster/nodes` |
| Node keys | `/v1/node-keys` `/v1/node-keys/{id}/usages` |
| Audit | `/v1/audit-events` |

## 12.3 需要明确写进 UI 的 Fugue 限制

### GitHub import

- 支持 public repo
- private repo 需要 GitHub 网页授权或 token override

### Runtime logs

- 对 external runtime 不应假装可用
- 当 app 不在 managed runtime 上时，要给出明确说明

### Backing services

- 当前只做 inventory 展示
- 不要先做“Create database”按钮

### App / project metadata

- 当前没有完整 update API
- 不要先做大量“编辑 app 基本信息”表单

## 12.4 建议尽快给 Fugue 补的接口 / 能力

| 能力 | 优先级 | 用途 |
| --- | --- | --- |
| `GET /v1/whoami` | 高 | 识别 token 的 actor、tenant、scopes，尤其是 Connect Existing Fugue 模式 |
| acting-user / acting-session header 透传 | 高 | 让 Fugue audit 能记录产品层真实用户 |
| `GET /v1/summary` | 中 | overview 聚合，减少前端 N+1 请求 |
| 统一 request id 回传 | 中 | 方便 product audit 与 Fugue audit 对账 |
| OpenAPI / machine-readable schema | 中 | 自动生成 SDK / docs / contract tests |

---

## 13. 视觉组件与页面组件

## 13.1 Marketing 组件

- Hero
- Capability rail
- Workflow timeline
- Runtime topology diagram
- Quickstart block
- Console preview frame
- FAQ accordion
- CTA footer

## 13.2 Auth 组件

- Auth shell
- OAuth button group
- Email auth form
- Password strength hint
- Verification state
- Invite accept card

## 13.3 App 组件

- Workspace switcher
- App table
- Runtime table
- Node key table
- Operation timeline
- Audit table
- Log viewer
- Env editor
- File editor
- Import wizard
- Node join wizard
- Status badge
- Scope / role badge
- Empty state
- Skeleton
- Confirm dialog

---

## 14. SEO、内容与埋点

## 14.1 内容优先级

公开内容优先围绕真实能力：

- k3s control plane
- multi-tenant k3s
- deploy GitHub repo to k3s
- shared runtime then migrate to your own VPS
- attach VPS to control plane

## 14.2 必做文档

- Quickstart
- Deploy Fugue on 3 VPS
- Import from GitHub
- Attach a VPS
- Migrate an app
- Auth and workspaces

## 14.3 结构化数据

- `SoftwareApplication`
- `FAQPage`
- `BreadcrumbList`
- `Article`

## 14.4 核心埋点

Marketing：

- `hero_primary_cta_clicked`
- `docs_quickstart_opened`
- `architecture_page_viewed`

Auth：

- `signup_started`
- `signup_completed`
- `google_auth_started`
- `email_signup_completed`

Product：

- `workspace_provision_started`
- `workspace_provision_completed`
- `onboarding_checklist_completed`
- `github_import_started`
- `github_import_completed`
- `first_public_url_opened`
- `node_key_created`
- `first_runtime_attached`
- `first_migration_completed`
- `invite_sent`

---

## 15. 安全与边界

## 15.1 必须做到的安全项

- password hash
- session fixation / CSRF 防护
- 登录 rate limit
- OAuth state / PKCE
- Fugue key at-rest encryption
- one-time secret reveal
- 敏感操作二次确认

## 15.2 不要做的事情

- 不要把 Fugue tenant key 放进浏览器 localStorage
- 不要把 bootstrap key 放进前端环境变量
- 不要把 GitHub App installation 假装成现有实现
- 不要把“Create database”按钮做出来但背后没有 API

---

## 16. 非目标

第一版不要做这些：

- billing / paywall
- pricing table
- GitHub App installation
- custom domain management UI
- SSO / SCIM
- 移动端 App
- WebSocket 实时日志系统
- 自定义复杂调度策略界面

---

## 17. 分阶段实施

## Phase 0：架构定稿

目标：

- 定域名策略
- 定 `workspace -> tenant` 映射
- 定 auth / session / encryption

交付：

- 这份方案文档
- 数据库 schema 草案
- 环境变量清单

## Phase 1：Marketing + Auth

目标：

- 官网可上线
- Google / 邮箱注册可用
- 用户可登录进入产品

交付：

- 首页
- Product / Docs / Architecture / Security
- Sign up / Sign in / Verify / Reset

## Phase 2：Hosted Workspace 开通

目标：

- 用户注册后自动拥有 Fugue tenant
- 首次进入看到 onboarding

交付：

- workspace 创建
- provisioning job
- member / invite 基础能力
- hosted overview

## Phase 3：Console MVP

目标：

- 能完成核心控制面操作

交付：

- Apps list / detail
- Import GitHub wizard
- Runtimes / cluster nodes / node keys
- Operations / audit
- Env / files
- Build logs / runtime logs

## Phase 4：BYO Fugue + 管理后台

目标：

- 支持连接已有 Fugue
- 平台内部能看到全局状态

交付：

- Connect existing Fugue
- admin/system
- admin/tenants
- support tooling

---

## 18. MVP 完成标准

如果满足下面这些，就可以认为 `fugue-web` 第一版可上线：

1. 用户可通过 Google 或邮箱注册并登录
2. 注册后可自动创建 workspace
3. workspace 能自动映射到 Fugue tenant
4. 用户能在控制台导入 GitHub repo 并看到部署结果
5. 用户能创建 node key 并拿到 join 命令
6. 用户能查看 operations / audit / logs
7. 用户能邀请 teammate
8. 所有对 Fugue 的调用都经过服务端代理
9. 所有 Fugue secrets 都只在服务端保存
10. 公开站点能准确表达 “shared runtime -> own VPS migration” 这条产品主线

---

## 19. 最终建议

用一句话总结这次评估：

**现有 `frontend-website-plan.md` 适合作为“官网 + token 控制台”的基础，但不够支撑你现在要做的 `fugue-web`。完整方案必须升级成“官网 + 自有认证 + workspace + BFF + Fugue 自动开通”的产品层。**

具体建议如下：

- 保留现有文档中对 Fugue 产品定位、官网叙事和控制台 IA 的优点
- 把控制台主入口从 `token connect` 改成 `Google / email -> create workspace`
- `token connect` 降级为高级模式 `Connect existing Fugue`
- `fugue-web` 自己维护：
  - user
  - session
  - workspace
  - membership
  - encrypted Fugue credentials
  - product audit
- 前端不直连 Fugue API，统一走服务端代理
- 正式发布前最好把 `FUGUE_APP_BASE_DOMAIN` 从 `fugue.pro` 迁到 `apps.fugue.pro`

如果后续你要真正开始写代码，第一步不是先画首页，而是先把这 4 件事定死：

1. 域名结构
2. auth 方案
3. workspace 到 tenant 的映射
4. Fugue key 加密与代理策略

这 4 件事定住之后，整个前端和产品层后端就都顺了。

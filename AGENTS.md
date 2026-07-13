# AGENTS.md

本仓库是 `fugue` 的产品层前端 / Web 包装层。凡是涉及前端的任务，不允许只凭通用经验直接下手，必须先到 `$HOME/Downloads/GitHub/web-design/AGENTS.md` 里查对应 skill，再进入设计、实现、改版、评审或优化。

`fugue` 的底层仓库 / 核心实现目录位于 `$HOME/Downloads/GitHub/fugue`。凡是需要核对底层能力边界、共享对象模型、上游实现来源或 Web 包装层与产品核心之间的衔接关系时，优先参考该目录中的正式实现。

## 控制平面发布路径

- 凡是改动落到 `$HOME/Downloads/GitHub/fugue` 仓库，且影响 control plane、edge proxy、Caddy、Ingress、cluster bootstrap、registry、runtime 路由或平台级流量规则时，标准发布路径不是手改线上机器，而是回到 `fugue` 仓库走正式控制平面发布链路。
- 正常控制平面升级路径是：提交 `fugue` 仓库变更，`git push` 到 `main`，再由 `.github/workflows/deploy-control-plane.yml` 和其 self-hosted runner 更新远端控制平面。
- 不要把 `./scripts/install_fugue_ha.sh`、手工 `ssh` 改文件、手工重启服务、手工 patch Deployment、手工同步镜像，视为正常发布方式。
- 只有在用户明确要求紧急止血、线上恢复或现场调试例外时，才可以做手工线上热修；一旦这样做，必须在同一任务里把改动回写到 `fugue` 仓库，并明确说明正式发布仍应走 GitHub Actions 控制平面链路。
- 如果 `fugue` 仓库自己的 `AGENTS.md` 与本仓库规则不一致，以 `$HOME/Downloads/GitHub/fugue/AGENTS.md` 的控制平面发布要求为准。

## 线上排障入口

- 本机已安装 `fugue` CLI，并且终端通常已经配置 `FUGUE_API_KEY`；该 key 使用的是 `fugue` 的 `FUGUE_BOOTSTRAP_KEY`，理论上具备最高权限。线上调查时应优先用 `fugue` CLI 和当前环境变量查询控制平面、租户、项目、app、operation、runtime、cluster 状态。
- 运行 `fugue` 相关排障命令时，默认直接以 `fugue ...` 开头执行；不要把 `[ -f $HOME/Downloads/GitHub/fugue/.env ] && . $HOME/Downloads/GitHub/fugue/.env` 作为常规命令前缀。`fugue` CLI 会读取它需要的本地配置 / 环境入口。
- 如果 `fugue` CLI 无法满足调查需求，可以到 `$HOME/Downloads/GitHub/fugue/.env` 查看 `FUGUE_BOOTSTRAP_KEY`、`FUGUE_API_URL` 等后端排障入口，再直接请求控制平面 API。除用户明确要求查看 / 导出环境变量的场景外，对话总结、诊断归档、issue、PR、日志摘录中不要粘贴实际 secret。
- 如仍需要核对控制平面或集群现场状态，可以通过 `ssh` 登录相关节点：`ovhvpsuswest`、`ovhuseast`、`netcup`、`alicehk2`、`ovhvps`、`ovhvpseu`。默认只做只读调查；除非用户明确要求紧急止血、线上恢复或现场调试，不要把 SSH 上手工改文件、重启服务、patch Deployment、同步镜像当作正式修复路径。

## Fugue CLI 产品原则

- `fugue` CLI 是用户在自己机器或自己控制的服务器上操作生产系统的主要入口，默认体验要优先保证直接、可见、可复制；不要为了抽象安全感牺牲排障速度。
- `fugue app env ls/show <app>` 这类“用户主动查看配置”的命令，默认应显示真实环境变量值，方便肉眼确认、复制、迁移和对比。不要把这类输出默认明文视为 bug。
- `fugue app env export <app>` 应输出可直接复用的 `.env` 形态；需要跨机器迁移、旧 VPS 对比、Fugue 线上核查时，应优先提供一条命令拿到完整配置。
- `--redact`、`--show-secrets`、`--confirm-raw-output` 这类开关应按命令语义使用：env 查看 / 导出以可见为默认，容易被转发的诊断包、operation、status、CI 输出、debug bundle 默认可以隐藏敏感值。
- 用户通常希望“一条命令直接知道有没有设置正确”。格式校验、指纹、目标系统探测、连通性检查可以作为增强能力，但不能替代直接显示真实值。
- 调查配置问题时，优先直接对比旧环境与 Fugue 环境的实际值，尤其是 `APP_PUBLIC_URL`、OAuth callback、支付 callback、数据库 DSN、上游 API URL 等迁移关键项；最终回复里只总结差异和修复结果，不贴出无关 secret。

## 当前集群节点

- 控制平面节点：`ovhvpsuswest`
- 美国 agent 节点：`ovhuseast`
- 德国 agent 节点：`netcup`
- 香港 agent 节点：`alicehk2`
- Edge / DNS 节点：`ovhvps`、`ovhvpseu`

## 强制规则

以下任务都属于“前端相关”，开始前必须先调查 `$HOME/Downloads/GitHub/web-design/AGENTS.md`，并继续打开对应 `SKILL.md` 学习后再动手：

- 前端改动
- 前端架构
- 页面 / UI 设计与视觉风格
- 组件设计
- 设计系统
- React / Next.js 前端实现模式
- 动效、交互、创意编码
- 设计品味、视觉打磨、改版
- 可访问性、性能、测试、发布最佳实践
- 信息架构、SEO、埋点、CRO、onboarding

## 执行流程

每次遇到前端任务时，按这个顺序执行：

1. 先读 `$HOME/Downloads/GitHub/web-design/AGENTS.md`
2. 根据任务类型定位相关 skill
3. 打开对应 `SKILL.md`，只读当前任务真正需要的部分
4. 将 skill 里的方法落实到本仓库方案、代码、样式、组件或评审意见中
5. 在最终说明里明确写出本次参考了哪些 skill，以及它们影响了哪些设计或实现决策

如果一个任务同时涉及多个维度，例如“页面改版 + 设计系统 + 动效 + onboarding”，就必须组合调查多个 skill，不能只看一个。

## 任务到 skill 的最小映射

### 页面 / UI 设计与视觉风格

优先查看：

- `frontend-design`
- `ui-ux-pro-max`
- `design-taste-frontend`
- `high-end-visual-design`

### 组件、设计系统、前端架构

优先查看：

- `shadcn`
- `ckm:design-system`
- `vercel-composition-patterns`
- `vercel-react-best-practices`

### 动效、交互、创意表达

优先查看：

- `animate`
- `design-taste-frontend`
- `remotion-best-practices`
- `algorithmic-art`

### 设计品味、改版、打磨

优先查看：

- `design-taste-frontend`
- `high-end-visual-design`
- `redesign-existing-projects`
- `bolder`
- `quieter`
- `distill`
- `polish`

### 最佳实践、质量、审查

优先查看：

- `web-design-guidelines`
- `vercel-react-best-practices`
- `audit`
- `harden`
- `optimize`
- `webapp-testing`

### 信息架构、增长与转化

优先查看：

- `site-architecture`
- `page-cro`
- `signup-flow-cro`
- `onboarding-cro`
- `analytics-tracking`
- `seo-audit`
- `schema-markup`

## 实施标准

- 不要做通用 AI 套板式页面。
- 不要默认使用保守、平庸、无辨识度的布局和配色。
- 做布局优化、页面改版、信息架构收敛时，默认只能删除层级 / 信息，或重新排列现有层级 / 信息来改善体验；禁止为了“补完整”而新增信息、摘要、说明块、统计块、额外 section 或新的层级包装。只有用户明确要求新增信息，或产品需求本身新增了真实对象 / 状态时，才允许增加。
- 不要跳过 design system、组件一致性和响应式检查。
- 不要跳过可访问性、状态设计、空状态、错误状态和加载状态。
- 不要在未调查相关 skill 的情况下直接给出“最佳实践”结论。

## 本仓库补充要求

- 本仓库的前端需要同时服务 marketing、docs、auth、app console 几个层次，做页面和组件时必须考虑整站一致性，而不是只看单页。
- 任何新页面、新组件、新视觉方向，都应优先复用或沉淀成可复用模式，而不是散落一次性实现。
- 共享 UI、token、组件或页面骨架的唯一实现链是 `apps/ui/registry/default/*` -> `packages/ui/src/*`；产品 composition 位于 `apps/web/app` 与 `apps/web/components`。
- 涉及 `frontend-website-plan.md`、设计方案、页面结构、控制台 IA、auth flow、onboarding flow 的修改，也属于前端任务，同样必须先参考 `$HOME/Downloads/GitHub/web-design/AGENTS.md` 中的对应 skills。

## API 协作规范

- `fugue` 后端现在采用 OpenAPI-first。后端 HTTP API 的唯一权威来源是 `$HOME/Downloads/GitHub/fugue/openapi/openapi.yaml`。
- 不要把 README、抓包结果、控制台现有调用、临时返回体、测试桩、口头约定当作 API 真源。
- 当前可直接查看的权威 API 产物包括：
  - `$HOME/Downloads/GitHub/fugue/openapi/openapi.yaml`
  - 后端运行时暴露的 `/openapi.yaml`
  - 后端运行时暴露的 `/openapi.json`
  - 后端运行时暴露的 `/docs`
- 本仓库与 OpenAPI 相关的派生产物包括：
  - `$HOME/Downloads/GitHub/fugue-web/apps/web/openapi/fugue.yaml`
  - `$HOME/Downloads/GitHub/fugue-web/apps/web/lib/fugue/openapi.generated.ts`
- 这两个文件都是从后端权威契约派生出来的，禁止手写维护、禁止直接当作“可以随手修”的本地事实源。
- 当前端任务涉及 API 接入、字段消费、鉴权方式、请求体、响应体、轮询、日志流、上传、下载、错误处理时，必须先对照上述权威契约。
- 如果前端发现后端行为与 OpenAPI 契约不一致，应优先视为后端契约/实现漂移问题，不能直接在前端写“猜测性兼容”并把错误固化下来。

## 新增或更新 API 的跨仓库流程

凡是需求涉及新增接口、修改接口、删除接口、改字段、改鉴权、改 content-type、改上传下载协议，按这个顺序执行：

1. 先在 `$HOME/Downloads/GitHub/fugue/openapi/openapi.yaml` 修改契约。
2. 在 `fugue` 仓库生成并校验后端产物：
   - `make generate-openapi`
   - `make test`
3. 再更新 `fugue` 后端 handler、测试和必要的 README 摘要。
4. 最后回到本仓库同步和生成前端契约产物：
   - `npm run openapi:sync`
   - `npm run openapi:generate`
5. 然后再更新本仓库里的前端调用、状态处理、错误提示、空状态和 loading 状态。
6. 最后执行前端契约校验：
   - `npm run contract:check`

- 禁止反过来先在前端发明字段，再要求后端事后补齐。
- 禁止只改前端 mock 或本地类型而不核对后端权威契约。
- 禁止只在 README 里加接口说明却不更新底层 OpenAPI 契约。

## 前端消费 API 的实现要求

- 优先从权威 OpenAPI 契约推导请求/响应结构，不要散落手写重复类型。
- `apps/web/lib/fugue/openapi.generated.ts` 是生成文件，禁止手改。
- `apps/web/lib/fugue/api.ts` 的职责是：
  - 基于生成出来的 OpenAPI 类型和 client 做请求。
  - 只在确实需要兼容前端现有 view model 时，做薄适配。
- 不要重新引入以前那套基于 `unknown` + `sanitize*` 的大段手写响应解析器，除非后端协议确实无法在 OpenAPI 中表达。
- 如果本仓库已经存在与后端对象同义的本地 TypeScript 类型，修改 API 时必须同步检查这些类型是否与契约一致。
- 前端对错误态的处理不能只覆盖 `200` 成功流，至少要考虑：
  - 权限错误
  - 参数错误
  - 资源不存在
  - 长任务进行中 / 空结果
  - 流式接口或上传接口失败
- 对于日志流、上传、下载、轮询这类接口，不要凭经验假设协议细节，必须核对后端契约和实际实现。

## 评审要求

- 评审 API 相关前端改动时，先核对 `$HOME/Downloads/GitHub/fugue/openapi/openapi.yaml`，再看页面代码。
- 再核对 `$HOME/Downloads/GitHub/fugue-web/apps/web/openapi/fugue.yaml` 和 `$HOME/Downloads/GitHub/fugue-web/apps/web/lib/fugue/openapi.generated.ts` 是否已经同步。
- 如果需求需要改 API，但 PR 里没有对应的后端契约变更或没有明确说明“后端已完成在哪个提交/分支”，应视为信息不完整。
- 如果 `npm run contract:check` 没跑过或已经失败，视为 API 改动未完成。

## 前端 CI 契约检查

- 本仓库的契约漂移检查工作流位于 `$HOME/Downloads/GitHub/fugue-web/.github/workflows/contract-drift.yml`。
- 该工作流会从 `yym68686/fugue` 拉取后端仓库，用后端真实 `openapi/openapi.yaml` 对本仓库执行：
  - `npm run openapi:sync:check`
  - `npm run openapi:generate:check`
  - `npm run typecheck`
- 如果 CI 报 snapshot drift 或 generated drift，不要在前端临时兼容；先同步 OpenAPI snapshot/codegen，再修真正受影响的前端逻辑。

## 当前 COSS 架构基线

- 本仓库完整采用 [`cosscom/coss`](https://github.com/cosscom/coss) 的 workspace、registry、Base UI、shared package 和工具链架构，不把“视觉相似”视为完成。当前固定参考提交为 `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`。
- `$HOME/Downloads/GitHub/morlane`、`design-system/morlane.css`、`ml-*`、`fg-*`、`fp-*` 和现有手写 COSS 组件只作为迁移输入或历史兼容层，不再是目标设计系统，不得继续扩展为平行 primitive 系统。
- COSS 上游是混合许可证：`apps/ui/`、`apps/origin/` 为 MIT，仓库默认和 `packages/ui/` 为 AGPL-3.0-or-later。复制上游源码前必须记录 commit、source path、license、local path 与本地修改；未完成许可证评审时禁止复制 AGPL source。
- 不迁移 COSS 的 Cal.com 业务对象、品牌、营销内容、页面 IA 或示例数据；只采用工程边界、组件架构、交互模型与允许使用的 UI source。

## Workspace 与工具链

- 根目录使用 Bun、Turborepo 和 Biome，workspace 固定覆盖 `apps/*`、`apps/examples/*`、`packages/*`。
- 正式产品运行时位于 `apps/web/`；UI 文档与 shadcn registry 位于 `apps/ui/`；Fugue 组合示例位于 `apps/examples/fugue-console/`。
- 共享运行时 UI package 位于 `packages/ui/`，严格 TypeScript 基线位于 `packages/typescript-config/`。
- 根 scripts 统一编排 format、lint、typecheck、test、build、OpenAPI contract、registry validate/build/sync-check、bundle、audit 与 license 检查；不得在 package 中建立彼此矛盾的第二套规则。
- React 与 Next.js 版本必须在 workspace 内唯一，并保持在已修复安全版本；禁止使用无上界的 `latest`。

## Registry 到 package 的单向规则

- `apps/ui/registry/default/ui` 是 primitive 唯一人工维护源；hooks、lib 和 Base UI adapter 的唯一来源分别位于同一 registry tree 的对应目录。
- `packages/ui/src/components`、`packages/ui/src/hooks`、`packages/ui/src/lib` 与 `packages/ui/src/base-ui` 是同步产物。禁止直接修改 synced 文件；所有变更先改 registry source，再运行同步并通过 drift check。
- 产品应用只通过显式子路径消费共享 UI，例如 `@fugue/ui/components/button`、`@fugue/ui/hooks/use-mobile`；禁止从总 barrel import 扩大客户端 bundle。
- registry item 必须声明准确的 `registryDependencies`、外部 dependencies、files、categories 和 target；registry build 产物必须可校验、可安装、可复现。
- 引入上游组件先使用 shadcn CLI 的 dry-run/diff 检查，再落入本仓库 registry source；不得静默覆盖本地组件。

## 组件与设计系统规则

- 活跃 primitive 基础统一为 Base UI，组合 API 使用 Base UI `render`，不新增 Radix `asChild` 路线。
- 组件使用 Tailwind CSS v4、semantic CSS variables、`data-slot`、CVA 与 `cn()`；token 按 `primitive -> semantic -> component` 三层组织，应用页面不得局部硬编码重写组件颜色和 typography。
- 运行时字体边界固定为 `packages/ui/src/fonts` 中的 `next/font/local` 定义，经 `@fugue/ui/fonts` 由每个应用根 layout 注入 CSS variables，再由 semantic font token 消费；registry font metadata 只描述外部安装依赖，不得用全局 Fontsource CSS import 绕过共享运行时。
- React/Next.js 默认 Server Component；只有 hooks、浏览器 API、交互状态或 Base UI 客户端 primitive 边界才声明 `"use client"`。不要因一个交互控件把整个页面提升为 Client Component。
- 优先使用现有 registry primitive 和 composition；只有现有 primitive 无法组合真实产品状态时才新增组件，并同时补文档、示例、键盘行为、disabled/loading/empty/error 状态和测试。
- 图标只使用设计系统指定的 icon library；按钮、菜单项与输入附属图标遵守共享尺寸与 `aria-hidden` 规则，不手写 SVG。
- 必须保留可见 focus、键盘操作、屏幕阅读器语义、forced-colors、200% zoom、`prefers-reduced-motion` 和移动端响应式。

## 跨页面产品边界

### Marketing

- 使用 COSS semantic token 和 registry primitive 组合现有真实内容与 CTA；不复制 COSS/Cal.com 文案，也不新增虚构能力、统计块或额外信息层级。

### Auth

- 使用真实 `<form>`、`Field`/`FieldGroup`、明确 label/name/type/autocomplete 和可恢复状态；Google、GitHub、邮箱、密码、验证码、回跳失败与限流都必须有一致语义。

### Docs

- 由 `apps/ui` 的文档/registry 基础设施承载 UI 文档；产品 docs 保证目录、正文、表格、code、note 和移动阅读体验，不混入 marketing 级装饰。

### App Console

- 使用 `@fugue/ui` primitive 和应用层 composition 实现 sidebar、topbar、page header、table、resource row、dialog、drawer、empty/error/loading；服务端权限边界与 UI shell 必须同时成立。

## 前端运行时立场

- auth、product shell、session、受保护页面、route handler 和 console 骨架在 `apps/web/` 中继续作为正式产品实现；不得回退到静态样张。
- 权限判断在 server layout、route handler 或 server action 完成；客户端失败态不是访问控制。
- OpenAPI generated client 与产品 view model 保持薄适配；不能为了 UI 迁移重新引入手写未知响应解析器。
- 迁移顺序固定为 workspace/toolchain -> registry/package -> primitive -> shell -> vertical slice；迁移期间不得同时扩展 Morlane、手写 COSS 和 `@fugue/ui` 三套系统。
- 不在仓库根维护版本化 landing 预览目录；示例必须进入 `apps/examples/`，正式方向直接更新运行时、registry 与文档。

## 维护与变更规则

- 任何影响全站的改动，至少同时检查：
  - 响应式
  - 可读性和对比度
  - `prefers-reduced-motion`
  - 动态场景失败后的 fallback
  - loading / empty / error / disabled 状态
- 新组件先判断能否由现有模式组合得到；不能组合时再新增，并及时回写到本文件。
- 修改 workspace 边界、registry 同步规则、核心 token、字体、primitive API、package export 或路径语法时，必须同步更新本 `AGENTS.md`、provenance 和迁移文档。
- 任何 `packages/ui` diff 都必须能由 registry source 和同步脚本重新生成；CI 必须阻止双写漂移。

## 当前推荐的 skill 组合

- 做 COSS primitive / registry：优先用 `shadcn`
- 做 tokens / 可复用组件沉淀：优先组合 `extract` + `ckm:design-system`
- 做跨页面一致性收敛：优先用 `normalize`
- 做设计品味与最终质感把关：优先组合 `design-taste-frontend` + `high-end-visual-design` + `polish`
- 做 React / Next.js 落地：优先组合 `vercel-react-best-practices` + `vercel-composition-patterns`
- 做安全、性能与验收：优先组合 `harden` + `optimize` + `webapp-testing`

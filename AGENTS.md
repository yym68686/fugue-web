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
- 已沉淀出的共享实现种子位于 `design-system/`；当任务目标是共享 UI、token、组件或页面骨架时，优先复用这里，再结合 `app/`、`components/` 里的当前已落地实现继续抽取。
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
  - `$HOME/Downloads/GitHub/fugue-web/openapi/fugue.yaml`
  - `$HOME/Downloads/GitHub/fugue-web/lib/fugue/openapi.generated.ts`
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
- `lib/fugue/openapi.generated.ts` 是生成文件，禁止手改。
- `lib/fugue/api.ts` 的职责是：
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
- 再核对 `$HOME/Downloads/GitHub/fugue-web/openapi/fugue.yaml` 和 `$HOME/Downloads/GitHub/fugue-web/lib/fugue/openapi.generated.ts` 是否已经同步。
- 如果需求需要改 API，但 PR 里没有对应的后端契约变更或没有明确说明“后端已完成在哪个提交/分支”，应视为信息不完整。
- 如果 `npm run contract:check` 没跑过或已经失败，视为 API 改动未完成。

## 前端 CI 契约检查

- 本仓库的契约漂移检查工作流位于 `$HOME/Downloads/GitHub/fugue-web/.github/workflows/contract-drift.yml`。
- 该工作流会从 `yym68686/fugue` 拉取后端仓库，用后端真实 `openapi/openapi.yaml` 对本仓库执行：
  - `npm run openapi:sync:check`
  - `npm run openapi:generate:check`
  - `npm run typecheck`
- 如果 CI 报 snapshot drift 或 generated drift，不要在前端临时兼容；先同步 OpenAPI snapshot/codegen，再修真正受影响的前端逻辑。

## 当前设计基线

- 当前视觉与交互唯一基线是 `$HOME/Downloads/GitHub/morlane`。本仓库现有样式、组件外观、布局和视觉风格不再作为参考；只把现有页面里的真实信息、状态、表单字段、操作和业务约束迁移进 Morlane 的界面语言。
- 当前设计系统入口是 `design-system/morlane.css`，并由 `design-system/index.css` 统一导入。`design-system/tokens.css`、`design-system/components.css`、`design-system/platform.css` 只保留为历史路径占位，不允许继续承载旧 Fugue 视觉。
- `components/platform/`、`components/ui/`、`components/console/` 等 React 组件可以继续作为行为和语义封装使用，但最终视觉必须由 Morlane token、Morlane 布局密度和 Morlane 组件材质覆盖。
- `fg-*`、`fp-*` 类名只允许作为迁移期 DOM class 或历史 API 名称存在；不得把它们当作旧视觉基线，也不得新增依赖旧 Fugue / Cloudflare / cinematic 风格的样式规则。

## Morlane Design DNA

### 设计系统层

- 色彩基线：
  - 画布底色：`#f6f7f8`
  - 主表面：`#ffffff`
  - 次级表面：`#f1f3f5`
  - 主文本：`#17191c`
  - 次文本：`#646b73`
  - 弱文本：`#8b929a`
  - 主边框：`#d8dde3`
  - 强调色：`#1463ff`
- 字体基线：
  - 主字体使用 `Inter`，代码、对象标识、命令和技术值使用 `IBM Plex Mono`
  - 只有左上角 / sidebar 的 `Fugue` wordmark 保留原品牌字体 `Syne`
  - 其他标题、面板、表格、按钮、表单和正文不使用 `Syne`、`Manrope` 或其他旧 Fugue 展示字体
  - 标题、按钮、表格对象名和表单标签都应紧凑、清晰、低装饰
- 布局基线：
  - Console / admin 使用左侧导航 + 顶部栏 + 内容工作区的密集产品布局
  - Marketing 使用简洁顶部导航 + split hero + 产品面板，不使用沉浸式暗场或动态背景秀场
  - Auth 使用居中表单卡片，不使用左右叙事 stage
  - Docs 使用左侧目录 + 内容正文 + 小型 note / table / code 组件
- 形状与材质：
  - 默认圆角为 `6px`，卡片和弹窗可到 `8px`
  - 表面以白底、浅灰边框、轻阴影和明确分隔为主
  - 禁止玻璃拟态、霓虹发光、CRT、扫描线、噪点、巨型装饰字和背景特效
- 动效基线：
  - 只保留必要的 hover、focus、loading、dialog transition
  - 不为装饰效果引入 Canvas / WebGL / shader
  - `prefers-reduced-motion` 下必须降低或移除非必要 motion

## Token 种子

- 扩展设计系统时，按 `primitive -> semantic -> component` 三层 token 架构拆分，不要散落硬编码值。
- 当前 Morlane 种子：

```css
/* primitive */
--ml-bg: #f6f7f8;
--ml-surface: #ffffff;
--ml-surface-2: #f1f3f5;
--ml-text: #17191c;
--ml-muted: #646b73;
--ml-faint: #8b929a;
--ml-border: #d8dde3;
--ml-accent: #1463ff;

/* semantic */
--fugue-color-surface-canvas: var(--ml-bg);
--fugue-color-surface-raised: var(--ml-surface);
--fugue-color-text-primary: var(--ml-text);
--fugue-color-text-secondary: var(--ml-muted);
--fugue-color-border-default: var(--ml-border);
--fugue-color-accent: var(--ml-accent);
```

## 可复用界面模式

- `ml-app-shell`: sidebar + topbar + page work area
- `ml-card`: compact panel / section container
- `ml-table`: dense product table
- `ml-button`: primary / secondary / danger / ghost controls
- `ml-segmented`: view switch
- `ml-form`: stacked field + validation + helper text
- `ml-auth-panel`: centered auth card
- `ml-docs-shell`: docs rail + content layout
- `ml-terminal`: lightweight command / log preview panel

这些模式优先从 `design-system/morlane.css` 和 morlane 仓库继续抽取，不从本仓库旧实现重新发明。

## 跨页面适配边界

### Marketing

- 使用 Morlane 的 light-first split hero、白色产品面板、浅灰背景和克制 CTA。
- 只迁移当前真实存在的信息和链接，不新增营销层级或虚构能力。

### Auth

- 使用居中 `ml-auth-panel`，表单主体优先。
- Google 登录、邮箱注册、验证码 / 邮件发送、表单校验、加载、失败、回跳失败、空状态都必须有明确状态。

### Docs

- 使用 `ml-docs-shell`，优先保证目录、正文、表格、code block 和 note 的可读性。
- 禁止引入动态背景或 marketing 级视觉效果。

### App Console

- 使用 Morlane 的密集后台产品布局：sidebar、topbar、page header、metric、table、resource row、dialog、drawer、empty/error/loading。
- 按钮默认使用 `primary / secondary / danger / ghost` 分层；局部视图切换默认使用 segmented control。
- Console 不使用 landing hero、叙事 stage、旧 route-signal / proof-shell / object-belt 视觉。

## 前端架构立场

- 正式产品运行时优先落在：
  - `app/`
  - `components/`
  - `lib/`
  - `app/api/auth/*`
- auth、product shell、session、受保护页面或 console 骨架，优先从这些目录继续实现，不要回退到历史静态样张思路。
- 共享 token、layout primitive、button / form / panel 组件优先抽到 `design-system/` 或正式组件层。
- 不再在仓库根维护版本化 landing 预览目录；影响全站的视觉方向变更应直接更新正式基线与文档。

## 维护与变更规则

- 任何影响全站的改动，至少同时检查：
  - 响应式
  - 可读性和对比度
  - `prefers-reduced-motion`
  - 动态场景失败后的 fallback
  - loading / empty / error / disabled 状态
- 新组件先判断能否由现有模式组合得到；不能组合时再新增，并及时回写到本文件。
- 修改核心视觉 token、字体、主按钮结构、面板材质、路径语法时，必须同步更新本 `AGENTS.md`。

## 当前推荐的 skill 组合

- 做设计 DNA 抽取：优先用 `design-dna`
- 做 tokens / 可复用组件沉淀：优先组合 `extract` + `ckm:design-system`
- 做跨页面一致性收敛：优先用 `normalize`
- 做设计品味与最终质感把关：优先组合 `design-taste-frontend` + `high-end-visual-design` + `polish`
- 做 React / Next.js 落地：优先组合 `vercel-react-best-practices` + `vercel-composition-patterns`

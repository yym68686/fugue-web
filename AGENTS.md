# AGENTS.md

本仓库是 `fugue` 的产品层前端 / Web 包装层。凡是涉及前端的任务，不允许只凭通用经验直接下手，必须先到 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md` 里查对应 skill，再进入设计、实现、改版、评审或优化。

`fugue` 的底层仓库 / 核心实现目录位于 `/Users/yanyuming/Downloads/GitHub/fugue`。凡是需要核对底层能力边界、共享对象模型、上游实现来源或 Web 包装层与产品核心之间的衔接关系时，优先参考该目录中的正式实现。

## 强制规则

以下任务都属于“前端相关”，开始前必须先调查 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md`，并继续打开对应 `SKILL.md` 学习后再动手：

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

1. 先读 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md`
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
- 不要跳过 design system、组件一致性和响应式检查。
- 不要跳过可访问性、状态设计、空状态、错误状态和加载状态。
- 不要在未调查相关 skill 的情况下直接给出“最佳实践”结论。

## 本仓库补充要求

- 本仓库的前端需要同时服务 marketing、docs、auth、app console 几个层次，做页面和组件时必须考虑整站一致性，而不是只看单页。
- 任何新页面、新组件、新视觉方向，都应优先复用或沉淀成可复用模式，而不是散落一次性实现。
- 已沉淀出的共享实现种子位于 `design-system/`；当任务目标是共享 UI、token、组件或页面骨架时，优先复用这里，再结合 `app/`、`components/` 里的当前已落地实现继续抽取。
- 涉及 `frontend-website-plan.md`、设计方案、页面结构、控制台 IA、auth flow、onboarding flow 的修改，也属于前端任务，同样必须先参考 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md` 中的对应 skills。

## API 协作规范

- `fugue` 后端现在采用 OpenAPI-first。后端 HTTP API 的唯一权威来源是 `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml`。
- 不要把 README、抓包结果、控制台现有调用、临时返回体、测试桩、口头约定当作 API 真源。
- 当前可直接查看的权威 API 产物包括：
  - `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml`
  - 后端运行时暴露的 `/openapi.yaml`
  - 后端运行时暴露的 `/openapi.json`
  - 后端运行时暴露的 `/docs`
- 本仓库与 OpenAPI 相关的派生产物包括：
  - `/Users/yanyuming/Downloads/GitHub/fugue-web/openapi/fugue.yaml`
  - `/Users/yanyuming/Downloads/GitHub/fugue-web/lib/fugue/openapi.generated.ts`
- 这两个文件都是从后端权威契约派生出来的，禁止手写维护、禁止直接当作“可以随手修”的本地事实源。
- 当前端任务涉及 API 接入、字段消费、鉴权方式、请求体、响应体、轮询、日志流、上传、下载、错误处理时，必须先对照上述权威契约。
- 如果前端发现后端行为与 OpenAPI 契约不一致，应优先视为后端契约/实现漂移问题，不能直接在前端写“猜测性兼容”并把错误固化下来。

## 新增或更新 API 的跨仓库流程

凡是需求涉及新增接口、修改接口、删除接口、改字段、改鉴权、改 content-type、改上传下载协议，按这个顺序执行：

1. 先在 `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml` 修改契约。
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

- 评审 API 相关前端改动时，先核对 `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml`，再看页面代码。
- 再核对 `/Users/yanyuming/Downloads/GitHub/fugue-web/openapi/fugue.yaml` 和 `/Users/yanyuming/Downloads/GitHub/fugue-web/lib/fugue/openapi.generated.ts` 是否已经同步。
- 如果需求需要改 API，但 PR 里没有对应的后端契约变更或没有明确说明“后端已完成在哪个提交/分支”，应视为信息不完整。
- 如果 `npm run contract:check` 没跑过或已经失败，视为 API 改动未完成。

## 前端 CI 契约检查

- 本仓库的契约漂移检查工作流位于 `/Users/yanyuming/Downloads/GitHub/fugue-web/.github/workflows/contract-drift.yml`。
- 该工作流会从 `yym68686/fugue` 拉取后端仓库，用后端真实 `openapi/openapi.yaml` 对本仓库执行：
  - `npm run openapi:sync:check`
  - `npm run openapi:generate:check`
  - `npm run typecheck`
- 如果 CI 报 snapshot drift 或 generated drift，不要在前端临时兼容；先同步 OpenAPI snapshot/codegen，再修真正受影响的前端逻辑。

## 当前设计基线

- 当前视觉与交互基线来源按优先级读取：
  1. `design-system/tokens.css`
  2. `design-system/components.css`
  3. `design-system/component-specs.md`
  4. `components/landing/`、`components/console/`、`app/` 中的当前正式实现
- 这里要求继承的不是“整站都长得像 landing page”，而是继承颜色纪律、字体配对、版式张力、材质处理、动效克制和信息组织方法。
- 当前核心命题不是“炫技背景”，而是：`route is the product`。页面结构、auth handoff、docs 叙事、console onboarding 都应围绕这个命题展开。

## Design DNA

### 设计系统层

- 色彩基线：
  - 画布底色使用近黑而不是纯黑：`#040506`、`#0a0c10`、`#10161d`
  - 文本使用暖象牙而不是冷白：`#f4efe7`、`#c9c1b4`、`#8f8a82`、`#6c6761`
  - 单一强调色使用去饱和蓝灰：`#a5bfdc`
  - 线框依赖低对比 hairline：`rgba(255,255,255,0.16)`、`0.10`、`0.06`
- 字体基线：
  - 标题字体：`Syne`
  - 正文字体：`Manrope`
  - 系统注释、对象名、命令、标签：`IBM Plex Mono`
  - 标题必须压缩字距、低行高；正文要克制；mono 只用于元信息和技术对象，不要大面积正文滥用
  - 文案大小写默认使用 `sentence case` 或 `title case`；禁止整词全大写，禁止依赖 `text-transform: uppercase` 把 UI 文案强转成全大写，也不要把普通 UI 标签、按钮、状态、导航项写成整词全小写
  - 缩写优先改写成完整词或常规大小写。只有命令、环境变量、协议字面量、代码示例、技术单位，以及 URL / 域名 / 邮箱 / branch / slug 这类必须保真的技术内容可以保留原始大小写
- `Syne` 只用于 display / brand / marketing 级标题，不用于 panel、modal、table、console、docs 这类严肃产品界面的主标题
- 严肃产品场景的标题默认使用基于 `Manrope` 的 `ui heading` 语义，追求更高识别度、更稳的字腔和更低的阅读摩擦
- 在产品层尤其是 console 内，不允许把 `--fugue-font-heading` / `Syne` 直接用于 summary metric 数值、workspace 名、表格主对象、topbar brand wordmark 或任何数据读数；这些都必须回到 `--fugue-font-ui-heading` 或 `--fugue-font-body`
- 布局基线：
  - Hero 默认使用非对称 split composition，不做居中 SaaS hero
  - 内容宽度参考 `--max-width: 1400px`、`--content-width: 1180px`
  - 重要段落采用大区块节奏和明显的上下文切换，不做碎片化小卡片拼盘
- 形状与材质：
  - 默认使用大圆角、胶囊按钮、低对比边线、带内高光的硬件感表面
  - 玻璃 / 半透明表面只用于真正需要悬浮感的区域；一旦影响可读性，优先改成高不透明度表面
  - 不靠夸张外发光营造高级感，优先使用边线、内阴影、分层渐变和背景深度
- 动效基线：
  - 默认 easing 使用 `ease-out-expo`、`ease-out-quint`、`ease-out-quart`
  - 进入动效以 `opacity + translate + blur` 为主，不动画布局属性
  - 整页只允许一个主角级效果，不要多个抢戏特效同时竞争注意力

### 风格层

- 气质关键词：`cinematic`、`authored`、`controlled`、`atmospheric`、`technical`、`premium`
- 视觉比喻：不是抽象 AI 平台，而是“在电流/气流中保持路由不变的控制平面”
- 构图方法：
  - 用左侧或左下的文字锚点建立叙事重心
  - 用右侧 rail、path、object belt、proof shell 提供技术语义
  - 用完整背景场而不是一个被框住的小模块建立气氛
- 信息风格：
  - 文案必须具体、克制、可验证，避免空泛的“下一代”“无缝”“智能化”套话
  - 只展示今天真实存在的产品边界；未实现能力只能作为 next shell，不准伪装成已上线
- 明确禁止：
  - 通用 AI 套板式首页
  - 居中大标题压死整个背景
  - 默认三栏等宽功能卡片
  - 紫色 / 霓虹 / 赛博蓝发光污染
  - 纯透明面板导致内容漂浮
  - 为了“极客”而加入无产品语义的噪音元素

### 效果层

- Landing 的特效重点不是单个 logo，而是“full-bleed live field + CRT / scan / noise / glare 分层”。
- Hero 效果必须铺满开场区域，不能被框进右侧卡片或局部容器。
- 推荐的背景层顺序：
  1. 实时场景层：Canvas / WebGL / shader
  2. 径向补光层：radial light
  3. 方向性压光层：gradient veil
  4. 颗粒层：noise
  5. 扫描线层：scanline
  6. 高光层：glare
- 噪点、扫描线、高光都是附属层，只能增强氛围，不能破坏可读性。
- 必须保留 graceful fallback：
  - 动态场景失败时，退回静态 gradient scene
  - `prefers-reduced-motion` 时保留层次但降运动
  - 任何情况下都不允许出现空白 hero 或突然断层

## Token 种子

- 扩展设计系统时，必须按 `primitive -> semantic -> component` 三层 token 架构拆分，不要长期依赖散落的硬编码值。
- 推荐维持以下种子：

```css
/* primitive */
--bg-0: #040506;
--bg-1: #0a0c10;
--bg-2: #10161d;
--text-0: #f4efe7;
--text-1: #c9c1b4;
--text-2: #8f8a82;
--text-3: #6c6761;
--accent-0: #a5bfdc;
--line-0: rgba(255, 255, 255, 0.16);
--line-1: rgba(255, 255, 255, 0.10);
--line-2: rgba(255, 255, 255, 0.06);

/* semantic */
--surface-canvas: var(--bg-0);
--surface-subtle: var(--bg-1);
--surface-raised: var(--bg-2);
--text-primary: var(--text-0);
--text-secondary: var(--text-1);
--text-tertiary: var(--text-2);
--text-muted: var(--text-3);
--accent-signal: var(--accent-0);
--border-strong: var(--line-0);
--border-default: var(--line-1);
--border-subtle: var(--line-2);
```

## 可复用界面模式

- `floating-pill masthead`
- `button-in-button CTA`
- `segmented view switch`
- `stage-note rail`
- `runway-strip`
- `route-signal`
- `proof-shell`
- `object-belt`
- `project-gallery workbench`

这些模式优先从 `design-system/` 和当前正式实现抽取，不要重新发明。

## 跨页面适配边界

### Marketing

- 可以使用完整的开场氛围、背景场和章节级戏剧张力。
- 但即便在 marketing，也要坚持“只说当前真实能力”的边界。

### Auth

- 必须继承颜色、字体配对、按钮结构、mono 标签和面板材质。
- 桌面 auth 双栏默认按 `1:1` 分配宽度；左侧 stage 是叙事辅助，不得挤压右侧主表单。
- 桌面 auth 表单列默认是右半边里的窄列居中，不把登录表单直接拉满整个右半屏。
- 窄屏 auth 第一屏必须先看到表单主体；左侧 stage 在窄屏只保留必要品牌锚点，不保留大段介绍。
- auth 主表单容器默认直接融入画布，不使用独立背景、table-like 外框或分段边线；信息分隔优先靠留白和局部 divider。
- submit CTA 默认使用 product primary；provider、cancel、secondary action 默认不带 icon island。
- 背景效果强度降到 marketing 的 `25% - 35%`；表单才是主角。
- Google 登录、邮箱注册、验证码 / 邮件发送、表单校验、加载、失败、回跳失败、空状态都必须明确设计，不准只做成功态。

### Docs

- 继承 mono 标签、proof shell、route / path 图示、object belt 和线框纪律。
- 以可读性、导航清晰度和信息层级为先；动态背景只能弱化为静态或极低频效果。
- 高密度阅读区域优先使用 `ui heading`。

### App Console

- 可以继承调色、面板语言、按钮体系、路径隐喻和对象命名语法。
- 按钮默认使用 `primary / secondary / danger / inline` 分层；`ghost` 只用于三级或 dismissive action。
- 局部视图切换默认使用 segmented control。
- current page、segmented 当前项、file pill 当前文件应使用同一套 raised lens 状态语言。
- Console 不能直接搬用 landing hero、超大 ghost wordmark、整屏动态秀场或长篇 thesis copy。
- page intro、panel title、dialog title、empty-state title 默认都使用 `ui heading`。

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

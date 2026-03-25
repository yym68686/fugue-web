# AGENTS.md

本仓库是 `fugue` 的产品层前端 / Web 包装层。凡是涉及前端的任务，不允许只凭通用经验直接下手，必须先到 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md` 里查对应 skill，再进入设计、实现、改版、评审或优化。

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
- 已沉淀出的共享实现种子位于 `design-system/`；当任务目标是共享 UI、token、组件或页面骨架时，优先复用这里，再回看 `versions/v8-unicorn-template/` 的页面级实现。
- 涉及 `frontend-website-plan.md`、设计方案、页面结构、控制台 IA、auth flow、onboarding flow 的修改，也属于前端任务，同样必须先参考 `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md` 中的对应 skills。

## 当前默认设计基线（v8）

- 当前 `fugue-web` 的默认视觉北极星是 `versions/v8-unicorn-template/`。
- 未来做 landing、auth、docs、console 时，除非用户明确要求另起风格，否则默认以 `v8` 继续演化，不要每次重新发明一套视觉语法。
- `v8` 的视觉真源按优先级读取：
  1. `versions/v8-unicorn-template/styles.css`
  2. `versions/v8-unicorn-template/index.html`
  3. `versions/v8-unicorn-template/design.md`
- `design-system/` 是 `v8` 的第一层实现抽取：
  - 做共享 token、共享组件、auth/docs/console 基础壳子时，先读 `design-system/tokens.css`、`design-system/components.css`、`design-system/component-specs.md`
  - 只有当共享层里还没有对应模式时，才回到 `v8` 页面级文件继续抽取
- 这里要求继承的不是“整站都长得像 landing page”，而是继承它的颜色纪律、字体配对、版式张力、材质处理、动效克制和信息组织方法。
- `v8` 的核心命题不是“炫技背景”，而是：`route is the product`。页面结构、auth handoff、docs 叙事、console onboarding 都应围绕这个命题展开。

## v8 Design DNA

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
  - 缩写优先改写成完整词或常规大小写；普通 UI 文案默认首字母大写。只有命令、环境变量、协议字面量、代码示例、`KB` / `MB` / `GB` / `TB` 这类行业约定的技术单位，以及 URL / 域名 / 邮箱 / branch / slug 这类必须保真的技术内容可以保留原始大小写
- `Syne` 只用于 display / brand / marketing 级标题，不用于 panel、modal、table、console、docs 这类严肃产品界面的主标题
- 严肃产品场景的标题默认使用基于 `Manrope` 的 `ui heading` 语义，追求更高识别度、更稳的字腔和更低的阅读摩擦
- 在产品层尤其是 console 内，不允许把 `--fugue-font-heading` / `Syne` 直接用于 summary metric 数值、workspace 名、表格主对象、topbar brand wordmark 或任何数据读数；这些都必须回到 `--fugue-font-ui-heading` 或 `--fugue-font-body`
- 布局基线：
  - Hero 默认使用非对称 split composition，不做居中 SaaS hero
  - 内容宽度参考 `--max-width: 1400px`、`--content-width: 1180px`
  - 重要段落采用大区块节奏和明显的上下文切换，不做碎片化小卡片拼盘
- 形状与材质：
  - 默认使用大圆角、胶囊按钮、低对比边线、带内高光的硬件感表面
  - 玻璃/半透明表面只用于真正需要悬浮感的区域；一旦影响可读性，优先改成高不透明度表面
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
  - 紫色/霓虹/赛博蓝发光污染
  - 纯透明面板导致内容漂浮
  - 为了“极客”而加入无产品语义的噪音元素

### 效果层

- `v8` 的特效重点不是单个 logo，而是“full-bleed live field + CRT/scan/noise/glare 分层”。
- Hero 效果必须铺满开场区域，不能被框进右侧卡片或局部容器。
- 推荐的背景层顺序：
  1. 实时场景层：Unicorn / Canvas / WebGL / shader
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

- 未来如果把 `v8` 迁移到 React / Next.js，必须按 `primitive -> semantic -> component` 三层 token 架构拆分，不要继续长期依赖散落的硬编码值。
- 推荐从 `v8` 提炼出以下种子：

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

/* component */
--button-route-bg: linear-gradient(145deg, rgba(244, 239, 231, 0.98), rgba(224, 215, 202, 0.94));
--button-primary-bg: linear-gradient(180deg, rgba(31, 40, 52, 0.98), rgba(15, 20, 27, 0.96));
--button-secondary-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(165, 191, 220, 0.030)), rgba(11, 14, 19, 0.96);
--button-secondary-border: rgba(255, 255, 255, 0.16);
--button-ghost-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(165, 191, 220, 0.012)), rgba(8, 10, 14, 0.38);
--button-ghost-border: rgba(255, 255, 255, 0.12);
--button-danger-bg: linear-gradient(180deg, rgba(106, 44, 44, 0.42), rgba(69, 24, 24, 0.30)), rgba(17, 10, 10, 0.92);
--selection-lens-hover-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.050), rgba(165, 191, 220, 0.018)), rgba(12, 16, 22, 0.76);
--selection-lens-active-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.095), rgba(165, 191, 220, 0.045)), rgba(17, 21, 28, 0.96);
--selection-lens-active-border: rgba(165, 191, 220, 0.24);
--selection-lens-text: rgba(244, 239, 231, 0.82);
--segmented-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.006)), rgba(6, 8, 12, 0.88);
--segmented-active-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.080), rgba(165, 191, 220, 0.030)), rgba(17, 21, 28, 0.96);
--rail-card-bg: linear-gradient(180deg, rgba(10, 12, 18, 0.64), rgba(8, 10, 14, 0.38));
--proof-shell-bg: linear-gradient(145deg, rgba(16, 22, 29, 0.98), rgba(7, 10, 14, 0.96));
--signal-path-color: var(--accent-signal);
```

## 可复用界面模式

- `floating-pill masthead`
  - 导航不是贴边扁条，而是 detached 的悬浮控件
  - 如果 nav 存在 current page / current shell 状态，当前项必须使用和 segmented control 一致的 raised selection lens；不能只靠字色变化
- `button-in-button CTA`
  - 只有 route 级 CTA 保留嵌套的小圆形 icon island；product primary / secondary / danger 默认回到更安静、状态更清晰的无岛按钮
  - product `secondary` 必须在静态态就保留可辨认的边框和轻填充；`ghost` 只用于三级或 dismissive action，不作为产品层默认按钮
- `segmented view switch`
  - `Environment / Files / Logs`、`Variables / Raw`、`Build / Runtime` 这类局部视图切换必须使用共享 segmented control，而不是独立按钮
  - segmented control 的选中态必须在静态态就足够明确；整组要被读成一个 mutually exclusive set，而不是一排零散 CTA
  - segmented、file pill、stateful pill nav 的选中态默认共用同一套 `selection lens` 材质语言：quiet hover + raised active lens；只允许根据上下文调节托盘密度和圆角，不允许各自发明一套 active fill
  - 如果 segmented control 和 action button 出现在同一条 control rail，外层高度必须统一；默认对齐到 compact control height，不要和 `tight` 按钮混排
- `stage-note rail`
  - 右侧的 route 注释卡可以复用于 onboarding、流程页、integration 说明，但要保持相同的材质语言
- `runway-strip`
  - `01 / repo`、`02 / shared`、`03 / attached` 这类 runway strip 是整站的重要结构原型，可复用于步骤页和 onboarding
- `route-signal`
  - 路径线不是装饰，可复用于进度、迁移、拓扑、对象关系说明
- `proof-shell`
  - 命令块、API 证明块、terminal proof 区优先使用双层 bezel 外壳，而不是裸 `pre`
- `object-belt`
  - `workspace / project / app / runtime / operation` 这类 mono belt 是对象语义层，后续 docs 和 console 可继续复用
- `project-gallery workbench`
  - Projects 默认使用纵向 gallery 流而不是统计卡网格；卡片摘要只负责项目名和 stack 方块，展开后在卡片内部进入左右分栏工作台：左侧操作当前 app，右侧切换项目内服务

## 跨页面适配边界

### Marketing

- 可以使用完整的 `v8` 强度：全幅场景、ghost wordmark、hero rail、章节级戏剧张力。
- 但即便在 marketing，也要坚持 “只说当前真实能力” 的边界，不允许把 auth、private repo、future console 包装成已交付。

### Auth

- Auth 页必须继承 `v8` 的颜色、字体配对、按钮结构、mono 标签和面板材质。
- Auth 的 submit CTA 默认使用 product primary；provider、cancel、secondary action 默认不带 icon island，避免表单区疲劳。
- Auth 的效果强度降到 marketing 的 `25% - 35%`；表单才是主角，背景只能做低频 atmosphere。
- 可以保留轻微的扫描线、颗粒、路径语法，但不能让用户输入区漂在透明噪声上。
- Auth 左侧 stage 可以保留 display typography，但表单面板标题、状态标题、modal 标题必须切到更清晰的 `ui heading`
- Google 登录、邮箱注册、验证码/邮件发送、表单校验、加载、失败、回跳失败、空状态都必须明确设计，不准只做成功态。

### Docs

- Docs 应继承 mono 标签、proof shell、route/path 图示、对象 belt 和线框纪律。
- Docs 优先可读性、导航清晰度和信息层级；动态背景只能弱化为静态或极低频效果。
- Docs 的标题可以沿用 `Syne`，但正文密集内容必须以阅读舒适性优先。
- Docs 一旦进入高密度阅读或工具式结构，章节标题优先改为 `ui heading`，不要为保持风格而牺牲辨识度。

### App Console

- Console 可以继承 `v8` 的调色、面板语言、按钮体系、路径隐喻和对象命名语法。
- Console 按钮默认使用 `primary / secondary / danger / inline` 角色分层；`ghost` 只用于三级或行内 dismissive 动作，只有 shell 级 route handoff 才允许沿用 icon island CTA。
- Console 内的局部视图切换默认使用 segmented control：例如 `Environment / Files / Logs`、`Variables / Raw`、`Build / Runtime`，不要复用 action button 的语义和视觉
- Console nav 的 current page、segmented 当前项、file pill 当前文件应使用同一套 raised lens 状态语言；不要再出现只有文字变亮、缺少材质反馈的孤立选中态
- Console 不能直接搬用 marketing hero、超大 ghost wordmark、整屏动态秀场或长篇 thesis copy。
- Console 优先做高信息密度但有呼吸的工具界面：更多边线分组、对象层次、状态设计，少做 marketing 式情绪铺垫。
- Console 的 page intro、panel title、dialog title、empty-state title 默认都使用 `ui heading`，不要继续沿用 landing 的 `Syne`
- Console 的 metric card 主数值、workspace / object 主字段、shell brand wordmark 也一律视为产品 UI，不允许因为“更显眼”而切回 `Syne`
- 如果需要动效，只能使用低幅度、功能性的反馈动效；不要在数据区堆积氛围特效。

### 只允许在 Marketing 使用的要素

- 全屏 live scene / Unicorn 背景
- 巨大的 ghost wordmark
- 强戏剧化 hero 开场和大段 thesis copy
- 版本 compare strip

### 可安全迁移到 Auth / Docs / Console 的要素

- 颜色体系和文字层级
- `Syne + Manrope + IBM Plex Mono` 的字体配对
- 胶囊按钮、状态矩阵和 route CTA 的 icon island 结构
- 低对比边线、双层 bezel、proof shell
- route signal / runway / object belt 这些信息结构原型

## 前端架构立场

- `versions/*` 继续作为设计分支和视觉档案存在，不需要全部 React 化。
- 正式产品层（auth、docs、console）应逐步落到 React / Next.js 上。
- 当前正式产品运行时已经落在：
  - `app/`
  - `components/`
  - `lib/`
  - `app/api/auth/*`
- 因此后续如果任务目标是 auth、product shell、session、受保护页面或 console 骨架，优先从这些目录继续实现，而不是回到静态 landing 目录里打补丁。
- 只有最终选定的 landing 版本才迁入正式产品代码；历史版本保留为参考样张。
- 当产品层开始实现时，优先抽共享 tokens、layout primitives、button/form/panel 组件，不要把 landing 的静态 HTML 直接整体搬进 app。

## 维护与变更规则

- 后续如果出现明显偏离 `v8` 的新视觉方向，先判断是局部演化还是新版本分支：
  - 局部演化：继续在现有基线内提纯
  - 新风格分支：创建新的 `versions/vX-*`，不要悄悄把基线改掉
- 任何影响全站的改动，至少同时检查：
  - 响应式
  - 可读性和对比度
  - `prefers-reduced-motion`
  - 动态场景失败后的 fallback
  - loading / empty / error / disabled 状态
- 新组件先判断能否由现有模式组合得到；不能组合时再新增，并及时回写到本文件。
- 修改核心视觉 token、字体、主按钮结构、面板材质、路径语法时，必须同步更新本 `AGENTS.md`，把它继续当成当前风格的源文档之一。

## 当前推荐的 skill 组合

- 做 `v8` 风格抽取：优先用 `design-dna`
- 做 tokens / 可复用组件沉淀：优先组合 `extract` + `ckm:design-system`
- 做跨页面一致性收敛：优先用 `normalize`
- 做设计品味与最终质感把关：优先组合 `design-taste-frontend` + `high-end-visual-design` + `polish`
- 做 React / Next.js 落地：优先组合 `vercel-react-best-practices` + `vercel-composition-patterns`

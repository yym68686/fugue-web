# Fugue Landing Page 方案 3

## 为什么前两版不够好

### v1 的问题

- 有气质，但偏“技术杂志封面”，产品路径不够锋利
- 结构还是常规 marketing page，记忆点不够集中
- Serif + warm paper 有辨识度，但还没把 `GitHub -> shared -> VPS` 做成唯一视觉主线

### v2 的问题

- 换成了 dark terminal 语汇，但骨架仍然是常规 landing page
- 仍然依赖左文案右仪表盘，这太像常见 AI 生成的 SaaS hero
- 信息块过多，导致“看起来更复杂”，但不是“更有设计判断”
- route trace 是对的，但周围模块太多，把主角冲淡了

结论：

**第三版必须不是“换一套皮肤”，而是换一套构图逻辑。**

## 概念名

**Swiss Technical Atlas**

这版不是控制台截图，也不是编辑杂志，而是：

**一张把产品迁移路径印成大幅技术海报的首页。**

## 风格目标

让首页更像下面这些东西的混合体：

- 1960s Swiss industrial manual
- 铁路 / 航线路线图
- 工程手册封面
- 产品发布海报

不要像：

- 深色 hacker dashboard
- 普通白底 SaaS 官网
- 赛博朋克 landing page

## 核心设计判断

### 1. 只保留一个 hero 动作

整页最强的视觉动作就是一条大尺度 route line：

**GitHub -> shared runtime -> user VPS**

它横穿首屏和后续 section，让整个页面像一份迁移路线图，而不是一堆模块。

### 2. 极端版式，不做常规左右分栏

Hero 采用：

- 左上：品牌与 nav
- 中上：巨大标题，跨越多列
- 中段：斜向 route map / anchor points
- 下段：两个 CTA + 极少量 supporting copy

不是“左文案右产品卡片”。

### 3. 去掉绝大多数卡片思维

不用 dashboard box 堆功能。

改为：

- 巨型排版
- 全宽 row
- 细分隔线
- 极少数真正需要被框起来的 command / proof 区域

### 4. light substrate but hard attitude

继续使用 `industrial-brutalist-ui`，但切到 **Swiss Industrial Print** 模式。

原因：

- 更少见
- 更适合做海报化构图
- 能把“技术感”从黑客终端换成“工程印刷物”

## 视觉系统

### Typography

- Display: `Oswald`
- Body: `Instrument Sans`
- Mono: `IBM Plex Mono`

原则：

- Display 字体要窄、硬、能撑起巨型标题
- Body 不能再用太中庸的通用 sans
- Mono 只承担坐标、命令、状态、技术标签

### Color Tokens

#### Primitive

```text
paper-0      #f3f0e8
paper-1      #ebe6db
ink-0        #0d0d0d
ink-1        #1a1a1a
graphite-0   #4d555e
graphite-1   #7b858f
signal-red   #d63b2e
signal-red-2 #f14d3d
signal-green #287a46
```

#### Semantic

```text
bg.canvas       = paper-0
bg.surface      = rgba(255,255,255,0.55)
bg.rule         = rgba(13,13,13,0.12)
text.primary    = ink-0
text.secondary  = graphite-0
text.muted      = graphite-1
accent.primary  = signal-red
accent.soft     = rgba(214,59,46,0.12)
status.live     = signal-green
```

### Material

- 页面底色是工程纸，不是纯白
- 只有一个强 accent：signal red
- 通过网格、registration marks、规则线、轻噪点建立质感
- 不用玻璃、不用 glow、不用大阴影

## 页面结构

1. Masthead
2. Atlas Hero
3. Route Statement
4. Three operational bands
5. System objects board
6. Quickstart evidence strip
7. FAQ / objections
8. Final CTA block

## 组件模式

### Route Anchor

路线图上的三个大节点：

- GitHub
- Shared
- VPS

它们不是普通 chips，而是整页视觉坐标。

### Operational Band

全宽水平条带，每条只解释一个动作：

1. import
2. deploy
3. migrate

每条只放：

- 序号
- 标题
- 简短解释
- 关键字段

### Evidence Strip

Quickstart 不做一个胖代码卡片，而是像技术资料页：

- 左侧 command block
- 右侧 current surface / current boundary

## 动效规则

动效比前两版更少，但更精确：

1. 首屏排版 stagger reveal
2. route line draw
3. route anchors hover 时联动 band / object 高亮
4. FAQ 和 mobile menu 基础反馈

不再做 dashboard-like pulsing modules。

## 这版的 taste 原则

- **Bolder**: 通过更极端的构图和字号对比，而不是更多效果
- **Distill**: 删除常规 feature card / panel 堆叠
- **Arrange**: 用大面积留白和长线性结构建立节奏
- **Typeset**: 让标题层级更有压迫感，正文更克制
- **Colorize**: 只用一个 red 作为命令性强调

## 参考过的 skills

- `frontend-design`
  - 要求明确 aesthetic lane，不能只是“换个主题”
- `critique`
  - 用来判断 v2 为什么仍然像常规 AI landing page
- `redesign-existing-projects`
  - 决定不在现有暗色 dashboard 骨架上修补，而是直接换构图逻辑
- `bolder`
  - 把重点放在更大尺度对比、更强 focal point，而不是特效
- `distill`
  - 砍掉多余模块和卡片感
- `typeset`
  - 强化 display type 与 body hierarchy
- `arrange`
  - 把页面节奏从“块状堆叠”改成长线性海报节奏
- `colorize`
  - 保持单一 red accent，不回到黑灰单调也不引入太多颜色
- `industrial-brutalist-ui`
  - 使用 Swiss Industrial Print 路线，而不是 CRT terminal
- `page-cro`
  - 保证即使风格更强，CTA 和价值主张仍然清楚
- `animate`
  - 只保留真正服务理解的动效

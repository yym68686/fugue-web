# Fugue Landing Page 方案 2

## 概念名

**Tactical Telemetry**

这是一个更极客、更系统控制台导向的落地页方向。它不走温暖编辑感，也不走廉价赛博朋克，而是把产品包装成一块可读、可信、硬边的控制面板。

一句话定义：

**像一套正在运行的 control plane 仪表板，被压缩成了首页。**

## 目标

首页仍然只做三件事：

1. 让用户在 5 秒内看懂 Fugue 的核心路径
2. 让“GitHub -> shared runtime -> user VPS”的迁移逻辑一眼可见
3. 把用户稳定推向两个动作：
   - `Create Workspace`
   - `Read Quickstart`

## 风格方向

### 选择的 archetype

采用 `industrial-brutalist-ui` 里的 **Tactical Telemetry & CRT Terminal** 路线，而不是 Swiss light print。

### 气质关键词

- control plane
- telemetry
- operation log
- route trace
- hard edge
- mechanical
- exact

### 明确避免

- 紫色 / 蓝色 AI 渐变
- 霓虹 cyberpunk
- 柔和玻璃卡片
- 圆润 SaaS 模板
- 没意义的 fake metrics

## 记忆点

这一版最应该被记住的不是一张“好看的 hero 图”，而是：

**中间那条从 repo 到 shared runtime，再到 user VPS 的红色 route trace。**

## 视觉系统

### Typography

- Headline: `Archivo`
- Body: `Manrope`
- Data / nav / labels: `IBM Plex Mono`

原则：

- 大标题全部用重型 sans，uppercase，强压缩
- 数据层、标签层、命令层统一用 mono
- 正文保持可读性，不把整页都变成“代码块”

### Color Tokens

#### Primitive

```text
coal-0      #0b0d0f
coal-1      #111418
coal-2      #171c21
coal-3      #20262d
fog-0       #f2f4f6
fog-1       #d4d9de
fog-2       #9ca6af
hazard-0    #d73a2f
hazard-1    #ff6a55
signal-0    #59e58a
```

#### Semantic

```text
bg.canvas       = coal-0
bg.surface      = coal-1
bg.panel        = coal-2
bg.panel-strong = coal-3
text.primary    = fog-0
text.secondary  = fog-1
text.muted      = fog-2
accent.primary  = hazard-0
accent.soft     = rgba(215, 58, 47, 0.18)
status.live     = signal-0
border.subtle   = rgba(242, 244, 246, 0.10)
border.strong   = rgba(242, 244, 246, 0.20)
```

### Material

- 全页深灰，不用纯黑
- 只保留一个主强调色：hazard red
- terminal green 只用于 live 状态点
- 通过 1px 分隔线、扫描线、弱噪点制造硬件感

## 版式策略

### Hero

仍然是非居中 hero：

- 左侧：价值主张、CTA、四个 signal cells
- 右侧：telemetry board

### 页面结构

1. Console Nav
2. Hero + Telemetry Board
3. Operational Surface Strip
4. Primary Route Rows
5. Object Model Board
6. Quickstart + Surface Matrix
7. FAQ
8. Final CTA

### 布局原则

- 不做 3 个等宽 feature cards
- 用硬边 row / rail / board 结构代替 SaaS 卡片墙
- 页面在桌面端允许更高信息密度，移动端必须彻底回落为单列

## 动效原则

只做 4 类动效：

1. Hero stagger reveal
2. Route trace draw
3. Hover / focus 高亮不同 route segment
4. FAQ、移动菜单、copy button 的反馈动效

规则：

- 只动画 `transform` 和 `opacity`
- 使用 `ease-out-expo` / `ease-out-quart`
- 必须支持 `prefers-reduced-motion`

## 组件模式

### Signal Cell

首页上半部分的四个小控制单元：

- 输入不是 feature card
- 它们像仪表盘的可点亮区块
- hover 时联动 hero 右侧 telemetry board

### Telemetry Module

hero 右侧的 3 个核心模块：

- repo intake
- deploy operation
- runtime topology

### Route Row

用于解释产品主路径：

- 左：序号
- 中：标题与价值
- 右：关键字段或状态

比普通 feature card 更像操作手册。

## 这版相对 v1 的区别

- 从“编辑感基础设施”切到“战术遥测控制面”
- 从暖白纸感切到深灰硬件感
- 从 serif 标题切到 heavy sans + mono
- 从柔和叠层面板切到 rigid grid 和 diagnostic rails

## 参考过的 skills

- `industrial-brutalist-ui`
  - 决定 dark substrate、mono telemetry、硬边几何、scanline/noise
- `design-taste-frontend`
  - 避免通用 SaaS 模板；坚持非居中 hero、避免等宽三栏卡片
- `high-end-visual-design`
  - 控制 section 节奏、按钮内部结构、进场动效层级
- `frontend-design`
  - 明确这版的“唯一记忆点”是 route trace，而不是堆装饰
- `ckm:design-system`
  - 用 primitive / semantic / component token 组织 CSS 变量
- `page-cro`
  - 保持 CTA 清晰、价值主张 5 秒可读、Quickstart 和边界说明真实
- `animate`
  - 只保留高价值动效，避免为了“炫”而把页面做重

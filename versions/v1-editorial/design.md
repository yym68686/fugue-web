# Fugue Landing Page 设计方案

## 1. 页面目标

落地页不是普通 SaaS 首页，也不是文艺品牌页。它必须同时完成 3 件事：

1. 让第一次看到 Fugue 的用户在 5 秒内明白产品是什么
2. 让用户理解 Fugue 最独特的路径：
   - 从 GitHub 导入
   - 先部署到 shared runtime
   - 再迁移到自己的 VPS
3. 把用户引向两个明确动作：
   - `Create Workspace`
   - `Read Quickstart`

## 2. 目标人群

优先服务这 4 类人：

- 有 k3s / VPS 背景的独立开发者
- 小团队、agency、AI 产品开发者
- 想先快上线，再迁到自有机器的用户
- 关心多租户、审计、节点接入的平台管理员

## 3. 落地页的核心信息

首页必须始终围绕这句话组织：

**Deploy from GitHub on shared k3s. Move to your own VPS when you are ready.**

副信息只补 4 个事实，不要散：

- Multi-tenant control plane
- Shared managed runtime
- Bring your own VPS
- Operations and audit trail

## 4. 风格方向

## 4.1 概念名

**Editorial Infrastructure**

这不是“赛博朋克云平台”，也不是“普通白底 SaaS 模板”。

它要把两种气质压在一起：

- `Editorial`
  - 有文化感、排版感、节奏感
- `Infrastructure`
  - 有控制面、操作流、节点关系、状态可信度

最终感觉应该像：

- 一本精致的现代技术杂志
- 外加一个克制的控制室界面

## 4.2 气质关键词

- 编排
- 乐谱
- 迁移
- 结构化
- 精密
- 冷静
- 有温度但不软

## 4.3 明确排除

不要出现这些：

- AI 紫色渐变
- 霓虹蓝发光球
- 传统 3 栏 SaaS 模板
- 巨量玻璃拟态
- 大面积假代码雨
- 过重的黑客 / cyberpunk 语言

## 5. 版式策略

## 5.1 首页采用非居中 Hero

Hero 不做居中大标题。

采用：

- 左侧：价值主张 + CTA
- 右侧：产品画面 + 操作流演示

这符合几个目标：

- 避免模板感
- 信息进入更快
- 更适合承载真实产品画面

## 5.2 页面结构

首页建议固定为 8 个 section：

1. Floating Nav
2. Hero
3. Capability Rail
4. Migration Story
5. Object Model
6. Proof / Quickstart
7. FAQ / Objection Handling
8. Final CTA

## 5.3 空间节奏

- section 间距用大留白
- 不堆满屏卡片
- 关键内容放在 2 到 3 个密度峰值里
- 页面整体节奏是：
  - 开场强识别
  - 中段结构解释
  - 后段信任与行动

## 6. 视觉系统

## 6.1 色彩

### Primitive Tokens

```text
paper-0      #f7f3ea
paper-1      #efe7da
ink-0        #111111
ink-1        #1d1d1d
slate-0      #41505c
slate-1      #6a7a86
teal-0       #0f8b7a
teal-1       #7ed8c7
amber-0      #c78a2c
amber-1      #efd4a7
rust-0       #9f4b33
rust-1       #d9896d
```

### Semantic Tokens

```text
bg.canvas        = paper-0
bg.surface       = #fbf8f2cc
bg.panel         = #fffdf9
text.primary     = ink-0
text.secondary   = slate-0
text.muted       = slate-1
border.subtle    = #d9cfbf
border.strong    = #bcae97
status.active    = teal-0
status.pending   = amber-0
status.error     = rust-0
accent.primary   = ink-0
accent.secondary = teal-0
```

### 页面使用规则

- 主背景用暖白，不用纯白
- 文字尽量深墨，不用硬黑
- 强调色只保留 `teal`
- `amber` 只给 pending / timeline / operation
- `rust` 只用于 destructive / failed

## 6.2 字体

- Hero / section title：`Fraunces`
- 正文与导航：`IBM Plex Sans`
- 命令、URL、状态标签、日志：`IBM Plex Mono`

### 字体使用原则

- Serif 只出现在 marketing 标题中
- Console 截图与技术内容只用 Sans + Mono
- 页面必须形成“文化感标题 + 技术感正文”的张力

## 6.3 网格

- 桌面：12 列
- 内容宽度：`max-w-[1400px]`
- Hero 左右列比例：`5 / 7`
- 重要卡片圆角偏大，但不做夸张泡泡 UI

## 6.4 材质

页面不是平面白板。

使用这 4 类轻材质：

- 极浅纸感底纹
- 细线网格
- 低透明度面板
- 轻微 inset 高光

但不要做大面积玻璃。

## 7. Hero 详细设计

## 7.1 布局

### 左侧

- eyebrow：
  - `MULTI-TENANT K3S CONTROL PLANE`
- H1：
  - 两到三行断句
  - 大号衬线
- supporting copy：
  - 2 行到 3 行
  - 解释 GitHub import + shared runtime + migrate to VPS
- CTA group：
  - Primary：`Create Workspace`
  - Secondary：`Read Quickstart`
  - Text link：`See Migration Flow`
- capability chips：
  - Public GitHub import
  - Shared runtime
  - Bring your own VPS
  - Audit trail

### 右侧

一个“编排面板”而不是普通产品截图。

由 3 层组成：

1. 顶层：GitHub repo input 卡片
2. 中层：operation timeline 卡片
3. 底层：runtime topology 卡片

三张卡片轻微错位叠放，像控制室里的三块信息板。

## 7.2 Hero 视觉重点

Hero 最让人记住的点必须是：

**一条从 GitHub 指向 shared runtime，再转向 user VPS 的迁移路径线。**

这条线会：

- 穿过右侧卡片
- 在不同 section 继续被引用
- 成为整页视觉母题

## 7.3 Hero 文案建议

### H1 方案 A

**Ship from GitHub now. Move to your own VPS later.**

### H1 方案 B

**Deploy on shared k3s first. Migrate to your own runtime when ready.**

### Supporting copy

Fugue gives you a multi-tenant k3s control plane with GitHub import, a managed shared runtime, and a clean path to attach and migrate onto your own VPS.

### CTA 文案

- Primary：`Create Workspace`
- Secondary：`Read Quickstart`
- Inline：`See how migration works`

## 8. 各 section 设计

## 8.1 Floating Nav

导航不是贴边顶栏。

采用悬浮胶囊式导航：

- 左：Fugue logo
- 中：Product / Docs / Architecture / Security
- 右：Sign in / Create Workspace

风格：

- 顶部留白
- 半透明暖白底
- 细边框
- 微弱 blur 只允许用于 nav 本身

## 8.2 Capability Rail

不是普通三栏 feature 卡。

做成横向结构化条带：

- 3 个主 capability
- 每个 capability 一句话说明
- 一条细线把 3 段串起来

3 个点：

1. Import from public GitHub
2. Run fast on shared runtime
3. Attach your own VPS and migrate

## 8.3 Migration Story

这是整页第二重点。

做成 5 步流程叙事：

1. Create workspace
2. Import repo
3. Deploy to shared runtime
4. Attach a VPS
5. Migrate app

### 视觉方式

- 横向编号时间线
- 每步都有一个小 panel
- hover 时 panel 高亮，对应路径线亮起

## 8.4 Object Model

这一段专门解释 Fugue 不是“又一个部署按钮”。

可视化关系：

- Workspace
- Project
- App
- Runtime
- Operation

布局方式：

- 左：解释性标题
- 右：节点图

节点图不是技术架构图大图，而是高度抽象的产品模型图。

## 8.5 Proof / Quickstart

不要 fake customer logos。

信任建立要基于真实产品能力：

- quickstart command
- current capability list
- operation states
- one-time secret reveal semantics

建议这一段拆成左右：

- 左：Quickstart code block
- 右：What is available now

### “What is available now” 卡片建议

- GitHub import
- Shared runtime
- Node key onboarding
- App migrate
- Build logs / runtime logs
- Audit trail

## 8.6 FAQ / Objection Handling

首页 FAQ 不要太多，控制在 5 个：

1. Is this a hosted PaaS?
2. Do I need my own k3s cluster first?
3. Can I migrate an app to my own VPS later?
4. Does it support private GitHub repositories?
5. What is already available in the current product?

FAQ 的作用不是补信息，而是处理疑虑。

## 8.7 Final CTA

最后 CTA 不做大横幅模板。

做成一个沉稳的“invitation panel”：

- 左：一句话总结价值
- 右：双按钮

按钮：

- `Create Workspace`
- `Read Quickstart`

底部加一行小字：

- `Advanced users can also connect an existing Fugue control plane later.`

## 9. 组件风格细节

## 9.1 卡片

卡片用“双层边框”思路：

- 外层：壳体
- 内层：内容面

效果：

- 比普通 1px card 更有质感
- 但不会像玻璃拟态那样油腻

## 9.2 按钮

Primary button：

- 深墨底
- 暖白字
- 右侧内嵌小圆形箭头

Secondary button：

- 透明底
- 细边框
- hover 时底色轻微升温

## 9.3 标签 / badge

badge 不要彩色胶囊堆满页。

只保留三类：

- neutral
- active
- pending

## 9.4 代码块

Quickstart 区块要像真实 CLI，不要像装饰品。

风格：

- 深色底
- 细边框
- 左上有环境标签
- 复制按钮
- 支持 command highlight

## 10. 动效方案

动效必须服务理解，不服务炫技。

## 10.1 动效总原则

- 一页只有一个 signature motion
- 其余都做反馈型动效
- 全部遵守 `prefers-reduced-motion`
- 只用 `transform + opacity`

## 10.2 Signature Motion

整页的 signature motion 就是：

**“迁移路径线被逐段点亮”**

触发点：

- 页面首屏加载
- 用户滚动到 Migration Story
- hover 某个 capability / step

## 10.3 Hero 动效

- nav 延迟淡入
- eyebrow、H1、copy、CTA 依次 reveal
- 右侧三层 panel 轻微错位上浮
- 路径线最后点亮

时长：

- 180ms 到 700ms 之间
- 不使用夸张 bounce

## 10.4 微交互

- 按钮 hover：轻微位移与阴影变化
- 复制命令：按钮变为 `Copied`
- capability hover：对应路径和卡片高亮
- FAQ 展开：柔和高度过渡

## 10.5 Scroll Reveal

section reveal 规则：

- 轻微 fade-up
- 最大位移不超过 24px
- 不要每个元素都单独花哨出现

## 11. 移动端策略

## 11.1 Hero

桌面 split layout 到移动端必须直接折叠为单列：

- 标题在上
- CTA 其后
- 编排面板在下

不要在移动端保留错位重叠太多的卡片。

## 11.2 导航

- mobile 用全屏 sheet
- 菜单出现方式为 fade + slide
- 不做复杂 morphing

## 11.3 时间线

桌面横向时间线改为纵向步骤流。

## 11.4 Quickstart

代码块要支持横向滚动，但默认不溢出页面容器。

## 12. 转化策略

## 12.1 主 CTA

主 CTA 全页都统一为：

- `Create Workspace`

不要在不同 section 乱变成：

- Try now
- Get started
- Open console

## 12.2 次 CTA

统一为：

- `Read Quickstart`

## 12.3 CTA 布局策略

- 首屏必须有
- Migration Story 之后再重复一次
- 页尾再重复一次

## 12.4 反对点处理

页面里必须主动回答这些疑虑：

- 这是不是成熟 hosted PaaS？
- 我是不是必须先有自建集群？
- 能不能以后迁到自己的机器？
- private repo 支持到什么程度？

## 13. 文案语气

语气应当：

- 精确
- 冷静
- 有技术可信度
- 不夸张

不要写：

- magical
- effortless
- revolutionary
- AI-native cloud platform

更适合的写法是：

- import
- deploy
- attach
- migrate
- inspect
- audit

## 14. 实现前的素材准备

开始写页面前，建议先准备这些资产：

1. 一个简化版控制台截图
2. 一个可定制的 topology diagram 组件
3. Quickstart 命令内容
4. FAQ 最终文案
5. `available now` 能力列表

## 15. 最终落地方向

如果只用一句话总结这个落地页：

**它应该看起来像一个“有排版品味的基础设施产品首页”，让用户一眼明白 Fugue 不是普通 PaaS，而是一条从 shared runtime 通往自有 VPS 的清晰迁移路径。**

这个页面最重要的不是“酷”，而是：

- 有辨识度
- 有结构
- 有可信度
- 有转化能力

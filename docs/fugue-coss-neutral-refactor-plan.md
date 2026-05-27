# Fugue 对齐 coss neutral surface 的整体重构方案

## 1. 目标

把 Fugue 的前端从“品牌化、戏剧化、页面差异很大”的状态，收敛成“neutral surface、清晰边框、统一间距、低噪音组件”的产品系统。

这不是把 Fugue 直接复制成 coss，而是借用 coss 的设计纪律：

- neutral canvas，而不是强情绪背景
- 1px hairline border，而不是多层 bezel
- 统一 spacing rhythm，而不是页面各自为政
- 低噪音组件，而不是每个页面都在讲不同故事
- 统一的按钮、面板、表单、空状态、加载状态

最终结果应该是：

- `auth` 看起来像一个成熟的登录流程
- `docs` 看起来像一个克制的阅读与导航系统
- `console` 看起来像一个密度统一的工作台
- `landing` 仍然保留品牌感，但不再喧宾夺主

## 2. 方向判断

这个重构的重点不是“换皮”，而是“收敛视觉语法”。

Fugue 目前最大的观感问题，不是单个组件丑，而是不同页面用了不同的视觉语言：

- `app/landing.css` 偏电影化、层数多、噪音重
- `app/console.css` 偏密，但密度规则不够统一
- `components/ui/*` 有共享基础，但状态、边框、间距还不够像一个系统
- `design-system/*` 已经有 token 和基线，但现在仍然偏品牌化、偏深色、偏故事化

对齐 coss 的目标，可以概括为一句话：

> 让用户觉得自己一直在同一个产品里，而不是在几个相似但不同的前端里跳转。

## 3. 现状问题

### 3.1 颜色和 surface 过于戏剧化

当前 `design-system/tokens.css` 里包含很多 layered background、gradient、shadow、glare、scan、noise 相关变量。它们能制造气氛，但会让产品层看起来不够克制。

尤其是 landing 相关样式：

- 多层 overlay
- scanline / noise / glare
- hero 过强的背景叙事

这种处理在 marketing 里还能接受，但放到 console、auth、docs 上就会显得吵。

### 3.2 页面之间不像同一套系统

现在各路由对 surface 的处理不完全一致：

- landing 讲故事
- auth 讲流程
- docs 讲阅读
- console 讲密度

这些都对，但缺少一套统一的 surface grammar 去托住它们。

### 3.3 组件没有足够严格的纪律

目前组件层已经有可复用基础，但还欠缺这些约束：

- button hierarchy 不够绝对
- panel / proof shell / disclosure 之间的边界不够统一
- form field、inline alert、empty state、loading state 的状态风格还不完全一致
- 部分页面仍然像在自己发明视觉规则

### 3.4 Typography 的角色分工还不够收敛

`Syne` 很适合品牌展示，但不适合做产品层的默认感受。产品页面如果太多 display feeling，就会显得轻飘。

## 4. 目标设计系统

### 4.1 Surface model

建议把整个产品层收敛成 4 类 surface：

1. `canvas`
2. `raised`
3. `inset`
4. `destructive / state`

规则：

- 所有主要 surface 只用一层边框
- 默认边框都是 hairline，不再做双层 bezel
- 阴影只做轻微 depth，不做 glow
- 只有一个主 accent
- 页面级背景不要各自发明不同的情绪层

### 4.2 主题方向

推荐做成 **light-neutral first** 的产品系统：

- 页面底色使用 warm neutral / stone-like canvas
- panel 使用白或接近白的 raised surface
- border 使用低对比 gray hairline
- text 使用 near-black / charcoal
- accent 只保留一套 muted blue-gray / slate-blue

Dark mode 可以保留，但它应该是同一套系统的另一种配色，不是另一套视觉逻辑。

### 4.3 Typography

产品层只保留 3 个明确角色：

- `SectionLabel`：mono 过线信息、对象名、技术元信息
- `UiHeading`：所有产品标题、面板标题、空状态标题、对话框标题
- `Copy`：正文和说明

规则：

- `Syne` 只用于 landing hero、品牌展示、少量 authored moment
- console / docs / auth 的标题默认用 `UiHeading`
- 正文宽度控制在 60-72ch
- 不要让字号靠夸张放大来制造层级
- 不要把普通标签、按钮、状态写成全大写

### 4.4 Spacing and layout

建议统一为一套 8px rhythm：

- mobile gutter: 16px
- tablet gutter: 24px
- desktop gutter: 32px
- major section gap: 64px - 96px
- panel inner padding: 16px - 24px

布局原则：

- app / docs / auth 使用更收敛的 content width
- marketing 才允许更宽的 hero 视野
- page-local 的奇怪偏移、重叠、过大留白要减少
- 组件之间按同一套垂直节奏排列，不要每页都重新定义呼吸感

### 4.5 Motion and texture

对齐 coss 的方向意味着降低噪音，不是禁用动效。

规则：

- 默认 transition 160ms - 220ms
- 只动画 `transform` 和 `opacity`
- 避免持续性装饰动效
- loading 优先 skeleton，不优先 spinner
- 纹理只保留非常轻的 grain，且仅限 landing 或极少数展示场景

## 5. 组件层重构

### 5.1 Button

统一按钮层级，避免页面自己发明按钮样式。

建议规则：

- `primary`：每个 surface 只允许一个真正主动作
- `secondary`：默认可见操作
- `ghost`：三级或 dismissive action
- `danger`：只用于破坏性动作
- `route`：只用于 route-level CTA
- icon 大小、位置、内边距统一

需要特别收敛的点：

- 不要让按钮像不同页面各自写的样式
- 不要在同一层级混用太多 button variants
- loading 态必须保留 label 结构，避免宽度跳动

### 5.2 Panel / Surface

`Panel`、`ProofShell`、`ConsoleDisclosure`、`LayoutShell` 这些 surface 需要同一套视觉逻辑。

建议：

- 所有 panel 共享同样的 border、radius、shadow token
- 只用一种主要 surface depth
- 不再区分“看起来像不同产品的 bezel”
- panel 只在需要分组或 hierarchy 时出现，不要所有 section 都卡片化

### 5.3 Form field

表单是最应该向 coss 靠拢的区域，因为它最容易暴露不统一。

规则：

- label 永远在 input 上方
- hint 在 label 附近，error 在 control 下方
- field height、focus ring、disabled style 一致
- error / success / warning 采用同一套语气
- input、select、textarea、code textarea 要共享同一类边框和状态

### 5.4 Inline alert and feedback

`InlineAlert` 要保持低噪音，避免像系统弹窗。

建议：

- info / warning / success / error 使用同一套 layout
- 颜色只做轻微 tint，不要高饱和
- 不要用大面积强对比背景
- 只在需要立即感知时才用 alert，不要替代普通说明文字

### 5.5 Empty state

空状态需要统一到“标题 + 一句说明 + 一个动作”。

规则：

- 不写长篇解释
- 不用多段宣传式 copy
- 不堆多个 CTA
- 空状态要告诉用户下一步做什么

### 5.6 Loading state

所有核心 surface 都要有形状匹配的 loading state。

规则：

- panel loading 用 skeleton
- list loading 用行骨架
- page shell loading 用占位骨架
- 只有极小按钮内联 loading 才允许 spinner

### 5.7 Navigation and selection

当前页、当前 segment、当前 filter、当前 pill 都要用同一套 active lens 语言。

规则：

- active state 应该一眼可见
- 不依赖 hover 才能识别当前状态
- 不要做太强的发光或彩色边缘
- `PillNav` / `SegmentedControl` / `ConsolePillSwitch` 的 active visual should be the same family

## 6. 页面级策略

### 6.1 Console

Console 是最应该变得“像工具”的地方。

目标：

- 更密，但更规整
- 更少装饰，更强对齐
- 所有 data-heavy 区域都应该像同一个控制台系统

要做的事：

- 收紧 page width
- 统一 topbar / sidebar / section title 的 spacing
- 减少不同 panel 的 surface 差异
- 让列表、表格、状态徽标、空状态共享同一套密度规则

### 6.2 Auth

Auth 应该变成最清晰的一层。

目标：

- 第一眼先看到表单
- 辅助 stage 存在，但不抢戏
- provider / email / password / finalize flow 的状态一致

要做的事：

- 降低视觉噪音
- 统一按钮宽度和顺序
- 清理过强的背景层
- 让错误、loading、回跳失败状态都保持克制且明确

### 6.3 Docs

Docs 的目标是可读、可扫、可导航。

要做的事：

- 强化 section heading 层级
- 保留 note / code / nav 的清晰边界
- 少用戏剧化背景
- 多用稳定的阅读节奏和一致的内边距

### 6.4 Landing

Landing 是唯一还能保留一点品牌气氛的地方，但也应该明显降噪。

要做的事：

- 背景层只保留一个主 scene + 一个 veil + 一个 fallback
- 移除多余的 scan / glare / noise 叠层
- hero 不要再像“一个独立风格实验”
- 改成更像产品入口，而不是视觉秀场

Landing 的原则：

- 品牌感可以留
- 情绪层要减
- 叙事要简化

## 7. 迁移顺序

### Phase 0: Audit and freeze

先盘点当前所有 page-local 的：

- color values
- border radii
- shadows
- spacing constants
- button variants
- surface variants
- loading / empty / error patterns

目的：找出哪些是系统级，哪些只是临时装饰。

### Phase 1: Token reset

先改 `design-system/tokens.css`，不要先碰各个页面。

目标：

- 收敛 color palette
- 收敛 border tokens
- 收敛 spacing scale
- 收敛 type roles
- 收敛 motion duration

### Phase 2: Shared primitives

再改 `design-system/components.css` 和 `components/ui/*`。

优先顺序：

1. Button
2. Panel / ProofShell
3. FormField / input family
4. InlineAlert
5. EmptyState
6. Loading skeleton
7. Segmented / pill navigation

### Phase 3: Product surfaces

先做 `auth`、`docs`、`console`，不要先动 landing。

原因：

- 这些页面最需要统一性
- 这些页面最容易暴露 surface grammar 的问题
- 这些页面会直接影响“是不是一个产品”的感觉

### Phase 4: Landing simplification

最后再处理 `landing`。

原则：

- 删噪音，不加新戏
- 让 hero 变得更像入口，不像表演
- 保留必要品牌锚点，但降低情绪强度

### Phase 5: QA and cleanup

最后做统一检查：

- 响应式
- focus-visible
- disabled / loading / error / empty
- reduced motion
- long text overflow
- button / panel / field consistency

## 8. File-level mapping

### Core design system

- `design-system/tokens.css`
- `design-system/components.css`
- `design-system/component-specs.md`
- `design-system/README.md`

### Global shell

- `app/globals.css`
- `app/layout.tsx`
- `app/fonts.ts`

### Page-specific CSS

- `app/landing.css`
- `app/console.css`
- `app/deploy.css`

### Shared components

- `components/ui/button.tsx`
- `components/ui/panel.tsx`
- `components/ui/form-field.tsx`
- `components/ui/inline-alert.tsx`
- `components/ui/segmented-control.tsx`
- `components/ui/pill-nav.tsx`
- `components/ui/proof-shell.tsx`
- `components/ui/route-note.tsx`

### Product surfaces

- `components/auth/*`
- `components/docs/*`
- `components/console/*`
- `components/landing/*`

## 9. Definition of done

这次重构完成时，应该满足这些判断：

- console / auth / docs / landing 看起来像同一家公司的一套产品
- 没有页面在自己发明边框、阴影、radius、spacing 语言
- 所有核心交互都有 hover / active / focus / disabled / loading / empty / error 状态
- 字体层级稳定，`UiHeading` 成为产品页面主标题的默认角色
- 表单、按钮、panel、alert、empty state 的视觉语法一致
- 轻微噪音存在，但不会抢走信息
- 如果把四个主路由并排看，用户不会再觉得它们像四个不同的设计项目

## 10. 风险和取舍

### 风险 1: 变得太 generic

如果只学 coss 的 neutral surface，而忘了 Fugue 的路由和产品语义，最后会变成普通 SaaS。

应对：

- 保留 route / object / handoff 的语义
- 用更克制的 surface 承载这些语义

### 风险 2: landing 失去识别度

如果 landing 也完全按 workbench 标准收敛，品牌感会掉太多。

应对：

- landing 保留唯一一个主视觉层
- 但去掉多余的装饰层和噪音

### 风险 3: 改一半就停

如果只改 token，不改组件；或者只改某几个页面，不收敛状态系统，效果会很碎。

应对：

- 先统一 tokens
- 再统一 primitives
- 最后统一 page surfaces

## 11. TODO list

### Phase 0: Audit

- [ ] 盘点 `design-system/tokens.css`、`app/globals.css`、`app/landing.css`、`app/console.css` 里的颜色、边框、阴影、间距和动效变量
- [ ] 盘点 `components/ui/*` 中 button、panel、form、alert、navigation 的当前视觉差异
- [ ] 标记所有 page-local 的重复 surface 规则，区分系统级与临时装饰

### Phase 1: Token reset

- [ ] 收敛 color palette 到 neutral-first 方案，保留单一 accent
- [ ] 重写 surface tokens，拆成 canvas / raised / inset / state 四层
- [ ] 统一 border、radius、shadow 的语义，不再保留多层 bezel 叙事
- [ ] 简化 typography roles，明确 `UiHeading`、`SectionLabel`、`Copy` 的默认使用边界
- [ ] 收紧 spacing scale，固定 mobile / tablet / desktop gutter 和 section gap

### Phase 2: Shared primitives

- [ ] 统一 `Button` 的层级、尺寸、icon 规则和 loading 行为
- [ ] 统一 `Panel`、`ProofShell`、`ConsoleDisclosure` 的 surface 语言
- [ ] 统一 `FormField`、input、select、textarea、code textarea 的边框、focus 和 error 状态
- [ ] 统一 `InlineAlert` 的语气、布局和色彩强度
- [ ] 补齐 `EmptyState` 和 skeleton loading 的视觉模式
- [ ] 统一 `PillNav`、`SegmentedControl`、`ConsolePillSwitch` 的 active lens

### Phase 3: Product surfaces

- [ ] 收紧 `app/app/*` 的 console 密度、topbar spacing 和 panel 语言
- [ ] 收紧 `components/auth/*` 的表单优先级、错误态和回跳态
- [ ] 收紧 `components/docs/*` 的阅读宽度、heading 层级和 nav rhythm
- [ ] 简化 `app/landing.css` 的背景层，减少 scan / glare / noise 叠层
- [ ] 确保 landing 保留品牌锚点，但不再主导整个体验

### Phase 4: QA

- [ ] 在 mobile / tablet / desktop 分别检查 landing、auth、docs、console
- [ ] 检查 focus-visible、disabled、loading、empty、error 和 reduced motion 状态
- [ ] 检查长文本、窄屏和低分辨率下的 overflow 与排版断裂
- [ ] 检查所有核心页面是否共享同一套 border、radius、shadow 和 spacing 语言
- [ ] 更新设计系统文档，记录最终收敛后的规则

## 12. 参考

- coss UI: <https://coss.com/ui>
- coss styling: <https://coss.com/ui/docs/styling>
- coss get started: <https://coss.com/ui/docs/get-started>
- Fugue design baseline: `design-system/README.md`
- Fugue tokens: `design-system/tokens.css`
- Fugue landing surface: `app/landing.css`
- Fugue console shell: `app/console.css`

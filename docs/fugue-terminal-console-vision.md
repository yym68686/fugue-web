# Fugue CLI / Terminal Console 重构愿景与规划

日期：2026-06-13

本文记录一个产品愿景与执行规划：把 Fugue 从“Web console + CLI 命令”推进到“跨 Web、Terminal、Agent 的统一控制平面体验”。

核心判断：

> Fugue 应该有两套一等公民的人机界面，以及一套稳定的机器接口。

- Web console：面向浏览器工作流、平台导航、项目管理、账号和团队协作。
- Terminal console：面向工程师在终端里的生产操作、现场排障、实时监看和高密度状态浏览。
- JSON / script CLI：面向 agent、CI、`jq`、自动化和可重复诊断。

这三者不应该互相替代，而应该共享同一套控制面 API、权限模型、对象语义、状态命名和错误解释。

## 1. 产品方向

`fugue` CLI 目前已经是用户在自己机器或服务器上操作生产系统的主要入口。下一阶段可以把它拆成两个清晰层次：

1. 传统命令层。
   - 保留 `fugue app ls --json`、`fugue app env export`、`fugue operation show --json` 这类可脚本化能力。
   - 输出契约稳定，适合 agent、CI 和排障脚本消费。
   - 默认不能因为视觉升级破坏 stdout、管道、`jq`、`--output-file` 或现有自动化。

2. Terminal console 层。
   - 新增显式入口，例如 `fugue console` 或 `fugue tui`。
   - 在终端里提供一个可点击、可键盘导航、可实时刷新的 Fugue 控制台。
   - 用户可以查看项目、app、route、operation、logs、runtime、cluster、用户和管理员视图。
   - 用户可以在明确确认后执行 restart、redeploy、failover、env 修改、import、dependency attach 等动作。

这不是把网页前端复制到终端里，而是为终端工作流重新组织同一套产品能力。

## 2. btop 可借鉴的部分

[btop](https://github.com/aristocratos/btop) 适合作为终端交互参考，但 Fugue 不应该照搬它的皮肤。

值得吸收的是：

- 全屏高密度布局。
- 多面板信息结构。
- 鼠标和键盘都可用。
- 实时刷新但不刷屏。
- 状态色、进度条、sparkline、排序、过滤和搜索。
- 面向低能力终端的降级策略。
- 主题和色彩能力检测。
- 把“当前系统状态”压缩进一个可快速扫读的 cockpit。

不应该照搬的是：

- 把所有命令默认变成全屏 TUI。
- 在配置、env、导出、原始请求等命令里加入影响复制的装饰。
- 把 Web console 也套成终端 / CRT / 监控器风格。
- 为了视觉密度牺牲权限确认、错误解释和可审计性。

当前 `fugue-web` 的 Web 视觉基线是 Morlane light-first 产品 / 管理系统。btop 风格应主要作用在 Terminal console 和 monitor 类命令中；Web 侧只共享对象模型、状态语言和信息架构，不直接复用终端视觉皮肤。

## 3. 三个产品表面

### 3.1 Web Console

Web console 继续承担这些职责：

- 项目和应用的长期管理。
- 团队、账号、API keys、billing、settings。
- 创建和部署流程。
- 文档、auth handoff、onboarding。
- 需要更完整表单、说明、权限解释和浏览器上下文的工作流。

Web console 的设计方向继续遵守 `fugue-web/design-system/README.md` 中的 Morlane 基线：浅色产品界面、侧边栏 + 顶栏、紧凑表格、明确状态 badge、6px 控件圆角、少装饰、少动效。

### 3.2 Terminal Console

Terminal console 是“终端里的 Fugue 控制台”。它面向用户已经在 shell、SSH、CI runner、GPU 机器、VPS 或本地项目目录里的场景。

建议入口：

```bash
fugue console
fugue console --project production
fugue console --account user@example.com
fugue console --admin
```

核心能力：

- 项目列表与项目 workbench。
- App 状态、route、runtime、replica、resource usage。
- Operation timeline 与部署进度。
- Runtime / cluster / edge / DNS 状态监看。
- Logs 查询、follow、过滤、跳转到相关 operation。
- Env 查看、对比、导出和受保护编辑。
- Service / dependency 导入和绑定。
- Admin users、workspace resolve、cluster nodes、node policy、edge cache、DNS delegation。
- Command palette：用统一入口搜索对象、动作和诊断命令。

概念草图：

```text
┌ Fugue / production ─────────────────────────────── route is the product ┐
│ Projects  Apps  Routes  Operations  Logs  Data  Admin                  │
├────────────────────┬──────────────────────────────┬────────────────────┤
│ Project list        │ Route graph                   │ Live operations    │
│ marketing           │ github -> build -> runtime    │ deploy running     │
│ api                 │ runtime -> route -> edge       │ cert renewed       │
│ console             │ api.example.com /v1 -> us-west │ import queued      │
├────────────────────┴──────────────────────────────┴────────────────────┤
│ Selected app: console-web                                               │
│ status: live   replicas: 2/2   runtime: ovhuseast   edge: healthy       │
│ latest logs / diagnosis / actions                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Agent / JSON CLI

Agent 面必须保持清晰、稳定和低装饰。

原则：

- `--json` 输出字段稳定。
- `--output text` 可以增强人类可读性，但 `--output json` 不受影响。
- 非 TTY 自动禁用 TUI 和装饰。
- 所有 TUI 内可执行动作都应该有等价 CLI 命令。
- Terminal console 不能成为唯一操作入口。
- Agent 不需要解析 ANSI、panel、颜色或交互状态。

示例：

```bash
fugue app ls --json | jq '.apps[] | select(.status.phase != "live")'
fugue operation show op_123 --json
fugue app env export web > .env.fugue
```

## 4. 共享产品模型

Web console 和 Terminal console 应该共享语义层，而不是各自临时拼接后端返回。

建议沉淀一组控制台 view model：

- `WorkspaceContext`
- `ProjectSummary`
- `ProjectWorkbench`
- `AppHealth`
- `RoutePath`
- `OperationTimeline`
- `RuntimeCapacity`
- `ClusterNodeHealth`
- `EdgeHealth`
- `LogWindow`
- `EnvSnapshot`
- `DependencyBinding`
- `DiagnosisEvidence`
- `AdminUser`
- `ActionPlan`

这些模型的事实来源仍应是 `fugue/openapi/openapi.yaml`。如果需要新增接口、字段、流式协议或操作语义，必须先更新 OpenAPI 契约，再同步 `fugue-web/openapi/fugue.yaml` 和 `lib/fugue/openapi.generated.ts`。

## 5. Terminal 设计系统

建议在 `fugue` CLI 内建立 terminal design system，而不是每个命令各自输出 ANSI。

需要的基础组件：

- `Panel`
- `Split`
- `Table`
- `List`
- `Detail`
- `StatusChip`
- `MetricBar`
- `Sparkline`
- `Timeline`
- `RouteChain`
- `LogViewport`
- `CommandPalette`
- `ConfirmDialog`
- `ErrorBlock`
- `CopyBlock`
- `HelpOverlay`

需要的系统能力：

- TTY 检测。
- 终端尺寸检测。
- `--color=auto|always|never`。
- truecolor / 256 色 / 16 色降级。
- `NO_COLOR` 支持。
- `prefers-reduced-motion` 或等价低动效配置。
- 鼠标开关。
- 非交互环境自动退出或降级。
- 安全动作二次确认。
- 快捷键帮助。

Web token 不应直接复制到 ANSI，但可以建立语义映射：

```text
semantic status -> web badge token -> terminal color pair
surface level   -> web panel token -> terminal panel border/style
danger action   -> web danger button -> terminal confirm/danger tone
route chain     -> web route graph   -> terminal route chain
```

## 6. 架构选择

### 6.1 首选路线：Go 内置 TUI

Fugue 当前 CLI 是 Go + cobra。第一版 Terminal console 不建议为了 TUI 改语言，也不建议引入 Node / Python sidecar。

推荐默认路线：

```text
fugue Go binary
  ├── cobra command tree
  ├── existing JSON / text commands
  └── terminal UI runtime
        ├── Bubble Tea / Lip Gloss / Bubbles
        ├── terminal design system
        ├── monitor views
        └── full console views
```

理由：

- 保持单二进制分发。
- 继续复用现有 Go client、auth store、配置解析、OpenAPI 类型和命令树。
- 避免为 TUI 引入第二套 release、安装、鉴权和配置路径。
- 可以从 `fugue project watch`、`fugue deploy --wait` 这类低风险入口逐步试水。

Go 主线建议优先评估：

- [Bubble Tea](https://github.com/charmbracelet/bubbletea)：作为 TUI update / view 主循环。
- [Lip Gloss](https://github.com/charmbracelet/lipgloss)：作为 terminal design system 的样式层。
- Bubbles / BubbleZone / ntcharts 等 Charm 生态组件：用于列表、输入、viewport、鼠标区域和轻量图表。

### 6.2 备选路线：Rust 独立 console

如果未来要把 Terminal console 做成独立高复杂度产品，且愿意接受第二个二进制，可以评估 Rust sidecar：

```text
fugue           # Go CLI，继续负责脚本化命令和控制面操作
fugue-console   # Rust TUI，负责高复杂度 terminal console
```

Rust 路线首选应是 [Ratatui](https://ratatui.rs/) + crossterm。Codex 本地源码就是这个方向：`codex-rs/tui` 使用 `ratatui`、`crossterm`、`supports-color`、`textwrap`、`vt100` 和 `insta` snapshot 测试。

这条路线的优势：

- 更强的底层终端控制。
- 更适合复杂长生命周期 TUI。
- 更容易做到细粒度绘制、事件流管理、终端探测和 snapshot 测试。

代价：

- 多语言构建和发布复杂度上升。
- Go CLI 与 Rust console 之间需要稳定 IPC / local API。
- auth、config、OpenAPI client、错误模型和 telemetry 需要跨语言复用或同步。

第一阶段不建议直接采用这条路线，但应把 Codex 的 terminal runtime 设计作为 Go 版本的质量标杆。

### 6.3 不建议的路线

- 不建议用 Node / Ink 作为 Fugue 主 TUI。React mental model 很好，但会增加 runtime、打包和安装复杂度。
- 不建议用 Python / Textual 作为 Fugue 主 TUI。Textual 很适合快速做漂亮原型，但不适合嵌入当前 Go CLI 发布链路。
- 不建议把 Web console 通过浏览器或 WebView 包成终端界面。Terminal console 应该是终端原生交互，不是网页降级版。
- 不建议把 monitor 命令和完整 console 混成一个入口。只读监看、交互管理、脚本输出应保持清楚边界。

## 7. 向 Codex TUI 学习

本地 Codex 源码路径：

```text
/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui
```

Codex 的关键启发不是“用了 ratatui 所以 ratatui 一定最好”，而是它在通用 TUI 框架之上自研了一套生产级 terminal runtime。Fugue 应该学习这些能力，并用 Go 生态实现等价设计。

### 7.1 终端探测必须有时间上限

Codex 的 `terminal_probe.rs` 明确避免 crossterm 默认终端响应探测可能带来的长等待，把 startup probe 控制在约 100ms，并探测：

- cursor position
- 默认 foreground / background
- keyboard enhancement support

Fugue 应学习：

- TUI 启动不能因为 SSH、tmux、CI、低能力终端或不响应 escape query 卡住。
- 探测失败时用 conservative fallback。
- 终端能力探测要早于事件流创建，避免输入事件被错误消费。

### 7.2 支持 inline 和 alternate screen 双模式

Codex 支持 inline viewport，保留 scrollback，也支持 alternate screen。

Fugue 应学习：

- `fugue deploy --wait`、`fugue project watch` 这类命令默认更适合 inline / scrollback-friendly 输出。
- `fugue console` 这种完整控制台更适合 alternate screen。
- 用户应能通过 `--no-alt-screen` 或配置强制保留 scrollback。
- 崩溃、Ctrl+C、panic 或 fatal error 后必须恢复 cursor、raw mode、paste mode 和 keyboard mode。

### 7.3 事件流要能暂停和恢复

Codex 有 `EventBroker`，会在需要交出终端给外部程序时 drop / recreate crossterm EventStream，避免 TUI 继续抢 stdin。

Fugue 应学习：

- 如果未来在 TUI 内打开 editor 修改 env、manifest、route config 或 compose patch，必须暂停 TUI event stream。
- 如果运行 `kubectl exec`、shell、database console、log pager 或外部诊断命令，也要明确释放 stdin。
- 恢复后要刷新 viewport、清理残留输入，并重绘。

### 7.4 颜色纪律比花哨主题更重要

Codex 的 TUI style guide 避免硬编码 white，默认使用 terminal foreground，只把 cyan、green、red、magenta、dim、bold 用在少数语义上。

Fugue 应学习：

- 默认 foreground 应尊重用户终端主题。
- 自定义 truecolor 只能作为 enhanced path，不应成为可读性的前提。
- 状态色必须有语义：success、danger、selection、secondary、brand。
- 256 色、16 色、`NO_COLOR`、unknown color capability 都要有清晰 fallback。

### 7.5 UI 可见变化需要 snapshot

Codex 要求 TUI 可见变化配 `insta` snapshot，且用 `vt100` / test backend 验证 rendered output。

Fugue 应学习：

- Terminal design system 组件要有 golden snapshots。
- 至少覆盖宽屏、窄屏、低色彩、无色、空态、错误态、权限态、长文本、危险确认。
- Monitor 页面要测试 resize 和数据刷新后布局不抖动。
- JSON 输出测试和 TUI snapshot 测试要分离，避免互相污染。

### 7.6 组件应该是领域组件，不只是通用 widgets

Codex 在 ratatui 上沉淀了 chat composer、command popup、selection list、history cell、diff render、markdown render、approval overlay 等产品组件。

Fugue 也应该沉淀自己的领域组件：

- `ProjectSwitcher`
- `RouteChain`
- `OperationTimeline`
- `RuntimeCapacityPanel`
- `ClusterNodeTable`
- `LogViewport`
- `EnvSnapshotView`
- `DiffPreview`
- `ActionPlanDialog`
- `DangerConfirmDialog`
- `AdminWorkspaceResolver`

这些组件应该消费 Fugue view model，而不是直接消费散乱 API response。

### 7.7 不应直接照搬 Codex 的产品结构

Codex 是对话式 coding agent，核心 UI 是 history + composer + approvals。Fugue 是控制平面，核心 UI 是 project workbench + route health + operation timeline + logs + admin cockpit。

因此：

- 可以学习 Codex 的 terminal runtime。
- 可以学习 Codex 的测试和样式纪律。
- 不应该照搬 Codex 的 chat-first 布局。
- Fugue 的主导航应围绕 projects、apps、routes、operations、logs、runtime、admin，而不是 conversation。

## 8. Fugue CLI 重构总规划

### 8.1 当前状态

当前 `fugue` CLI 的事实基础：

- 入口是 Go + cobra，主入口在 `cmd/fugue/main.go`，命令实现集中在 `internal/cli`。
- root 层已经有 `--output text|json`、`--json`、`--output-file`、`--show-ids`、`--redact`、`--confirm-raw-output`、`--account`、`--tenant`、`--project` 等全局能力。
- 文本输出大量使用 `text/tabwriter`、`key=value` 和局部 `fmt.Fprintf`。
- JSON 输出散落在各命令中，通过 `c.wantsJSON()` 分支和 `writeJSON` 输出。
- deploy wait 已经有 hash 去重的状态 snapshot 渲染，说明长任务输出已经具备改造成 monitor renderer 的基础。
- `project overview`、`app overview`、`app diagnose`、`operation explain` 等命令已经在做跨 API 的语义聚合，适合作为 view model 抽取起点。
- env 查看 / 导出、raw API request、db query、debug bundle、logs collect 这类命令承载排障和迁移职责，不能被视觉升级破坏复制、重定向和脚本消费。

现状最大问题不是缺少某个 TUI 框架，而是输出、view model、命令执行、诊断聚合、redaction 和用户交互还混在同一个 `internal/cli` 包里。重构目标应先建立边界，再逐步替换输出表面。

### 8.2 重构目标

CLI 重构要同时服务三类用户：

- 人类用户：在终端直接看懂状态、原因、下一步动作。
- 管理员：在高密度 cockpit 中快速定位 workspace、project、cluster、edge、DNS、runtime 问题。
- Agent / 自动化：继续稳定使用 JSON、stdout、exit code、`jq`、CI 和脚本。

目标状态：

- 命令语义保持稳定，输出表面分层。
- JSON 输出成为机器契约，不因 TUI 改造变化。
- text 输出从散落 `tabwriter` 迁移到统一 renderer。
- rich terminal 输出只在 TTY 和适合人类阅读的命令中启用。
- monitor 和 full TUI 是显式交互入口，不吞掉普通命令。
- Web console 与 Terminal console 共享对象语义和状态语言。
- 所有危险动作都有 action plan、确认、operation id 和可审计结果。

### 8.3 非目标

- 不重写整个 CLI。
- 不为了 TUI 把主 CLI 从 Go 改成 Rust。
- 不让 `fugue console` 成为唯一管理入口。
- 不让 btop 风格污染 Web console 的 Morlane 设计基线。
- 不改变 env 查看 / 导出的默认可见原则。
- 不把 OpenAPI 派生产物当作可手写事实源。
- 不先发明前端/TUI 字段再要求后端补齐。

### 8.4 兼容性契约

重构前必须先冻结这些契约：

- `--json` 输出：字段、嵌套结构、redaction 规则和 exit code。
- `--output-file`：内容必须与 stdout 语义一致，不应混入 TUI 控制字符。
- 非 TTY stdout：必须默认 plain text 或 JSON，不输出 ANSI、面板边框、交互提示。
- stderr：progress、warning、diagnostic trace 不得污染 JSON stdout。
- env 命令：
  - `fugue app env ls/show <app>` 默认显示真实值。
  - `fugue app env export <app>` 默认输出可复用 `.env`。
  - redaction 只在诊断包、debug bundle、operation 等容易转发的上下文默认启用。
- 退出码：现有错误分类继续稳定，TUI 退出不能掩盖真实失败。
- 命令别名和兼容命令：迁移期继续可用，避免破坏用户脚本。

建议新增兼容控制：

```bash
fugue --color auto|always|never ...
fugue --interactive auto|always|never ...
fugue console --no-alt-screen
fugue project watch --plain
```

`--output text|json` 继续表示输出数据格式，不承担完整 UI 模式选择。UI 模式应由 TTY 检测、命令类型和专用 flag 决定。

### 8.5 目标代码边界

第一阶段可以继续在 `internal/cli` 下演进，避免一次性大搬家。边界稳定后再拆包。

建议目标结构：

```text
internal/cli
  root.go / app.go / project.go / ...     # cobra wiring and command options
  client*.go                              # API client and transport
  redaction.go                            # redaction policy
  output.go / output_extended.go          # legacy output, gradually shrink

internal/cli/contract
  json.go                                 # machine output helpers
  exit.go                                 # exit code mapping and error classes
  redaction.go                            # output redaction contracts if split later

internal/cli/viewmodel
  app_health.go
  project_workbench.go
  route_path.go
  operation_timeline.go
  runtime_capacity.go
  diagnosis_evidence.go
  admin_workspace.go

internal/cli/terminal
  capability.go                           # TTY, color, width, alt-screen, inline support
  palette.go                              # semantic colors and fallback
  writer.go                               # stdout/stderr/inline rendering guard
  probe.go                                # bounded terminal probe
  snapshot.go                             # test renderer / golden output support

internal/cli/ui
  panel.go
  table.go
  status_chip.go
  metric_bar.go
  route_chain.go
  operation_timeline.go
  log_viewport.go
  confirm_dialog.go
  error_block.go

internal/cli/monitor
  project_watch.go
  app_watch.go
  cluster_top.go
  operation_watch.go

internal/cli/console
  app.go                                  # Bubble Tea program root
  pages/
  actions/
  command_palette/
```

命名可以调整，但边界原则不变：

- command 负责解析参数和调用业务。
- viewmodel 负责把 API 对象组合成产品语义。
- contract 负责机器输出和兼容。
- terminal 负责终端能力、输出环境和运行时。
- ui 负责可复用 terminal 组件。
- monitor / console 负责交互式界面。

### 8.6 输出模式设计

输出应分四层：

1. JSON output
   - `--json` / `--output json`
   - 稳定、机器可读、无 ANSI、无 progress、无交互。

2. Plain text output
   - 非 TTY 默认。
   - 保留可复制、可 grep、可 paste 的文本。
   - 适合 env、db query、api request、raw diagnostics。

3. Rich text output
   - TTY + 人类命令默认可启用。
   - 用统一 renderer 输出 status chip、section、route chain、timeline、diagnosis block。
   - 不能影响 JSON 和非 TTY。

4. Interactive TUI
   - `fugue console`、`fugue project watch`、`fugue admin cluster top` 等显式入口。
   - 支持 keyboard、mouse、search、filter、refresh、pause、confirm。
   - 必须有 `--plain` / `--json` 或非 TTY fallback。

命令迁移优先级：

- 第一批 rich text：`app status`、`app overview`、`app diagnose`、`operation explain`、`project overview`。
- 第一批 monitor：`project watch`、`admin cluster top`、`operation watch`。
- 保持 plain 优先：`app env ls/show/export`、`app db query`、`api request`、`debug bundle`、`logs collect`。

### 8.7 命令族重构策略

#### Read-only inventory

代表命令：

```bash
fugue app ls
fugue project ls
fugue service ls
fugue runtime ls
fugue operation ls
```

策略：

- JSON 输出保持原样。
- text 输出统一到新 table renderer。
- TTY 下可显示 compact status、relative time、scope context。
- 非 TTY 保持 plain table。
- 不在列表命令里引入全屏 TUI。

#### Detail / overview

代表命令：

```bash
fugue app status <app>
fugue app overview <app>
fugue project overview <project>
fugue runtime doctor <runtime>
```

策略：

- 抽 view model。
- rich text 默认显示 summary、route chain、resource、operations、warnings、next actions。
- `--json` 输出 view model 或现有对象，迁移前必须明确兼容策略。
- text 输出不应再是一长串无层级 `key=value`。

#### Diagnosis / explain

代表命令：

```bash
fugue app diagnose <app>
fugue operation explain <operation>
fugue diagnose fs <app>
fugue diagnose timing -- <command...>
```

策略：

- 用 `DiagnosisEvidence` 统一表达 root cause、evidence、scope、confidence、next command。
- human 输出必须直接回答“卡在哪 / 为什么 / 下一步跑什么”。
- diagnostic bundle 默认 redacted，主动 env 查看仍默认 raw。

#### Long-running operations

代表命令：

```bash
fugue deploy . --wait
fugue app logs runtime <app> --follow
fugue project watch <project>
```

策略：

- 分离 operation polling、snapshot diff、renderer。
- TTY 下使用 inline renderer，保留 scrollback。
- `--ui` 或 monitor 命令使用 interactive view。
- CI / non-TTY 保持 periodic plain snapshot 或 quiet progress。
- 支持 Ctrl+C 后打印 operation id 和 resume command。

#### Mutating actions

代表命令：

```bash
fugue app deploy <app>
fugue app failover policy set <app>
fugue app env set <app>
fugue service postgres create <name>
fugue admin cluster node-policy set ...
```

策略：

- 抽 `ActionPlan`：目标、影响范围、API 调用、预期 operation、回滚/恢复提示。
- TUI 内动作复用同一 action plan。
- 危险动作统一确认文本和 audit result。
- `--yes` / `--confirm` 只在脚本场景显式使用，不作为 TUI 默认。

### 8.8 分阶段实施计划

#### P0：基线锁定

目标：先保证重构不会破坏现有 CLI。

工作：

- 盘点所有 `wantsJSON()` 分支和 `writeJSON` 输出。
- 给高频命令补 JSON golden tests。
- 给 env/export/db/api/logs/debug bundle 补非 TTY stdout 测试。
- 记录现有 exit code 行为。
- 为 `progressf`、warning、stderr/stdout 边界补测试。

验收：

- `go test ./internal/cli` 通过。
- 关键命令 JSON 输出有 snapshot 或结构断言。
- 文档列出第一批允许改变 text 输出的命令和禁止改变 text 输出的命令。

#### P1：Terminal runtime 基座

目标：建立终端能力和输出运行时，不改业务命令行为。

工作：

- 增加 TTY / width / color / `NO_COLOR` 检测。
- 增加 `--color auto|always|never`。
- 增加 bounded terminal probe 原型，参考 Codex 的 100ms startup probe 思路。
- 增加 plain/rich renderer 选择器。
- 建立 test renderer / golden snapshot 工具。

验收：

- 非 TTY 永不输出 ANSI。
- `NO_COLOR=1` 生效。
- probe 超时不阻塞命令启动。
- 新 runtime 可以被单元测试覆盖，不依赖真实 terminal。

#### P2：View model 抽取

目标：让命令和 UI 消费同一套产品语义。

工作：

- 从 `app overview`、`project status`、`operation explain` 抽取 view model。
- 定义 `RoutePath`、`OperationTimeline`、`AppHealth`、`DiagnosisEvidence`。
- 把 API fan-out、inventory enrichment、diagnosis summary 从 renderer 中移出。
- 明确哪些 view model 是前端也需要的 console semantic model。

验收：

- 旧 text 输出仍可由新 view model 渲染。
- JSON 输出不变，或变更经过明确兼容说明和测试。
- view model 有独立单元测试。

#### P3：Rich text 第一批迁移

目标：先改善最能体现 DX 的 read-only / diagnosis 命令。

命令范围：

```bash
fugue app status <app>
fugue app overview <app>
fugue app diagnose <app>
fugue operation explain <operation>
fugue project overview <project>
```

工作：

- 用 `Panel`、`StatusChip`、`RouteChain`、`OperationTimeline`、`ErrorBlock` 渲染。
- 对宽屏 / 窄屏 / 无色 / 长文本做 snapshot。
- 非 TTY 回退 plain。
- `--json` 完全不变。

验收：

- 人类能在一屏内看到 phase、route、runtime、latest operation、root cause、next command。
- 所有 rich 输出都有 plain fallback。
- 这些命令的 `--json` 测试全部通过。

#### P4：Monitor MVP

目标：验证 btop-like 高密度实时界面。

第一批入口：

```bash
fugue project watch <project>
fugue operation watch <operation>
fugue admin cluster top
```

工作：

- 建立 refresh loop、pause、filter、sort、search。
- 支持 inline 默认和 alt-screen 可选。
- 支持 Ctrl+C summary：最后状态、operation id、resume command。
- 支持 API transient error 显示和重连。

验收：

- 数据刷新不刷屏、不闪烁。
- Resize 后布局稳定。
- 网络错误不会清空整屏。
- 非 TTY 有明确 fallback。

#### P5：Terminal Console MVP

目标：推出 `fugue console` 第一版。

页面范围：

- Projects
- Apps
- Project detail
- Operations
- Logs
- Runtime
- Admin overview

能力范围：

- command palette
- object search
- keyboard navigation
- read-only drilldown
- logs viewport
- operation timeline
- limited safe actions：restart / redeploy / cancel operation

验收：

- 可以从 project 列表进入 app detail，查看 route、runtime、operation、logs。
- 所有写动作都有 action plan 和确认。
- 退出后 terminal 状态恢复。
- 低宽度终端降级为单列。

#### P6：Admin cockpit

目标：把管理员排障路径产品化。

范围：

- account / workspace resolve
- users
- cluster nodes
- runtime capacity
- edge / DNS health
- node policy
- control plane operations

策略：

- 第一版只读优先。
- 写动作必须经过更强确认。
- 所有手工线上操作提示正式发布路径，不能把 SSH hotfix 伪装成标准流程。

验收：

- 管理员可以在不手动猜 tenant 的情况下定位用户 workspace。
- 可以从异常 route 追到 app、runtime、cluster node、edge/DNS。
- 可以导出 redacted diagnostic summary。

#### P7：Web / Terminal 收敛

目标：让 Web console 和 Terminal console 真正共享控制台语义。

工作：

- 对齐 Web project workbench 与 Terminal project workbench 的 IA。
- 评估是否需要新增 console semantic endpoints。
- 若新增或修改 API，按 OpenAPI-first 跨仓库流程执行。
- 对齐 error copy、permission copy、empty state、operation naming。

验收：

- 同一个 app / project 在 Web 和 Terminal 中看到的状态解释一致。
- 同一个 operation 在 Web 和 Terminal 中的 timeline 语义一致。
- 前端契约检查通过：`npm run contract:check`。

### 8.9 测试策略

需要四类测试并行：

- Contract tests：JSON 输出、exit code、redaction、stdout/stderr 边界。
- Renderer tests：plain/rich table、panel、route chain、timeline、error block golden snapshots。
- TUI runtime tests：resize、color fallback、non-TTY fallback、probe timeout、alt-screen restore。
- Flow tests：deploy wait、project watch、danger confirm、admin read-only cockpit。

Go 生态需要补齐一个类似 Codex `vt100 + insta` 的测试组合。可以先用 golden string + fake terminal width 起步，再评估引入 VT100 emulator。

### 8.10 发布策略

- 第一阶段全部 hidden / opt-in。
- rich text 先通过环境变量或实验 flag 启用，例如 `FUGUE_CLI_RICH_TEXT=1`。
- monitor 命令可以公开，但标注 experimental。
- `fugue console` 先作为 preview，不替代任何现有命令。
- 每次迁移命令都必须在 README / help docs 中说明 JSON 不变和 fallback 行为。
- 如果涉及 `fugue` 仓库控制平面能力或 API 变更，发布仍走 `fugue` 仓库 GitHub Actions 控制平面链路，不手工 patch 线上。

### 8.11 第一批具体任务清单

1. 写 CLI output compatibility inventory。
2. 给 `app status`、`app overview`、`operation explain`、`project overview` 建 JSON / text baseline tests。
3. 新增 terminal capability package。
4. 新增 renderer interface：

```go
type Renderer interface {
    AppHealth(AppHealthView) error
    ProjectWorkbench(ProjectWorkbenchView) error
    OperationTimeline(OperationTimelineView) error
    Diagnosis(DiagnosisEvidenceView) error
}
```

5. 从 `project_status.go` 抽 `OperationTimeline` 和 service stage view model。
6. 从 `app_overview.go` / `app_diagnosis.go` 抽 `AppHealth` 和 `DiagnosisEvidence`。
7. 改造 `deploy_progress.go`，把 polling、snapshot hash、render 分离。
8. 做 `fugue operation watch <operation>`，验证 monitor loop。
9. 做 `fugue project watch <project>`，验证 project cockpit。
10. 做 `fugue console` shell，仅支持 read-only projects/apps/logs。
11. 加入危险动作 action plan 和 confirm dialog。
12. 与 Web console 对齐 project/app/operation 状态文案。

### 8.12 可打勾详细 Todo List

这份清单用于后续执行时直接维护进度。默认所有实现任务落在 `/Users/yanyuming/Downloads/GitHub/fugue`；涉及 Web 文案、IA、OpenAPI 同步或产品文档时，再回到 `/Users/yanyuming/Downloads/GitHub/fugue-web`。

#### P0：基线锁定

- [x] 盘点 `internal/cli` 里所有 `wantsJSON()`、`writeJSON`、`writeOutputFile` 调用点。
- [x] 列出所有已有 `--json` / `--output json` 命令及其当前字段结构。
- [x] 列出禁止改变默认文本输出语义的命令：env、db query、api request、logs collect、debug bundle、raw diagnostics。
- [x] 列出允许第一批升级 rich text 的命令：`app status`、`app overview`、`app diagnose`、`operation explain`、`project overview`。
- [x] 为 `app status --json` 建立 baseline test。
- [x] 为 `app overview --json` 建立 baseline test。
- [x] 为 `app diagnose --json` 建立 baseline test。
- [x] 为 `operation explain --json` 建立 baseline test。
- [x] 为 `project overview --json` 建立 baseline test。
- [x] 为 `app env ls/show/export` 建立非 TTY stdout 测试，确认默认显示真实值。
- [x] 为 `api request` / `db query` 建立非 TTY stdout 测试，确认不混入 ANSI。
- [x] 为 diagnostic / debug bundle 建立 redaction 行为测试。
- [x] 记录当前错误类型到 exit code 的映射。
- [x] 记录 stdout / stderr 边界：JSON 写 stdout，progress / warning 写 stderr。
- [x] 在 CLI 文档里标注“机器输出契约”和“人类输出可演进”边界。

#### P1：Terminal Runtime 基座

- [x] 新建 `internal/cli/terminal` 包。
- [x] 实现 TTY 检测：stdout、stderr、stdin 分别判断。
- [x] 实现 terminal width / height 检测，并支持测试注入。
- [x] 实现 `NO_COLOR` 支持。
- [x] 新增全局或 runtime 级 `--color auto|always|never` 设计与解析。
- [x] 新增 `--interactive auto|always|never` 设计与解析。
- [x] 实现 semantic palette：success、warning、danger、muted、accent、selection、border。
- [x] 实现 truecolor / 256 color / 16 color / no color fallback。
- [x] 实现 bounded terminal probe 原型，超时目标控制在 100ms 量级。
- [x] 实现 probe 失败 fallback，不阻塞普通命令启动。
- [x] 实现 inline renderer guard，保证非 TTY 不输出 ANSI。
- [x] 实现 alt-screen lifecycle 原型，包含 raw mode、cursor、paste mode 恢复。
- [x] 增加 panic / Ctrl+C / fatal error 下的 terminal restore 测试。
- [x] 建立 fake terminal / fake writer，用于 renderer 单元测试。
- [x] 建立 golden snapshot 更新流程和 review 约定。

#### P2：View Model 抽取

- [x] 新建 `internal/cli/viewmodel` 包或等价边界。
- [x] 定义 `AppHealthView`。
- [x] 定义 `ProjectWorkbenchView`。
- [x] 定义 `RoutePathView`。
- [x] 定义 `OperationTimelineView`。
- [x] 定义 `RuntimeCapacityView`。
- [x] 定义 `DiagnosisEvidenceView`。
- [x] 定义 `ActionPlanView`。
- [x] 从 `app_overview.go` 抽出 app health 聚合逻辑。
- [x] 从 `app_diagnosis.go` 抽出 diagnosis evidence 聚合逻辑。
- [x] 从 `project_status.go` 抽出 project workbench / service stage 聚合逻辑。
- [x] 从 `operation` 相关命令抽出 operation timeline 聚合逻辑。
- [x] 把 API fan-out 和 renderer 分离，renderer 只消费 view model。
- [x] 为每个 view model 写最小单元测试：正常态、空态、错误态、权限态。
- [x] 检查 view model 字段是否都能从 OpenAPI 权威契约推导。
- [x] 如需新增字段，先在 `fugue/openapi/openapi.yaml` 设计契约，不在 CLI 里猜字段。

#### P3：Rich Text Renderer

- [x] 新建 `internal/cli/ui` 包或等价边界。
- [x] 实现 `Section` / `Panel` 基础渲染。
- [x] 实现 `Table` renderer，替代分散 `tabwriter` 的第一批场景。
- [x] 实现 `StatusChip`，覆盖 live、deploying、failed、degraded、unknown。
- [x] 实现 `RouteChain`，展示 source -> build -> runtime -> edge -> domain。
- [x] 实现 `OperationTimeline`，展示 queued、building、deploying、routing、completed / failed。
- [x] 实现 `MetricBar`，展示 replica、capacity、usage、latency 这类轻量指标。
- [x] 实现 `ErrorBlock`，包含 error、evidence、next command。
- [x] 实现 `CopyBlock`，用于可复制命令、URL、operation id。
- [x] 为宽屏输出建立 snapshot。
- [x] 为窄屏输出建立 snapshot。
- [x] 为无色输出建立 snapshot。
- [x] 为长 app / project / domain 名建立 wrapping snapshot。
- [x] 为空态、权限态、错误态建立 snapshot。
- [x] 迁移 `fugue app status <app>` 到 rich renderer。
- [x] 迁移 `fugue app overview <app>` 到 rich renderer。
- [x] 迁移 `fugue app diagnose <app>` 到 rich renderer。
- [x] 迁移 `fugue operation explain <operation>` 到 rich renderer。
- [x] 迁移 `fugue project overview <project>` 到 rich renderer。
- [x] 确认上述命令 `--json` 输出与 P0 baseline 一致。
- [x] 确认上述命令在非 TTY 下 fallback 到 plain text。

#### P4：Monitor MVP

- [x] 新建 `internal/cli/monitor` 包或等价边界。
- [x] 把 `deploy_progress.go` 拆成 polling、snapshot hash、renderer 三部分。
- [x] 实现 refresh loop：固定间隔、手动刷新、pause / resume。
- [x] 实现 API transient error 状态，不清空已有画面。
- [x] 实现 resize 后重新 layout。
- [x] 实现 Ctrl+C summary：最后状态、operation id、resume command。
- [x] 实现 `fugue operation watch <operation>`。
- [x] 实现 `fugue project watch <project>`。
- [x] 实现 `fugue admin cluster top` 的只读原型。
- [x] 支持 filter / search / sort 的最小键盘交互。
- [x] 支持 inline 默认模式，保留 shell scrollback。
- [x] 支持可选 alt-screen 模式。
- [x] 支持 `--plain` fallback。
- [x] 支持非 TTY 下直接给出 plain snapshot 或明确错误提示。
- [x] 为 monitor 首屏、刷新、错误、resize 建立 snapshot / fake terminal 测试。

#### P5：Terminal Console MVP

- [x] 新建 `internal/cli/console` 包或等价边界。
- [x] 增加 `fugue console` cobra 入口。
- [x] 评估 Go TUI 框架；第一版选择 Go 内置轻量 TUI shell，保留 Bubble Tea / Lip Gloss / Bubbles 作为下一阶段可选引入。
- [x] 建立 app root：global state、route、page stack、focus、refresh。
- [x] 建立 keyboard navigation：上下左右、enter、esc、tab、search、help。
- [x] 建立 mouse optional support，不让鼠标成为唯一操作方式。
- [x] 实现 command palette。
- [x] 实现 project list 页面。
- [x] 实现 project detail 页面。
- [x] 实现 app detail 页面。
- [x] 实现 operations 页面。
- [x] 实现 logs viewport 页面。
- [x] 实现 runtime 页面。
- [x] 实现 admin overview 只读页面。
- [x] 实现 global help overlay。
- [x] 实现 loading、empty、error、permission、offline 状态。
- [x] 实现低宽度终端单列 fallback。
- [x] 实现退出时 terminal restore。
- [x] 实现 preview 标识，不替代现有命令。

#### P5.5：Mutating Action 安全层

- [x] 定义 `ActionPlanView` 字段：target、scope、api call、operation、risk、rollback hint。
- [x] 为 restart 设计 action plan。
- [x] 为 redeploy 设计 action plan。
- [x] 为 cancel operation 设计 action plan。
- [x] 实现 `DangerConfirmDialog`。
- [x] 实现确认文本必须包含 workspace、project、app、operation 或 runtime。
- [x] 实现 TUI action 调用后展示 operation id。
- [x] 实现 action 失败时展示 evidence 和 next command。
- [x] 为危险动作确认写 snapshot。
- [x] 为取消确认、权限不足、API 失败写测试。
- [x] 确认 `--yes` / `--confirm` 不会被 TUI 默认静默使用。

#### P6：Admin Cockpit

- [x] 实现 account / workspace resolve 只读视图。
- [x] 实现 users 只读视图。
- [x] 实现 cluster nodes 只读视图。
- [x] 实现 runtime capacity 视图。
- [x] 实现 edge / DNS health 视图。
- [x] 实现 node policy 只读视图。
- [x] 实现 control plane operations 视图。
- [x] 实现从异常 route 追踪到 app、runtime、node、edge / DNS 的 drilldown。
- [x] 实现 redacted diagnostic summary 导出。
- [x] 管理员写动作默认不开放，逐个设计 action plan 后再启用。
- [x] 在 admin cockpit 文案中明确正式控制平面发布路径，不把 SSH hotfix 当标准流程。
- [x] 为 admin cockpit 权限不足、tenant 解析失败、空集群、节点离线写测试。

#### P7：Web / Terminal 收敛

完成记录：

- 语义对齐文档落点：`fugue/docs/cli-terminal-console-preview.md`、`fugue/docs/cli-viewmodel-boundaries.md`。
- JSON / fallback / release note 文档落点：`fugue/docs/cli-output-compatibility.md`、`fugue/README.md`。
- TUI snapshot / 人体工学评审落点：`fugue/docs/cli-tui-snapshot-testing.md`。
- Endpoint 评估结论：本阶段不新增 console semantic endpoint，继续复用 `/v1/console/gallery`、`/v1/console/projects/{id}`、operation、runtime、cluster、edge、DNS、tenant 以及 fugue-web admin snapshot 路由；如未来需要新增字段，再从 `fugue/openapi/openapi.yaml` 开始。

- [x] 对齐 Web console 和 Terminal console 的 project workbench IA。
- [x] 对齐 app status、route health、operation timeline 的状态命名。
- [x] 对齐权限错误文案。
- [x] 对齐 loading / empty / error 状态文案。
- [x] 对齐 operation naming 和 next command。
- [x] 评估是否需要新增 console semantic endpoints。
- [x] 如需新增 endpoint，先更新 `fugue/openapi/openapi.yaml`。
- [x] 在 `fugue` 仓库运行 `make generate-openapi`。
- [x] 在 `fugue` 仓库运行 `make test`。
- [x] 回到 `fugue-web` 运行 `npm run openapi:sync`。
- [x] 回到 `fugue-web` 运行 `npm run openapi:generate`。
- [x] 回到 `fugue-web` 运行 `npm run contract:check`。
- [x] 更新 Web console 文案或 IA 时遵守 Morlane 设计基线。
- [x] 更新 CLI / Terminal console 文档，明确 Web、Terminal、JSON 三个入口关系。

#### 横切任务

- [x] 写 `fugue console` preview 文档。
- [x] 写 `fugue project watch` / `operation watch` 使用文档。
- [x] 写 JSON 兼容性保证说明。
- [x] 写 terminal fallback 说明：非 TTY、NO_COLOR、低宽度、SSH、tmux、Windows Terminal。
- [x] 写危险动作确认规范。
- [x] 写 TUI snapshot review 规范。
- [x] 建立 CLI rich output changelog。
- [x] 建立用户反馈入口，收集 TUI 可读性、快捷键、布局问题。
- [x] 在 release note 中明确哪些命令只是 text 输出升级，哪些是新增 experimental 命令。
- [x] 每次阶段完成后回看本清单，把已完成项打勾并记录对应 PR / commit；本阶段记录为本地 workspace 变更，等待用户决定 commit / PR。

## 9. Monitor 类命令

除了 `fugue console`，还可以保留更轻量的 btop-like monitor 命令，用于只看不改或低交互监控。

候选命令：

```bash
fugue project watch
fugue app watch <app>
fugue admin cluster top
fugue admin edge watch
fugue runtime watch <runtime>
fugue operation watch <operation>
```

这些命令适合：

- 实时刷新状态。
- 展示趋势和资源使用。
- 显示最新 logs、events、operation transition。
- 提供跳转提示，但不强制进入完整 console。

`fugue deploy --wait` 也可以吸收 monitor 语言，但仍应保持可退出、可复制、可在 CI 中降级。

## 10. 安全和权限边界

Terminal console 一旦支持点击操作，必须比普通网页更重视误触和可审计性。

规则：

- 重启、删除、failover、env 修改、runtime policy、admin 用户操作必须二次确认。
- 危险动作确认前显示目标 workspace、project、app、runtime、operation 类型和影响范围。
- 管理员模式必须明确显示当前 account / tenant / project 解析结果。
- env 查看 / 导出保持 Fugue CLI 产品原则：用户主动查看时默认可见，诊断包和可转发证据默认 redacted。
- 所有 mutating action 都应返回 operation id 或 action result。
- Terminal console 不保存额外 secret，不绕过现有 auth store。

## 11. 分阶段落地

### Phase 1：人类输出增强

目标：对应 P0-P3，不引入全屏 TUI，先建立兼容基线、terminal runtime、view model 和 rich text renderer。

- 新增 CLI terminal design system。
- 增加兼容测试和 renderer snapshot 测试。
- 抽取 `AppHealth`、`RoutePath`、`OperationTimeline`、`DiagnosisEvidence`。
- 改造 `app status`、`app overview`、`app diagnose`、`operation explain` 的 text 输出。
- 保持 JSON 输出完全不变。
- 给 `deploy --wait` 增加结构化 progress / route chain / diagnosis block。
- 同步建立 TUI snapshot 测试骨架，避免后续 UI 演进不可审计。

### Phase 2：Monitor 原型

目标：对应 P4，验证实时刷新、终端布局和降级策略。

- 实现 `fugue project watch` 或 `fugue admin cluster top`。
- 支持键盘导航、过滤、排序、暂停刷新。
- 非 TTY 降级为周期性 text snapshot 或直接提示使用 `--json`。
- 验证 inline / alternate screen 双模式，以及 terminal probe 超时 fallback。

### Phase 3：Terminal Console MVP

目标：对应 P5，形成可用的终端控制台。

- 实现 `fugue console`。
- 支持 projects、apps、operations、logs、runtime、admin 基础页。
- 支持 command palette 和对象搜索。
- 第一版 mutating action 可以限制在 restart / redeploy / cancel operation 等少数安全路径。
- 支持暂停 event stream，给未来外部 editor、shell、pager、exec 交互留接口。

### Phase 4：Web / Terminal IA 对齐

目标：对应 P7，让 Web console 和 Terminal console 成为同一产品的两个入口。

- 抽象共享 view model。
- 对齐对象命名、状态解释、权限错误和诊断证据。
- 把 Web 的项目 workbench 和 Terminal 的项目 workbench 对齐到同一套 route-first 信息架构。

### Phase 5：管理员 cockpit

目标：对应 P6，为平台管理员提供高密度控制平面状态。

- Users / workspaces / account resolve。
- Cluster nodes / runtime capacity / node policy。
- Edge / DNS / route health。
- Control plane operations。
- 只读优先，写操作逐步开放。

## 12. 风险

- TUI 不能破坏 CLI 的自动化价值。
- btop 风格不能污染 Web 的 Morlane 设计基线。
- 鼠标操作不能成为唯一操作方式。
- 重构不能把 `internal/cli` 一次性拆到不可 review；应按命令族和输出层分阶段移动。
- rich text 不能改变 JSON，也不能影响 env/export/db/api 这类复制型命令。
- 终端宽度、远程 SSH、tmux、低色彩终端、Windows Terminal 都需要降级策略。
- 终端能力探测不能让启动变慢；探测失败必须 fallback。
- inline mode 要避免破坏 shell scrollback，alternate screen 退出时必须恢复终端状态。
- 事件流不能在打开外部程序时继续抢 stdin。
- 高密度布局不能省略 loading、empty、error、permission、disabled、offline 状态。
- API 字段不能由 Terminal console 临时猜测，必须走 OpenAPI-first。
- 管理员操作不能绕过正式控制平面发布和审计路径。
- 如果未来引入 Rust sidecar，必须先明确安装、升级、auth、config、telemetry 和错误模型同步策略。

## 13. 初步开放问题

- TUI 入口命名使用 `fugue console` 还是 `fugue tui`？
- 是否允许 `fugue console` 默认进入当前目录绑定的 project？
- Terminal console 是否需要插件化页面，还是先内置固定页面？
- Web console 和 Terminal console 的共享 view model 放在 `fugue` 后端、`fugue-web` 产品层，还是由 OpenAPI 新增 console endpoints 提供？
- 第一批 mutating action 应该包含哪些？
- 是否需要主题文件，还是先只做内置 Fugue terminal theme？
- Windows / PowerShell 的支持范围从第一版开始做到什么程度？
- 第一版是否只使用 Go 内置 TUI，还是同时做 Rust sidecar spike？
- `fugue deploy --wait` 默认使用 inline renderer，还是保持现有文本并提供 `--ui`？
- TUI snapshot 测试在 Go 生态里选用哪个 VT100 / golden renderer？
- rich text 默认开启的范围如何控制：按命令 allowlist，还是全局 `FUGUE_CLI_RICH_TEXT` 实验开关？
- view model 放在 `internal/cli/viewmodel`，还是抽到更接近 API / console 的共享包？
- `--color`、`--interactive`、`--no-alt-screen` 是否作为全局 flag，还是只在 monitor / console 子命令里暴露？

## 14. 本次设计参考

本愿景受以下本地设计规则约束：

- `frontend-design`：Terminal console 要有明确产品场景，不做通用 AI 套板。
- `ckm:design-system`：Web / Terminal / CLI 需要共享语义 token 和组件层，而不是散落 ANSI 或 CSS。
- `design-taste-frontend`：高密度 cockpit 只用于监看和诊断，不用于所有产品表面。
- `site-architecture`：Web console 与 Terminal console 应被视为同一信息架构的两个入口。
- `normalize`：终端新体验必须对齐 Fugue 现有对象、状态和权限语言。
- `harden`：必须设计低能力终端、非 TTY、错误态、权限态、空态、长文本和危险动作确认。

本愿景也参考了本地 Codex 源码：

- `/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui/Cargo.toml`：确认 Codex TUI 使用 ratatui + crossterm，并配合 supports-color、textwrap、vt100、insta。
- `/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui/src/terminal_probe.rs`：学习 bounded startup probe。
- `/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui/src/tui.rs`：学习 inline / alt-screen、raw mode、bracketed paste、terminal restore。
- `/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui/src/tui/event_stream.rs`：学习 event stream pause / resume。
- `/Users/yanyuming/Downloads/GitHub/codex/codex-rs/tui/styles.md`：学习终端颜色和样式纪律。

# WP-09 COSS registry 同步审查

日期：2026-07-12
对象：`cosscom/coss@1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`

## 结论

Fugue Web 使用的是 COSS 的完整 workspace、registry、synced UI package、Base UI、
Tailwind v4、direct subpath exports 和 example consumer 架构，不是只复刻视觉样式。
可编辑 primitive 的唯一事实源是 `apps/ui/registry/default`，生成目标是
`packages/ui/src`，产品只能从 `@fugue/ui/*` 精确子路径消费。

用户已在本任务中明确要求完整采用 COSS 架构并在验收后发布；该产品要求本身不被解释
为法律签字，owner license sign-off 仍以对 MIT-only 边界的明确回复为准。工程执行采用
更保守的 MIT-only allow-list：只同步上游 `LICENSING.md` 明确覆盖的 `apps/ui/` 文件；没有
复制默认 AGPL 的 root、`packages/ui/`、`packages/typescript-config/` source，也没有复制虽
同为 MIT 但属于旧 Radix 路线的 `apps/origin/` source。
逐文件来源、SHA-256、本地修改和许可证见 `docs/upstream/coss-files.json`；NOTICE、最终
许可证门禁报告与发布 SBOM 分别见 `THIRD_PARTY_NOTICES.md`、`artifacts/licenses.json`
和 `artifacts/fugue-web.cdx.json`。旧的中途快照不作为 release evidence。

## shadcn dry-run 与逐文件 diff

2026-07-12 在完全隔离、无凭据的临时项目
`/private/tmp/fugue-coss-cli-audit-9Lfgzc` 中执行核对。临时项目把当前
`apps/ui/registry/default/{base-ui,hooks,lib,ui}` 和 `apps/ui/app/globals.css` 复制为
比较输入，并在临时 `components.json` 中声明
`@coss = https://coss.com/ui/r/{name}.json`；没有把 registry 命令指向产品工作树。

实际 runner 为仓库固定的 Bun `1.3.1`；
`bunx --bun shadcn@latest --version` 解析到 shadcn CLI `4.13.0`，退出码为 `0`。
`bunx --bun shadcn@latest info --json` 同样退出 `0`，确认 CLI 使用 `base`、RSC、
TypeScript、Tailwind v4，以及临时目录下的 registry aliases 和 CSS 路径。

在该临时目录执行的原始预览命令如下；两条命令退出码均为 `0`，全程没有使用
`--overwrite`：

```sh
bunx --bun shadcn@latest add @coss/ui @coss/style --dry-run
bunx --bun shadcn@latest add @coss/ui @coss/style --diff
```

无路径的 `--diff` 按 CLI 设计只显示前 5 个文件，并提示通过 `--diff <path>` 查看
指定文件。因此又对 dry-run 标出的 7 个候选路径逐一执行以下命令；7 次退出码均为
`0`：

```sh
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/badge.tsx
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/card.tsx
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/field.tsx
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/lib/utils.ts
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/tabs.tsx
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/group.tsx
bunx --bun shadcn@latest add @coss/ui @coss/style --diff registry/default/ui/input-group.tsx
```

本次 dry-run 解析 56 个文件：49 个与 CLI 解析后的官方 registry 产物完全相同，7 个
是候选覆盖；同时预览了 8 个 runtime dependencies、1 个 dev dependency、95 个 CSS
variables 和 3 个 font entries。命令结束后再次比较临时副本与产品源，61 个 registry
文件和 CSS 入口仍逐字节一致，证明预览没有写入产品或比较输入。

7 个 diff 均逐项审阅；前 5 个是已记录的 Fugue 本地偏差，后 2 个是 CLI 安装时的
格式/alias 变换，不是 pinned source 漂移：

| 路径 | CLI 候选变化 | 结论 |
| --- | --- | --- |
| `ui/badge.tsx` | 移除 dark destructive badge 的 `64%` semantic blend；另有纯格式变化 | 保留 Fugue 的 blend，保证小号 destructive 文本的实测 WCAG AA 对比；该偏差已记录在 provenance manifest |
| `ui/card.tsx` | 移除 `CardFrame` 的 isolated stacking context、pseudo layer z0 和直接子内容 z1 | 保留 Fugue 修复，避免 decoration 覆盖正文造成 washed-out 回归；该偏差有 source contract 和视觉证据 |
| `ui/field.tsx` | 删除 `FieldGroup` | 保留 typed `FieldGroup`，让产品表单复用同一 registry primitive，不在应用层创建第二套字段布局 |
| `ui/tabs.tsx` | 把默认 tab 文本从完整 semantic muted token 降为 `/72` alpha | 保留完整 token 以满足交互文本对比度；不改变 Base UI 状态机 |
| `ui/input-group.tsx` | 删除 addon 的 `role="group"`；其余为 generic formatting | 保留可访问分组语义；格式差异不影响行为 |
| `lib/utils.ts` | 调整 type import 顺序并移除 `cn` 的显式 `string` 返回类型 | 本地文件 SHA-256 与 pinned COSS source 完全一致；这是 shadcn CLI formatter 的目标形态，不登记为上游源码偏差 |
| `ui/group.tsx` | 把 pinned source 的 `@/lib/utils` 按临时项目配置改写为 `@/registry/default/lib/utils` | 本地文件 SHA-256 与 pinned COSS source 完全一致；这是 CLI install-time alias rewrite，正式 package alias 仍由 `ui:sync` 单向生成 |

官方 `https://coss.com/ui/r/{name}.json` 是 floating registry endpoint，不提供 commit-addressed
provenance；因此 CLI 预览只能证明“当前可安装产物”与本地 source 的兼容关系，不能替代
pinned commit。独立只读 checkout 的 `git rev-parse HEAD` 为
`1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`：其中 `lib/utils.ts`、`ui/group.tsx`
与本地逐字节一致，另外 5 个行为偏差均已写入 `docs/upstream/coss-files.json`。任何后续
同步仍需重新执行 dry-run、逐文件 diff、许可证检查、consumer 影响审查和完整质量矩阵，
再决定是否更新 pinned SHA；不得用 floating registry 静默改写 provenance。

## Registry 字体元数据与运行时字体边界

COSS 固定提交把两条字体链分开：`apps/ui` 的 registry metadata 描述组件安装者应取得的
字体与依赖，而正式应用运行时由 shared UI package 的字体模块、package export 和根 layout
CSS variables 负责。Fugue Web 采用同一工程边界：registry 继续声明获准的 Inter / Geist
依赖，`packages/ui/src/fonts/index.ts` 使用 `next/font/local` 读取已锁定 package 内的 WOFF2，
三个应用只从 `@fugue/ui/fonts` 导入并在 `<html>` 注入 `--font-sans`、`--font-heading` 和
`--font-mono`。semantic theme 只引用这些根变量；全局 CSS 不再直接导入 Fontsource。

字体模块是针对 Fugue 独立编写的实现，只参考 pinned COSS 的模块边界，没有复制上游默认
AGPL 路径 `packages/ui/src/fonts` 的源码。字体二进制也没有复制进仓库，仍由
`@fontsource-variable/inter` 与 `geist` package 提供；版本、完整性、许可证与资产来源继续
由 lockfile、NOTICE、SBOM 和 license gate 追踪。`theme:check` 同时验证 runtime export、
三个变量、依赖来源以及“禁止全局 Fontsource import”，防止 registry/runtime 两条链再次
混为一体。

当前 self-hosted Inter 文件有意限定为 Latin variable subset：正式 UI locale 为英文和中文，
中文以及用户内容中的其他未覆盖 script 通过明确的 Arial/Helvetica/sans-serif fallback 保持
可读，不为每次访问预加载未使用的 Greek/Cyrillic/Vietnamese 字体。后续如果新增对应产品
locale，应在 shared font module 中恢复经测量的 subset，并同步更新 preload、bundle、i18n
与 200% zoom 门禁；不得在单个页面临时加字体。

## Consumer 与 bundle 影响

- Marketing、Docs、Auth、Console 共用同一 UI package，但保留各自的信息架构。
- `/`、Docs、Auth 不导入 Console workbench、registry index、UI docs 或 particle code。
- `apps/web` 没有对 `apps/ui/registry`、generated registry JSON 或相对路径副本的 import。
- 最终 route bundle 预算由 `artifacts/route-bundles.json` 记录；截图位于
  `artifacts/visual/post-remediation/`，覆盖 public、Docs、Auth、authenticated Console
  的 desktop/mobile。

## 同步门禁

发布前和远端 CI 必须依次通过 registry dependency validation、registry build、
`ui:sync:check`、package exports、theme parity、format、lint、typecheck、unit、integration、
E2E、axe、style audit、bundle、license、SBOM 和 dependency audit。同步 PR/提交说明必须
包含 pinned upstream changelog、许可证结论、所有已记录的 local deviations、受影响 consumers、
截图和 bundle diff；本文件即本次固定证据。

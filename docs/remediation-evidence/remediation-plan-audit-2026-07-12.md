# 前端整改计划执行审计（2026-07-13 更新）

审计对象：`docs/frontend-code-review-remediation-plan-2026-07-12.md`
审计基线：当前本地 settled Fugue Web 工作树；后端权威为
`/Users/yanyuming/Downloads/GitHub/fugue@409bd6c57005f695d13a112ad78bb0d91ddb71e7`。
勾选原则：实现与自动化可以关闭本地工程项；owner 许可、commit/PR、远端 CI、生产
发布/观察、release archive 和人工视觉必须等动作真实发生后关闭。

## 1. 当前精确结果

- 计划共有 **605** 个 checkbox：**590 已勾，15 未勾**。
- 本轮把最终本地命令矩阵、Auth 成功流、Base UI keyboard/axe、后端正式发布证据与可由
  当前 artifacts 直接证明的 DoD/Gate 汇总项更新为 `[x]`。
- 已形成 13 个单一职责提交；项目 owner 已书面批准可使用全部 COSS 代码并归档许可证
  边界。[`fugue-web#1`](https://github.com/yym68686/fugue-web/pull/1) 的 17 个 required checks
  与 GitGuardian 全绿后，于 2026-07-13 合并为
  `3637670c38ca5fddc2e21e08868e51e5932e0f76`。合并后的
  [`frontend-quality` run 29216965612](https://github.com/yym68686/fugue-web/actions/runs/29216965612)
  也已全绿；生产首发已完成，流式 preauthorization follow-up 见
  `wp-13-protected-route-preauthorization.md`。尚未勾选稳定观察、closeout PR 或最终
  release archive。
- 在全新 `git clone --no-local` 的 `4f1aba057d358e840c41971147688692581b58bc`
  上依次执行 25 项文档化门禁，482 秒完成且 0 失败；E2E 正式使用
  `start-standalone.mjs`，没有 unsupported `next start` 警告。
- 当前 browser matrix 是 **205 个 Playwright project cases：107 passed、98 个预期
  capability skip、0 failed**；axe 独立矩阵是 **8/8 passed**。
- 当前有 **10 张** post-remediation 截图：marketing、Docs、sign-in、sign-up、Console
  各 desktop/mobile。desktop Console 初次人工复核发现的视觉缺陷已修复；desktop/mobile
  Console 截图已重新生成，10 张截图均已人工复核通过，且没有通过放大阈值掩盖回归。

## 2. settled tree 最终本地门禁

| 维度 | 结果与可复现证据 |
| --- | --- |
| 安装与源码质量 | `bun install --frozen-lockfile`、format、lint、typecheck 全部通过；lint 只有 7 个来自保留上游 COSS 行为/forced-motion 规则的非阻断 warning，0 error |
| i18n | 454 keys、`en`/`zh-CN`/`zh-TW` 三语言、0 violation；`artifacts/i18n.json` passed；减少的 1 个 key 来自删除会抢先 stream 的 root loading 文案 |
| OpenAPI | `openapi:sync:check`、`openapi:generate:check`、`contract:check` 全部通过；后端与 Web snapshot SHA-256 同为 `0344f43ac9803411c28c34127ccb92316eddad6e6c60cd144d9ada77922f49ed` |
| Registry/COSS | validate、build、sync drift、theme parity、upstream verify 全绿；72 个 registry items、73 个 JSON、4 个 lazy particles、68 个固定上游 MIT 文件 |
| Unit/integration | Web server/unit、`@fugue/ui`、registry、example 与 PostgreSQL integration 全绿；包含 DB concurrency、Auth provider/finalize、pagination、cache/race、错误边界 |
| Upload stress | 2 × 16 MiB 并发；RSS delta 41,107,456 B < 100,663,296 B；event-loop max 13 ms < 250 ms；临时目录清理成功；`artifacts/upload-stress.json` |
| E2E | Chromium desktop/mobile、WebKit desktop/mobile、Firefox desktop 的 205 cases：107 pass / 98 expected skip / 0 fail；新增 raw HTML/RSC/prefetch/HEAD preauthorization gate |
| Accessibility | 8/8；关键 routes、authenticated Console、Drawer、Base UI Tabs/Dialog/Table harness 均为 0 Critical/Serious axe，覆盖 keyboard、Escape、focus return、roving focus/manual activation |
| Style/visual | static inventory 18/18 routes、23 states、10 contracts、768 matrix cells、0 violation；rendered assertions 由 Playwright/axe/screenshots 承担；修复后的 10 张 desktop/mobile 截图已人工复核通过 |
| Security/license/version | dependency audit 0 Critical/High/Moderate/Low；secret-output scan 0；clean-install license/SBOM gate passed（68 COSS files、54 byte-identical、592 dependency components、6 workspace components）；Next 16.2.10、React 19.2.7、Base UI 1.6.0、Tailwind 4.1.17、TypeScript 5.9.3 单版本 |
| Build/bundle | Turbo build 通过；同一 build 立即读取的 bundle gate 覆盖 19 routes，最大 `/new/template/[slug]` 243,017 B gzip < 256,000 B；public/auth 不加载 Console workbench chunk |
| Container | 实际构建镜像；non-root、health、homepage、forbidden paths、cache/Vary contract 全绿；容器与临时镜像已清理；`artifacts/container.json` |

这些结果支持主计划第 1182–1206 行的本地命令项。下一节只记录首版 PR 的远端 CI；
当前 preauthorization follow-up 的 required checks 尚待新 PR 绑定其提交 SHA 后补充。

### 2.1 远端 required checks

- PR：[`fugue-web#1`](https://github.com/yym68686/fugue-web/pull/1)。
- Workflow：[`frontend-quality` run 29216177426](https://github.com/yym68686/fugue-web/actions/runs/29216177426)。
- 17/17 required GitHub Actions contexts 全部 `SUCCESS`；额外 GitGuardian check 也为
  `SUCCESS`。
- `main` branch protection 使用 `strict=true`、`enforce_admins=true`，17 个 context 均
  绑定 GitHub Actions `app_id=15368`。
- 首轮 dependency-review 因仓库 dependency graph 未启用而失败；启用 graph 后通过。
- 首轮 GitGuardian 将三个 CI PostgreSQL 示例密码识别为 secret；workflow 改用隔离
  runner 的 passwordless service，并从 PR 历史移除示例密码后通过。
- 上述 workflow 不作为当前 follow-up 的 CI 证明；主计划 Gate B 对应项已重新打开。

## 3. Auth、权限与产品行为复核

- C-01/C-02 已有空库、并发 bootstrap、session version、blocked/deleted/demoted 下一请求
  失权和全 mutation guard 证据。
- email-link 与 password 的 sign-in/sign-up 覆盖 verification、session handoff、safe
  `returnTo`、成功、失败、replay 与 expiry。
- Google/GitHub 各自覆盖 sign-in 与 sign-up；测试走完整 start/callback、state、browser
  nonce、PKCE token exchange/profile、transaction consume 和 finalize route，只把外部
  provider HTTP 端点替换为确定性 fixture，不绕过产品 route。
- OAuth nonce/provider/TTL/PKCE 失败不会签发 session，并清理 browser/server state；
  callback 最多一次成功。
- Base UI contract harness 与 authenticated Console E2E 共同覆盖 Dialog、Drawer、Tabs、
  Form/Field、Table、Sidebar、Env row identity、focus return 与 keyboard-only product flow。

因此主计划的 Google/GitHub 正常成功、sign-in/sign-up/finalize 和 Base UI contract 项已
勾选；生产事件观察仍由发布后的真实窗口负责。

## 4. 后端权威与正式发布证据

- 后端 feature commits：stream `c7643eec48b177c19bb7f2784d5fed9d265022f6`、data
  transfer/database import `9cb026971b79c02ad6dee66cb318f82e6739fc64`、edge/archive
  `5246335069f92939803b9fd6b9d8777785fe6980`。
- 组合 commit `5246335` 已进入 `fugue/main`，并由
  [`deploy-control-plane.yml` run 29197487888](https://github.com/yym68686/fugue/actions/runs/29197487888)
  成功发布；没有用 SSH 热修、手工重启或 patch Deployment 代替正式链路。
- 当前 `fugue/main` 是 `409bd6c57005f695d13a112ad78bb0d91ddb71e7`，且
  `git merge-base --is-ancestor 5246335 409bd6c` 成功。
- Web snapshot 与该当前权威 OpenAPI hash 完全一致；远端
  `contract / authoritative OpenAPI contract` required check 已通过。

逐协议细节见 `wp-06-contract-protocol-audit.md`。

## 5. 生产观测准备与边界

代码已有六类不含 secret 的结构化事件：

- `fugue_web_session_rejection`
- `fugue_web_oauth_callback`
- `fugue_web_auth_rate_limit`
- `fugue_web_auth_email`
- `fugue_web_local_upload`
- `fugue_web_client_telemetry`

字段、安全边界、测试和发布后查询矩阵见 `wp-13-production-observability.md`。首版 Fugue
Web 已由正式自动链路发布；本次 preauthorization follow-up 尚未发布，且其观察窗口与
回滚负责人尚未归档，因此所有生产监控 checkbox 仍是 `[ ]`。

## 6. 剩余 15 个未勾项

以下行号对应本次审计后的计划文件。

### 6.1 Merge、CI 与 closeout PR（3 项）

- 359：必须由当前 implementation PR 与计划中的发布后 closeout PR 共同证明。
- 1287：preauthorization follow-up 尚未走完正常 code review、CI、merge 与发布流程。
- 1383：首版 required CI 已通过，但尚无绑定当前 follow-up SHA 的 required checks。

### 6.2 Release archive（2 项）

- 1110、1347：NOTICE/provenance/SBOM 虽已在本地生成，但尚未随实际 release 归档。

Owner 已明确批准“可以使用全部代码”。批准解释、实际更窄的 MIT-only release 边界和
持续义务见 `wp-09-owner-license-approval.md`。

### 6.3 生产发布后观察与 closeout（10 项）

- 1290：没有发生紧急热修；如果后续发生，才可用“同任务回写 + 正式 Actions”证据关闭。
- 1298–1304：session/OAuth/status/admin/upload/email/Web Vitals/client-error 必须在真实
  生产窗口查询；事件代码就绪不等于已观察。
- 1353、1394：监控结果、回滚负责人和窗口起止尚未归档；由发布后 closeout PR 关闭。

## 7. 下一次审计的最小输入

1. 最终 follow-up commits、PR、rollback map 和用户改动隔离证明。
2. Fugue Web production version/operation、管理员预检、观察窗口、回滚 owner 和指标结果。
3. 发布后 closeout PR 与 NOTICE/provenance/SBOM release archive。

在这些证据真实产生前，不应为了让计数归零而提前勾选剩余 15 项。

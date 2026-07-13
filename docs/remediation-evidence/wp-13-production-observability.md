# WP-13 生产观测与发布窗口证据

日期：2026-07-13
状态：**结构化事件与本地回归已就绪；follow-up release 尚未发布，采集完整性修复、生产采样、观察窗口和回滚负责人未关闭。**

本文件把“代码已有可观测事件”和“发布后已经观察”严格分开。事件存在、单测通过或
本地压力测试通过，都不能提前勾选主计划的生产监控 TODO。

## 1. 已实现的结构化事件

| 事件 | 安全字段 | 用途 | 当前自动化证据 |
| --- | --- | --- | --- |
| `fugue_web_session_rejection` | `reason`、截断的 SHA-256 `subject`；不记录 Cookie、token 或完整邮箱 | 按 `invalid-signature-or-expired`、`legacy-or-invalid-claims`、`blocked`、`deleted`、`missing-user`、`stale-version`、`role-mismatch:*` 等原因观察会话拒绝 | session/authorization unit 与 DB integration |
| `fugue_web_oauth_callback` | `provider`、`stage=callback`、`outcome`、allow-list `reason` | 观察 Google/GitHub state、nonce、PKCE、provider exchange、账号状态和 transaction store 失败 | `auth-telemetry.test.ts`、`auth-security.test.ts` |
| `fugue_web_auth_rate_limit` | `policy`、`outcome=allowed/limited`；不记录 IP、email、bucket key 或 secret | 以全部已完成 rate-limit decision 为分母，按 email/password/OAuth/finalize policy 统计 429 命中率 | rate-limit unit/integration、identifier-free telemetry unit 与 429 产品场景 |
| `fugue_web_auth_email` | `flow`、`stage=delivery`、`outcome=sent/failed`；失败只附受限 `category` | 以 provider 已返回的 sent/failed 为分母，统计 email-link / password-signup 邮件失败率 | `auth-telemetry.test.ts` 与 Auth integration |
| `fugue_web_local_upload` | 字节数、文件数、耗时、RSS、cleanup、outcome、受限 rejection/status；不记录路径、文件内容或凭据 | 观察峰值 RSS、413/429/timeout/abort、清理失败和压缩/归档耗时 | upload unit、integration、`artifacts/upload-stress.json` |
| `fugue_web_client_telemetry` | `kind`、route group；每次 route view 提供分母，Web Vital 使用 `name/rating/value`，client error 使用受限 `source` | 按公开页/Auth/Console 路由组观察 Web Vitals，并以 route view 为分母计算客户端异常率 | `client-telemetry.test.ts`、same-origin/body-limit tests |

管理员 bootstrap、恢复、角色/状态变更、session revoke 与高权限 mutation 另外写入
`app_security_audit_events`，其 `action` 为类型化 allow-list；这类持久化审计记录与上述
stdout JSON event 不能互相替代。

## 2. 发布后必须实际执行的观察

下面是 release candidate 的最小查询矩阵，不是已经发生的生产结果：

| 信号 | 发布前基线 | 发布后判断 | 当前状态 |
| --- | --- | --- | --- |
| session rejection | 按 `reason` 的计数/比例 | 比较发布前后；`stale-version` 的计划内峰值需与重新登录窗口一致，`blocked/deleted` 不得伴随成功写入 | 待生产采样 |
| OAuth callback | provider × outcome × reason | callback replay、state/nonce/PKCE failure 不得出现成功 session；provider failure 突增触发回滚评估 | 待生产采样 |
| Auth rate limit / email | policy 命中率、429、503、邮件 failure | 防护命中可解释；共享存储或 provider 故障不得持续，不能通过关闭限流止血 | 待生产采样 |
| HTTP 401/403/413/429 | route/status access-log 聚合 | 与结构化事件对齐；异常增长需按 Auth、权限、上传分别定位 | 待生产采样 |
| Admin audit | action 的 requested/completed、bootstrap/recovery/role/status | 不得出现未授权 bootstrap；requested 无 completed 必须人工核对远端副作用 | 待生产采样 |
| Upload | outcome/rejection、RSS delta、cleanup、duration | 413/429 失败关闭；临时目录清理成功；RSS 与持续时间不出现无界增长 | 待生产采样 |
| Browser quality | route × Web Vital rating、client-error source | 与本地 bundle/CWV 基线比较；Console/root boundary 错误率不能持续上升 | 待生产采样 |

## 3. 生产采集完整性审计与前向修复

2026-07-13 对当前首版生产链路做安全 canary：edge pod 直接日志中存在带 app id、request
id、path template 与 200 status 的 canonical request fact，但同时间窗口的
`fugue app observability export` 缺失该事件；Web pod 直接日志中存在合法的
`fugue_web_client_telemetry`，Loki 查询也缺失。当前 exporter 的 `available` 只表示查询
后端执行成功，不表示采集覆盖完整，因此所有 stdout 事件只能视为未知比例的下界，不能
用等待 60 分钟或 24 小时掩盖缺口。

根因与正式修复属于 `fugue` 控制平面：高 target 数下的全局 `TailLines` 均分会在 kube API
端预先截断高流量 edge 日志，固定 30 秒 lookback 又小于慢/不可达 kubelet 拉长后的实际
轮询周期。修复必须进入 `fugue` 仓库、通过 Go/OpenAPI 门禁并由
`deploy-control-plane.yml` 发布；本任务不做 SSH、Deployment patch 或手工重启。

另一个独立缺口是 `https://web.fugue.pro` 曾直接返回 200，而配置的 canonical origin 是
`https://fugue.pro`，使 alternate-host 页面发送的 same-origin telemetry 被服务器按预期
拒绝。当前 follow-up 在 rendered GET/HEAD 边界增加受信配置驱动的 308 redirect，完整保留
path/query；API origin 校验没有放宽。unit 与真实 Next production-server E2E 同时验证
alternate host → canonical host，以及 forged forwarded host 不影响 Auth redirect。

## 4. 未关闭的 owner/window Gate

- Fugue Web 正式版本、镜像/operation SHA：待 frontend commit、PR、CI、merge 和生产发布。
- 观察窗口：尚未由发布负责人确认。建议至少包含发布后连续 60 分钟即时窗口和 24 小时
  稳定窗口，但在 owner 明确接受前不把该建议写成已就绪事实。
- 回滚负责人及联系方式：待项目 owner 指定。
- 生产日志/指标查询链接、脱敏截图或导出：待发布后补写。
- closeout PR：必须归档最终版本、窗口起止、各信号基线/结果、异常处置和 owner 结论。

因此，主计划第 14 节的监控与告警、Definition of Done 中的观察窗口，以及 Gate C 的
发布后监控项继续保持 `[ ]`。

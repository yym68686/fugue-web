# WP-06 OpenAPI 契约与特殊协议审计

日期：2026-07-13
当前唯一权威来源：`/Users/yanyuming/Downloads/GitHub/fugue@710f7d29eadefd880225ff7cbdb40c5cc62bd4d0/openapi/openapi.yaml`。

本文件记录协议本身、正式 handler/store 实现、Fugue Web consumer 与可验证的退出
条件。`apps/web/openapi/fugue.yaml` 和
`apps/web/lib/fugue/openapi.generated.ts` 只是由权威契约生成的派生产物，不作为
本地事实源，也不允许手改。

## 特殊协议逐项签字

| 类别 | 权威契约与后端实现 | Fugue Web consumer/adapter | 失败关闭与资源边界 | 自动化证据 |
| --- | --- | --- | --- | --- |
| Source upload | `POST /v1/templates/inspect-upload`、`POST /v1/apps/import-upload`；只接受一个 JSON `request` 与一个 `archive`；archive 128 MiB、envelope 160 MiB、2 并发、300 秒；415 校验 media type/扩展名/magic | 两个 exact BFF upload path；`local-upload-server.ts` 使用流式 multipart、私有临时目录与流式 tar/gzip，不调用 `formData()`、上传文件 `arrayBuffer()` 或 archive `Buffer.concat` | 已知 `Content-Length` 读 body 前拒绝，chunked 持续计数；400/408/413/415/429 保留，429 透传 `Retry-After`；client abort、timeout、上游失败均清理 | `local-upload-server.test.ts`、`request-json.test.ts`、`upload-stress.test.ts`；完整资源证据见 `wp-04-upload-resource-safety.md` |
| Database import | `POST /v1/apps/{id}/database/import`；必须恰好一个 64 KiB JSON `request` 和一个 128 MiB `dump`，envelope 130 MiB；gzip 解压最多 256 MiB；明确声明不是端到端 streaming | 当前 Web 没有自行猜测数据库导入 multipart；生成类型保留正式 schema，后续 consumer 必须按该 schema 接入 | 只接受 `multipart/form-data` 与 `form-data` disposition；拒绝 unknown/duplicate/伪装 part；临时文件 `0600`；bounded BYTEA 读取；400/413/415 | `app_database_import_test.go` 覆盖重复字段、未知字段、错误 disposition、request/dump/envelope/gzip 上限与清理 |
| Log snapshot | build/runtime logs 的普通 GET 是有界 JSON snapshot；`tail_lines` 为 1..5000，默认 200 | workbench lazy Logs panel 使用对应 BFF snapshot；build/runtime endpoint identity 分离 | late response/identity 不匹配时丢弃；403/404/network 可显式 retry；空日志显示 Empty state | workbench endpoint/race browser tests 与 server route tests |
| SSE streams | build/runtime log stream 支持 `follow`、opaque `cursor`、`Last-Event-ID`；observability request stream 支持严格过滤、`limit` 1..1000、`until`、lossless `(timestamp, request_id)` cursor、ASC tie-breaker 与有界 batch | `lib/fugue/stream.ts` 只透传正式 stream，不解释未声明 event payload；转发 `Last-Event-ID`，保留 backpressure、Content-Type 与 no-buffer headers | 非 2xx 不伪装成 SSE；client abort 取消 reader；`no-cache, no-store, must-revalidate, no-transform`；`X-Accel-Buffering: no`；非法 cursor/filter 返回 400；显式 `until` 不被 follow 越过 | `app_observability_test.go` 锁定 timestamp tie、filter、limit 与 until；Web stream tests 锁定 abort/header/error boundary |
| Poll/retry | 普通 JSON endpoint 没有隐式“最终成功”协议 | runtime target inventory 只有 1 秒/3 秒两次有界 retry；其余 endpoint 由用户显式 retry | timer cleanup；unmount/resource identity 使结果失效；429 尊重 `Retry-After`；不无限轮询、不跨资源复用错误 | `runtime-target-inventory-retry` unit tests、resource switch browser tests |
| Pagination | `GET /v1/apps` 使用 opaque、scope/filter/sort-bound keyset cursor；Web user store 使用稳定 keyset；legacy caller 省略分页参数时保持旧响应形状 | admin apps `limit <= 200`、admin users `limit <= 100`；UI 只保留当前页和 cursor stack，搜索切换会 abort/reset | malformed、expired、scope/filter/sort mismatch cursor 返回 400；不降级为全量读取；hydration 只发生于返回页 | 10,037 users 与 10,037 apps 遍历、forward/back、无重复遗漏和 PostgreSQL `EXPLAIN`；见 `wp-11-admin-pagination.md` |
| Data blob download/upload | `GET/PUT /v1/data/blobs/{sha256}` 要求 canonical lowercase 64-hex digest 且 blob 属于 active transfer plan；GET 支持单 Range、ETag/IMS/If-Range；PUT 只接受 exact-size octet-stream | 当前 Web 没有 data blob consumer；只保留 generated contract，不发明 token、Range 或 checkpoint 行为 | GET 为 200/206/304/JSON 416；PUT 的 Content-Length 和 chunked body 都必须精确匹配 plan，超限 413、短包 400、media type 错误 415，失败不 commit；checkpoint 不能改 immutable digest/size/object/upload/part | `data_blob_security_test.go`、`data_workspace_blob_test.go`、S3/MinIO CLI integration |
| Source archive download | `GET /v1/source-uploads/{upload_id}/archive` 返回 `application/octet-stream`、准确 `Content-Length` 与经 `mime.FormatMediaType` 生成的 attachment filename | 当前 Web 没有 archive download consumer；未来接入必须从 generated response/header contract 开始 | filename 不手工拼接，避免 header injection；store error 继续使用统一 JSON error | `import_upload_test.go` 覆盖 type、length、disposition 与安全 filename |
| Error model / Edge TLS ask | 普通失败使用 `ErrorResponse`；`GET /v1/edge/tls/ask?domain=` 成功为 `text/plain` 的 `ok`，400/403/404/500/502 为 JSON `ErrorResponse` | `requestJson`/product route 按 status 与契约 error 读取；公开错误先做 bounded read 与稳定清洗 | 非 JSON/空 body 使用稳定 fallback；错误 body 最多读取 64 KiB；不把 error/cache 写入其他 resource identity；日志、诊断与报告不记录 bearer/secret | `request-json.test.ts`、`read-bounded-response-body` tests、`app_domains_test.go`、OpenAPI response tests |

## Deprecated 字段退出条件

Deprecated 兼容不是永久双协议。每个字段都按
`expand -> consumer migration -> telemetry window -> contract` 顺序退出；删除前必须同时
满足下表所有条件，不能只因为 Fugue Web 当前不用就删除后端兼容。

| 字段 | 当前兼容位置 | 可量化退出条件 | 删除动作 |
| --- | --- | --- | --- |
| `App.source` | OpenAPI response 仍标 deprecated；Fugue Web 只在 generated-contract adapter 使用 `app.buildSource ?? app.source`，业务 consumer 只看 `buildSource`；后端内部持久化模型仍可保留 `Source`，它不是公网 consumer 证据 | 所有受支持 control-plane 均稳定返回 `build_source`；所有第一方 API/CLI/Web consumer 对 response `source` 的扫描为零；最老受支持 CLI 已超过兼容窗口；API 响应字段使用遥测连续至少 2 个 release train 且不少于 30 天为零 | 先删除 adapter fallback 与对应 contract test allowance，再从 OpenAPI response 删除 `source`、生成并发布后端，最后同步 Web snapshot/types；后端内部字段是否重命名是独立迁移 |
| `force_publish` | OpenAPI request alias、handler normalization、旧 `artifact.force_publish` scope 和 CLI `--force-publish` 仍存在；CLI 会规范化为 `soft_override` 且不发送旧字段 | 最老受支持 CLI 已使用 `--soft-override`；deprecated flag、request field、旧 scope 的独立遥测连续至少 2 个 release train 且不少于 30 天为零；所有持久化/重放 payload 已迁移；文档与自动化不再生成旧字段 | 先移除 CLI deprecated flag/scope fallback，再拒绝新 `force_publish` 写入一个兼容窗口，最后从 model/OpenAPI/handler 删除 alias；不得扩大 `soft_override` 的安全能力 |
| 六个 verification boolean | OpenAPI 同时接受旧 boolean 与 `*_state`；API/CLI 对冲突输入 fail closed；CLI 仍公开 legacy flags 和 state flags | 六个 legacy CLI flag 与 JSON field 分别有零使用遥测，连续至少 2 个 release train 且不少于 30 天；最老受支持 CLI 已发送 state；历史 request/job/replay payload 已迁移；不存在只理解 boolean 的第一方 consumer | 先让 CLI 只产生 state，随后在 API 拒绝 legacy write，再从 OpenAPI 与 wire structs 删除 boolean；read model 的 bool 可作为内部 derived pass 状态，但不得继续作为公网协议 |

当前尚未具备独立的 deprecated-field 使用遥测，因此本次完成的是“明确、可测试的退出条件”，
不是伪称兼容字段已经可以删除。任何后续删除 PR 都必须附对应观察窗口查询和最老受支持
CLI 版本证据。

## 自动化与发布顺序

- 后端变更先落在权威 OpenAPI，再运行 `make generate-openapi`、
  `make generate-openapi-check` 和 `make test`；generated `internal/apispec/spec_gen.go`
  不手写。
- 后端正式发布并成为 `fugue/main` 后，Web 才运行 `bun run openapi:sync`、
  `bun run openapi:generate` 和 `bun run contract:check`。
- `.github/workflows/contract-drift.yml` 从 `fugue/main` 拉取权威契约，并执行 snapshot
  drift、generated drift 与 TypeScript typecheck。
- `openapi-adapter-contract.test.mjs` 保证 `App.source` 兼容只存在于 adapter；上传压力、
  SSE cursor、分页遍历、Range、error body cap 和资源切换 race 各由独立测试覆盖，
  不把一次 200 response 当作协议验收。
- 本轮协议实现已经拆成三个可追溯的后端 feature commit：
  - stream：`c7643eec48b177c19bb7f2784d5fed9d265022f6`；
  - data transfer / database import：`9cb026971b79c02ad6dee66cb318f82e6739fc64`；
  - edge / source archive / response contract：`5246335069f92939803b9fd6b9d8777785fe6980`。
- 组合后的 `5246335069f92939803b9fd6b9d8777785fe6980` 已进入正式
  `fugue/main`，并由
  [`deploy-control-plane.yml` run 29197487888](https://github.com/yym68686/fugue/actions/runs/29197487888)
  成功发布；没有用手工 SSH、手工 patch Deployment 或手工同步镜像替代正式链路。
- 截至 2026-07-13，本地与远端 `fugue/main` 已继续推进到
  `710f7d29eadefd880225ff7cbdb40c5cc62bd4d0`；`git merge-base --is-ancestor
  5246335 710f7d2` 返回成功，因此上述 feature 仍是当前权威历史的一部分，而不是临时
  分支事实。
- 当前后端权威 `openapi/openapi.yaml` 与 Web 派生 snapshot
  `apps/web/openapi/fugue.yaml` 的 SHA-256 均为
  `0344f43ac9803411c28c34127ccb92316eddad6e6c60cd144d9ada77922f49ed`；
  `openapi:sync:check`、`openapi:generate:check` 与 `contract:check` 已在同一 settled
  Web 工作树通过。
- Fugue Web 的最终 commit SHA 仍待正式 commit。发布证据必须在 commit 后补写该 SHA，
  并由远端 contract CI 再次验证；本地 snapshot hash 一致不能替代尚未发生的 Web PR/CI。

# WP-04 上传资源安全验收证据

日期：2026-07-12
范围：浏览器 -> `fugue-web` Route Handler -> Fugue control plane -> Fugue Edge/Caddy

## 权威契约

权威来源是 `fugue/openapi/openapi.yaml`。`POST /v1/templates/inspect-upload` 与
`POST /v1/apps/import-upload` 现在明确声明：

- content type 必须是 `multipart/form-data`；
- 只能有一个 JSON `request` 字段和一个 `archive` 文件；
- archive 最大为 `134217728` bytes（128 MiB）；
- 完整 multipart request 最大为 `167772160` bytes（160 MiB）；
- 仅接受 `.zip`、`.tgz`、`.tar.gz`，并校验扩展名与 magic bytes 一致；
- 稳定错误状态为 400、408、413、415、429，其他服务端错误仍使用统一
  `ErrorResponse`；429 带 `Retry-After`。

后端先修改 OpenAPI，再运行 `make generate-openapi`；前端随后执行
`bun run openapi:sync` 与 `bun run openapi:generate`。生成文件未手改。

## 各层资源边界

### Fugue Web 入口

`apps/web/lib/fugue/local-upload-server.ts`：

- 已移除 `request.formData()`、上传文件 `arrayBuffer()` 与 archive
  `Buffer.concat` 的全量上传路径；multipart 按 64 KiB chunk 读取并带
  backpressure；
- request-scoped 临时目录权限为 `0700`，文件为 `0600`；成功、解析失败、
  client abort、timeout 和 upstream failure 都执行清理；
- `Content-Length` 仅用于读 body 前快速拒绝；缺失时仍由流式累计值执行
  130 MiB request limit；
- archive/source 总量 128 MiB、单文件 128 MiB、最多 1024 文件、路径 255
  bytes、深度 32；拒绝绝对路径、`..`、反斜杠歧义、NUL、重复路径、链接、
  设备文件、ZIP/TAR 元数据越界与解压后超限；
- 每个实例最多同时处理 2 个上传，超限返回 429 + `Retry-After: 5`；
- 整个解析、归档和上游上传共享 5 分钟 abort signal；
- 上游 408/413/415/429 状态与 `Retry-After` 不再被折叠为 500，UI 的
  `RequestError` 保留状态并给 429 显示可恢复等待信息；
- 日志记录 duration、request/source/archive bytes、file count、拒绝原因、
  cleanup 结果和 peak RSS，不记录文件内容或 token。

### Fugue control plane

`internal/api/import_upload.go` 与 `internal/api/template_inspect_upload.go`：

- 在读取 body 前检查 media type 和已知 `Content-Length`；
- `http.MaxBytesReader` 对 chunked/未知长度请求持续执行 160 MiB 硬上限；
- `ParseMultipartForm(32 MiB)` 将大文件部分落到临时文件，并由
  `MultipartForm.RemoveAll()` 清理；
- 精确校验字段/文件数量和未知字段，archive header size 与实际读取量都受
  128 MiB 上限保护；
- 每个 API 实例共享 2 个 source-upload slot，inspect/import 共用预算；
- 5 分钟 deadline 会关闭仍在读取的 body；超容量稳定返回 429 和
  `Retry-After: 5`；
- `httpx` 为 408/413/415/429 提供稳定 code/category/retryable 分类。

### Edge / Caddy / Ingress

`fugue` Edge 现在通过应用显式声明的
`FUGUE_EDGE_REQUEST_BODY_POLICIES` 元数据执行第二层防御，不硬编码 Fugue Web
hostname，也不对其他租户应用或普通 multipart 建立全局限制。Fugue Web 的
`docker-compose.yml` 声明一个 `source-imports` policy，只匹配：

- `POST /api/fugue/apps/import-upload`；
- `POST /api/fugue/projects/create-and-import-upload`。

该 policy 与应用入口保持一致：完整 body 最大 `167772160` bytes、deadline 300
秒、两个 exact path 在同一 app 内共享 2 个并发 slot，容量不足时返回 429 和
`Retry-After: 5`。实现边界如下：

- control plane 严格解析 app metadata，拒绝未知字段、非规范化 path、重叠规则和
  无界数值；非法 opt-in policy 会令对应 route fail-closed；
- policy 进入签名 `EdgeRouteBinding` 和 route generation material，不能由公网请求
  header 临时开启或改变；
- 已知 `Content-Length` 在连接 origin 前返回 413；chunked/未知长度由 counting
  `ReadCloser` 持续限制，最多向 origin 转发上限内字节，超出后稳定返回 413；
- Edge 不预读完整 body、不复制 archive、不落盘；pipe/backpressure 测试证明
  origin 在客户端完成上传前即可收到首字节；
- deadline 通过 request context 取消 upstream 并映射为 408；slot 在成功、超限、
  timeout、client abort 和 upstream failure 后均由 `defer` 释放；
- 并发 guard 以 `app_id + policy name` 隔离；同一 app 的两个路径共享预算，不同 app
  互不占用。

原有 `edge.requestBodyBuffer.maxBytes=16 MiB` 保持不变。该配置是 JSON SSE 请求的
可重放磁盘 buffer，不是通用上传限制：

- `internal/edge/service.go:requestBodyBufferEligible` 要求请求同时是 SSE、
  有 request body，并且 media type 是 `application/json`/`+json`；
- browser multipart 上传没有 `Accept: text/event-stream`，content type 也不是
  JSON，因此不会进入该 buffer，也不会被 16 MiB 值拒绝；
- `internal/edge/upload_proxy_test.go` 用 3-byte SSE replay-buffer 上限验证非匹配
  multipart body 仍按 backpressure 完整流到 origin，且不占 buffer reservation；
- `internal/edge/request_body_policy_test.go` 验证 preflight/chunked 413、exact-size
  success、普通 multipart 不受影响、无预读流式转发、跨路径并发 429、slot 释放和
  timeout 408；
- Caddy 配置是到 Fugue Edge proxy 的直接 `reverse_proxy`，没有第二个隐式
  body buffer；生产 HA values 中 `ingress.enabled: false`。

可信代理链也已固定为 `client -> Caddy -> Edge -> Fugue Web`：Caddy 生成配置覆盖
客户端传入的 `X-Forwarded-For`，只写连接身份；Edge proxy listener 在 Caddy 模式
下必须绑定显式 `127.0.0.1`/`::1`，并只保留 Caddy 写入的最后一项后追加自己的
loopback hop。Fugue Web 发布配置必须使用 `AUTH_TRUST_PROXY_HEADERS=true` 与
`AUTH_TRUSTED_PROXY_HOPS=2`；按该链路部署后，公网客户端不能伪造第一个可信 hop。

## 明确的上游内存边界

control plane 当前的 source-upload 持久化接口仍是
`CreateSourceUpload(..., archive []byte)`，PostgreSQL 仍写入 `BYTEA`；因此
`decodeImportUploadMultipart` 会从已落盘 multipart part 读取最多 128 MiB 到一个
`[]byte`。这不是 Fugue Web 原 H-04 的多副本 OOM 路径，且现在被 128 MiB 单请求
上限、2 请求并发上限和 5 分钟 deadline 严格约束，但它也不能被描述为后端
端到端零拷贝流式持久化。若未来要消除这一个有界 `[]byte`，必须先把 store 与
source importer 的正式接口改为 stream/file/object reference；不能在前端伪装
为已完成。

## 自动化证据

- `make generate-openapi`、`make generate-openapi-check`（fugue）：通过。
- `go test ./internal/model ./internal/releaseflow ./internal/api ./internal/edge`：通过；
  其中 `go test ./internal/edge -count=1` 通过全部 Edge package 测试。
- 定向 Go 测试：unsupported media、读 body 前 Content-Length 413、archive 413、
  magic mismatch 415、stalled body 408、并发 429 + Retry-After、Edge exact-route
  preflight/chunked 413、无预读流式透传、普通 multipart 隔离、Caddy XFF 清洗和
  loopback listener fail-closed 均通过。
- `bun run openapi:sync:check`：通过。
- `bun run openapi:generate:check`：通过。
- `bun test ... local-upload-server.test.ts request-json.test.ts`：13/13 通过。
- `bun run --cwd apps/web test:upload-stress`：通过；2 个并发 16 MiB 上传，
  RSS delta `48955392` bytes（预算 `100663296`），最大事件循环间隔 `11.19 ms`
  （预算 `250 ms`），临时目录零泄漏。
- 压测机器可复核产物：`artifacts/upload-stress.json`。

## 回滚边界

- 前端回滚不得恢复 `formData()`/`arrayBuffer()`/archive chunk 数组全量缓冲；
- 后端回滚不得移除 128/160 MiB、2 并发和 5 分钟 deadline；
- Edge policy 必须继续从 app-scoped、签名 route metadata 下发；不要把 JSON SSE
  replay-buffer 的 16 MiB 值误当上传契约，也不要把这两个 exact path 的规则扩大为
  所有租户 app 的全局 multipart 限制。

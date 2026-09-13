# Fugue 五层架构重构方案

> 目标：让 Fugue 真正遵循 `configuration intent → constraint policy → signed immutable artifact → runtime facts → code execution` 五层模型，并保证代码发布与配置发布相互独立。

## 目标架构

```text
Configuration Intent
        ↓
Constraint Policy
        ↓
Deterministic Compiler
        ↓
Signed Immutable Artifact
        ↓
Release Set
        ↓
Consumer Apply
        ↓
Runtime Facts / ACK / LKG
```

核心规则：

- intent 描述应该服务什么；
- policy 描述哪些变化被允许；
- artifact 是已经批准并可执行的具体内容；
- runtime facts 描述实际发生了什么；
- code 只提供编译、校验和执行机制；
- 代码发布失败不能影响当前 serving artifact；
- 配置发布失败必须保留上一份 positive LKG。

## 当前状态判断

Fugue 已经具备相当一部分基础设施：`PlatformArtifact` 已有 generation、content hash、签名、验证状态、release channel、fencing token 和 LKG；Edge 与 DNS 也有签名校验、本地缓存和过期控制。

主要缺口是：

- serving intent 仍分散在业务表、环境变量和即时计算逻辑中；
- route/DNS bundle 仍可能从 mutable app、domain、runtime 状态即时推导；
- policy 参数和决策分散在代码与环境变量中；
- route、DNS、TLS、cache 等 artifact 没有统一的一等 ReleaseSet；
- runtime facts、期望状态和 release ledger 仍需要进一步分离；
- executor 仍需要逐步脱离控制面业务数据库。

## 需要删除的内容

### 删除 serving intent 环境变量

迁移完成后，以下变量不得再作为 serving 配置来源：

- [ ] `FUGUE_DNS_STATIC_RECORDS_JSON`
- [ ] `FUGUE_PLATFORM_ROUTES_JSON`
- [ ] `FUGUE_DNS_ROUTE_A_ANSWER_IPS`
- [ ] `FUGUE_DNS_GEOIP_OVERRIDES_JSON`
- [ ] `FUGUE_EDGE_QUALITY_RANKING_MODE`
- [ ] `FUGUE_APP_SAFE_ZERO_DOWNTIME_PUBLIC_ENABLED`
- [ ] 其他表达“当前应该服务什么”的 `FUGUE_*` 变量

保留在环境变量中的内容只包括数据库地址、控制面地址、节点身份、bootstrap token、签名密钥引用、本地 cache 路径、监听地址以及日志和 metrics 地址。

### 删除 serving 路径中的即时 route 生成

- [ ] 删除 Edge consumer 直接触发 route 重新推导的路径。
- [ ] 删除 DNS consumer 直接读取 app/domain/runtime 业务表的路径。
- [ ] 删除请求期间重新计算并直接 serving 的 route bundle 逻辑。
- [ ] 将旧 route builder 限制为 compiler 内部实现或迁移工具。

### 删除 artifact 可变内容语义

- [x] artifact 创建后禁止修改 `Content`。
- [x] artifact 创建后禁止修改 `ContentHash`。
- [x] artifact 创建后禁止修改 `Generation`、`Scope` 和 `Provenance`。
- [x] 同一 generation 的不同内容一律拒绝。
- [x] 所有内容变化必须创建新 generation。

### 删除 executor 对业务数据库的依赖

- [ ] Edge 不再读取 App、Project、Domain、Release 业务表。
- [ ] DNS server 不再读取 App、Project、Domain、Runtime 业务表。
- [ ] Caddy edge front 不再从控制面业务表构造配置。
- [ ] Node updater、runtime-agent、node-guardian 只消费 artifact。

### 删除散落的 policy 决策

- [ ] 删除散落在多个包中的 route publication 决策。
- [ ] 删除散落在多个包中的 DNS answer eligibility 决策。
- [ ] 删除散落在代码中的 canary 扩大门槛。
- [ ] 删除散落在代码中的 stale bundle 和 rollback 判定。
- [ ] 删除未经过 policy registry 管理的临时 override 逻辑。

### 删除共享 HMAC 作为长期信任模型

- [ ] 保留 HMAC 兼容验证一段迁移期。
- [ ] 新 artifact 改用非对称签名。
- [ ] 逐步删除 consumer 持有共享 signing secret 的方式。
- [ ] 迁移完成后撤销旧 HMAC key。

## 需要合并的内容

### 合并 artifact envelope

- [ ] 为所有 artifact 建立统一 envelope。
- [ ] 统一 `schema_version`、`artifact_kind`、`generation`、`scope`、`content_hash`。
- [ ] 统一 `intent_digest`、`policy_digest`、`input_snapshot_digest`。
- [ ] 统一 `compiler_version`、`valid_from`、`valid_until` 和 compatibility floor。
- [ ] 统一 provenance、签名、key id 和撤销信息。
- [ ] 用泛型 payload 表达 Edge、DNS、TLS、Node 等不同 artifact 内容。

### 合并 route、DNS、TLS、cache 的编译输入

- [ ] 建立统一 platform configuration graph。
- [ ] route、DNS、TLS、cache 使用同一份 intent snapshot 编译。
- [ ] 编译前固定 runtime snapshot。
- [ ] DNS answer 必须是 route-ready edge 集合的子集。
- [ ] route 引用的 certificate 必须是 TLS-ready。
- [ ] cache policy 引用的 hostname 必须存在于 route artifact。

### 合并 release channel 和 LKG 生命周期

- [ ] 建立统一 `ReleaseSetCoordinator`。
- [ ] 统一 shadow、gray、full、verified、failed、rolled_back、frozen 状态。
- [ ] 统一 fencing token、idempotency、expected consumer set。
- [ ] 统一 verified LKG 和 rollback 目标。
- [ ] 统一 release freeze 和恢复策略。

### 合并 consumer heartbeat 协议

- [ ] 统一 consumer identity。
- [ ] 统一 desired generation、loaded generation、loaded digest。
- [ ] 统一 apply status、probe status、serving status。
- [ ] 统一 sequence、fencing token、evidence hash。
- [ ] 统一 heartbeat freshness 和 convergence 计算。

### 合并 policy evaluator

- [ ] 将 invariant、release guard、override、rollback、compatibility gate 统一到 policy evaluator。
- [ ] 将 policy 参数移出执行代码。
- [ ] 保留执行代码作为 policy evaluator 的解释器，而不是 policy 的唯一来源。

## 需要迁移的内容

### 将环境变量迁移到 Intent Store

- [ ] 实现一次性环境变量 importer。
- [ ] 将静态 DNS record 导入 intent generation。
- [ ] 将平台 route 导入 intent generation。
- [ ] 将 edge ranking 和 traffic policy 导入 intent generation。
- [ ] 将 TLS、cache 和默认 storage class 导入 intent 或 policy。
- [ ] 保存 `source=env-migration`、source digest、迁移时间和迁移操作者。
- [ ] 迁移成功后禁止新进程继续依赖旧 serving 环境变量。

### 将业务数据迁移为 intent projection

- [ ] 保留 App、Project、AppDomain 作为业务模型。
- [ ] 新增 App/Domain 到 Platform Route Intent 的 projection。
- [ ] 明确业务事实、平台 intent、artifact、runtime fact 的边界。
- [ ] 禁止 Edge 直接把业务表当成 serving 配置。

### 将旧 artifact 迁移为带 lineage 的 artifact

- [ ] 为旧 artifact 补充 `intent_digest`。
- [ ] 为旧 artifact 补充 `policy_digest`。
- [ ] 为旧 artifact 补充 `input_snapshot_digest`。
- [ ] 为旧 artifact 补充 `compiler_version`。
- [ ] 为旧 artifact 补充 dependency artifact references。
- [ ] 无法补全 lineage 的旧 artifact 标记为 `legacy`。
- [ ] 旧 artifact 可以继续作为 LKG，但不能作为新 release 的唯一来源。

### 将单 artifact release 迁移为 ReleaseSet

- [ ] 将旧单 artifact release 转换为单成员 ReleaseSet。
- [ ] 将 route、DNS、TLS、cache 绑定到同一个 ReleaseSet。
- [ ] 保留旧 API 兼容层，由兼容层内部创建 ReleaseSet。
- [ ] 新 API 只允许使用 ReleaseSet 进行 full promotion。

### 将本地 cache 迁移为 Consumer LKG

- [ ] 为本地 cache 增加 artifact digest。
- [ ] 为本地 cache 增加 release set id。
- [ ] 为本地 cache 增加 verified-at、valid-until 和 fallback reason。
- [ ] 将 cache fallback 写入 runtime facts。
- [ ] 将“上一次 JSON 文件”升级为可验证的 Consumer LKG record。

### 将 heartbeat 迁移为 Runtime Facts

- [ ] 保留原始 heartbeat 和 apply 事件。
- [ ] 增加 runtime facts event log。
- [ ] 从 event log 构建 consumer projection。
- [ ] 从 projection 计算 convergence。
- [ ] 让 runtime facts 不能修改 intent。

## 需要新增的内容

### Intent Store

- [ ] 新增 `platform_intents`。
- [ ] 新增 `platform_intent_versions`。
- [ ] 新增 `platform_intent_changes`。
- [ ] 新增 intent diff、validate、promote、rollback API。
- [ ] intent version 创建后不可变。

### Policy Store

- [ ] 新增 `platform_policies`。
- [ ] 新增 `platform_policy_versions`。
- [ ] 新增 policy bindings。
- [ ] 新增 policy exceptions 和过期时间。
- [ ] 为每个 policy 保存 policy digest。

### Deterministic Compiler

- [x] 新增 deterministic compiler 接口。
- [x] compiler 输入必须明确包含 intent generation、policy generation 和 runtime snapshot。
- [x] compiler 输出必须包含 lineage。
- [x] 相同输入必须生成相同 artifact digest。
- [x] compiler 不得直接修改 runtime。
- [x] compiler 不得直接绕过 release coordinator 发布 artifact。

### ReleaseSet

- [x] 新增 ReleaseSet 数据模型。
- [ ] 新增 artifact dependency graph。
- [x] 新增 release set validation。
- [ ] 新增 shadow、gray、full promotion。
- [ ] 新增 convergence gate。
- [ ] 新增 verified LKG。
- [ ] 新增 rollback 和 freeze。

### Runtime Facts Event Log

- [ ] 新增 `runtime_fact_events`。
- [ ] 新增 `runtime_consumer_projections`。
- [ ] 新增 `runtime_convergence_projections`。
- [ ] 记录 consumer registered、artifact verified、apply succeeded、probe passed、serving LKG 和 fallback 等事件。
- [ ] 所有事实带 consumer、release set、artifact digest、generation、fencing token 和 observed-at。

### Compiler Compatibility Registry

- [ ] 每个代码版本声明支持的 artifact schema。
- [ ] 每个代码版本声明最小可读取 schema。
- [ ] 新代码必须能够读取当前 positive LKG。
- [ ] schema 不兼容时拒绝发布，不得覆盖现有 serving。

### Lineage 查询 API

- [ ] 查询 intent generation。
- [ ] 查询 policy generation。
- [x] 查询 artifact lineage。
- [x] 查询 release set。
- [ ] 查询 consumer convergence。
- [ ] 查询当前 hostname 使用的 route、DNS、TLS artifact。
- [ ] 查询某个 edge 未进入 DNS answer 的原因。

## 需要抽象的接口

### `IntentStore`

- [ ] `Create`
- [ ] `Get`
- [ ] `Latest`
- [ ] `Diff`

### `PolicyStore`

- [ ] `Resolve`
- [ ] `GetVersion`
- [ ] `ListBindings`

### `ArtifactStore`

- [ ] `Put`
- [ ] `Get`
- [ ] `ListDependencies`
- [ ] `RetainLKG`
- [ ] `VerifyIntegrity`

### `ArtifactSigner`

- [ ] `Sign`
- [ ] `Verify`
- [ ] `RotateKey`
- [ ] `RevokeKey`

### `Compiler`

- [ ] `Compile`
- [ ] `Explain`
- [ ] `ValidateInputs`

### `ReleaseCoordinator`

- [ ] `Create`
- [ ] `Validate`
- [ ] `Promote`
- [ ] `Verify`
- [ ] `Rollback`
- [ ] `Freeze`

### `ConsumerExecutor`

- [ ] `Verify`
- [ ] `Apply`
- [ ] `Serve`
- [ ] `FallbackToLKG`

### `RuntimeFactStore`

- [ ] `Append`
- [ ] `CurrentConsumer`
- [ ] `Convergence`
- [ ] `Evidence`

## 当前代码目录迁移表

| 当前路径 | 目标处理 |
|---|---|
| `internal/api/edge_routes.go` | route 推导迁移到 `internal/platformconfig/compiler` |
| `internal/api/edge_dns.go` | DNS 编译迁移到 `internal/platformconfig/compiler` |
| `internal/api/edge_dns_artifacts.go` | 改为 artifact materializer |
| `internal/api/platform_routes.go` | 改为 intent decoder，最终删除环境变量路径 |
| `internal/config/config.go` | 删除 serving intent 环境变量读取 |
| `internal/model/platform_state.go` | 拆分 intent、artifact、release set、runtime fact 模型 |
| `internal/store/platform_state.go` | 拆分 ArtifactStore、ReleaseStore、RuntimeFactStore |
| `internal/bundleauth` | 迁移到统一 `platformsecurity` |
| `internal/platformsafety` | 迁移为 policy evaluator 和 release gate |
| `internal/platformcontrol` | 保留 consumer identity、heartbeat 和 convergence |
| `internal/edge/service.go` | 保留 bundle executor、LKG 和 Caddy apply |
| `internal/dnsserver/service.go` | 保留 DNS executor、resolver 和 LKG |
| `internal/edge/caddy.go` | 保留执行逻辑，删除业务表依赖 |
| `internal/lkgcache` | 抽象为通用 Consumer LKG Store |
| `internal/localwal` / `internal/walreplay` | 统一为 runtime fact fallback journal |
| `internal/releaseflow` | 收敛为 ReleaseSetCoordinator |
| `internal/releasecontract` | 并入 artifact/release schema |
| `internal/releaseevidence` | 并入 runtime facts/evidence |
| `internal/releaseterminal` | 并入 release coordinator 执行适配层 |

## 分阶段迁移计划

### 阶段 0：冻结协议

- [ ] 为现有 artifact 增加 lineage 字段。
- [ ] 为现有 release 增加输入 digest。
- [ ] 记录 compiler version。
- [ ] 记录 runtime snapshot digest。
- [ ] 增加 route/DNS 变化审计。
- [ ] 不改变当前 serving 行为。

验收：所有当前 serving bundle 都可以追溯到输入来源。

### 阶段 1：双写 intent

- [ ] 保留旧环境变量和旧 builder。
- [ ] 同时生成新的 Platform Intent。
- [ ] 比较 legacy output 与 intent output。
- [ ] 记录 route、DNS、TLS 和 edge membership diff。
- [ ] 只 shadow，不改变生产流量。

### 阶段 2：Compiler shadow

- [ ] compiler 从 intent、policy 和 runtime snapshot 生成 artifact。
- [ ] 重复编译验证 digest 稳定。
- [ ] 验证 legacy 与新 compiler 输出一致。
- [ ] 验证 compiler 失败不会影响旧 serving。
- [ ] 验证 runtime 变化不会影响已固定 snapshot 的输出。

### 阶段 3：Consumer 双读

- [ ] Edge 支持 legacy bundle 和 artifact bundle。
- [ ] DNS 支持 legacy bundle 和 artifact bundle。
- [ ] artifact bundle 先进入 shadow consumer。
- [ ] 记录 apply、probe、convergence 和 fallback。
- [ ] 验证本地 LKG 恢复。

### 阶段 4：ReleaseSet 接管 gray

- [ ] route、DNS、TLS、cache 绑定到 ReleaseSet。
- [ ] 增加 dependency graph 校验。
- [ ] gray promotion 必须通过 consumer gate。
- [ ] full promotion 必须通过 route/DNS/TLS invariant。
- [ ] 任一 required consumer 失败时冻结发布。

### 阶段 5：Full serving 切换

- [ ] 默认 serving 路径改为 intent → compiler → artifact → ReleaseSet。
- [ ] 旧 builder 只保留 read-only emergency 模式。
- [ ] 所有 consumer 默认读取 artifact。
- [ ] 旧环境变量仅用于检测，不再用于 serving。

### 阶段 6：删除旧路径

- [ ] 生产中不再使用 serving intent 环境变量。
- [ ] 旧 route builder 没有 serving 调用。
- [ ] 所有 consumer 都能从 artifact 恢复。
- [ ] 旧 release API 已转换为 ReleaseSet。
- [ ] 旧 HMAC key 已撤销。
- [ ] legacy mode 连续一个完整发布周期没有流量。
- [ ] 删除 legacy parser、legacy publisher 和 legacy compatibility code。

## 必须增加的验收测试

### 代码与配置隔离

- [ ] 新代码发布失败时旧 artifact 继续服务。
- [ ] compiler 失败时旧 artifact 不变。
- [ ] 控制面数据库短暂不可用时 Edge 继续使用 LKG。
- [ ] 新代码不支持新 schema 时发布被拒绝。

### Artifact 原子性

- [ ] route 成功、DNS 失败时 DNS 不切换。
- [ ] TLS 未 ready 时 DNS 不返回对应 edge。
- [ ] cache 引用不存在 hostname 时 ReleaseSet 被拒绝。
- [ ] required consumer 未收敛时禁止 full promotion。

### Runtime facts

- [ ] 重复 heartbeat 不推进 cursor。
- [ ] 旧 fencing token 不能覆盖新事实。
- [ ] ACK 不自动等于 serving healthy。
- [ ] probe 失败时保留 previous LKG。
- [ ] runtime facts 不会修改 intent。

### Rollback

- [ ] 部分 consumer 已加载新版本时可以 rollback。
- [ ] rollback 后 consumer 最终回到同一个 verified LKG。
- [ ] rollback 不需要重新编译旧 artifact。
- [ ] artifact 被删除时 rollback 被拒绝。
- [ ] stale 超期后进入明确 degraded 状态。

## 最终完成标准

- [ ] Fugue 的 serving intent 不再由代码发布决定。
- [ ] Fugue 的 serving intent 不再由环境变量作为长期来源。
- [ ] 每个 serving artifact 都有完整 lineage。
- [ ] route、DNS、TLS 和 cache 可以通过同一个 ReleaseSet 原子推进。
- [ ] Edge、DNS 和 Node consumer 不访问业务数据库。
- [ ] runtime facts 不能修改 intent。
- [ ] 代码发布和配置发布可以分别回滚。
- [ ] 任意配置发布失败都保留上一份 positive LKG。
- [ ] 任意代码发布失败都不影响当前 serving artifact。

## 补充原则：约束策略必须独立化

`AGENTS.md` 明确要求配置和代码解耦，并把 `constraint policy` 单独列为 Fugue 的第二层。因此，Fugue 不应只把 route、DNS 和 traffic intent 抽出来，还应把可变化的约束、发布顺序、恢复编排和 gate 语义抽出来。

目标不是把所有逻辑都变成任意脚本，而是把所有经常变化的控制语义配置化，同时保留一个小而可信的代码安全内核。

### 三类逻辑边界

#### 必须配置化的 policy

- [ ] route 与 DNS 的发布顺序。
- [ ] route-ready、TLS-ready、probe-ready 条件。
- [ ] 最小健康 edge 数量。
- [ ] edge 排除和 fallback 规则。
- [ ] canary 权重和推进步骤。
- [ ] heartbeat freshness。
- [ ] consumer convergence 门槛。
- [ ] evidence 数量和 failure domain 要求。
- [ ] blast radius 限制。
- [ ] rollback signal。
- [ ] stale LKG 最大服务时间。
- [ ] 自动恢复动作是否允许。
- [ ] 默认 storage class、cache policy 和其他平台默认值。

#### 可以配置化但必须使用受限 DSL 的 orchestration logic

Policy DSL 只允许使用预先定义的安全算子：

- [ ] `all`。
- [ ] `any`。
- [ ] `threshold`。
- [ ] `freshness`。
- [ ] `dependency`。
- [ ] `monotonic`。
- [ ] `before`。
- [ ] `after`。
- [ ] `preserve_lkg`。
- [ ] `freeze`。
- [ ] `rollback`。

Policy 不得直接执行任意 Go、shell、SQL、网络请求、文件写入或 Kubernetes 操作。

自动动作只能引用预先注册的 action contract：

- [ ] `edge.route_filter`。
- [ ] `dns.answer_filter`。
- [ ] `release.rollback`。
- [ ] `lkg.reload`。
- [ ] `node.quarantine`。
- [ ] `component.stateless_restart`。

#### 必须留在代码安全内核中的机制

- [ ] 签名验证。
- [ ] canonical serialization 和 digest 计算。
- [ ] schema 解析。
- [ ] policy DAG 无环验证。
- [ ] 权限、租户隔离和 scope 校验。
- [ ] fencing token 和幂等性。
- [ ] artifact integrity 和 replay protection。
- [ ] 事务提交。
- [ ] fail-closed 和 preserve-LKG 语义。
- [ ] action contract 的实际执行器。

## Constraint Graph

发布约束应当以版本化、有向无环的 Constraint Graph 表达，而不是散落在多个 Go 包的 `if` 判断中。

典型依赖关系：

```text
intent.validated
        ↓
edge.route.compiled
        ↓
tls.ready
        ↓
route.converged
        ↓
dns.publish
        ↓
release.verified_lkg
```

Constraint Graph 的节点可以是：

- [ ] gate；
- [ ] artifact；
- [ ] runtime fact；
- [ ] action；
- [ ] release state。

每条边必须声明依赖关系，例如：

- [ ] `requires`。
- [ ] `blocks`。
- [ ] `before`。
- [ ] `produces`。
- [ ] `rollback_to`。

每个 gate 需要声明：

- [ ] evidence source。
- [ ] evidence freshness。
- [ ] threshold。
- [ ] unknown behavior。
- [ ] stale behavior。
- [ ] failure behavior。
- [ ] 是否允许 bypass。

### Constraint Graph 验证要求

- [x] graph schema 验证。
- [x] graph 必须无环。
- [x] 所有节点引用必须存在。
- [ ] 所有 action contract 引用必须存在。
- [ ] 所有 evidence source 引用必须存在。
- [ ] 不能删除当前 serving 所依赖的 root invariant。
- [ ] 不能把 `preserve_lkg`、签名校验、租户隔离和 fencing 设为可绕过。
- [ ] graph 版本必须单调递增。
- [ ] graph digest 必须进入 artifact lineage。

## Policy Runtime

新增独立的 policy runtime，用来加载、验证、编译、评估和激活 policy。

建议新增目录：

```text
internal/platformpolicy/
  schema/
  parser/
  validator/
  dag/
  evaluator/
  capabilities/
  activation/
  lkg/
```

建议接口：

```go
type PolicyCompiler interface {
    Compile(document PolicyDocument) (CompiledPolicy, error)
}

type PolicyEvaluator interface {
    Evaluate(
        ctx context.Context,
        policy CompiledPolicy,
        facts RuntimeFacts,
    ) (Decision, error)
}

type PolicyActivator interface {
    Activate(ctx context.Context, policyID, generation string) error
}

type PolicyLKGStore interface {
    Current(ctx context.Context, scope Scope) (PolicyVersion, error)
    Verified(ctx context.Context, scope Scope) (PolicyVersion, error)
}
```

Policy runtime 必须是 fail-closed 的：无法解析、发现环、引用未知动作、缺少 capability 或 evidence 不足时，继续使用上一份 verified policy LKG。

## Policy Artifact 模型

每个 policy 版本都必须记录：

- [ ] `policy_id`。
- [ ] `policy_generation`。
- [ ] `policy_digest`。
- [ ] `schema_version`。
- [ ] `capability_floor`。
- [ ] `created_by`。
- [ ] `created_at`。
- [ ] `valid_from`。
- [ ] `valid_until`。
- [ ] `parent_generation`。
- [ ] 签名和 key id。

Policy 生命周期：

```text
draft
  ↓
schema validation
  ↓
DAG validation
  ↓
capability validation
  ↓
static simulation
  ↓
shadow evaluation
  ↓
canary scope
  ↓
full activation
  ↓
verified policy LKG
```

### Policy 更新 TODO

- [ ] policy draft 不直接影响 serving。
- [ ] policy 更新必须生成新 generation。
- [ ] policy 必须通过签名验证。
- [ ] policy 必须通过 schema、DAG 和 capability 验证。
- [ ] policy 必须先 shadow evaluation。
- [ ] policy 必须支持 canary scope。
- [ ] policy 必须支持 verified policy LKG。
- [ ] policy 激活失败时保留旧 policy。
- [ ] policy 回滚不依赖代码重新发布。
- [ ] policy 版本变化必须写入审计日志。

## Code Capability Registry

动态 policy 不能假定所有代码版本都支持所有能力。每个代码版本必须声明自身的 capability。

- [ ] 声明支持的 policy schema。
- [ ] 声明可读取的 artifact schema。
- [ ] 声明支持的 action contracts。
- [ ] 声明支持的 evidence sources。
- [ ] 声明支持的 policy operators。
- [ ] 声明可读取的旧版本 LKG。
- [ ] policy 激活前检查 `capability_floor`。
- [ ] 不兼容的 policy 只能被拒绝，不能覆盖当前 serving policy。

示例：

```text
control-plane v42:
  policy schema: v1
  artifact schema: edge-route v1, v2
  action: edge.route_filter v1
  action: release.rollback v2
  evidence: edge_heartbeat v1
  operator: preserve_lkg v1
```

## 对当前模块的补充迁移

| 当前模块 | 约束策略重构方向 |
|---|---|
| `internal/platformcontrol/registry.go` | 保留 root invariant 和 registry 读取接口；普通 invariant 定义迁移到 signed policy artifact |
| `internal/platformsafety` | 收敛为 policy evaluator、root invariant verifier 和 action authorization |
| `internal/api/bundle_invariants.go` | 删除散落 gate；改为调用 Policy Runtime |
| `internal/model/blast_radius.go` | 保留通用 evaluator；将阈值和 scope 参数迁移到 policy artifact |
| `internal/model/edge_routes.go` | 保留类型和执行所需 schema；将 route policy 参数迁移到 policy store |
| `internal/releaseflow` | 使用 Constraint Graph 驱动发布顺序，不再硬编码完整流程 |
| `internal/releasecontract` | 声明 action contract 和 capability，不再承载全部 policy 内容 |
| `internal/releaseevidence` | 改为 runtime evidence adapter，输出 facts 给 Policy Runtime |
| `internal/store/platform_state.go` | 增加 policy artifact、policy LKG 和 policy activation ledger |

## “代码 bug”与“policy bug”的判定

每个问题都必须先分类：

### Policy bug

表现为：

- 阈值错误；
- 发布顺序错误；
- fallback 条件错误；
- canary 权重错误；
- freshness 时间错误；
- blast radius 过严或过松；
- action 触发条件错误。

处理方式：

- [ ] 修订 policy。
- [ ] 生成新 policy generation。
- [ ] shadow 验证。
- [ ] canary 激活。
- [ ] 不发布代码。

### Code bug

表现为：

- parser 错误；
- signature verification 错误；
- DAG evaluator 错误；
- transaction 或 fencing 错误；
- action executor 错误；
- consumer 无法正确应用 artifact；
- LKG 恢复逻辑错误。

处理方式：

- [ ] 修复代码安全内核或执行器。
- [ ] 保留当前 artifact 和 policy LKG。
- [ ] 验证新代码兼容旧 artifact 和旧 policy。
- [ ] 单独发布代码。

## 新增故障测试

### Policy 故障

- [ ] policy 文件语法错误时继续使用 policy LKG。
- [x] Constraint Graph 有环时拒绝激活。
- [x] Constraint Graph 未知节点和不支持关系被拒绝。
- [ ] 引用未知 action 时拒绝激活。
- [ ] 引用未知 evidence source 时拒绝激活。
- [ ] policy 要求不存在的 capability 时拒绝激活。
- [ ] policy 删除 root invariant 时拒绝激活。
- [ ] policy shadow 结果异常时阻止 full activation。

### 修复链路隔离

- [ ] policy bug 可以不发布代码直接修复。
- [ ] artifact bug 可以不修改 intent 直接回滚。
- [ ] code bug 修复时旧 policy 继续工作。
- [ ] action executor 失败时保持旧 LKG。
- [ ] control plane 重启时恢复 verified policy 和 verified artifact。

## 补充完成标准

- [ ] Constraint policy 已成为独立、签名、可版本化的 policy artifact。
- [ ] 发布顺序由 Constraint Graph 驱动。
- [ ] 普通 invariant 不再只能通过代码发布修改。
- [ ] policy bug 可以独立于 code release 修复。
- [ ] policy 更新支持 shadow、canary、full、rollback 和 LKG。
- [ ] policy 不能绕过签名、租户隔离、fencing 和 preserve-LKG root invariant。
- [ ] 代码只保留 policy interpreter、执行原语和安全内核。
- [ ] Fugue 不允许把 policy DSL 变成任意脚本执行器。

## 最终简化版方案

本方案假设前面的 P0/P1 目标都已经实现，并进一步约束实现规模，避免把每个逻辑概念都发展成独立服务、独立数据库和独立状态机。

核心原则：

> 保留多个故障边界，但只保留一个配置真相。

逻辑层可以很多，物理实现不需要同样多。Intent、Policy、Artifact、Release 和 Runtime Facts 可以继续分表、分权限、分接口，但不应默认拆成多个控制面服务。

### 最终三平面架构

```text
配置平面
  PlatformIntent
  PolicySnapshot
  DeterministicCompiler
  Lineage
        ↓
发布平面
  ImmutableArtifact
  TrafficReleaseSet
  Promotion
  VerifiedLKG
  Rollback
        ↓
运行平面
  Heartbeat
  ApplyReceipt
  Probe
  ServingState
  RuntimeFact
```

配置平面负责“应该服务什么”和“什么变化被允许”。

发布平面负责 route、DNS、TLS 等 artifact 是否可以一起进入生产。

运行平面负责记录 consumer 实际加载、应用、探测和服务的状态。

## 必须保留的核心能力

- [ ] PlatformIntent 是唯一的 serving intent 来源。
- [ ] PolicySnapshot 是唯一的可变约束来源。
- [ ] deterministic compiler 生成可重放 artifact。
- [ ] 每个 artifact 都包含完整 lineage。
- [ ] immutable artifact 创建后不可变。
- [ ] route、DNS、TLS 使用一个 `TrafficReleaseSet`。
- [ ] consumer 使用 verified LKG 恢复。
- [ ] runtime facts 不修改 intent。
- [ ] 代码安全内核负责签名、schema、fencing、事务和 fail-closed。

## 必须合并为投影的内容

### EdgeRouteIntent

`EdgeRouteIntent` 不应成为第二个配置真相。

- [x] `EdgeRouteIntent` 由 `PlatformIntent` 编译或投影得到。
- [ ] Edge Control 只读取该投影，不接受独立的用户配置来源。
- [ ] EdgeRouteIntent 的 generation 必须绑定 PlatformIntent digest。
- [ ] EdgeRouteIntent 的变更必须能够追溯到 PlatformIntent 和 PolicySnapshot。

### Edge Group Authority

Edge Group Authority 是发布执行器和局部 LKG，不是新的配置层。

- [ ] Group candidate 是 TrafficReleaseSet 的执行候选。
- [ ] Group published authority 是 TrafficReleaseSet 的局部发布结果。
- [ ] Group LKG 不能修改上层 intent。
- [ ] Group rollback 必须回到上层 ReleaseSet 指定的 artifact。

### Consumer LKG

Consumer LKG 是运行平面的恢复状态，不是配置版本。

- [ ] Consumer LKG 只保存已验证可服务的 artifact 引用。
- [ ] Consumer LKG 不生成新的 intent。
- [ ] Consumer LKG 不覆盖 policy。
- [ ] Consumer fallback 必须产生 runtime fact。

## 必须保持独立但不必拆成独立服务的内容

以下内容需要逻辑隔离、权限隔离和数据模型隔离，但默认放在同一个控制面数据库和同一个控制面进程中即可：

- [ ] Intent Store。
- [ ] Policy Store。
- [ ] Artifact Store。
- [ ] Release Store。
- [ ] Runtime Fact Store。

只有出现明确的容量、权限、故障域或组织边界时，才把它们拆成独立服务。

## TrafficReleaseSet 的范围

ReleaseSet 只覆盖存在直接服务依赖的 artifact。

默认集合：

```text
TrafficReleaseSet
  ├── edge route artifact
  ├── DNS answer artifact
  └── TLS readiness/reference
```

以下内容默认不放入 TrafficReleaseSet：

- [ ] observability policy。
- [ ] billing policy。
- [ ] image retention policy。
- [ ] node maintenance policy。
- [ ] 与当前公网流量无直接依赖的 runtime policy。

如果未来确实需要联合发布，再建立独立的 ReleaseSet 类型：

```text
RuntimePlacementReleaseSet
ObservabilityReleaseSet
MaintenanceReleaseSet
```

不能把所有 artifact 放进一个全局发布事务。

## Policy DSL 的最终边界

Policy 只支持有限、强类型、可静态验证的算子：

- [ ] `requires`。
- [ ] `before`。
- [ ] `threshold`。
- [ ] `freshness`。
- [ ] `preserve_lkg`。
- [ ] `freeze`。
- [ ] `rollback`。

Policy 不支持：

- [ ] 任意 Go 或 JavaScript。
- [ ] 任意 shell 命令。
- [ ] 任意 SQL。
- [ ] 任意网络请求。
- [ ] 任意 Kubernetes 操作。
- [ ] 任意循环和递归。
- [ ] 不受限的动态函数。

Policy Runtime 只解释受限 policy，并调用已注册的 action contract。

## Runtime Facts 的最终范围

只对发布和恢复关键路径保留事实事件：

- [ ] artifact downloaded。
- [ ] artifact verified。
- [ ] artifact apply started。
- [ ] artifact apply succeeded。
- [ ] artifact apply failed。
- [ ] probe passed。
- [ ] probe failed。
- [ ] serving LKG。
- [ ] fallback to LKG。
- [ ] release promoted。
- [ ] release rolled back。

普通 App、Project、Runtime、Backup 和 Billing 状态继续使用普通状态表，不强制全部改造成 event sourcing。

## 暂不实现的内容

以下能力保留为后续选项，不属于默认完成标准：

- [ ] 通用脚本型 Policy DSL。
- [ ] 全系统完整 event sourcing。
- [ ] Intent、Policy、Artifact、Release、Facts 的独立微服务化。
- [ ] 所有 artifact 进入一个全局 ReleaseSet。
- [ ] 每个 action contract 建立复杂版本矩阵。
- [ ] 每个 consumer、policy、artifact 都建立独立 capability 图。
- [ ] 为每个局部状态建立第二套 LKG 状态机。

## 最终配置真相约束

- [ ] 用户 serving intent 只有一个来源：PlatformIntent。
- [ ] 发布约束只有一个来源：PolicySnapshot。
- [ ] 已批准服务内容只有一个来源：ImmutableArtifact。
- [ ] 当前发布集合只有一个来源：TrafficReleaseSet。
- [ ] consumer 当前状态只有一个来源：Runtime Facts projection。
- [ ] EdgeRouteIntent 只是 PlatformIntent 的投影。
- [ ] Edge Group Authority 只是 ReleaseSet 的执行状态。
- [ ] Consumer LKG 只是 Runtime 平面的恢复状态。
- [ ] 任何 projection 都不能反向修改上层配置真相。

## 最终复杂度检查

- [ ] 每个逻辑层是否有唯一 owner。
- [ ] 是否存在两个对象都声称自己是 serving intent 来源。
- [ ] 是否存在两个独立 release 状态机可以同时 promote 同一流量。
- [ ] 是否存在多个 LKG 可以互相冲突。
- [ ] 是否可以在不启动所有组件的情况下恢复公网流量。
- [ ] 是否可以只回滚 policy 而不回滚代码。
- [ ] 是否可以只回滚 artifact 而不重新编译 intent。
- [ ] 是否可以只升级代码而保持当前 artifact 不变。
- [ ] 是否可以通过 lineage 找到一次 serving 变化的完整来源。

如果这些问题都能回答清楚，说明 Fugue 保留了必要的故障隔离能力，同时没有把每一个逻辑概念膨胀成一套新的控制面。

### P0-B：受限 Constraint Graph

- [x] `ConstraintGraph` 和 `ConstraintEdge` 使用强类型 schema。
- [x] 支持 `requires`、`blocks`、`before`、`produces`、`rollback_to` 关系。
- [x] graph 节点、边和关系进行规范化排序，保证 digest 稳定。
- [x] 重复节点、重复边、未知节点和未知关系被拒绝。
- [x] 正向依赖图进行环检测；`rollback_to` 不参与正向拓扑环检测。
- [x] graph 内容进入 `PolicySnapshot` digest 和 artifact lineage。
- [x] OpenAPI 和 `fugue-web` 类型已同步。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 947，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
c2240d43  feat(policy): validate constrained release graphs
```

生产镜像：

```text
sha256:c17759073407fc435f24d8c3c96d5a7b540e9ed4f68f11ab2922ed5f5bf38e46
```

### P0-C：Traffic ReleaseSet 静态安全门

- [x] ReleaseSet artifact 必须同时声明 route、DNS、TLS artifact kinds。
- [x] ReleaseSet artifact 必须包含同一 lineage 的 intent/policy digest。
- [x] ReleaseSet artifact 引用数量必须与 artifact kind 数量一致。
- [x] ReleaseSet 缺少 traffic artifact 时验证失败。
- [x] API invariant validation 覆盖 ReleaseSet。
- [x] 本地 API tests 和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 948，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
76f5c460  feat(release): gate traffic release set invariants
```

生产镜像：

```text
sha256:e369f4fcd257ee7ccb9e9c3f1496b1d742236870de97e4244c11aff6d40ef119
```

### P0-D：ReleaseSet 子 artifact 引用与 lineage 校验

- [x] ReleaseSet 必须引用真实存在的子 artifact。
- [x] ReleaseSet 引用的子 artifact kind 必须与声明一致。
- [x] ReleaseSet 引用的子 artifact 必须已经 validated。
- [x] ReleaseSet 子 artifact ID 不得重复，引用数组必须保持一一对应。
- [x] ReleaseSet 的 intent digest、policy digest 与子 artifact lineage 不一致时拒绝验证。
- [x] compile API 在持久化 ReleaseSet 后执行引用校验，失败时不推进 ReleaseSet 验证状态。
- [x] 增加缺失子 artifact 的回归测试。
- [x] 本地定向 API tests 和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 950，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
db5dbcc8  feat(release): validate traffic release set references
```

生产发布证据：

```text
workflow: ci
run: 34721532225
deploy_api: success
api_image: sha256:16d6fc2d7ac80da13a0639c250023bd17a936572308159a052716f36b8d8b120
```

### P0-E：ReleaseSet promotion 引用安全门

- [x] ReleaseSet promotion 前重新校验子 artifact 引用，避免历史 validated 对象绕过当前规则。
- [x] 缺失子 artifact 时 promotion 返回冲突并保持当前 serving 状态。
- [x] 新增 promotion 边界回归测试。
- [x] 本地定向 API tests 和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 951，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
37866e27  feat(release): guard release set promotion references
```

生产发布证据：

```text
workflow: ci
run: 34722255506
deploy_api: success
api_image: sha256:6febb9c4332dbf1bc3bfc5afb668c1c0a90e33cacfe150b81fcab7d0fe087fdb
```

### P0-F：配置编译失败保持旧 immutable artifact

- [x] 同一 immutable generation 的配置内容变更被拒绝，不覆盖已保存 artifact。
- [x] 编译失败后旧 route artifact 仍可按 ID 读取，内容 hash 与 serving 内容保持不变。
- [x] 增加配置失败恢复回归测试。
- [x] 本地定向 API tests 和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 952，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
adfce4f6  test(config): preserve immutable artifacts on compile failure
```

生产发布证据：

```text
workflow: ci
run: 34722892464
deploy_api: success
api_image: sha256:1f1af73ee2552b20996b69160d46d029a23b3b6c9d0dc0ad44a05e23cbe42d23
```

### P0-G：强类型 RuntimeSnapshot 编译输入

- [x] 新增强类型 `RuntimeSnapshot`，明确记录 intent generation 与 policy generation。
- [x] compiler 拒绝与当前 intent/policy 不一致的 runtime snapshot。
- [x] runtime snapshot facts 进入稳定的 input snapshot digest 和 artifact lineage。
- [x] 保留 `input_snapshot` 兼容读取路径，但新 API 支持 `runtime_snapshot`。
- [x] OpenAPI、生成代码和 `fugue-web` 类型已同步。
- [x] 增加 runtime snapshot generation drift 回归测试。
- [x] 本地 prepush、web contract CI 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 953，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
48ccb7ad  feat(platform): bind compiler to typed runtime snapshots
```

生产发布证据：

```text
workflow: ci
run: 34723705622
deploy_api: success
api_image: sha256:7fad74233ce258433edcaba76d77a56e6d505e09073911a24b7e20ecddd71cb6
```

### P0-H：Edge RouteIntent 优先读取 verified route artifact

- [x] 增加 `edge_route_bundle` verified LKG 到 `EdgeRouteIntentSnapshot` 的投影。
- [x] artifact 投影路径不读取业务表；没有 verified artifact 时保留兼容 fallback。
- [x] 投影沿用 artifact generation 作为 RouteIntent generation。
- [x] 增加 verified route artifact LKG 投影回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 954，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
5a6561f7  feat(edge): project verified route artifacts into route intents
```

生产发布证据：

```text
workflow: ci
run: 34724587390
deploy_api: success
api_image: sha256:36c6086a766e11e1cd15bb19eba515ea9a6ebc0e09c72f24034c23025a5135b5
```

### P0-I：ReleaseSet lineage 依赖查询

- [x] ReleaseSet lineage API 返回 route、DNS、TLS 子 artifact。
- [x] 每个子 artifact 返回自身 lineage 和当前 LKG（若存在）。
- [x] 子 artifact 缺失或引用结构损坏时查询失败并明确返回冲突。
- [x] 增加 ReleaseSet lineage dependencies 回归测试。
- [x] OpenAPI 与生成代码同步。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 955，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
21314958  feat(api): expose release set lineage dependencies
```

生产发布证据：

```text
workflow: ci
run: 34725449648
deploy_api: success
api_image: sha256:4aaf282a7304acf299385d350636331c7665efd47a177751c4499fea722bea11
```

### P0-J：Route/DNS/TLS lineage 查询完成度

- [x] ReleaseSet lineage 查询返回全部 traffic 子 artifact 的 lineage。
- [x] 每个子 artifact 的 verified LKG 一并返回，便于故障恢复定位。
- [x] 缺失依赖会 fail closed，不返回不完整的 lineage 图。
- [x] OpenAPI 与前端生成类型同步并通过 contract CI。
- [x] 本地 API 测试和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 955，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
21314958  feat(api): expose release set lineage dependencies
637dc07a  chore(api): sync lineage dependency contract
```

生产发布证据：

```text
workflow: ci
run: 34725449648
deploy_api: success
api_image: sha256:4aaf282a7304acf299385d350636331c7665efd47a177751c4499fea722bea11
```

### P0-K：TLS readiness 优先读取 verified artifact

- [x] Edge TLS ask 在存在 verified `caddy_route_config` 时读取 artifact certificate host 列表。
- [x] artifact 存在时未知 hostname fail closed，不回退到业务表。
- [x] 没有 verified TLS artifact 时保留兼容业务域名校验路径。
- [x] 增加 artifact allow/deny 回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 956，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产近 10 分钟无 panic、fatal 或 error 日志。

生产提交：

```text
4244ccc3  feat(edge): project TLS readiness from verified artifact
```

生产发布证据：

```text
workflow: ci
run: 34726488435
deploy_api: success
api_image: sha256:e54698b2179bd71eda6adfdc6b013f033881ceac9c44901666c027bd6b80d09e
```

### P0-L：Consumer convergence 查询 API

- [x] 新增只读 admin convergence API，按 release set、artifact release、kind 和 scope 查询。
- [x] API 使用统一 consumer convergence evaluator 计算 required passing、stale、unexpected 和 assessment。
- [x] convergence 查询不修改 intent、artifact、release 或 runtime facts。
- [x] 增加 admin API 回归测试并验证权限边界。
- [x] OpenAPI 与生成代码同步。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 957，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
7b5fbf3c  feat(api): expose platform consumer convergence
```

生产发布证据：

```text
workflow: ci
run: 34727457145
deploy_api: success
api_image: sha256:8da5fb49549463a7c9f5343f77dcdd2cd4ee06ab9318bf0214970ea3037e95d2
```

### P0-M：ReleaseSet generation lineage 一致性

- [x] compiler 为 route、DNS、TLS 子 artifact 写入 `release_set_generation`。
- [x] ReleaseSet 引用校验拒绝跨 ReleaseSet generation 混用子 artifact。
- [x] 该约束与 child kind、validated 状态和 intent/policy digest 校验一起执行。
- [x] 本地定向 API tests 和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 958，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
d316ef9e  feat(release): bind child artifacts to release set generation
```

生产发布证据：

```text
workflow: ci
run: 34728050733
deploy_api: success
api_image: sha256:51af0e949c4c722012148cf9dffff5e38dae4c71600f6df41ea6b2c13ed39c60
```

### P0-N：DNS active artifact 不可用时回退 verified LKG

- [x] DNS consumer 在 active full artifact 缺失时查找同 scope verified LKG。
- [x] active artifact 校验失败时尝试 verified LKG，避免新配置阻断旧 serving。
- [x] LKG 必须通过签名、schema、有效期和 DNS bundle 内容校验。
- [x] 没有可验证 LKG 时才返回 service unavailable 并保留明确错误语义。
- [x] 本地 Edge DNS 测试和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 959，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
805e61ce  feat(dns): serve verified LKG when active artifact is unavailable
```

生产发布证据：

```text
workflow: ci
run: 34728686550
deploy_api: success
api_image: sha256:51d541b38e79d28c6bb23f2b00b8ae36f5451704ec517514e6abb8884089f5a7
```

### P0-O：Lineage 显式绑定 intent/policy generation

- [x] `Lineage` 增加 `intent_generation` 和 `policy_generation`。
- [x] compiler 输出的 digest、artifact metadata 与 generation 一一绑定。
- [x] lineage API 可同时返回 generation、digest、compiler version 和 input snapshot digest。
- [x] 增加 generation binding 回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 960，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
5b0285c7  feat(platform): expose intent and policy generations in lineage
```

生产发布证据：

```text
workflow: ci
run: 34729487979
deploy_api: success
api_image: sha256:2d14740099eaaee0826ee032695b8f1a9eda77b208dbbac014036b787ec4cd13
```

## 原子步骤生产证据

### P0-A：Intent/Policy/Compiler/Lineage 基础

- [x] 实现强类型 `PlatformIntent`。
- [x] 实现强类型 `PolicySnapshot`。
- [x] 实现 deterministic compiler。
- [x] 为 route、DNS、TLS artifact 写入 intent/policy/compiler lineage。
- [x] 持久化最小 ReleaseSet artifact。
- [x] 增加 compile API。
- [x] 增加 artifact lineage API。
- [x] 更新 OpenAPI 并同步 `fugue-web`。
- [x] 本地 `go test ./...` 通过。
- [x] GitHub Actions prepush 通过。
- [x] API component build 通过。
- [x] API production deployment 通过。
- [x] 生产 API 2/2 Ready、0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。
- [x] 生产 OpenAPI 暴露 compile/lineage API。

生产提交链：

```text
aca642af  feat(platform): add deterministic intent policy compiler lineage
4fe50509  chore(platform): format artifact kind declarations
2446f02c  release(api): bind compiler lineage rollout to production intent
45f39bbf  release(api): follow stable guardian lkg predecessor
330f7bf9  release(api): advance production intent generation
```

最终生产 CI：

```text
workflow: ci
run: 34717838794
deploy_api: success
api_image: sha256:00c77fecea25d30b4ba90425e99006f5b12825395fea696c2927f9579f09442f
```

每个 P0 原子步骤都必须先通过本地测试，再 push，等待 GitHub Actions 与生产运行态验证，最后在本文件中记录证据后才能开始下一步。

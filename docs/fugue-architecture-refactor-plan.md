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

2026-09-15 生产核查：API 已运行 commit `ce418c91`（2/2 Ready，compiler v12）；美洲和德国 DNS/SSH-front 均已运行 `ce418c91`；Guardian 已运行 `42ba6b41`。本次观测的业务迁移草稿包含 132 条 route、15 条 DNS 输入和 8 份 release observations；13 条静态 DNS 与来源逐条一致，已删除 zone 的 1 条记录明确排除。加权 compiler 与 DNS wire 校验通过本地、CI 和生产验证。仍未完成动态 DNS placement、ACME/flatten、TLS readiness、真实 release facts 修复、全量等价以及 consumer gray/full 接管。现有 shadow ReleaseSet 未提升为 serving；其 route lineage 和 policy LKG 查询结果保持不变；这些结果不能作为全局迁移完成证明。

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
- [x] 统一 `schema_version`、`artifact_kind`、`generation`、`scope`、`content_hash`。
- [x] 统一 `intent_digest`、`policy_digest`、`input_snapshot_digest`。
- [ ] 统一 `compiler_version`、`valid_from`、`valid_until` 和 compatibility floor。
- [x] 统一 provenance、签名、key id 和撤销信息。
- [x] 用泛型 payload 表达 Edge、DNS、TLS、Node 等不同 artifact 内容。

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

- [x] 统一 consumer identity。
- [x] 统一 desired generation、loaded generation、loaded digest。
- [x] 统一 apply status、probe status、serving status。
- [x] 统一 sequence、fencing token、evidence hash。
- [x] 统一 heartbeat freshness 和 convergence 计算。

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

- [x] 查询 intent generation。
- [x] 查询 policy generation。
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

- [x] compiler 从 intent、policy 和 runtime snapshot 生成 artifact。
- [x] 重复编译验证 digest 稳定。
- [ ] 验证 legacy 与新 compiler 输出一致。
- [ ] 验证 compiler 失败不会影响旧 serving。
- [x] 验证 compiler 失败不会影响旧 serving。
- [x] 验证 runtime 变化不会影响已固定 snapshot 的输出。

### 阶段 3：Consumer 双读

- [x] Edge 支持 legacy bundle 和 artifact bundle。
- [x] DNS 支持 legacy bundle 和 artifact bundle。
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

### P0-P：Traffic ReleaseSet 显式依赖图

- [x] ReleaseSet 增加受限 artifact dependency graph。
- [x] compiler 固定 DNS/TLS 对 route 的 `requires` 关系。
- [x] ReleaseSet validation 拒绝未知 kind、错误 relation 和重复边。
- [x] dependency graph 与 ReleaseSet lineage 一起持久化和查询。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 961，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
1997de0d  feat(release): add explicit traffic dependency graph
```

生产发布证据：

```text
workflow: ci
run: 34730212271
deploy_api: success
api_image: sha256:fa7e15b7ba10d7e635262556b1ca3e0233d77ccf8afe30d101ec25eb5ec08c70
```

### 现有平台状态能力审计

以下条目对应 Fugue 当前已经存在的通用 `PlatformArtifact`、release、LKG 和 consumer 状态实现，经过代码与生产 API 状态核对后勾选；它们不代表尚未完成的 ReleaseSet 全量迁移。

- [x] `PlatformArtifact` 统一保存 schema、kind、generation、scope、content hash 和泛型 payload。
- [x] artifact 保存 intent/policy/input snapshot digest 与 compiler version lineage。
- [x] artifact 具备 provenance、签名、key id 和撤销 key 支持。
- [x] artifact 创建后内容、generation、scope 和 provenance 不可变。
- [x] release 支持 shadow、gray、full、fencing token 和幂等键。
- [x] release 支持 verified LKG、rollback target、verification evidence 和 freeze 状态。
- [x] consumer 状态保存 desired/actual/LKG generation、apply/probe/serving 状态、sequence 和 evidence hash。
- [x] consumer convergence evaluator 检查 freshness、身份、版本、LKG 过期和 required cardinality。
- [x] 管理 API 提供 artifact、LKG、release lineage 和 convergence 查询。

审计依据：

```text
internal/model/platform_state.go
internal/store/platform_state.go
internal/platformsafety/kernel.go
internal/platformcontrol/consumer_convergence.go
生产 API generation: 961
```

### P0-Q：PolicySnapshot artifact 强类型校验

- [x] generic `policy_snapshot` artifact validation 解码强类型 `PolicySnapshot`。
- [x] 校验 policy generation、边界、dependency order 和 ConstraintGraph。
- [x] policy digest metadata 与规范化 PolicySnapshot 不一致时拒绝验证。
- [x] 增加非法 policy artifact 回归测试。
- [x] 本地 prepush 和 `fugue-web` contract check 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 962，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
51e91600  feat(policy): enforce typed policy artifact validation
```

生产发布证据：

```text
workflow: ci
run: 34731142894
deploy_api: success
api_image: sha256:d9fd53a1813cce43f019e62aa69f64e34e156650d8740ae60d6ef4706b590f40
```

### P0-R：PlatformIntent artifact 强类型校验

- [x] generic `platform_intent` artifact validation 解码强类型 `PlatformIntent`。
- [x] 校验 intent generation、route hostname/upstream 和重复 route。
- [x] intent digest metadata 与规范化 PlatformIntent 不一致时拒绝验证。
- [x] 增加非法 intent artifact 回归测试。
- [x] 本地 prepush 和前端 contract check 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 963，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
6a1a962f  feat(intent): enforce typed platform intent artifacts
```

生产发布证据：

```text
workflow: ci
run: 34731835133
deploy_api: success
api_image: sha256:c6bc95c761163797d79967017b42909915785c27ef6cfe42112b296308423587
```

### P0-S：固定 RuntimeSnapshot 的 compiler determinism 回归

- [x] 相同 intent、policy 和固定 runtime snapshot 产生相同 canonical artifact content digest。
- [x] compiler wall-clock `CreatedAt` 变化不改变固定输入的内容 digest。
- [x] 增加固定 snapshot determinism 回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 964，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
8d720bd7  test(platform): prove fixed runtime snapshot determinism
```

生产发布证据：

```text
workflow: ci
run: 34732618891
deploy_api: success
api_image: sha256:5e7592637f1844cb59a3bfc79ad2cf5dddfd996933e1decbf15f5ecbb25e61b6
```

### P0-T：Full promotion convergence gate

- [x] ReleaseSet full promotion 前读取 expected consumer sets。
- [x] required consumer 未通过 convergence 时拒绝 promotion。
- [x] convergence evaluator 检查 stale heartbeat、身份、generation、apply/probe、LKG 和 cardinality。
- [x] 原兼容行为已在 P0-AH/P0-AJ 中收紧：没有 expected consumer set 时拒绝 full promotion；不伪造 convergence 事实。
- [x] 增加 required consumer 未收敛的回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 965，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
5f9aaa72  feat(release): gate full promotion on consumer convergence
```

生产发布证据：

```text
workflow: ci
run: 34733207625
deploy_api: success
api_image: sha256:6e42a80ee497f4e55226c3a8497f15f59729052301d4c86eeb1f1d49cd16fc52
```

### P0-U：按 hostname 查询 route/DNS/TLS lineage

- [x] 新增只读 hostname lineage API。
- [x] 查询返回 validated route、DNS、TLS artifact 及其 lineage。
- [x] 查询同时返回各 artifact 当前 verified LKG（若存在）。
- [x] hostname 规范化并递归扫描 artifact payload，未知 hostname 返回空集合。
- [x] 增加 hostname 内容匹配回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 966，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
15cf8365  feat(api): add hostname lineage lookup
```

生产发布证据：

```text
workflow: ci
run: 34733970931
deploy_api: success
api_image: sha256:acaec0164b186969d9e1cd716c79f693bc4aeed03174f32bce16c2cd38cee784
```

### P0-V：Legacy serving 环境变量导入预览

- [x] 新增受限 `ImportEnvironment` 纯函数，将旧 route/DNS JSON 转换为 `PlatformIntent`。
- [x] 导入结果包含 source digest、generation 和实际导入键，便于审计。
- [x] signing key、节点身份等非 serving 环境变量不会进入 intent。
- [x] 新增只读 admin preview API，不自动修改 serving 或发布 artifact。
- [x] 增加环境变量规范化和审计结果回归测试。
- [x] 本地 prepush 和 `fugue-web` contract check 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 967，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
4db89488  feat(platform): add audited legacy environment import preview
```

生产发布证据：

```text
workflow: ci
run: 34734747550
deploy_api: success
api_image: sha256:61b4dd782f000e013272dbd410d2bcdfaf04d7a6b04be68bab87d3ac394d792f
```

### P0-X：Runtime Facts 事件投影查询

- [x] 复用现有 tamper-evident heartbeat audit chain 作为 runtime fact 事件源。
- [x] 新增只读 runtime facts projection API，支持按 consumer、release set、artifact kind 过滤。
- [x] projection 返回 heartbeat accepted 及 platform artifact 运行相关事件。
- [x] 查询不修改 intent、policy、artifact 或 release 状态。
- [x] 增加 runtime facts API 回归测试。
- [x] 本地 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 968，2/2 Ready，0 restart。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交：

```text
ec372488  feat(api): expose runtime fact event projection
```

生产发布证据：

```text
workflow: ci
run: 34736044756
deploy_api: success
api_image: sha256:2837b60d882a056f884e124106c2eb2d0e3c260b6f0a5183a543ddfa94324f18
```

### P0-Y：Runtime Facts contract 同步

- [x] runtime facts projection endpoint 已同步 authoritative OpenAPI。
- [x] `fugue-web` 生成类型与 contract check 通过。

生产提交：

```text
46bcd10f  chore(api): sync runtime facts contract
```

生产发布证据：

```text
fugue-web workflow: contract-drift
run: 34736557042
conclusion: success
```

### P0-W：Hostname lineage 查询 contract 同步

- [x] hostname lineage API 的 authoritative OpenAPI 已同步到 `fugue-web`。
- [x] 生成 TypeScript 类型并通过 `contract:check`。
- [x] CI contract-drift 修复提交已成功。

生产提交：

```text
28d1769b  chore(api): sync hostname lineage contract
```

生产发布证据：

```text
fugue-web workflow: contract-drift
run: 34734377914
conclusion: success
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

### P0-Z：RouteIntent 语义投影与生产验证

- [x] Edge RouteIntent 优先读取 verified route artifact LKG。
- [x] 严格校验 artifact payload schema、显式 `enabled`、唯一 hostname 和 HTTP(S) upstream。
- [x] 保留 disabled route 与 pinned edge group 语义。
- [x] 生成的 intent 可直接被 Edge Control `GroupShadowCompiler` 消费。
- [x] artifact 路径返回 `X-Fugue-Route-Intent-Source: verified-artifact`。
- [x] artifact/LKG 不可用时返回 503 或仅在没有 LKG 时使用兼容投影。
- [x] 增加端到端投影、歧义 payload、无回退和确定性回归测试。
- [x] 本地 RouteIntent 定向测试和 prepush 通过。
- [x] API component build 和 `deploy_api` 通过。
- [x] 生产 API generation 970，2/2 Ready，0 restart。
- [x] 生产 Guardian 后续修复发布成功，1/1 Ready。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`，API 日志无 panic/fatal/error。

生产提交与证据：

```text
0cd9f148  feat(edge): validate and preserve route artifact semantics
0b0978df  feat(edge): expose verified artifact route source
2e7b0a92  chore(release): publish runtime scope API atom
workflow: ci
run: 34740931608
deploy_api: success
api_image: sha256:7fc45c6476138f74b98539baed9a8725766a6708db6c1e55915752beb15b91c4
```

发布链路修复：

```text
47d03a8c  chore(release): advance guardian intent generation
workflow: ci
run: 34741550202
deploy_release_guardian: success
guardian_image: sha256:3ccd85fe840be006cbd4f7d57a58c01b7a78bed6d02919a1d4368baaed14d66b
```

### P0-AA：RouteIntent 来源头 OpenAPI 契约同步

- [x] authoritative OpenAPI 声明 `X-Fugue-Route-Intent-Source` 响应头。
- [x] 重新生成后端 OpenAPI artifacts。
- [x] `fugue-web` vendor contract 和 TypeScript 类型已同步。
- [x] 后端 prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 971，2/2 Ready。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`。

生产提交与证据：

```text
439cecca  docs(api): declare route intent source header
8e7a0ee8  chore(api): sync route intent source contract
953400b7  chore(release): advance api contract generation
workflow: ci
run: 34742501465
deploy_api: success
api_image: sha256:7622d438554ccee336a41580763ff98efb8fd745bac7af0483d7331761765812
```

### P0-AB：Verified Policy LKG 查询

- [x] 新增只读 `GET /v1/admin/platform-config/policy-lkg`。
- [x] 复用现有 artifact/LKG store，不创建第二套 policy 状态机。
- [x] 只返回通过 typed policy、validated artifact 和 signed LKG 验证的 global policy。
- [x] 仅 platform admin 且具备 artifact.read 权限可调用。
- [x] 增加 verified policy LKG 和租户访问拒绝回归测试。
- [x] 本地定向测试和 prepush 通过。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 972，2/2 Ready。
- [x] 生产 `/healthz` 和 `/readyz` 返回 `ok`，生产 OpenAPI 暴露 policy LKG endpoint。
- [x] `fugue-web` contract 和生成 TypeScript 类型同步并通过 contract check。

生产提交与证据：

```text
535d4566  feat(platform): expose verified policy LKG
workflow: ci
run: 34743215404
deploy_api: success
api_image: sha256:16252409cfe9aa6e8de595181a57432772f7c71adc64f7d37889700e64a803dc
```

### P0-AC：Policy LKG 故障响应

- [x] 存储读失败与已存在 LKG 引用的 artifact 缺失均返回 503，避免误报为没有策略。
- [x] 回归测试覆盖无 LKG 的 404、存储损坏、artifact 缺失、签名 key 撤销，以及候选策略验证失败保持旧 LKG。
- [x] CI `34743964516` 全部通过；API generation 973，2/2 Ready。

```text
commit: fad854929170d5092f2487f5706fcf608341bf50
api_image: sha256:561d7203a145317a3781ab7a78d934a49cf8f97874d749b84a03b8c48a2be32a
```

### P0-AD：旧环境配置 envelope 与 enabled 默认值

- [x] 导入器兼容 route/DNS 数组和 routes/records 对象 envelope。
- [x] 未指定 enabled 的旧 route 默认为启用，显式 disabled 保持禁用，保留 edge group ID。
- [x] CI `34744370232` 全部通过；API generation 974，2/2 Ready，health/ready 均为 ok。
- [x] 生产管理员调用 import-env/preview 从 400 恢复为 200，返回 2 条启用 route。
- [x] 完整迁移校验：生产源配置 13 条 DNS 记录全部保留（A/MX/NS/TXT），2 条 route 的 kind、policy、region_aware group mode、enabled 和 TTL 均保留。
- [x] 将确认完整的配置持久化为 validated immutable intent draft；当前尚未推进 serving，需后续完成 shadow 对比后再 promote。

```text
commit: be75a69b2e1c159756be074b40c4b19d9af0713b
api_image: sha256:2053c2839915b9cb15f6223901d4c2b54982341c1bbd0810959415deaadd30ec
```

生产持久化验证：

```text
artifact_generation: env-migration-prod-1
artifact_status: validated
artifact_kind: platform_intent
routes: 2
dns_records: 13 (A/MX/NS/TXT)
policy_lkg: 404 (未发生策略激活)
```

跨仓契约验证：

```text
fugue-web commit: f7e4af61  chore(api): sync environment import contract
workflow: contract-drift
run: 34746576898
conclusion: success
```

### P0-AE：Validated artifact-only compiler replay

- [x] 新增 `compile-from-artifacts`，只接受 validated PlatformIntent 与 PolicySnapshot。
- [x] draft、错误 artifact kind、schema 不完整的输入被拒绝。
- [x] compiler 使用规范化 typed artifact，不读取业务表或请求内 serving 配置。
- [x] 增加 artifact-only 编译和 draft rejection 回归测试。
- [x] CI prepush、API build 和 `deploy_api` 通过。
- [x] 生产 API generation 977，2/2 Ready，health/ready 正常。
- [x] 生产 shadow replay 成功并将 route/DNS/TLS/ReleaseSet 落库；两次相同输入返回相同 artifact ID，lineage 记录 intent/policy/input snapshot/compiler v2；未 promotion。

生产证据：

```text
commit: 2f43f529  chore(release): advance artifact compiler generation
workflow: ci
run: 34747827816
api_image: sha256:8f6aaef604fe63c1699bdd742b6694178792ca7c0cd651bbb3638226a54bbe72
intent_generation: env-migration-prod-1
policy_generation: policy-shadow-prod-1
release_generation: release-915ca009dc70243f7b4a29462bd0844b9319c16e8c7f67a78cdafed488a3cadf
compiler_version: platform-config-compiler/v2
promoted: false
route_artifact: artifact_1789290147_3ae6084f214d
dns_artifact: artifact_1789290147_a04df449b074
tls_artifact: artifact_1789290147_0511fe77df9e
release_artifact: artifact_1789290147_22038f948fad
```

持久化实现生产证据：

```text
commit: 2a52f5cd  feat(platform): persist artifact-only compiler outputs
workflow: ci
run: 34748439925
deploy_api: success
api_config: 2a52f5cdaed29f56baf580f5ebd6ce821ce67ee9
api_generation: 978
api_image: sha256:cbdaa4274b818114c4762fb362347875b2f3c8a403c1961e058ac90d6cac5e49
```

### P0-AI：ReleaseSet expected consumer topology

- [x] 新增 prepare-consumers API，从一个已验证 ReleaseSet 生成 route、DNS、TLS 三份 expected consumer set。
- [x] topology 来自现有 edge、DNS、node-updater、runtime inventory；不伪造 ACK。
- [x] 每个集合绑定同一 ReleaseSet、artifact release、child generation 和稳定 revision。
- [x] 重复 prepare 幂等复用已有集合，revision 冲突不会生成重复状态机。
- [x] 本地定向测试、prepush、API build 和 `deploy_api` 通过。
- [x] 生产创建 route 10、DNS 9、TLS 5 个 required consumer 集合。
- [x] 生产 convergence 明确为 unknown/0 observed，full promotion 继续被阻止。

生产证据：

```text
commit: 9cb9b833  feat(platform): prepare release set consumer expectations
workflow: ci
run: 34750746033
route_expected: 10
dns_expected: 9
tls_expected: 5
convergence: unknown (0 observed)
```

跨仓 contract 验证：

```text
fugue-web workflow: contract-drift
run: 34751164173
conclusion: success
```

### P0-AG：TrafficReleaseSet shadow 发布

- [x] 对已验证的 route/DNS/TLS ReleaseSet 创建 shadow release。
- [x] shadow release 使用独立 fencing token 和 idempotency key，状态为 `serving_unverified`。
- [x] shadow 发布不改变当前 full serving artifact 或 API workload。
- [x] 生产 `/healthz` 和 `/readyz` 仍返回 `ok`，API config 保持原 serving atom。
- [ ] 在 required Edge、DNS、TLS consumer 完成 heartbeat、apply、probe 和 convergence 前禁止 full promotion。

生产证据：

```text
release_set: artifact_1789290147_22038f948fad
release_id: artifactrel_1789292458_d1b4c134c3e2
release_channel: shadow
fencing_token: 1
verification_state: serving_unverified
ack_count: 0
```

### P0-AH：未收敛 ReleaseSet 禁止 full promotion

- [x] 在 expected consumer sets 已准备后，对 shadow ReleaseSet 再次尝试 full promotion。
- [x] required consumer 未收敛时稳定返回 409，拒绝原因是 `required release set consumers have not converged`。
- [x] convergence 查询返回 route、DNS、TLS 三个集合，均为 `unknown`，required observed 为 0；普通节点 heartbeat 没有被伪造成 ACK。
- [x] ReleaseSet artifact 保持 `validated`，shadow release、当前 serving artifact 和 API workload 均未改变。
- [x] 旧的“没有 expected consumer set 时返回 409”仅作为代码回归测试保留，不再作为生产收敛证据。

生产结果：

```text
release_set: artifact_1789290147_22038f948fad
full_promotion: 409 conflict
reason: required release set consumers have not converged
route: unknown (0/10 observed)
dns: unknown (0/9 observed)
tls: unknown (0/5 observed)
api serving: unchanged
```

跨仓 contract 验证：

```text
fugue-web commit: 51238391  chore(api): sync artifact compiler contract
workflow: contract-drift
run: 34748217539
conclusion: success
```

### P0-AF：Artifact-only 编译输入完整性门

- [x] 编译前验证输入 artifact 的 schema、content digest、签名、kind、validated 状态、generation 与 scope。
- [x] 输入 ID 必须精确匹配存储对象；缺失对象与存储不可用分别返回 404/503。
- [x] typed decoder 拒绝未知字段，任何不可信输入在写入 route/DNS/TLS/ReleaseSet 前失败。
- [x] 增加内容篡改、无效签名、撤销 key、错误 kind、未知字段、scope 不一致和零输出回归测试。
- [x] 本地定向测试、受控并发全量 `make test` 与 prepush 通过。
- [x] CI `34749574622` 的 prepush、API build 和 `deploy_api` 全部通过。
- [x] 生产 API generation 979，2/2 Ready，`/healthz` 和 `/readyz` 正常。

```text
commit: 786a0315  fix(platform): verify artifact compiler inputs
release-repair: b3ca9243  fix(release): bind compiler verification to serving predecessor
api_image: sha256:b09f42397298f3ef29e2ca860f062e6fbe9b454494f73e97b9ea147d948d31ec
```

全量测试记录：此前 `make test` 的 sourceimport deadline evidence 测试曾在 8 秒采集预算下失败。2026-09-14 在后端 `d047ae27` 上以 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 完整复跑，包含脚本检查、契约生成检查和所有 Go 包，退出码 0。该结果证明这一代码版本的本地验收通过，不替代生产 consumer 接管与恢复演练。

### P0-AJ：移除不可信 runtime facts 投影并验证生产安全

- [x] 删除把普通 Edge/DNS 节点 heartbeat 推断为 ReleaseSet apply/probe/ACK 的临时投影代码。
- [x] 保留 trusted consumer heartbeat 作为唯一收敛事实来源；未接入真实 consumer identity 前，full promotion 继续 fail closed。
- [x] 本地 `go test ./internal/api ./internal/platformcontrol` 通过。
- [x] CI `34755400147` 的 prepush、API build 和 `deploy_api` 全部通过。
- [x] 生产 API 2/2 Ready，镜像为 `sha256:95a681ff784147ebf9579dffd0cd4afea255c9cc72c1a5fb9f40ffcd278e7734`，`/healthz` 和 `/readyz` 均返回 `ok`。
- [ ] Edge、DNS、TLS/Caddy consumer 尚未完成真实 artifact 拉取、apply、probe 和 trusted heartbeat；在此项完成前不得把 shadow ReleaseSet 切为 full serving。

生产证据：

```text
commit: 6da3cfab  chore(release): declare api rollback intent
workflow: ci
run: 34755400147
deploy_api: success
api_ready: 2/2
full_promotion_after_expected_sets: 409 conflict
```


### P0-AK：可信消费者 assignment 查询

- [x] 新增 `GET /v1/platform-state/consumers/assignment`，只接受有效的 component identity。
- [x] 以 active ReleaseSet 和授权 scope/kind 查询最新 topology revision；不使用全局前 200 条历史集合，也不向已移除节点返回旧 assignment。
- [x] 返回 child artifact ID、content digest、generation/sequence、release channel、fencing token 和 expected consumer set；验证 ReleaseSet 和 child 的签名及引用绑定。
- [x] prepare-consumers 拒绝绑定其他 ReleaseSet 或已 superseded 的 release。
- [x] 回归覆盖身份越权、历史记录超过 200、release 替换、拓扑移除节点、错误 generation；完整 `make test` 通过。
- [x] 后端 CI 和 `deploy_api` 成功；web OpenAPI 同步、`contract:check` 和 contract-drift 成功。
- [x] 生产以临时签名身份只读查询 route/DNS/TLS assignment，均返回 200，digest 和 token 与实际 shadow release 一致；匿名/admin key 为 401，无 assignment 的身份为 404。
- [x] API 2/2 Ready，`/healthz`、`/readyz` 正常。
- [ ] 真实消费者尚未接入 assignment 的持续读取；此次查询没有上报 heartbeat，也不证明 apply/probe 已完成。

```text
backend implementation: 32490b38 (replaces the incomplete assignment implementation in 6420e29f)
backend production commit: d047ae272af758ededd4589106077a6db911c3ad
backend CI: 34787597537, success
API generation: 982
API image: sha256:353ab9b4f3297c97b247717e7725c1accd319c60d9d15272b9aaf3734d868131
web contract commit: a9989762
web contract-drift: 34787620714, success
release_set: artifact_1789290147_22038f948fad
release_id: artifactrel_1789292458_d1b4c134c3e2
assignment channel: shadow
fencing_token: 1
convergence: route 0/10, DNS 0/9, TLS 0/5 observed; all unknown
```

### P0-AL：按 assignment 下载签名 artifact

- [x] 新增 `GET /v1/platform-state/consumers/artifacts/{artifact_id}?expected_consumer_set_id=...`，只接受可信组件身份。
- [x] assignment 查询与 artifact 下载共用 active ReleaseSet、最新 topology revision、scope/kind、generation 和签名校验逻辑。
- [x] 下载必须同时匹配 artifact ID 和 expected consumer set；返回原始签名内容、assignment 和对应 release，不重新编译。
- [x] 拒绝错误 expected set、未分配 artifact、被替换的 release、已移除节点和不一致 generation；普通 admin/tenant API key 不能代替组件身份。
- [x] 测试断言完整 artifact 与存储对象相等，查询与下载不产生 consumer facts；定向测试及完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过。
- [x] 本地生成准确发布计划后以单个 commit 推送；后端 CI、API build、`deploy_api` 均成功，web contract-drift 成功。
- [x] 生产 route、DNS、TLS 下载均返回 200，完整 JSON（含签名）与存储读回一致；错误 expected set 为 404，普通 admin key 为 401。
- [x] API generation 983、2/2 Ready，`/healthz` 与 `/readyz` 正常；原 shadow ReleaseSet 和 0 observed 的 convergence 保持不变。
- [ ] 将真实 DNS/Edge/TLS consumer 接入持续获取 assignment、验证下载结果、执行和本地持久化；下载成功不视为 serving ACK。

```text
backend commit: 5654b8012847abb8a7e172d6f14078571d2b94d5
backend CI: 34788653290, success
API image: sha256:c685e44a99afa2cceb147ae867f3227d8747ceaec238194e596ea7f2ddcd0e9c
API generation: 983
web contract commit: 248517c3
web contract-drift: 34788665078, success
release_set: artifact_1789290147_22038f948fad (shadow)
fencing_token: 1
route/DNS/TLS artifact downloads: 200 / 200 / 200
consumer observed: route 0/10, DNS 0/9, TLS 0/5
```

只读验证使用临时签名的组件身份，未向生产上报 heartbeat、apply receipt 或 probe；真实 executor 接管、完整配置输出对比和回滚恢复演练仍属未完成项。机器可读证据见 [consumer-artifact-download-2026-09-14.json](verification/consumer-artifact-download-2026-09-14.json)。

### P0-AM：Pod 身份交换（DNS consumer 接入前置）

- [x] 新增 `POST /v1/platform-state/consumers/identity`，用 Kubernetes SelfSubjectReview 验证调用方 Pod token。
- [x] 绑定真实 Pod UID、ServiceAccount、控制面 namespace 和调度节点；能力来自受控 Pod 的 `fugue.pro/consumer-identity` 强类型注解。
- [x] 签发两分钟有效的 component identity；消费者不持有平台 identity signing key，客户端不能指定节点或扩大能力。
- [x] 拒绝未绑定/已删除/已替换/终止的 Pod、租户 namespace 和无授权注解的 Pod；Kubernetes 故障返回 503，凭据不写入响应错误或日志。
- [x] 定向测试、完整 `make test`、后端 CI 与部署、web contract-drift 通过；不增加集群 RBAC 权限。
- [x] 生产真实 API Pod token 经 Kubernetes 核验后因无 consumer 授权注解返回 403；匿名与无效 token 返回 401；API 2/2 Ready，健康检查正常。
- [x] 真实 DNS Pod 的正向换证和持续续期已由 P0-AN 的两个生产消费者持续上报验证。

```text
backend commit: 59ef15cd65a443b54665cb83d9cde52503badb56
backend CI: 34790131103, success
API generation: 984
API image: sha256:6bbb73a5e995acb43e0801fa9afe9f95e6318dcd1b5005f52eee6444a216d226
web contract commit: d2ce907b
web contract-drift: 34790143695, success
```


### P0-AN：DNS consumer shadow 接入

- [x] DNS Pod 使用受控 `fugue.pro/consumer-identity` 注解和短期 projected ServiceAccount token。
- [x] DNS consumer 通过 Pod 身份交换获取 component identity，按 assignment 下载 DNS artifact。
- [x] consumer 在本地 shadow LKG 文件中持久化 artifact、assignment、digest、sequence 和 verified-at。
- [x] 严格验证签名、content hash、ReleaseSet、expected consumer set、generation、fencing 和 DNS payload schema。
- [x] shadow candidate 验证成功后上报 trusted heartbeat；普通 DNS heartbeat 没有被当作 ACK。
- [x] 两个生产 DNS Pod 均持续 `shadow_verified`，记录数 13，当前 serving 没有切换到候选 artifact，容器无重启；原发布通道仍可正常更新 generation。
- [x] 后端 CI `34792924445` 的两个 edge-client build 和两个 deploy 均成功；API `/healthz`、`/readyz` 正常。
- [ ] DNS apply、probe 和 full convergence 尚未执行；当前 ReleaseSet 仍为 shadow，不能据此推进 full serving。

生产证据见 [dns-platform-shadow-2026-09-14.json](verification/dns-platform-shadow-2026-09-14.json)。

```text
backend commit: d8d3ddcd17c26ccc3e12f66099ffa24ff9fcd2ea
workflow: ci / 34792924445 / success
release_set: artifact_1789290147_22038f948fad (shadow)
dns artifact: artifact_1789290147_a04df449b074
artifact digest: sha256:219aa35e3085818a3ff8e5bb996205b433b320bf60f0993c0967bcfe6ad5ce7c
trusted DNS observations: 2/9 observed, 0 passing (shadow_validated)
serving: legacy publication continues; neither DNS pod applies the shadow candidate
```


### P0-AO：活跃 Edge worker 的 route shadow 消费

- [x] 新增 `internal/platformconsumer` 客户端，用受控 Pod token 换取短期组件身份，下载精确 assignment 绑定的 artifact；限制响应体大小，拒绝凭据重定向、歧义 assignment 和身份能力不匹配。
- [x] Edge 验证签名、scope、kind、generation/sequence、fencing、ReleaseSet、policy digest、payload schema 与 lineage；候选文件与 serving route cache 分开。
- [x] 只允许活跃 A/B 槽位上报；activation 缺失、损坏或下载期间切换时停止上报；落盘单调 sequence 后发送事实，丢失回执与重启不会重放 cursor。
- [x] 只上报 `staged/shadow_validated`，保持实际 serving generation，不把下载或 shadow 校验伪造成 apply/probe 成功。
- [x] 增加失败路径与 serving cache 保留测试；完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 及定向 `-race` 测试通过。
- [x] 两地 build/deploy job 成功；Guardian 两地均 `stable`，local/dependency/route health 全部 healthy，monitor 无连续失败。
- [x] 德国一个、美国两个活跃 worker 持续 `shadow_verified`、2/2 Ready、0 重启；实际 serving 130 条 route，候选 2 条 route。
- [ ] 补全业务 PlatformIntent 投影、比较全部 route/DNS/TLS 输出，完成 TLS consumer 和灰度后才能推进 full。

生产 commit：`febc911db3e57f868111e29309426da461595bd8`；CI `34795838726` 的全部 build 和两个 deploy job 为 success，run 总体因取消请求记录为 cancelled。取消前提交的 Guardian target 已完成部署和稳定验证，不能把 run 总体状态写成 success。

发布中曾误填前驱并推送未通过计划检查的 intent，还重写过 main 历史；已通过 `1b28c5a0` 合并恢复原提交祖先，当前文件树与生产 commit 完全一致。失败 preflight 没有被作为部署成功证据，重复发布已取消。

当前可信观察：route 3/10、DNS 2/9、TLS 0/5；passing 均为 0。候选只包含平台迁移样本，不能覆盖现有完整 serving。机器可读证据见 [edge-platform-shadow-2026-09-14.json](verification/edge-platform-shadow-2026-09-14.json)。

### P0-AP：完整业务路由与候选 artifact 的只读比较

- [x] 新增管理员接口 `GET /v1/admin/platform-config/routes/compare?artifact_id=...`，比较当前业务投影与精确、签名可信、validated 的 global route artifact。
- [x] 按 hostname/path 区分路由，报告缺失、额外和字段变化；忽略 generation/记录时间差异，保留 upstream、权重、排除规则、缓存和请求策略的语义差异。
- [x] 单独比较 TLS allowlist 和 cache policies；拒绝重复路由身份、错误 kind、generation 别名、撤销签名和未授权请求。
- [x] 比较独立于 serving source selector，即使存在 route LKG 仍读取业务投影；不写入业务、artifact、release 或 LKG。
- [x] 定向测试、完整 `make test`、前端契约同步/typecheck、后端 CI 与生产部署全部通过。
- [x] 生产 API 两个副本 Ready、0 重启，Guardian `stable` 且三项健康；新接口成功返回真实差异，比较前后 artifact/lineage/LKG 与 shadow release 保持相同。
- [ ] 将完整业务 serving 语义迁移到强类型 PlatformIntent，并使编译后的投影通过语义等价比较。
- [ ] 继续完成 DNS/TLS 输出比较和实际 apply/probe/灰度/回滚验证；本接口结果不能替代这些验收。

生产观察：业务投影 130 条 route，候选 2 条；1 条语义一致、1 条 `min_healthy_edge_nodes` 不同、128 条缺失；TLS allowlist 和 cache policies 均不同。这个结果说明候选还不能接管。比较捕获的是当前业务投影，尚不保证跨业务表的事务快照，后续编译输入冻结需另行实现。

```text
backend commit: 001953eaed064794a47f78dd7f0b4d8b9f63bad1
backend CI: 34798428678, success
API generation: 985
API image: sha256:3dd8839a4672b37a99c80ae3667d78af3111c41ad686334f6fb1e638d77e53a0
web contract commit: 04a2415f1ced0319504ccc35f3adf8ccbb5da7ca
web contract-drift: 34798641060, success
release_set: artifact_1789290147_22038f948fad (shadow, unchanged)
anonymous/missing-id/unknown-id/generation-alias/wrong-kind: 401/400/404/409/409
```

机器可读证据见 [route-migration-comparison-2026-09-14.json](verification/route-migration-comparison-2026-09-14.json)。

### P0-AQ：PlatformIntent 多路径基础语义

- [x] `RouteIntent` 支持同一 hostname 下按 canonical `path_prefix` 区分的多条路由。
- [x] 支持显式 `service_port`（0 保留旧默认行为）和可选 `streaming`，进入 artifact 内容与 route generation。
- [x] compiler version 升至 `platform-config-compiler/v3`；相同 intent/policy 连续编译生成相同 artifact digest。
- [x] 旧 intent JSON 的精确字段和默认行为保持兼容；拒绝非 canonical path、重复 hostname/path、非法端口。
- [x] Edge artifact projection 与 Edge Control materialization 保留 path、port、streaming，未改变现有 serving。
- [x] 后端完整测试、CI `34800313874`、API deploy 和前端 contract-drift `34800377322`（commit `2f46992c`）通过。
- [x] 生产验证：commit `5e8b1cbbf5445021b0b3403b6b8f9e8704cf2c8b`，API generation 986，image `sha256:43675670f4eeb3204e7d3da1ee60b094115bb397214203ddecbc274dd358528c`，两个副本 Ready、0 重启，Guardian stable。
- [x] 生产连续三次编译 digest 相同，`/` 与 `/api` 路径、18081 端口、`streaming=false` 均保留；重复路由返回 400，未发布候选，shadow ReleaseSet 和旧 artifact LKG 不变。
- [ ] 继续迁移多 upstream、cache、请求体策略和 TLS/DNS 绑定；当前候选仍不能代表完整业务 serving。

生产证据见 [platform-intent-route-paths-2026-09-14.json](verification/platform-intent-route-paths-2026-09-14.json)。

### P0-AR：PlatformIntent 加权 upstream 语义

- [x] 新增强类型 `UpstreamIntent`，承载 role、release、weight、URL、service port、upstream kind/scope、runtime 和 deployment 引用。
- [x] upstream 只描述期望目标；不接受 health、probe、observed status 等 runtime fact。
- [x] 限制最多 16 个目标，权重必须总计 100，拒绝重复选择身份、非法 HTTP URL、凭据/fragment、非法端口、未知 kind/scope。
- [x] 保留 Edge weighted selector 使用的目标顺序；同一输入重放产生相同 artifact digest。
- [x] 禁用/不可服务路由不会重新获得 upstream；artifact projection 不伪造 runtime status。
- [x] 后端全仓 `make test`、CI `34803290544`、API deploy 和前端 contract-drift `34804067000`（commit `be520668`）通过。
- [x] 生产验证：commit `0a999c8ab7922b33759ae9caa5a5c4f4545511b3` 已部署，编译器 v4 连续三次 digest 相同；80/20 stable/canary、release ID、service port 均保留；错误权重返回 400，候选未发布。
- [x] 后续生产复查：API generation 987、image `sha256:a4c8df0add4ffaf94b062a12dcae892fd7b3802c2c02176fca1df74d6d0e32ef`，两个副本 Ready、0 重启，Guardian stable；旧 route artifact/lineage/LKG 和 shadow ReleaseSet 未变化。证据见 [weighted-upstream-serving-health-2026-09-14.json](verification/weighted-upstream-serving-health-2026-09-14.json)。
- [ ] 将业务 AppRelease/TrafficPolicy 的完整 upstream 投影迁移到此模型，并完成真实 route/DNS/TLS 输出等价后才能推进灰度。

生产证据见 [platform-intent-weighted-upstreams-2026-09-14.json](verification/platform-intent-weighted-upstreams-2026-09-14.json)。

### P0-AS：PlatformIntent cache 与 ingress policy 语义

- [x] `PlatformIntent` 保存强类型 cache policies；route 保存 cache policy ID、namespace、deployment generation 和 request-body policies。
- [x] cache policy ID 唯一且受限于支持的 kind、TTL、path/method/status/vary/header 字段；route 引用必须存在且非 disabled policy 必须有 namespace。
- [x] request-body policy 复用严格 parser，要求 canonical 方法/path、显式 retry-after 和现有大小、超时、并发边界。
- [x] artifact route payload 携带 cache policies；artifact projection 与 Edge Control 保留 cache、namespace、deployment generation 和 request-body 语义，不混入 runtime facts。
- [x] 后端全仓 `make test`、CI `34805584061`、API deploy、前端 contract-drift `34805613342`（commit `ac92b648`）通过。
- [x] 生产验证：API generation 988，v5 编译器连续三次 replay digest 相同；cache policy、namespace、deployment generation、request-body policy 完整保留，健康/就绪均 200，shadow ReleaseSet 未变化，候选未发布。
- [ ] 将真实业务 AppRelease、cache policy 和 ingress policy 全量投影进 PlatformIntent，完成 route/DNS/TLS 等价后再推进灰度。

生产证据见 [platform-intent-cache-ingress-2026-09-14.json](verification/platform-intent-cache-ingress-2026-09-14.json)。

### P0-AT：固定 RuntimeSnapshot 与 origin observation

- [x] `RuntimeSnapshot` 支持固定 `captured_at` 和 typed `OriginObservation`；origin observation 只属于编译输入事实，不进入 intent digest。
- [x] route 可声明 `origin_ref` 和 desired `runtime_id`；compiler 要求引用存在、runtime identity 一致、状态在固定时间点有效。
- [x] 按 `PolicySnapshot.max_stale_seconds` 拒绝过期 observation，拒绝未来时间、重复 ref、缺失 ref 和非法状态。
- [x] unavailable/disabled observation 只影响新 artifact 的可服务状态，不会改写 intent/policy；恢复 observation 只重编译 artifact。
- [x] artifact projection 保留 runtime identity 与固定 observation 结果，避免 executor 重新读取 mutable business/runtime 表。
- [x] 后端全仓 `make test`、CI `34807438317`、API deploy 和前端 contract-drift `34807463873`（commit `d46ba44a`）通过。
- [x] 生产 v6 验证：intent/policy digest 在 unavailable 与 active observation 间稳定，runtime snapshot digest 和 artifact 随事实变化；缺失、future、stale、runtime mismatch 均返回 400，候选未发布。
- [ ] 将生产业务表的 route/upstream/cache/request-body/TLS/DNS 输入一次性冻结为完整 typed intent + runtime snapshot，并完成跨 artifact 等价比较。

生产证据见 [platform-intent-origin-snapshot-2026-09-14.json](verification/platform-intent-origin-snapshot-2026-09-14.json)。

### P0-AU：业务迁移草稿与原始证据时间

- [x] 新增只读管理员 `GET /v1/admin/platform-config/routes/project`，返回完整 route 清单的迁移草稿、独立 origin observations 和明确的迁移缺口。
- [x] 应用 enabled/runtime 来自 desired spec；不从观测健康状态推导 enabled，不把运行时选择的 upstream/权重冒充 desired intent。
- [x] origin ref 绑定 hostname/path/app/runtime，插入其他 route 不改变已有引用；group mode 映射到合法 PlatformIntent 枚举。
- [x] 同一次业务读取保留 desired app 和 observation overlay，使用原始 `ObservedAt`；缺失或陈旧证据不会被请求时间更新为“新鲜”。
- [x] `migration_ready=false` 与 `issues` 明确标识事务快照、policy、DNS/TLS 和 release 权重等尚未完成的迁移；草稿不等于可发布配置。
- [x] 本地认证、无写入、故障时 intent 稳定、原始观察时间、引用稳定性和平台维护配置测试通过；完整 `make test` 通过。
- [x] 后端 commit `e053484ea46975ecc442275011056136de41d631`，CI `34810431303` attempt 2 成功；attempt 1 因 Docker Hub token endpoint 连接重置失败，未部署。前端 commit `745be647`、contract-drift `34810501780` 成功。
- [x] 生产 API generation 991，image `sha256:b5d66374fe1ec415e69dac8933a17561bf3025a01c8d5256429d0c2016b36db4`；两个副本 Ready、0 重启，Guardian stable，健康/就绪 200。
- [x] 生产草稿包含 130 route、128 app route、128 origin，原始 observation 时间保留，旧 route artifact/LKG 和 shadow ReleaseSet 不变。
- [ ] 完成事务内业务快照、PolicySnapshot 投影、8 条加权 release 的 desired/fact 分离，以及 DNS/TLS 输出；当前 `migration_ready` 必须继续为 false。

首版 `054ad367` 虽返回 130 条 route，但存在 group mode 映射错误和观测时间被重新赋值的问题，未作为迁移完成证据；以上修复后才验收草稿诊断。生产证据见 [business-intent-draft-2026-09-14.json](verification/business-intent-draft-2026-09-14.json)。

### P0-AV：业务输入事务快照

- [x] 新增 `RouteBusinessSnapshot`，一次读取 Apps、verified Domains、ProjectRouteTables、Runtimes、EdgeRoutePolicies、AppReleases、TrafficPolicies。
- [x] PostgreSQL 使用只读 `REPEATABLE READ` 事务并记录 `pg_current_snapshot()` revision；文件存储在同一 state lock 内复制并计算 revision。
- [x] snapshot 完成深拷贝和稳定排序，过滤 deleted/pending 业务记录，不让后续调用读取到更新中的半套数据。
- [x] 草稿接口返回 `business_snapshot_revision`、`business_snapshot_at`；transaction snapshot 缺口从 issues 移除，仍保持 `migration_ready=false`。
- [x] 覆盖文件存储隔离、取消、数据库错误回滚及真实 PostgreSQL 并发写入的一致性测试；完整 `make test` 通过。
- [x] 后端 commit `a213b48db4f9f62494cba86b4aef3b9749d4729a`，CI `34812191553` 成功；前端 contract-drift `34812235896`（commit `2d5c3ef1`）成功。
- [x] 生产 API generation 992，两个副本 Ready，健康/就绪 200；返回 `postgres:50637113:50637113:` snapshot revision，130 route、128 origin，旧 artifact/LKG 与 shadow ReleaseSet 不变。
- [x] 生产前驱刷新复查：commit `f7f91e83fe4c6e60f9743d2c7f19079e424c4bf8`，API generation 993，snapshot revision `postgres:50641879:50641879:`，130 route、128 origin，健康/就绪 200；旧 artifact/LKG 与 shadow ReleaseSet 仍不变。
- [x] PolicySnapshot route/traffic 约束已投影进迁移草稿；DNS 与 weighted release target 仍保留为显式 issues，当前不可直接 compile/promote。

生产证据见 [business-snapshot-2026-09-14.json](verification/business-snapshot-2026-09-14.json)。
前驱刷新复查证据见 [business-snapshot-predecessor-refresh-2026-09-14.json](verification/business-snapshot-predecessor-refresh-2026-09-14.json)。

### P0-AW：PolicySnapshot 约束投影与编译执行

- [x] 将业务 route policy 与 traffic policy 投影为强类型 `PolicySnapshot.RouteConstraints` / `TrafficConstraints`；投影只复制期望约束，不复制 runtime evidence、checked-at 或 owner digest。
- [x] route 约束在 deterministic compiler 中应用到 artifact：route policy、enabled、最小健康 edge、排除 edge、原因与过期时间均进入 artifact；输入对象保持不变。
- [x] 对未具备 resolver 的 traffic/release 约束和 edge-group/DNS placement 约束 fail-closed，编译返回 400，不静默忽略。
- [x] policy rule 数量、hostname、owner、权重、模式、排除列表和过期字段均执行边界校验；规范化排序保证 replay digest 稳定。
- [x] backend commit `1003dc0e071c32214f3affbc7b8ecb90796726db` 已推送 `main`；GitHub Actions CI `34818322239` 成功，API 已生产运行 `platform-config-compiler/v7`。
- [x] web OpenAPI 同步 commits `c562e522`、`5af40e8f` 已推送；最终 contract-drift `34828739059` 成功。
- [x] 生产验证：连续 3 次相同输入得到相同 artifact digest；route 约束正确产生 disabled、`route_a_only`、最小健康数和 edge 排除；未支持 traffic/edge-group 约束均返回 400；shadow ReleaseSet 未变化；API generation `994`、2/2 replicas、`/healthz` 与 `/readyz` 均正常。证据：[platform-policy-constraints-2026-09-14.json](verification/platform-policy-constraints-2026-09-14.json)。
- [ ] 完成 release fact resolver 与 DNS placement resolver 后，再分别启用 traffic constraint 和 edge-group constraint 的 artifact 编译与生产 shadow 验证。

### P0-AX：业务迁移草稿纳入 PolicySnapshot

- [x] `GET /v1/admin/platform-config/routes/project` 同时返回 `PlatformIntent`、`PolicySnapshot` 与固定 `RuntimeSnapshot`，三者带独立 generation/事实边界。
- [x] route policy 与 traffic policy 从同一事务业务快照投影；runtime evidence、checked-at、owner digest 不进入 policy。
- [x] 未完成的 TLS/DNS、release target 投影继续以 issues 暴露，`migration_ready` 保持 `false`，草稿不具备 promotion 权限。
- [x] backend commits `6d575090`、`c0ba659a`、`c4310f67`、`c619120a` 已推送；最终 CI `34827857272` 成功，生产 API generation `997`。
- [x] 生产验证：130 routes、128 app routes/origins；策略投影已生效；剩余 issues 明确为 `dns_not_projected`、`release_weights_not_projected`；原始 observation 时间保留；route LKG、shadow ReleaseSet 未变化；2 个 API Pod 零重启，Guardian stable，健康/就绪正常。证据：[business-intent-policy-projection-2026-09-14.json](verification/business-intent-policy-projection-2026-09-14.json)。


### P0-AY：迁移草稿 TLS intent 投影与发布恢复链修复

- [x] 从同一业务快照将 route 的 TLS policy 投影为 `PlatformIntent.TLS`，不复制证书 readiness 或运行时状态；缺失 DNS 记录继续以 `dns_not_projected` 暴露。
- [x] 新增 `PolicySnapshotGeneration`，按规范化策略内容计算稳定 generation；runtime observation 时间变化不会伪造 policy 版本。
- [x] declarative release predecessor 解析保持严格：只有显式 supersede 的失败 atom 才能进入恢复路径，并仍要求精确 intent atom、祖先关系和部署时 Guardian LKG/image CAS 校验；普通 successor 不得任意跳过生产前驱。
- [x] backend commits `9d07dfb8`、`c4310f67`、`c619120a` 已推送；最终 CI `34827857272` 成功，生产 commit `c619120a822637c8c8b8c7153d84ecb690b238a5`、API generation `997`。
- [x] 生产验证：草稿 130 route、128 app route/origin；TLS intent 已投影，issues 仅为 `dns_not_projected`、`release_weights_not_projected`；原始 observation 时间保留，route LKG/shadow ReleaseSet 未变化；2 Pod 零重启、Guardian stable、健康/就绪 200。证据：[business-intent-tls-projection-2026-09-14.json](verification/business-intent-tls-projection-2026-09-14.json)。
- [x] typed DNS record projection 已接入事务快照；早期 `dns_zone_missing` 只是草稿诊断，编译拒绝边界与已删除 zone 的排除在 P0-BB 才得到验证。
- [ ] 完成 DNS 动态 placement、ACME、flatten 与全量等价比较；用逐项 issues 标记尚未迁移的输入，不能因为存在少量 DNS 记录就宣告完整。

### P0-AZ：事务快照中的 typed DNS projection

- [x] `RouteBusinessSnapshot` 同时捕获 hosted zones 与有效 DNS records；PostgreSQL 使用同一 repeatable-read 事务，文件存储使用同一锁。
- [x] DNS record 规范化、排序并投影到 `PlatformIntent.DNS`，保留 type、values、TTL、source、tenant 语义。
- [x] 缺失 zone 关联显式报告 `dns_zone_missing` 并保持迁移不可发布；不静默丢弃记录。
- [x] backend commits `f2e6dc1b`、`3dae2c99`、CI `34831195308` 成功，生产 API generation `999`；shadow ReleaseSet 未变化。
- [x] 历史中间验证记录 3 条 typed DNS 草稿记录及 `dns_zone_missing` 告警；这不证明编译器 fail-closed。P0-BB 已修复已删除 zone 的错误纳入以及 compiler 校验缺失。证据：[business-intent-dns-projection-2026-09-14.json](verification/business-intent-dns-projection-2026-09-14.json)。
- [x] 已删除 zone 的遗留记录被明确排除并记录原因；13 条 legacy static DNS 记录与 migration preview 逐条完全一致。
- [ ] 完成全部活动业务 DNS zone/record 关联和全量等价校验。

### P0-BA：固定 release facts 驱动加权 artifact

- [x] `RuntimeSnapshot.releases` 保存 release/app/tenant、原始 observation 时间、状态、地址和 runtime；`PolicySnapshot` 独立保存 stable/candidate 引用和期望权重，runtime 变化不改变 intent/policy digest。
- [x] compiler v8 只从固定 facts 解析 release，验证 owner、唯一身份、HTTP URL、时间与 freshness；拒绝缺失、未来、过期或跨租户输入。
- [x] 新增显式 `unavailable_candidate=reject|stable`，默认拒绝；stable 回退必须有 fresh active stable observation。禁用 intent、origin 不可用或 route policy 禁止时不会恢复流量。
- [x] 权重只允许一个来源；同时声明 route upstream 权重和 traffic policy 被拒绝。single/paused 编译为 stable 100%；未支持的 sticky 策略继续拒绝。
- [x] 业务迁移草稿从事务快照提取引用的 AppRelease facts，保留原始 UpdatedAt，绑定 policy generation；不复制运行时改写后的 upstream 权重到 intent。
- [x] `make test` 通过；backend `cbd41e15eef23b59ec434a07195f09b0d6c119ba` 已推送，CI `34834637420` 成功；web `1e557add` 的 contract-drift `34835074673` 成功。
- [x] 生产 API generation 1000、2/2 ready、Guardian stable、健康/就绪 200；3 次编译 digest 一致，80/20 与候选不可用后的 100% stable 行为通过，11 类非法输入返回 400；shadow、route LKG、policy LKG 均未变化。验证创建了未 promotion 的候选 artifacts。
- [ ] 完成真实业务 release observation 修复、sticky consumer 支持和输出等价验证；当前草稿包含 8 条 release facts/8 条 traffic constraints，`release_observations_require_repair` 和 `release_target_equivalence_not_verified` 继续阻止迁移验收。

生产证据：[release-fact-resolver-2026-09-14.json](verification/release-fact-resolver-2026-09-14.json)。

### P0-BB：DNS wire-level 校验与来源保真

- [x] compiler v9 对 DNS hostname、RRset 唯一性、CNAME 冲突、TTL、IP family、MX/SRV/CAA/TXT wire 编码执行强校验。
- [x] `FUGUE_APP`、ALIAS/ANAME、flatten 等符号或未解析输入 fail-closed；不会静默生成空 DNS answer。
- [x] migration snapshot 保留 deleted zone tombstone；活动、删除、孤立、跨租户和 zone 外 record 分别记录 exclusion reason；排除的记录保留身份与原因供审计，不进入 serving intent。
- [x] 静态 DNS 输入与 typed migration intent 逐条比对一致；record 来源、tenant、TTL、values 保留。
- [x] backend commit `c026642c1250e7353bad2e342193d06da6f847da`、CI `34837431393` 成功，web contract-drift `34837518788` 成功；生产 API generation `1001`、2/2 ready、Guardian stable。
- [x] 生产 3 次重排编译 digest 一致，13 条 legacy static records 完全保留，8 类非法 DNS 输入均返回 400，shadow/LKG 未变化。证据：[dns-boundary-and-static-preservation-2026-09-14.json](verification/dns-boundary-and-static-preservation-2026-09-14.json)。
- [ ] 修复活动业务 DNS zone/record 关联、应用 placement 和 ACME 输入，完成与旧 Edge/DNS 输出的全量等价比较。

### P0-BC：收紧代码发布恢复前驱

- [x] 移除将任意较早祖先当作普通 production predecessor 的宽松逻辑；保留相同 intent 的 merge 兼容与原有显式 failed-atom supersede 恢复。
- [x] 新增真实 Git 历史回归：隐式跳过前驱拒绝、显式修正失败 preflight 接受、引用不匹配失败提交拒绝。Guardian/declarative release 全量包测试通过。
- [x] backend `42ba6b4130ecec63c41beb3f6594704561252b05`、CI `34839391762` 成功，仅发布 release-guardian component；Guardian 与 canary prober 的已加载版本均匹配本次 commit。
- [x] 生产 Guardian/Prober 均 Ready，API 保持 `c026642c` / generation 1001；Guardian stable、健康/就绪 200，shadow、policy LKG 与 route lineage 在发布前后完全一致。

证据：[guardian-predecessor-boundary-2026-09-14.json](verification/guardian-predecessor-boundary-2026-09-14.json)。

### P0-BD：后台任务退出与 CI 清理竞态修复

- [x] 为 API 预热任务增加 completion/join；取消 context 后等待已经开始的 callback 完成，测试在关闭临时存储前等待后台任务退出。
- [x] inventory 预热使用调用方 context，并等待 singleflight 的最终结果；console warmer 不再从 stale 读取路径启动脱离生命周期的刷新。
- [x] API 退出时有界等待 warmers；加入已取消任务不启动、取消期间已有工作必须结束的回归，相关场景连续 20 次通过；完整 `make test` 通过。
- [x] backend `b94b490c1cccd9722e0d0f5d1ab6c73892d7629e` 已推送，CI `34841776124` 首次通过，生产 API generation 1002、2/2 Ready、Guardian stable、健康/就绪 200。
- [x] 发布前后 shadow、route lineage 与 policy LKG 状态一致。policy LKG 仍为原有的 404（未激活），不将该缺失状态当成已验证恢复能力。

证据：[warmer-lifecycle-2026-09-14.json](verification/warmer-lifecycle-2026-09-14.json)。

### P0-BE：固定 DNS flatten facts 与确定性编译

- [x] `DNSFlattenObservation` 绑定完整 canonical DNSIntent digest、tenant、查询/成功时间、A/AAAA 和目标 TTL；改变 target/配置不能复用旧证据。
- [x] compiler v10 从固定 facts 将 CNAME/ALIAS/ANAME 编译为 A/AAAA；支持 IP family、dual stack、record/target/min/bounded TTL 和受 freshness 限制的显式 stale 回退；缺失、过期、跨租户、私有/保留地址及冲突 RRset 被拒绝。
- [x] migration capture 从冻结的配置重新查询并记录实际查询时间和目标 TTL，不将未绑定配置的 legacy cache 冒充新事实。相同地址的成功刷新更新 observation 时间；查询失败不续期成功时间；CNAME 链保留最短 TTL。
- [x] 全量 `make test`、CNAME 链和故障回归通过；backend `e4a98ce9fa0ca84bdb92c41ea6b1a07d36e0daf1`、CI `34845381253` 成功；web `fc4b914b`、contract-drift `34845570785` 成功。
- [x] 生产 API generation 1003、2/2 Ready、Guardian stable、健康/就绪 200；三次 digest 一致、双栈输出、60 秒正常 TTL、10 秒剩余 freshness 的 stale TTL 与 13 类非法事实拒绝通过。候选未 promotion，shadow/route/policy LKG 不变。
- [ ] `empty_noerror` 在消费者具备空权威名称语义后启用；真实业务 flatten 端到端 serving 验证仍未完成（当前生产草稿的 flatten record 数为 0）。

证据：[dns-flatten-2026-09-14.json](verification/dns-flatten-2026-09-14.json)。

### P0-BF：ACME challenge 到期语义与发布隔离

- [x] `PlatformIntent.ACMEChallenges` 保存 challenge ID、zone、hostname、TXT value、TTL 和绝对 `expires_at`；challenge 由同一业务事务快照投影，过期判断只使用固定 `captured_at`。
- [x] compiler v11 将多个 challenge 合并为同一 TXT RRset，为每个 value 保留独立 expiration；永久 TXT 不会被 challenge 生命周期覆盖，过期 value 在编译时删除，空 RRset 不输出。
- [x] challenge identity、zone 边界、TTL、空值、重复 ID、缺失 captured_at 和到期时间均 fail-closed；runtime facts 改变只改变 input snapshot/artifact digest，不改 intent/policy digest。
- [x] DNS artifact 与包含它的 ReleaseSet 在 DNS consumer 尚未支持逐值 expiration 前，gray/full 发布和 rollback 均返回 409；shadow 编译可用于验证，soft override 不能绕过该兼容性门。
- [x] backend commit `966c2fc8ab7465017823156207d150bac94572cf`、CI `34849354452` 成功；web `ccb9cf65`、contract-drift `34849540285` 成功。
- [x] 生产 API generation 1004、2/2 Ready、Guardian stable、健康/就绪 200；3 次 replay digest 一致，两个值独立到期，首值到期后只剩第二值；5 类非法输入返回 400，6 类 traffic promotion/rollback 入口返回 409，shadow/route/policy LKG 未变化。
- [ ] DNS consumer 支持逐值 expiration、空权威 RRset 和 ACME serving 后，才可解除 gray/full 门并完成真实业务 challenge 的端到端验证；当前生产草稿 challenge 数为 0。

证据：[acme-expiration-2026-09-14.json](verification/acme-expiration-2026-09-14.json)。

### P0-BG：DNS consumer 逐值到期过滤与 LKG 恢复

- [x] `EdgeDNSRecord.ValueExpirations` 纳入签名内容；consumer 在编译校验、缓存加载和每次查询时按绝对到期时间过滤 TXT value，并按最早剩余租期限制 TTL。
- [x] 过期 value 不会通过缓存续租；全部 value 过期时返回权威空 RRset 语义，保留签名 bundle 和 verified LKG，不改写 serving cache。
- [x] DNS consumer 校验 PlatformIntent/PolicySnapshot lineage、artifact metadata、ReleaseSet 绑定和 DNS wire 编码；不支持到期语义的 consumer 仍被 gray/full promotion 与 rollback 保护门拒绝。
- [x] 到期事实写入 autonomy WAL，只记录 record identity、数量和 evidence digest，不记录 challenge token；重复事实有时间窗口去重。
- [x] `make test` 与 DNS 到期/LKG/WAL/篡改签名回归通过；backend `7f214a78d6e827f247ad098c41c942820aa720df`、CI `34853240238` 成功；web `fd581ee77ad6caa04541d2e4c63c09674d239191`、contract-drift `34853332420` 成功。
- [x] 生产 API、US/DE DNS 与 SSH-front workloads 均运行 `7f214a78`，Ready 且无重启；两个 DNS consumer 对现有 shadow artifact 均报告 `shadow_verified`、可信 heartbeat `staged/shadow_validated`，未将候选提升为 serving；legacy DNS envelope generation 随正常刷新变化，API/Guardian 健康。
- [ ] 生产尚无真实 ACME challenge（当前草稿 challenge 数为 0），因此真实公网 challenge 的逐值过期 serving E2E 与解除 promotion 保护门继续留待业务输入存在后验证。

证据：[dns-consumer-expiring-values-2026-09-14.json](verification/dns-consumer-expiring-values-2026-09-14.json)。

### P0-BH：DNS artifact 到实际报文的语义一致性

- [x] 修复查询入口漏掉 SRV，支持普通 SRV 与根目标 `.` 的禁用服务语义；保留 null MX 的 `0 .`，不会把合法 artifact 内容静默丢弃。
- [x] TXT 分片保留原始 byte string 的首尾空白；签名中的 RDATA 与实际 DNS 报文保持一致。
- [x] 已存在名称没有所请求 RRset 时（包括全部 challenge value 到期），返回 `NOERROR` 和 authority SOA；不存在名称仍返回 `NXDOMAIN`。
- [x] 新增 compiler → signed cache reload → public ServeDNS → pack/unpack 回归，覆盖 11 类记录与 5 类否定应答；完整 `make test` 通过。
- [x] 首次提交 `3d603977` 漏带 release intent，CI `34855177222` 在发布计划校验时拒绝，未部署；已补齐两个组件的真实生产前驱，`100497849f09837fa41f3081847cb536ee337cf5`、CI `34855593385` 完成构建和生产部署；后续 snapshot 修复 commit `db44b459f352d7f59a462265c473bd72f5410416`、CI `34857297271` 完成部署。
- [x] US/DE DNS 与 SSH-front Ready，DNS pod 无重启；两个生产节点分别通过 UDP/TCP 正常 A 应答及 NODATA/SOA 探测，可信 shadow heartbeat 正常，API/Guardian 健康，shadow ReleaseSet、route lineage 和 policy LKG 查询状态不变。
- [x] zone apex 使用配置的 authoritative zone 判断存在性；缺少显式 apex RRset 时返回权威 NODATA/SOA。查询与 WAL 事实使用同一 bundle/index snapshot，刷新不能造成混合版本或索引越界。

证据：[dns-wire-contract-2026-09-14.json](verification/dns-wire-contract-2026-09-14.json)。

补充证据：[dns-snapshot-index-2026-09-14.json](verification/dns-snapshot-index-2026-09-14.json)。协议依据：[RFC 2308](https://www.rfc-editor.org/rfc/rfc2308.html)、[RFC 2782](https://www.rfc-editor.org/rfc/rfc2782.html)、[RFC 7505](https://www.rfc-editor.org/rfc/rfc7505.html)。

### P0-BI：DNS 查询与发布快照一致性

- [x] 消费者在同一个锁内读取 bundle 与其 immutable index，查询和到期 WAL 共用该快照；删除查询链路单独读取全局 index 的路径。
- [x] 在查询获取快照之后插入一次新发布，A/TXT 查询仍返回旧快照的值，下一次查询再读取新值；修复测试中可稳定复现的索引越界 panic。
- [x] authoritative zone apex 没有显式 RRset 时仍视为存在，返回 NODATA/SOA；缺失的非 apex 名称继续返回 NXDOMAIN。
- [x] `go test -race ./internal/dnsserver`、完整 `make test`、精确发布计划通过；backend `db44b459f352d7f59a462265c473bd72f5410416`、CI `34857297271` 成功，US/DE DNS 与 SSH-front 已部署并 Ready。
- [x] 两个生产节点的 UDP/TCP 正常 A、已有名称 NODATA、apex NODATA 探测通过；可信 shadow heartbeat、API/Guardian 正常。shadow ReleaseSet、route lineage 和 policy LKG 查询与发布前一致。没有在生产主动制造竞态或故障，竞态修复由本地 interleaving/race 回归证明。

证据：[dns-snapshot-index-2026-09-14.json](verification/dns-snapshot-index-2026-09-14.json)。后续迁移仍由 DNS placement、release observation 修复与全量输出等价验证阻塞，不能将这些 DNS consumer 修复当作五层架构已完全接管 serving。

### P0-BJ：应用 DNS 期望配置与 placement 分离

- [x] `DNSApplicationIntent` 保存 FUGUE_APP 的 IP family、TTL、fallback 策略；迁移草稿将唯一同租户应用名称解析为稳定 app ID，Values 只保存该 ID，不复制已选择的地址或 readiness。
- [x] 配置校验要求 canonical app/tenant ID、准确 Values 引用及同 hostname 的 route owner；拒绝不完整绑定、跨租户、冲突 IP family、混用 flatten/expiration，以及与 A/AAAA/CNAME/ALIAS/ANAME 的地址来源冲突。
- [x] 应用 DNS 配置可创建并验证为 immutable intent；wire 校验和 compiler 在 placement resolver 尚未完成时继续明确拒绝，不把应用 ID 当作 DNS 地址或生成空 artifact。
- [x] normalization 深拷贝应用 DNS policy，修改期望策略产生新的 intent generation；16 类非法输入、名称歧义、来源保真与完整 `make test` 通过。
- [x] backend `e6abe55d10e4e47e2931231f6434641e69943500`、CI `34862201247` 成功，仅发布 API；web `6639986c15dbd35d920f0a1b03845c3f940502bb`、contract-drift `34862418114` 成功。
- [x] 生产 API generation 1006、2/2 Ready、Guardian stable、健康/就绪 200；合法候选 intent 验证成功，7 类非法候选验证返回 409，未解析编译返回 400。当前 132 条 route、1 条应用 DNS 的草稿已消除 `intent_requires_validation_repair`，shadow ReleaseSet、route lineage 和 policy LKG 查询不变。验证新增 8 份候选 intent，均未 promotion。
- [ ] 从固定 edge inventory、route-ready/TLS-ready 证据解析应用与平台 DNS placement，绑定 input digest、原始证据时间和 policy；补齐发布一致性与全量输出等价后再推进 consumer gray/full。当前 `migration_ready=false`，剩余 4 个 issue 为应用/平台 DNS placement 与 release facts/等价验证。

证据：[dns-application-intent-2026-09-14.json](verification/dns-application-intent-2026-09-14.json)。

### P0-BK：DNS placement 固定事实编译与绝对租期

- [x] 新增 `DNSPlacementObservation` 与 `DNSPlacementCandidate`，绑定 canonical DNS/application/compiled-route/policy digest；候选保存 edge identity、group、serving generation、observed-at、valid-until、健康、route-ready、TLS-ready 和 A/AAAA。
- [x] compiler v12 只从固定 placement facts 生成 FUGUE_APP 的 A/AAAA；校验租户/route owner、edge 排除、pinned group、IP family、最小健康 edge、freshness 和 wire 地址，缺证据或不满足 ready 条件时拒绝新编译。
- [x] 应用地址写入逐值绝对 expiration；TTL 同时受记录、目标事实、heartbeat freshness 和 quorum deadline 限制，任一租期到期后不再满足最小健康数量时，整组地址按 quorum deadline 停止返回；反复查询和缓存重载均不续期。
- [x] 动态候选与地址租期互斥；consumer 对带租期 A/AAAA/TXT 执行查询时过滤、签名校验和 LKG 恢复，promotion/rollback 在真实 consumer 能力注册前继续 fail-closed。
- [x] placement replay、双栈、quorum、owner、route/TLS readiness、排除、过期和 21 类非法输入回归通过；完整 `make test` 通过。
- [x] backend `ce418c911d1ba10d38e870e4edd3be5f6a7f5e1b`、CI `34871479064` 成功，API 与 US/DE DNS lanes 均部署；web `3b86559acc9b3261445d0bbaa3d91b4457c6e276`、contract-drift `34871954405` 成功。
- [x] 生产 API 2/2 Ready、两个 DNS 节点可信 shadow receipt 为 `staged/shadow_validated`，DNS 节点健康、cache ready；现有 shadow ReleaseSet、route lineage 和 policy LKG 查询与发布前一致，候选未 promotion；legacy DNS envelope generation 仍按正常刷新推进。管理端对美、德 DNS 的 UDP/TCP 探测均通过。生产合成编译验证了三次相同 digest、双栈 lease、quorum 截止、策略分支、所有 traffic guard 和健康/就绪 200。
- [x] 真实业务 hostname placement observation 已由 P0-BM 的独立 HTTPS proof collector 生成；当前应用 DNS 草稿已消除 `dns_app_placement_not_projected`。这是编译输入观测，FUGUE_APP 尚未切换到新 artifact serving，租期 promotion 保护继续保留。

### P0-BL：Edge 实际加载路由证明协议

- [x] 在 OpenAPI 中定义受限 `HEAD` 探测协议；通过候选 IP 访问业务 hostname，使用 TLS SNI/证书、随机 nonce、edge/group identity、route digest、bundle version 和原始有效期绑定响应。
- [x] Edge 从同一 immutable route index 读取 hostname/path、路由和 bundle expiry，返回版本化 SHA-256 摘要；不访问 upstream、peer 或业务数据库，不暴露路由 payload、地址或凭据，不延长 signed bundle 租期。
- [x] 缺失路由、未发布候选、非活动或被排除路由、错误分组、过期 bundle、错误 method/version/nonce 均不能生成有效证明；普通代理请求保持原行为。
- [x] 回归验证最长路径选择、route owner/upstream/权重/TLS/cache 变化导致 digest 改变、诊断时间和无序排除集合不影响 digest、拒绝路径无证明、重复探测不续期；完整 `make test`、定向 race 与精确发布计划通过。
- [x] backend `0d7b084f504e3c0cc3c875dca59ae326113d0ae1`、CI `34877564853` 成功；API 及美/德 Edge worker 均经声明式流程部署；web `596dc49086b015d85e1a4c0f7fb41418884aa027`、contract-drift `34877587474` 成功。
- [x] 从生产 Guardian 对德国 1 个、美国 2 个公网 IP 发起 HTTPS 探测，全部返回 204；nonce、edge/group identity、摘要、bundle version 和有效期均与对应 worker 的已加载 bundle 相符，无 nonce 返回 400；3 个活跃 worker Ready、零重启，API 2/2 Ready，三项 Guardian local/dependency/route health 均 healthy。
- [x] 发布前后 shadow ReleaseSet、route lineage 和 policy LKG 查询完全一致；policy LKG 仍为原有 404，不将其当作已完成 policy 恢复验收；候选配置未 promotion。证据：[edge-route-proof-2026-09-15.json](verification/edge-route-proof-2026-09-15.json)。
- [x] 接入独立 placement collector，将证明与编译目标路由及原始 inventory freshness 核对，生成固定 `DNSPlacementObservation`，见 P0-BM。
- [ ] 完成真实应用/平台 DNS 等价校验后才可解除发布保护。

验证范围：本机网络路径对同一固定 IP 的请求仍返回普通 upstream 响应，原因尚未确认，未用作部署验收证据；生产 Guardian 发起的公网 HTTPS 与 worker 本地 bundle 交叉验证通过。本步骤证明协议可用，不代表应用 origin 健康或未来持续可用，尚未完成真实 FUGUE_APP serving 迁移。

### P0-BM：真实应用 DNS placement 采集

- [x] migration draft 对应用 DNS 的每个 hostname/path、每个候选公网地址发起独立 TLS/Host proof；校验 nonce、完整路由行为 digest、原始 bundle version、edge/group identity 和有效期，拒绝重定向、私有地址、歧义响应头和失效证据。
- [x] 提取 `routebinding.FromIntent` 为 API 观测与 Edge Control 共用的纯字段转换；runtime 健康、group selection、签名和发布 generation 仍由原 owner 处理，避免第二套路由转换语义。
- [x] 只为通过全部路径证明的地址生成候选；保留原始 heartbeat 时间，租期取 heartbeat freshness、policy freshness、signed bundle 和证书链有效期的最小值。LastSeenAt 不续期，后续 hostname 探测完成后按最终 captured_at 重新校验已有事实。
- [x] 采集使用有界时间、节点数和探测数；有效 inventory 地址身份冲突明确拒绝，陈旧 inventory 不阻塞健康节点；拒绝结果保留 issues，其他迁移问题不会被清除。
- [x] 定向/race 回归与完整 `make test` 通过；修复现有 NetworkPolicy 测试中写死历史 release SHA/generation 的断言，改为校验完整前驱绑定，真实前驱继续由精确 release plan 与 Guardian CAS 核验。
- [x] backend `11b7f38bc1577d94e2289804410c4ccad25ba0de`、CI `34883804560` 成功；API、两地 Edge Control、Guardian/Prober 均通过声明式流程部署且 Ready。web `dc52d879986193e2a03191b38e9c7369cd3b4785`、contract-drift `34883844216` 成功。
- [x] 生产真实应用 DNS 生成 1 份 placement observation、3 个正向候选（美国 2、德国 1），原 heartbeat 时间及最长 90 秒租期已核对；业务 deployment 变化导致旧 digest 被拒绝，重新捕获的快照通过。当前 132 routes，issues 仅余平台 DNS placement、release target equivalence 和 release observation repair。
- [x] API 与两地 Edge Control Guardian 均 stable，local/dependency/route health 均 healthy；health/ready 200，shadow ReleaseSet、route lineage 和 policy LKG 查询与发布前一致。policy LKG 仍为 404，候选配置未 promotion。证据：[dns-placement-capture-2026-09-15.json](verification/dns-placement-capture-2026-09-15.json)。
- [ ] 完成平台 DNS placement、真实 release facts/sticky 策略和全量输出等价验证，再执行 artifact consumer apply、gray/full 与 rollback 恢复验收；当前 `migration_ready=false`。

### P0-BN：显式 DNS 到 route 引用与别名编译

- [x] 新增强类型 `DNSRouteIntent` / `FUGUE_ROUTE`：DNS 名称显式引用 1..128 个实际 HTTP/TLS hostname，Values 为空，owner 与每个引用的全部路径一致；平台 route 使用空 app/tenant owner，托管目标使用明确应用 owner。
- [x] compiler v13 对每个引用的所有路径绑定完整 route/policy input digest；复用现有 placement readiness、排除、quorum、IP family、freshness、绝对租期和 DNS wire 校验，编译结果只保留 A/AAAA，不把符号引用交给 consumer。
- [x] 拒绝缺失/重复/非法/wildcard 引用、跨 owner、混合 app/flatten、字面 IP、冲突地址来源、过期或不匹配证据；修改任意引用路径或 upstream 不能重用旧事实。归一化深拷贝并排序引用，顺序不影响 digest。
- [x] placement collector 对引用的真实 route hostname 发起 TLS/Host/path proof，而不是探测 DNS 别名；所有引用通过才能生成该地址候选，不扩大发布权限。
- [x] 定向与 race 测试通过；全量测试首次在同机并发压力下出现两个外部命令超时，降低包并发后完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过；精确发布计划通过。
- [x] backend `adddaf8be95573749ad8ace26e7b0526ea660d2e`、CI `34887674602` 成功；API 与美/德 Edge worker 已部署。web `cbeff8e7125909acc4e8398cd96c17bf43642bd7`、contract-drift `34887743440` 成功。
- [x] 生产 compiler v13 合成多 hostname/path 编译重放 3 次 digest 一致，双栈 alias 带 30 秒绝对租期；14 类非法输入返回 400，DNS/ReleaseSet 的 gray/full/rollback 共 6 个保护入口返回 409；候选未 promotion。
- [x] 3 个活跃 Edge worker 镜像均匹配本次 receipt，Ready 且零重启；公网 proof 摘要与已加载 bundle 一致，API 2/2 Ready、两地 Guardian stable；真实应用 placement 仍有 3 个候选，shadow ReleaseSet、lineage 和 policy LKG 查询不变。证据：[dns-route-references-2026-09-15.json](verification/dns-route-references-2026-09-15.json)。
- [ ] 将平台入口、应用默认域名和托管自定义域名 target 的 DNS 期望投影到这些显式引用；处理 protected/static 优先级和共享 target 关系，完成全量输出等价。当前 `dns_route_placement_not_projected` 仍保留，不宣称平台 DNS 已迁移。

### P0-BO：平台 DNS 入口投影

- [x] 将配置范围内的显式平台 route 入口投影为 `FUGUE_ROUTE` DNS intent；API 与 mesh 入口保留 route owner、TTL、状态和 route hostname 引用，不复制 runtime 地址或健康状态。
- [x] 同名静态 A/AAAA/CNAME 只有在内容完全匹配静态来源时才被替换，并写入 `static_address_replaced_by_platform_entry` 审计排除；MX/TXT/NS 等其他 RRset 保留。同名租户记录不会被误删，而是保留并阻止发布。
- [x] 缺少 route、重复入口和业务 owner 冲突被拒绝；配置 authoritative base domain 之外的入口不投影。投影完成后重新计算 intent generation，placement facts 绑定完整 route/policy digest。
- [x] 定向 API、DNS route、placement 和全量 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过；精确 release plan 仅选择 API lane。一次 amend 造成错误 ancestry 被 release planner 拒绝后，已重建 successor，未绕过前驱检查。
- [x] backend `9560b9099e2d38cbac6601c33898ae4daa16177d` 以生产 `ef47c27e` 为真实前驱推送，CI `34895066459` 成功，API 2/2 Ready、health/ready 200；旧 Edge/DNS serving、shadow ReleaseSet、route lineage 和 policy LKG 保持不变。
- [x] 生产 migration draft 返回 `api.fugue.pro`、`mesh.fugue.pro` 两个 `FUGUE_ROUTE` intent；静态 api A 覆盖保留审计记录；三份 placement observation 的候选数随采集时的证据变化，已观察到各 3 个，落盘证据为各 2 个，均满足当次门槛。API route 的既有最小健康门槛 2 已冻结到迁移 policy，修复后摘要与加载 bundle 一致；当次没有 placement repair issue。
- [ ] 真实平台 DNS answer 与旧 Edge/DNS 全量输出仍未完成；平台 route placement issue 保持阻塞，不能解除 DNS consumer gray/full 或声明公网平台入口已迁移。证据：[platform-entry-dns-projection-2026-09-15.json](verification/platform-entry-dns-projection-2026-09-15.json)。

### P0-BP：默认应用域名 DNS 投影与并发采集

- [x] app base domain 内的应用根 route 投影为同 owner 的 `FUGUE_ROUTE`；同名现有 DNS 配置保持原来源，子路径不重复生成 RRset，但全部参与 proof；缺失/冲突 owner 不会被伪造成平台路由。TTL 读取现有 DNS 配置并沿用其规范化规则。
- [x] collector 使用最多 8 个 hostname worker、共享 4096 次探测预算和 30 秒总时限；worker 读取固定输入，主线程按 intent 顺序合并事实，全部 worker 结束后按最终 captured_at 重验，不续期 heartbeat、证书或 bundle lease。
- [x] 200 hostname/800 次成功探测回归验证并发上限、完整事实及取消后 join；相关 race 与低并发完整 `make test` 通过。route proof canonicalization 保持 v1，冗余 policy、deployment generation 和 cache namespace 继续参与摘要；未发布的放宽摘要尝试已撤回。
- [x] backend `91419a0a778b6af9e8ec9025b32b79f608ebd22b` 首次投影触发采集预算问题，后续 `2967affb194d7a52eea3a822e4adcfb7b7e65ad9` 修复；CI `34901096311` 成功且只发布 API。Web 契约同步 commit `7145bc1b`，本地 contract:check 通过。
- [x] 生产最终证据为 133 routes、136 DNS intents、122 个 route DNS 引用、110 份 placement observation / 189 个候选，capture_limit 为 0；API 镜像匹配 `2967affb`、2/2 Ready、零重启、Guardian stable、health/ready 200，配置基线未变化。
- [x] 13 个 `dns_placement_route_inputs_invalid` 明确保留：包括尚未支持的 edge-group policy、陈旧 release facts 和 sticky release 策略；不能把这些都称为 origin 故障。其他时刻采集仍可能因真实 generation/freshness 变化出现 repair issue，单次通过不代表全平台无故障。证据：[default-dns-concurrent-placement-2026-09-15.json](verification/default-dns-concurrent-placement-2026-09-15.json)。
- [ ] 补齐自定义域名/共享 target 投影、上述 policy/release 缺口和全量 DNS 等价校验；当前 migration_ready=false，旧 artifact 继续 serving，DNS gray/full 保护未解除。

### P0-BQ：Placement policy bridge 与业务缺口分类

- [x] 新增 `ApplyRoutePolicyConstraintsForPlacement`：placement 诊断先物化 edge-group、排除和最小健康约束，再用固定 inventory/proof facts 解析地址；完整 serving compiler 仍使用严格 `ApplyRoutePolicyConstraints`，未迁移约束不能直接发布。
- [x] 约束 bridge 不修改 intent 或 policy，只复制 compiled route；edge-group readiness、route proof、quorum 和绝对租期仍是 fail-closed 条件。回归证明 placement 版本接受 edge-group policy，而严格 serving 编译仍拒绝同一未迁移输入。
- [x] backend `1347f8371c06bf68ed33245ef642b786a24bab4a`、CI `34906552312` 成功；API Ready，生产迁移 draft 的 `dns_placement_route_inputs_invalid` 从 13 项降为 6 项。减少的 7 项来自 edge-group policy 循环；剩余 6 项继续保留为真实 release freshness/sticky/业务事实问题。
- [x] 发布前后 shadow ReleaseSet、route lineage 和 policy LKG 状态未变化；健康/就绪 200，未 promotion。证据：[placement-policy-bridge-2026-09-15.json](verification/placement-policy-bridge-2026-09-15.json)。
- [ ] 修复剩余 release freshness、sticky consumer 能力和各 hostname 的 origin/runtime 输入后，才能完成 placement 全量等价和 DNS gray/full/rollback 验收。

### P0-BR：Placement 证明回滚与 LKG 恢复验证

- [x] 撤回重复覆盖 route projection 的实现：`projectPlatformRouteArtifact` 已应用全局/每路由最小健康数及排除字段；再次把 `CompiledRoute.MinHealthyEdgeNodes=0` 复制到最终投影会抹掉有效默认值，导致 proof 不匹配。恢复直接对最终 route projection 求摘要，保留 v1 的完整行为校验。
- [x] 通过声明式 release 链恢复兼容 collector。`1471bdce` 曾通过健康检查并部署，但 placement 诊断出现回归；`2b925c3b` 才是撤回后的实际生产版本。若干发布因本轮错误的 intent generation、predecessor/digest 与历史改写失败，均发生在生产写入前；后续恢复使用实际 Guardian LKG 和明确 supersede 关系，没有现场修改 Deployment。
- [x] backend `2b925c3bda48a5f78753a4fd91ecb467214f6b92`、CI `34914038259` 成功；生产 API 镜像 digest 为 `sha256:c329b57e76a3a0fccfb4884b0ecd78a6d764fd58b59eb596963218d76ebef925`，2/2 Ready，Guardian `stable` 且 local/dependency/route health 全部 healthy，`/healthz` 与 `/readyz` 均为 200。
- [x] 恢复后 shadow ReleaseSet、route lineage、policy LKG 查询与已有基线完全一致；没有配置 promotion。placement 草稿为 133 routes、136 DNS intents、119 observations，保留 4 个 `dns_placement_route_inputs_invalid`、2 个 `dns_placement_evidence_requires_repair`、平台 DNS 与 release equivalence/freshness 缺口，`migration_ready=false`。policy LKG 仍为 404，该恢复能力尚未验收。
- [x] 证据：[placement-proof-recovery-2026-09-15.json](verification/placement-proof-recovery-2026-09-15.json)。
- [x] 补充 collector 与实际 Edge Control 输出之间的回归，覆盖默认健康门槛 1、每路由覆盖 3 和排除字段，并验证已编译 release eligibility 不会在投影时丢失（P0-CC）。
- [ ] 调查剩余业务输入/证明缺口，完成全量等价前不得解除 DNS gray/full 保护。

### P0-BS：Release fact 与 serving runtime 证据绑定

- [x] release observation 不再仅凭业务 release 行的 `UpdatedAt` 延长 freshness；只有 RuntimeID、resolved image 和 `app_release_traffic_policy` serving evidence 同时一致，才可采用更新的 runtime `ObservedAt`。
- [x] 不匹配、缺失或不新鲜的 runtime 证据继续使用原始 release 时间并保留 fail-closed 行为，避免把其他 release 或历史运行实例冒充当前 stable release。
- [x] 新增匹配/不匹配回归测试；后端完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过。
- [x] backend `885da468faffddf1bb73df2305c673a12222db1a`、CI `34916793225` 成功，生产 API 2/2 Ready、Guardian stable、health/ready 通过；placement 草稿保持 `migration_ready=false`，2 个 route input invalid 和现有 evidence/equivalence 缺口均被保留。
- [x] 证据：[release-fact-runtime-evidence-2026-09-15.json](verification/release-fact-runtime-evidence-2026-09-15.json)。
- [ ] 为每个 stable/candidate release 增加可验证的 release identity（而不是仅 app 级 serving evidence），再处理剩余 freshness 和 target equivalence 缺口。

### P0-BT：Placement 与 release 输入的结构化诊断

- [x] placement collector 将 route input 和 evidence repair 的通用校验错误写入 `issues[].reason`；不记录 upstream URL、凭据或其他敏感 runtime payload。
- [x] OpenAPI、生成客户端和 web 快照同步；本地 `make generate-openapi`、完整 Go 测试与 `npm run contract:check` 通过。
- [x] backend `5dc88268c36823c50e37dc16db8194d0e768707a`、CI `34918009055` 成功，生产 API 2/2 Ready、Guardian stable。生产原因已确认：2 个 route input 为 `release observation requires fresh evidence at fixed captured_at`；4 个 placement repair 为 `insufficient route-ready and TLS-ready edges`。这些 issue 继续阻止 promotion，没有被隐藏或降级。
- [x] 证据：[projection-validation-reasons-2026-09-15.json](verification/projection-validation-reasons-2026-09-15.json)。
- [ ] 逐项修复实际 release identity/freshness 和 route/TLS readiness 输入后，才能完成 DNS 等价和 consumer gray/full 验收。

### P0-BU：精确 serving release identity

- [x] `AppObservedStatus` 增加 `serving_release_id`，由实际 serving traffic target 的 release observation 写入；PlatformIntent projection 只有 release ID、runtime ID、resolved image 和 serving evidence source 全部一致时才延长该 release 的 evidence 时间。
- [x] 不再使用 app 级同 runtime/同镜像证据替代另一个 release；缺少精确 identity 时保持原始 release 时间并 fail closed。
- [x] backend `922cc1296a2f23a1055209a7169ebc013d52d9ed`、CI `34921024404` 成功；生产 API 2/2 Ready、health/ready 与 Guardian health 正常。placement evidence repair 从 4 项降为 3 项，两个过期 release input 仍保留，未发生 serving promotion。
- [x] OpenAPI 与 web generated client 同步（web `3739ccc1`，contract check 通过）。证据：[serving-release-identity-2026-09-15.json](verification/serving-release-identity-2026-09-15.json)。
- [ ] 补齐每个 release 的真实 route/TLS readiness 和 target equivalence，不能把 app 级健康状态继续当作全量 release 验收。

### P0-BV：缺少精确 identity 的 release active gate

- [x] PlatformIntent projection 只有在 `serving_release_id`、RuntimeID、resolved image、fresh serving evidence 同时匹配时，才把 stable/candidate release fact 标记为 active。
- [x] 没有精确 serving identity 的 ready/serving release 保留为 `unavailable`，并返回 `exact serving release identity is unavailable`，不会被 traffic compiler 当作可服务目标。
- [x] 新增回归测试覆盖 identity 缺失时的 fail-closed 行为；后端 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 全部通过。
- [x] backend `b02ba40c51e59e437bded1d2527dc1469063388f` 已推送 `main`；CI `34926438171`、`34926438201` 均成功。
- [x] 生产 API 已运行 `b02ba40c…`，2/2 Ready，`healthz/readyz` 均为 200；缺少 identity 的两个历史 release 均为 `unavailable`，具备 identity 的 release 保持 `active`，`migration_ready=false` 未发生 promotion。
- [x] 证据：[release-identity-active-fact-gate-2026-09-15.json](verification/release-identity-active-fact-gate-2026-09-15.json)。
- [x] release 事实只在健康 current cohort 证明下携带精确 identity；真实观测时间固定为 runtime evidence 时间，业务 `UpdatedAt` 不再续期。
- [x] backend `af1058b93639940968184453dc1684012872db77`、CI `34930943883` 与生产部署成功；API 2/2 Ready，Guardian stable，health/ready 均为 200。生产 4 个 release 为 active、4 个未验证 release 为 unavailable 且 `observed_at=zero`。
- [x] 证据：[healthy-exact-release-evidence-2026-09-15.json](verification/healthy-exact-release-evidence-2026-09-15.json)。
- [ ] 继续补齐每个 release 的真实 route/TLS readiness、target equivalence 和 DNS placement 投影，完成前保持 gray/full 保护。


### P0-BW：托管自定义域名与共享 target DNS 投影

- [x] 将 verified AppDomain 的 managed、manual、external 绑定统一投影为 symbolic `FUGUE_ROUTE` target；同一 target 的多个 hostname 聚合到一个 route 引用。
- [x] 校验 App、Domain、Route 的 tenant/owner 一致性；缺失 route、非法 target、地址记录冲突和受保护 target 只生成结构化 issue，不覆盖已有 DNS。
- [x] DNS/TLS readiness 保持 runtime fact；intent 只描述 hostname、target、owner 和 route 引用，placement collector 继续独立验证 readiness。
- [x] 新增自定义 target 聚合、owner 冲突、protected target、缺失 route 和 legacy 空 DNS mode 回归测试；完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过。
- [x] backend `d3abeada10664027ba63e2bbff5140d9a26e5df2`、CI `34962186895` prepush/build/deploy 成功；生产 API 2/2 Ready，Guardian stable，health/ready 均为 200。
- [x] 生产生成 119 个 custom-domain target intent，`dns_route_placement_not_projected` 为 0；剩余 shared-host owner conflict（`api.0-0.pro`）、release freshness、route/TLS evidence 和 output equivalence 继续 fail-closed，`migration_ready=false`。
- [x] 证据：[custom-domain-dns-projection-2026-09-15.json](verification/custom-domain-dns-projection-2026-09-15.json)。
- [ ] 继续修复剩余 owner mismatch、release freshness、route/TLS readiness 与全量旧输出等价，完成前保持 gray/full 保护。

### P0-BX：Placement readiness 计数诊断

- [x] placement repair reason 增加 `candidates`、`healthy`、`route_ready`、`tls_ready` 计数；计数来自同一固定 DNS placement fact，不会改变 gate 判定。
- [x] `candidates=0`、任一路由/TLS readiness 不足和 release freshness 继续分别 fail-closed；不通过降低阈值或伪造候选清除 issue。
- [x] backend `4d232f0a8062b7f87afcaf0a859220c5272aea92`、CI `34964491450`、API deploy 成功；生产 API 2/2 Ready，`migration_ready=false`，Guardian/LKG serving 保持稳定。
- [x] 生产诊断确认 6 个 placement repair 为 `candidates=0 healthy=0 route_ready=0 tls_ready=0`，6 个 route input 为固定时间 freshness 失败，1 个 shared-host owner conflict 保持 fail-closed。
- [x] 证据：[placement-readiness-counts-2026-09-15.json](verification/placement-readiness-counts-2026-09-15.json)。
- [ ] 继续修复真实 edge inventory、route/TLS readiness、release freshness 和 shared-host 业务冲突，完成前保持 gray/full 保护。


### P0-BY：Ready stable baseline 的 serving identity 兼容

- [x] 单 stable 100% traffic policy 下，`AppRelease.status=ready` 且 Deployment/Service/Endpoint/image current cohort 全部健康时，作为 canonical stable baseline 参与 serving identity 证明；不要求历史持久状态必须已经写成 `serving`。
- [x] 新增 point-read 回归测试；完整 `GOFLAGS=-p=2 GOMAXPROCS=4 make test` 通过。
- [x] backend `65f319b544b36eac27bfc3dc25350ade07a9c600`、CI `34967815766`、API deploy 成功；生产 API 2/2 Ready，Guardian stable，health/ready 通过。
- [x] 生产 `music.fugue.pro` 与 `drain-canary-0705.fugue.pro` 均恢复精确 `serving_release_id`；`release_observations_require_repair` 的 freshness 输入从 6 个降为 2 个，未发生 serving promotion。
- [x] 证据：[ready-stable-baseline-release-identity-2026-09-15.json](verification/ready-stable-baseline-release-identity-2026-09-15.json)。
- [ ] 继续处理剩余两个 freshness 输入、review00 runtime 故障、route/TLS evidence、shared-host conflict 和全量 output equivalence。

### P0-BZ：CrashLoop 故障状态传播与时间精度容错

- [x] 控制器在 Pod 创建时间与 release cutoff 存在秒级截断时，仍识别当前 cohort 的真实容器失败；旧 release 的失败 Pod 继续按 cutoff 隔离。
- [x] CrashLoop/进程退出错误优先于“等待副本”状态，避免把已知故障错误显示为长期 `deploying`。
- [x] 新增时间精度边界回归；完整 `make test` 通过。
- [x] backend `04dc1658d299aa144fcc250e5821ad0fa6faed8e`、`e6eef67274763ff7024b527fc3ff97698b75f078`、CI `34978538926`、controller deploy 成功；生产 controller 2/2 Ready。
- [x] 生产 review00 观察状态已从 `deploying` 变为 `failed`，API 返回 `reason=managed_app_error`、Pod/容器错误和 fresh Kubernetes evidence；runtime log 同时记录数据库连接被拒绝。旧 serving/LKG 与其他组件未被该故障污染。
- [x] 托管 Postgres Pod 的容器故障也已进入 backing-service runtime facts；生产 `GET /v1/backing-services?include_live_status=true` 返回 `phase=error`、`ready_instances=0/1`，消息包含 `exit_code=4`，底层日志明确为 `no free disk space for WALs`。
- [x] 保护性回归确认：其他 healthy/suspended backing service 仍保持原有 `active`/`suspended` phase；只有当前 Pod failure 的服务转为 `error`，不会被历史失败 Pod 误覆盖。
- [x] 证据：[controller-crashloop-status-2026-09-15.json](verification/controller-crashloop-status-2026-09-15.json)。
- [ ] 继续修复 review00 数据库自身故障、剩余 release freshness、route/TLS evidence、shared-host conflict 和全量 output equivalence；本步骤只修复故障识别与传播，不宣称业务实例已恢复。

### P0-CA：数据库存储意图保持与容量安全门

- [x] database-localize 扩容严格保持请求中的 `storage_class_name`，不因目标 runtime 存在其他驱动而隐式切换 StorageClass。
- [x] 应用不可用时仍可进入数据库扩容预检；扩容操作不会把 app ready 作为同 runtime PVC expansion 的必要条件。
- [x] 新增 app-owned/bound-service 两条执行入口回归，验证替代驱动不会被读取、迁移对象不会被写入；完整 `make test` 通过。
- [x] 生产 controller `d17ce4560233a0104f587ca484a32a27402a8cb1`（实现修正 `4b918141f5dbbe75fc59f54ac404f2e162e983f7`）、CI `34994646236`/`34996046808`、controller deploy 成功，2/2 Ready。
- [x] 生产实测 `fugue-postgres-rwo`（OpenEBS）与 `fugue-longhorn-rwo`（Longhorn）为不同驱动；review00 PVC 保持 20Gi，新 40Gi 扩容在容量预检阶段拒绝，未 patch PVC。此前失败的 standby 操作已把 CNPG Cluster spec 改为 Longhorn 40Gi、2 副本；这份残留不代表卷已迁移，也不能算恢复完成。
- [x] 证据：[postgres-storage-intent-preservation-2026-09-15.json](verification/postgres-storage-intent-preservation-2026-09-15.json)。
- [ ] 需要增加 `ns101351/fugue-vg` 的物理 LocalPV 容量并重新执行扩容；当前剩余 8.59GB，小于 20Gi 扩容和 22.4Gi 安全余量要求，数据库与应用仍保持 fail-closed。
- [ ] 通过正式恢复流程处理早先操作留下的 CNPG Cluster spec 与实际 PVC 不一致，验证 primary、存储类、容量和副本数全部收敛。

### P0-CB：失败操作的终态消息一致性

- [x] `FailOperation` 在文件与 PostgreSQL 存储中原子写入 failed 状态、完成时间和终态消息；`result_message` 不再保留旧的 in-progress 提示，`error_message` 保留失败详情。
- [x] 回归覆盖文件存储、PostgreSQL 事务写入，以及失败历史不能充当 serving runtime evidence；完整 `make test` 通过。OpenAPI 与 web 生成类型同步，`contract:check` 通过。
- [x] backend `acf3a20f855f22066066585d6c27efbb09d52ff2`、CI `35000216401` 成功；API 与 Controller 均匹配该版本、2/2 Ready，health/ready 通过。
- [x] 生产 operation `op_1789493150_fa29686cc5b8` 在容量预检拒绝后，两个消息字段均返回同一真实原因；PVC 仍为 OpenEBS 20Gi。该验证不等于数据库恢复。
- [x] 证据：[operation-terminal-message-2026-09-16.json](verification/operation-terminal-message-2026-09-16.json)。

证据：[dns-placement-compiler-2026-09-15.json](verification/dns-placement-compiler-2026-09-15.json)。

P0-BK 验收范围说明：管理 SSH 通道在本轮核查时于密钥交换前关闭，实际镜像与 readiness 改由已授权 cluster API 和 CI 收据交叉核对。policy LKG 查询仍是原有 404，不等于已验证 policy 恢复。发布前全平台 release guard 已报告 152 项失败（以该次观测为准）；这些旧应用/运行态问题仍需后续调查修复，本步骤的通过不能证明全平台无故障。


### P0-CC：编译后 release eligibility 与实际 Edge proof 一致

- [x] 对通过固定 release facts 校验的 traffic-policy targets，在 artifact 执行投影中保留 `active`；校验 tenant、release 引用和正权重，普通 desired upstream 仍不携带运行状态。
- [x] 保持 routeproof v1 的完整字段比较、节点/分组身份、加载版本和有效期校验；不忽略差异或降低健康门槛。
- [x] 回归独立运行旧 traffic planner 和实际 Edge Control compiler，证明其 bundle 可被新 placement collector 接受；覆盖健康门槛 1/3、排除字段、陈旧 release facts 拒绝及 intent/policy 不变。
- [x] 后端 `make test`、前端 contract/typecheck 通过。后端 `33c6a737`、API intent generation 447 已发布，CI [35002911576](https://github.com/yym68686/fugue/actions/runs/35002911576) 成功；前端契约 `ae1ad8cf` 已同步并通过 CI。
- [x] 生产 API 新镜像 2/2 Ready，healthz/readyz 正常。本次前后采集均为 134 route、241 份 placement；`dns_placement_evidence_requires_repair` 从 13 条降为 0，总 issues 从 19 条降为 6 条。候选数量会随实时健康变化，该结果只代表记录中的采集时刻。
- [x] 本步没有发布新配置；`fugue.pro` hostname lineage artifact 列表保持不变。Policy LKG 前后均为 404（尚未激活），不将此表述为 verified policy LKG 已完成。证据：[compiled-release-placement-proof-2026-09-16.json](verification/compiled-release-placement-proof-2026-09-16.json)。
- [ ] 继续处理 release freshness、共享 hostname owner 冲突、全量 route/DNS/TLS 等价和真实 consumer apply/gray/full/rollback；当前 `migration_ready=false`。


### P0-CD：数据库运行事实共用 Job-aware 故障判断

- [x] 删除后台同步单独调用普通长驻应用故障判断的包装函数，rollout 与后台同步统一使用 CNPG 故障投影。
- [x] 只有带明确 `batch/v1 Job` controller owner 的成功任务可以正常结束；Cluster 管理的数据库进程退出、非零失败及 CrashLoop 仍被识别。
- [x] 回归覆盖成功 initdb/join、成功任务后另一实例的真实失败、失败 Job、数据库进程意外退出及源 pod facts 不变；`make test` 全量通过。
- [x] 后端 `afe4c0ab`、Controller intent generation 138 已推送并发布；CI [35004314869](https://github.com/yym68686/fugue/actions/runs/35004314869) 成功，Controller 2/2 Ready，API healthz/readyz 正常。
- [x] 等待生产 reconciliation 后，成功 join 的 `process exited successfully instead of staying online` 误报消失，对外状态恢复为真实的 `resuming`；review00 数据库的真实 `exit_code=4` 错误继续保留。证据：[cnpg-job-status-projection-2026-09-16.json](verification/cnpg-job-status-projection-2026-09-16.json)。
- [ ] 继续处理实际数据库容量与副本拓扑问题；本步骤修复事实分类，不代表数据库恢复完成或全部业务健康。


### P0-CE：共享 hostname 的显式 path owner binding

- [x] 新增强类型 `DNSRouteBinding(hostname, path_prefix, app_id)`，仅用于同租户多应用共享 DNS target；普通单应用和平台 DNS 保持原有严格 owner 校验。
- [x] DNS projection 为共享 target 生成每条 hostname/path/app 绑定；编译、输入校验和 placement collector 都要求绑定与 PlatformIntent 路由逐条一致，跨租户、缺失路径、重复绑定和悬空 policy 均 fail-closed。
- [x] 增加共享路径、绑定变更、单应用兼容及按 App route policy 回归；后端 `make test`、前端 OpenAPI 同步和 typecheck 通过。
- [x] 后端 `79d2a6e9`、API intent generation 448 已推送；CI `35008546470` 成功，API 2/2 Ready，前端 contract-drift `35008580689` 成功。
- [x] 生产 projection 验证：`dns_custom_domain_shared_hostname_conflict` 与 owner mismatch 均为 0；route count 135，migration_ready 仍为 false。证据：[shared-hostname-path-binding-2026-09-16.json](verification/shared-hostname-path-binding-2026-09-16.json)。
- [ ] 继续完成真实 DNS/TLS 全量等价、consumer apply/gray/full/rollback 和剩余 release freshness；本步没有解除发布保护。


### P0-CF：Release facts 按冻结 route graph 过滤

- [x] 只把当前 `PlatformIntent` route graph 引用的 traffic policy、stable/candidate release 和 route policy 纳入迁移编译；未被 route 引用的应用不会阻塞迁移，也不会进入 RuntimeSnapshot。
- [x] 保持 fail-closed：当前 route 引用的 release 仍必须通过 owner、runtime、image、freshness 和 serving evidence 校验；此步骤没有放宽任何正向 serving gate。
- [x] 增加无关 release facts 不进入 PolicySnapshot/RuntimeSnapshot 的回归，完整 `make test` 通过。
- [x] 后端 `ee19260c`、API intent generation 449 已发布；CI [35011697271](https://github.com/yym68686/fugue/actions/runs/35011697271) 成功，API 2/2 Ready，health/readiness 正常。
- [x] 生产前后 route count 均为 135，release observations 从 8 降为 7，移除的条目没有对应 serving route；剩余问题仍是 route graph 中真实引用的 freshness/equivalence/placement 缺口。证据：[release-graph-input-filter-2026-09-16.json](verification/release-graph-input-filter-2026-09-16.json)。
- [ ] 修复仍被 route graph 引用的 release identity/freshness，并完成全量 route/DNS/TLS 等价和 consumer convergence；当前 `migration_ready=false`。

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

截至 Y39，route、DNS、TLS 已完成统一 TrafficReleaseSet 的生产 full 接管。三台 active Edge 和两台 DNS 按当前 release、artifact、expected consumer set 与 fence 提供真实 serving 回执；全局 ReleaseSet、route、DNS、TLS、policy 五份 verified LKG 绑定同一验证 release 和 evidence hash。

签名 producer policy 已启用自动 serving：固定基础 intent 与输入 policy，捕获业务投影后编译、gray、full，并在观察窗口与消费者收敛通过后更新 LKG。gray/full 各至少观察 120 秒，600 秒未完成则恢复 verified 基线。policy 授权版本变化的生产演练已验证：5.321 秒内发布恢复版本，八个消费者随后收敛，原五份 positive LKG 保留。超时专用演练、重启恢复与连接连续性仍待补齐。

当前已验收代码：API `8f6d69a0`、schema migrator `43e0052d`、两地 DNS client `56749f65`、release guardian `7faf072a`、Controller `edc72b9b`、两地 Edge worker `7cff4f63`。Y26 已删除 Edge route-intents HTTP serving 路径中的业务表即时生成及 standalone LKG 回退，只返回适用的已发布 TrafficReleaseSet；缺少/损坏发布时返回 503，consumer 保留当前 artifact。业务投影仍由配置 producer 独立完成。

历史 revision 资源回收、不可变执行快照保护、排除路由负向证明和 DNS 通配监听恢复均已完成相应生产验收，详见 Y10–Y26。发布监控保留了 SSH 采集失败与一次 US A/B 期间 TLS EOF；后续独立复查正常，不能据此声称所有发布均零中断。

Y27 已删除已登记 DNS consumer 的启动旧 cache/bundle fallback：丢失全部 positive checkpoint 时也不回到环境配置；正式两地重启已恢复 artifact、新鲜 readiness 和准确 inventory heartbeat，六个公网 SOA 与实际 artifact sequence 一致。

尚未完成的主要工作：其他 legacy serving 来源删除、环境变量退役、超时和重启恢复演练、非对称签名迁移、其余 policy 与 runtime facts 收敛，以及最终简化版清单的逐项核验。自动 serving 已启用不代表整份重构方案完成。本文后续步骤记录中的版本和状态是当时快照，以本节及最新验证为准。

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
- [x] 验证 compiler 失败不会影响旧 serving。
- [x] 验证 runtime 变化不会影响已固定 snapshot 的输出。

### 阶段 3：Consumer 双读

- [x] Edge 支持 legacy bundle 和 artifact bundle。
- [x] DNS 支持 legacy bundle 和 artifact bundle。
- [x] 完整 artifact bundle 进入真实 Edge/DNS shadow consumer；P0-DD 验证三台 Edge 的 137 路由隔离执行和两台 DNS 候选校验，正式 serving 未切换。
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
- [x] route、DNS、TLS 使用一个 `TrafficReleaseSet`，Y23 已完成生产 full 和五成员恢复基线。
- [ ] consumer 使用 verified LKG 恢复。
- [ ] runtime facts 不修改 intent。
- [ ] 代码安全内核负责签名、schema、fencing、事务和 fail-closed。

## 必须合并为投影的内容

### EdgeRouteIntent

`EdgeRouteIntent` 不应成为第二个配置真相。

- [x] `EdgeRouteIntent` 由 `PlatformIntent` 编译或投影得到。
- [x] Edge Control 的 route-intents serving 接口只读取已发布 TrafficReleaseSet 的投影，Y26 已删除业务表与 standalone LKG fallback。
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
- [x] 在 required Edge、DNS、TLS consumer 完成 heartbeat、apply、probe 和 convergence 前禁止 full promotion；API 拒绝与事务内复核已由 P0-AH、P0-DJ、P0-DQ 验证。真实 serving 收敛仍未完成。

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
- [x] DNS、Edge、TLS 真实消费者已持续读取 assignment 并上报可信 shadow heartbeat，后续证据见 P0-AN、P0-AO、P0-DF、P0-DR；原只读查询与当前 shadow 均不证明 serving apply/probe 已完成。

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
- [ ] 完成真实业务 release observation 修复、sticky consumer 支持和输出等价验证；当前草稿只保留 7 条被 route graph 引用的 release facts；`release_observations_require_repair` 和 `release_target_equivalence_not_verified` 继续阻止迁移验收。

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
- [ ] 继续修复 review00 数据库自身故障、剩余 release freshness、route/TLS evidence 和全量 output equivalence；本步骤只修复故障识别与传播，不宣称业务实例已恢复。

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


### P0-CG：DNS placement proof failure diagnostics

- [x] 在不改变 placement 正向 gate 的前提下，记录有界的 `hostname/path:proof_failure` 分类：probe error、digest、bundle version、edge/group identity 和 expiry。
- [x] 诊断不保存 URL、origin 内容、凭据或完整 probe 响应；proof v1、bundle version、edge/group identity 和租期校验保持不变。
- [x] 新增回归覆盖 digest mismatch 与诊断边界；完整 `make test` 通过。
- [x] 后端 `15e9474b`、API intent generation 450 已发布；CI [35015498181](https://github.com/yym68686/fugue/actions/runs/35015498181) 成功，API 2/2 Ready。
- [x] 生产 d-97 placement issue 已具体化为 `0-0.pro/:bundle_version_mismatch` 与 `api.0-0.pro/:digest_mismatch`；这证明剩余问题在 Edge bundle/proof reconciliation，未放宽 gate 或推进 DNS gray/full。证据：[placement-proof-diagnostics-2026-09-16.json](verification/placement-proof-diagnostics-2026-09-16.json)。
- [ ] 修复实际 Edge bundle/proof 不一致，并完成 route/DNS/TLS 全量等价和 consumer convergence。修复后 convergence API 记录 required 6、observed 3、passing 0；历史移除节点不再计入 required，当前 3 个 consumer 仍分别存在 heartbeat 或 generation/apply/probe 缺口，因此继续保持 gray/full 保护。证据：[edge-consumer-convergence-2026-09-16.json](verification/edge-consumer-convergence-2026-09-16.json)。


### P0-CH：Convergence 使用当前 fresh active topology

- [x] convergence read model 和 expected consumer preparation 使用与 Edge inventory 相同的 active/fresh topology projection；持久化 expected set 不被修改，lineage 仍保持不可变。
- [x] 已移除节点不再永久阻塞 required cardinality；当前仍在 inventory 的节点缺 heartbeat、generation 或 apply/probe 证据时继续 fail-closed。
- [x] 回归覆盖 topology projection、持久化 expected set 不变和完整 API/platformcontrol 测试；`GOMAXPROCS=2 make test` 通过。
- [x] 后端 `22b6eef6` 已发布，CI `35021446483` 成功，API 2/2 Ready。生产 required consumer 从 10 降为 6，observed 3、passing 0；未解除 full promotion。证据：[edge-consumer-topology-projection-2026-09-16.json](verification/edge-consumer-topology-projection-2026-09-16.json)。
- [ ] 修复当前 3 个真实 consumer 的 heartbeat/generation/apply/probe 缺口，完成 full convergence。

### P0-CI：Caddy sidecar 归属到 Edge worker consumer

- [x] 将 Caddy 明确建模为 edge-worker DaemonSet 的受管 sidecar；Caddy apply/probe 证据通过 worker heartbeat 的 `caddy_apply_probe` capability 传递，不再要求不存在独立身份的 `caddy-edge-front` heartbeat。
- [x] 对历史 immutable expected set 做只读 projection 兼容：保留 lineage 原记录，把 legacy Caddy owner 映射到同节点的 worker owner，并继续要求该 capability；新 expected set 直接只生成 worker owner。
- [x] 增加 legacy owner projection、capability 和确定性 convergence 回归；后端 `GOMAXPROCS=2 make test` 全量通过。
- [x] Edge worker `3aab5ce2` 与 API `9beed1a3` 已通过 GitHub Actions 正式部署；API `healthz/readyz` 均为 200。
- [x] 生产 convergence required expected 从 6 降为 3，required observed 为 3；三个 worker 的 expected/observed capability 均为 `caddy_apply_probe`，历史 Caddy 条目不再作为独立 consumer 阻塞恢复。证据：[edge-consumer-caddy-owner-2026-09-16.json](verification/edge-consumer-caddy-owner-2026-09-16.json)。
- [ ] 当前 shadow consumer 仍为 staged/shadow_validated，required passing 为 0；继续处理 generation/apply/probe 证据与 full convergence，不解除 gray/full 保护。

### P0-CJ：Full promotion gate 与 convergence 使用同一 live topology projection

- [x] full promotion gate 使用与 convergence 查询相同的 active/fresh Edge、DNS、node-updater、runtime topology projection；历史 removed consumer 不再永久阻塞，历史 Caddy owner 映射到 worker owner。
- [x] live topology 为空时保留原 expected set 的 `RequiresConsumers` 语义，返回 unknown/block，不能把 topology 缺失解释成“没有 required consumer”。
- [x] 增加 promotion gate、空 topology 和 legacy owner projection 回归；完整 `GOMAXPROCS=2 make test` 通过。
- [x] 后端 `9b172712` 已通过 prepush、API build 和 `deploy_api`；生产 `/healthz`、`/readyz` 均为 200。
- [x] 生产 convergence 仍为 required expected 3、observed 3、passing 0，三个 worker 的 `caddy_apply_probe` capability 均匹配；shadow staged/shadow_validated 继续阻止 full promotion。证据：[promotion-gate-live-topology-2026-09-16.json](verification/promotion-gate-live-topology-2026-09-16.json)。
- [ ] 完成真实 consumer 的 candidate apply/probe、gray/full 和 rollback 验收后，才能解除 full promotion 保护。

### P0-CK：Edge consumer 接受完整 compiled route artifact

- [x] Edge shadow consumer 使用 `CompiledRoute` 强类型解码 route artifact，保留 runtime placement、edge/group exclusions、min healthy edges、upstream 和 request semantics。
- [x] route artifact 的 `cache_policies` 纳入同一强类型 payload，并继续执行 route/cache policy 绑定校验；未知字段和非法 placement 类型仍 fail-closed。
- [x] 回归覆盖 compiler 生成的 placement、排除规则、cache namespace/reference、未知字段和 serving cache 保留；完整 `GOMAXPROCS=2 make test` 通过。
- [x] 后端 `6d1314f7`、CI [35042217523](https://github.com/yym68686/fugue/actions/runs/35042217523) 和 DE/US Edge deploy 均成功。
- [x] 生产三个 Edge 节点 healthy，Caddy last error 为 0，route count 仍为 134；active serving 未被候选 artifact 覆盖。证据：[edge-compiled-artifact-decoder-2026-09-16.json](verification/edge-compiled-artifact-decoder-2026-09-16.json)。
- [ ] candidate apply/probe、trusted heartbeat 的 applied/passed 语义和 full convergence 仍未完成；当前 required passing 仍为 0。

### P0-CL：Candidate generation 与 serving generation 分离

- [x] heartbeat 增加可选 `candidate_generation`；旧消费者省略该字段时，evidence hash 保持向后兼容。
- [x] PostgreSQL consumer projection、fresh-install DDL、增量 schema migration、audit metadata 和 OpenAPI 均保存 candidate generation。
- [x] convergence 继续以 `actual_generation` 作为 serving 事实；只有未来明确 `apply=applied`、`probe=passed` 时才允许 candidate generation 参与 candidate 收敛判断。
- [x] 本地完整 `GOMAXPROCS=2 make test` 通过；API 与 Edge atom 均通过 planner、CI/build/deploy。
- [x] 生产三个 Edge consumer 持续上报相同 candidate generation，同时保留各自 serving actual generation；required observed 为 3、passing 为 0，full promotion 仍被阻止。证据：[candidate-generation-runtime-fact-2026-09-16.json](verification/candidate-generation-runtime-fact-2026-09-16.json)。
- [ ] 实现真正 candidate apply、离线/隔离 probe、applied/passed heartbeat 和 gray/full/rollback 验收。


### P0-CM：隔离候选路由索引落盘与部署核对

- [x] 构建与 serving pointer 分离的候选 route index，保存 `route_index_digest` 到独立 shadow 文件和 consumer 状态；不调用 Caddy apply，不覆盖当前 bundle/cache/LKG。
- [x] 实现提交 `3d758877` 的后端全量 `make test` 通过；最终 US `2d9daf1c` 与 DE `c1fdb535` 已经分别通过声明式部署，三个活动 worker 均上报候选索引摘要。
- [x] 生产核对：三个活动 worker 均 healthy、非 stale、Caddy 加载版本匹配；各自继续服务 135 条 route，候选仅 2 条，route convergence passing 为 0。
- [x] 记录发布中断原因：此前手工 generation 修复出现回退/跳代而被预检拒绝；改为从直接父提交计算 +1、引用生产真实 LKG 收据后通过。DE 的 A/B sequence conflict 经精确 supersede 失败提交恢复，未绕过 Guardian。
- [x] 统一候选与 serving 的 route materialization，验证 enabled/disabled、多路径、placement、upstream eligibility、cache 等语义；P0-CO 已用真实 Edge Control compiler 和生产逐节点摘要核对。该结果仍不等于 Caddy apply 或 origin/TLS 健康证明。
- [ ] 完成真正 candidate apply、Caddy/route probe、gray/full 与 rollback。不得把当前 `shadow_validated` 改名为 `passed` 来满足 gate。

证据：[candidate-route-index-2026-09-17.json](verification/candidate-route-index-2026-09-17.json)。此步骤只验收候选索引与 serving 隔离和部署事实，完整 candidate 执行仍未完成。

### P0-CN：Authority 健康事实完整读取，修复 false 误报

- [x] API 不再对 Edge Authority 请求 legacy inventory cursor 表示，改为读取完整 authority projection，保留 `serving_healthy`、`bootstrap_eligible` 和 publication/authority sequence。
- [x] 缺失或 null 的健康字段返回明确的 evidence unavailable 错误，不把缺失事实解码成 false；真实的 false 仍原样保留。
- [x] 回归直接调用 Edge Control 的真实 content-negotiation handler，覆盖显式不健康、缺失/null 字段与健康投影；后端全量 `GOMAXPROCS=2 make test` 通过。
- [x] OpenAPI 先更新，并同步 web generated client；前端 `contract:check` 与 [contract-drift 35182036855](https://github.com/yym68686/fugue-web/actions/runs/35182036855) 通过。
- [x] 后端 `230b7de1`、API intent generation 468、本地精确 release plan（仅 API）和 [CI 35182003877](https://github.com/yym68686/fugue/actions/runs/35182003877) 通过，生产 API 2/2 Ready，Guardian stable 且全部健康证据通过。
- [x] 生产交叉验证：修复前 DE/US 原始 authority 的 serving health 为 true，legacy cursor 省略字段，而 API 错报 false；修复后 API 两组均为 true，与原始响应一致。此前关于“混合 A/B 版本导致不健康”的推断撤回；A/B 的 inactive slot 保留旧 LKG 本身不构成活动流量故障。
- [x] 发布前后 shadow ReleaseSet、route artifact identity/digest、full channel 和 policy LKG 查询状态一致；三个活动 worker 继续服务 135 条 route，candidate 2 条且 required passing 仍为 0。

证据：[authority-health-projection-2026-09-17.json](verification/authority-health-projection-2026-09-17.json)。该修复属于 runtime facts 的保真读取，不代表候选配置已经 apply、policy LKG 已激活或全量迁移完成。


### P0-CO：候选与 serving 共用路由语义，并验证路径查找

- [x] 将 API 的 artifact → EdgeRouteIntent 投影、默认值、路由 generation 和 legacy normalization 收敛到 `internal/routeartifact`。API 使用同一实现，候选按实际 group 通过共享 `routebinding` 生成不可服务的 detached bundle，不读取业务表或 live facts。
- [x] 删除 Edge candidate 的独立逐字段复制；保留 enabled/disabled、unavailable origin、默认及显式 streaming、分组固定、runtime placement、policy exclusions、min healthy、80/20 release eligibility、request-body 与 cache 行为。
- [x] 修复 cache ID 大小写引用：按校验器的大小写不敏感规则绑定声明的准确 policy ID；禁用 cache 清空 active reference，分组 bundle 只携带本组引用的 cache policies。
- [x] 候选探测从 hostname-only 改为 hostname/path 查找，并比较实际返回 route 的完整行为 proof；缺路径后落到父路由、错误 owner、upstream、group、cache 和 generation 均被拒绝。
- [x] 测试使用同一 compiled artifact 同时驱动真实 Edge Control compiler 与候选 materializer，比较每条路由 proof 和 cache policy；验证没有伪造健康数量、签名或有效期，artifact 不被修改。shadow 同步和失败路径仍保持 serving index pointer 与 cache 不变。
- [x] 原始及重放到最新 main 后的完整 `GOMAXPROCS=2 make test` 均通过；前端契约同步、typecheck 和 [contract-drift 35184353466](https://github.com/yym68686/fugue-web/actions/runs/35184353466) 通过。
- [x] 后端 `3d0a19b7` 通过本地精确 release planner；[CI 35184254091](https://github.com/yym68686/fugue/actions/runs/35184254091) 的 API、DE/US Edge 部署全部成功。前驱从各组件 Guardian 成功收据读取，未覆盖并行任务的 main 更新。
- [x] 2026-09-17 05:32 UTC 生产验收：API 2/2 Ready；三个活动 worker 的 source commit 均为 `3d0a19b7`、Ready 且零重启，候选 digest 分别与本地生产 artifact 重放精确相等；各自继续服务 135 条 route，Caddy 版本一致、无 error。API 和两地 Edge Guardian 均 stable，local/dependency/route 均 healthy。
- [x] 发布前后 shadow ReleaseSet、route artifact identity/digest、full channel 和 policy LKG 状态一致；route required expected/observed 为 3，passing 为 0，2 条 route 的候选仍与完整业务输出不等价。
- [x] 真正 apply 到隔离 HTTP Caddy，生成绑定精确 artifact/ReleaseSet/consumer 的 candidate apply/probe receipt；P0-CP 已完成生产验收，尚不包括 origin/TLS 或公网 serving 验证。
- [ ] 完成完整配置的 gray/full 与 rollback；不能把隔离 HTTP receipt 当成 serving convergence。

证据：[shared-route-materialization-2026-09-17.json](verification/shared-route-materialization-2026-09-17.json)。DE 切换期间出现过旧 record 的 canary unknown；最终两地 Guardian 的 fresh 证据均通过并恢复 stable，未降低门槛或把 shadow 结果计入 serving convergence。


### P0-CP：候选配置在隔离 Caddy 中执行并产生回执

- [x] 从已经验签、校验 lineage 和 assignment 的 route artifact 生成 detached bundle，交给短生命周期的真实 Caddy 进程加载；监听地址仅为 loopback，admin 和配置持久化关闭，临时目录与 serving cache 分离。
- [x] 候选 backend 只接受带本次随机 nonce 的 HEAD 探测，按 hostname/path 查找并比较完整 route proof；没有 origin transport，不加载 TLS/ACME，不返回 serving proof，不修改 serving index、Caddy serving 配置或 LKG。
- [x] 回执保存 artifact ID/digest/generation、node/group、ReleaseSet、expected consumer set、generation sequence、fencing token、route index/config digest、probe count、observed/expiry 与 receipt digest。只复用本进程中绑定一致、摘要完整且有效期剩余超过 30 秒的结果；回执租期为 2 分钟，进程重启后重新执行。
- [x] 子进程启动失败、提前退出、探测失败或超时均清理进程/临时目录；任何失败保留原 serving。新增真实 Caddy 2.10.2 集成测试、错误/取消清理和回执绑定/有效期回归，完整 `GOMAXPROCS=2 make test` 通过。
- [x] 初次实现 `ec580a88` 的 [CI 35194919457](https://github.com/yym68686/fugue/actions/runs/35194919457) 成功后，生产验收发现候选启动 `operation not permitted`：上游 Caddy 二进制带文件 capability，而 worker 的 capability bounding set 为空。该故障导致候选执行及其 heartbeat 暂停，但三个 worker 的 135 条 serving route 持续健康；没有把 CI 成功当成该功能验收完成。
- [x] 修复 `b120cd3b` 在镜像构建时移除 Caddy 文件 capability，并强制以全部 capability 丢弃、no-new-privileges 的环境执行 Caddy 自检；公网 Caddy 继续使用 Pod 已显式授予的 `NET_BIND_SERVICE`。本地完整测试、精确 release planner 和 [CI 35197313486](https://github.com/yym68686/fugue/actions/runs/35197313486) 均通过，DE/US worker 与共享镜像的 DNS/SSH 四个发布通道全部成功。
- [x] OpenAPI 文档与 web 快照同步，前端 contract/typecheck 及 [contract-drift 35195201850](https://github.com/yym68686/fugue-web/actions/runs/35195201850) 通过。
- [x] 08:24 UTC 生产核对：3 个活动 worker 的 source commit 都为 `b120cd3b`，Ready、零重启，各自产生 2 条候选路由的 `isolated_http/passed` 回执；摘要复算、artifact/consumer/fencing 绑定及观测时有效期均通过。5 个 DNS/SSH 实例也为该提交，Ready、零重启，DNS 所有 zone 健康，SSH listener 正常。
- [x] 三个 worker 仍各自服务 135 条 route，Caddy 已加载版本与 bundle 一致，无 Caddy error 或 stale cache；API 与两地 Guardian 均 stable，local/dependency/route 证据均 healthy。发布前后 shadow ReleaseSet、route artifact、full channel 和 policy LKG 查询状态一致。
- [x] trusted heartbeat 恢复新鲜且保持 `staged/shadow_validated`，actual serving generation 与 candidate generation 分离；route required expected/observed 为 3、passing 为 0。回执中的 `serving`、`tls_verified`、`origin_verified` 均为 false，2 条候选 route 与完整业务输出仍不等价。
- [ ] 将完整配置的执行回执接入可信 consumer 协议，完成 route/DNS/TLS 等价、serving apply/probe、gray/full 与 rollback；policy verified LKG 和旧路径删除仍未验收。

证据：[candidate-isolated-execution-2026-09-17.json](verification/candidate-isolated-execution-2026-09-17.json)。该步骤验收真实的隔离 HTTP candidate 执行及失败时保留 serving，不代表整个重构已完成。


### P0-CQ：显式保存同租户 hostname 策略范围

- [x] 先更新 OpenAPI，新增受限 `match_scope`：省略或 `app` 保持按 App 匹配，`tenant_hostname` 显式作用于该 hostname 下同 tenant 的所有路径，并要求非空 tenant。未知范围、跨租户和悬空策略仍拒绝。
- [x] 旧业务 hostname policy 投影为 `tenant_hostname`，保留原 App owner、排除名单、排除到期字段、最小健康节点数和 group 约束；不通过删除排除项或忽略 route proof 来满足迁移 gate。旧 artifact 省略字段时 digest/行为保持兼容。
- [x] 明确修正诊断：根路径 proof 差异来自旧策略按同租户 hostname 匹配、新 compiler 仅按 App 匹配，并非到期自动清除。过期排除仍按原有 fail-closed 语义保留。
- [x] 回归覆盖默认 App 范围、显式 sibling App 范围、跨租户/未知范围拒绝、expired exclusion 保留和输入不变；集成测试使用真实 legacy Edge Control compiler 比较根路径与子路径完整 proof。完整 `GOMAXPROCS=2 make test` 通过，生产固定快照本地重放的两条 proof 精确相等。
- [x] OpenAPI 与 web generated client 同步；前端 contract/typecheck 和 [contract-drift 35201803629](https://github.com/yym68686/fugue-web/actions/runs/35201803629) 通过。
- [x] 实现 `64b2e4ad` 的 [CI 35201688452](https://github.com/yym68686/fugue/actions/runs/35201688452) 中 API 和美国 Edge 成功。德国 CurrentAuthority 未收敛，Front 自动补偿回 `b120cd3b`；回滚健康检查因 inactive worker 镜像归属不符进入 recovery_required，后续重试旧候选遇到 prewrite CAS changed。保留日志不足以断言首次 partial activation 的单一原因。
- [x] 德国恢复提交 `da5f117b` 使用最新成功 LKG 收据、generation 322 和精确 `supersedesFailedConfigSha=64b2e4ad`，通过 planner 与 [CI 35204768029](https://github.com/yym68686/fugue/actions/runs/35204768029)。恢复仍经 main/GitHub Actions/Guardian 完成，没有手改生产对象或降低正向门。
- [x] 09:34 UTC 生产核对：API 2/2 Ready；美国两个 worker 为 `64b2e4ad`，德国 worker 为 `da5f117b`，全部 Ready、零重启，各服务 136 条 route，Caddy 版本匹配、无 error/stale。三个隔离候选回执的摘要、绑定与有效期均通过；API 和两地 Guardian 均 stable。
- [x] projection 保存 10 条显式 tenant_hostname 策略；共享域名的 digest mismatch 消失。旧 release freshness 问题随并行业务恢复消失，不归因于本补丁；当前只剩 DNS 输出和 release target 两项等价验证。发布前后配置 artifact/ReleaseSet/full/policy-LKG 指纹不变，route required expected/observed 3、passing 0。
- [ ] 主 compiler 接入已固定的 Edge group/DNS placement 证据，完成 136 条业务 route 与 DNS/TLS 全量编译、输出等价和 consumer gray/full/rollback。
- [x] 修复代码 A/B 发布被并发配置变化打断后的候选重建、提交观察和工作负载补偿竞态；P0-CT/CU/CV 覆盖明确配置失效、Guardian 事务提交中和旧 Worker 快照三类路径，回归与两地正式恢复均通过。全量配置迁移仍按独立清单验收。

证据：[tenant-hostname-policy-scope-2026-09-17.json](verification/tenant-hostname-policy-scope-2026-09-17.json)。该步骤已完成策略范围的生产对齐，整个重构目标仍未完成。


### P0-CR：主 compiler 接入 DNS 分组约束

- [x] compiler v15 将 policy group 编译为 `dns_placement_edge_group_id`，进入 artifact 与 placement input digest；保留 route intent 的 Host serving 范围，禁止用 DNS 排除直接删掉其他组 Host route。
- [x] 删除独立的 ForPlacement 转换路径；主 compiler 和采集器共用约束转换与 DNS edge 资格判断。固定证据、route/TLS readiness、owner、quorum、排除名单和绝对租期仍强制校验，意图 pin 与 policy group 冲突时拒绝。
- [x] 新增端到端回归，覆盖允许/排除/异组 DNS 候选、Host 跨组保留、缺证据、错误输入、TLS 未 ready、到期和冲突 pin；完整 `make test` 与前端契约检查通过。
- [x] 实现 `0aa6cfe0` 在生产 API 编译当前固定快照，保存完整 intent/policy/route/DNS/TLS/ReleaseSet artifacts。route artifact 为 `artifact_1789639173_f25b71093641`，ReleaseSet 为 `artifact_1789639173_145226533924`；六类 artifact 均 validated，未 promote。
- [x] 同一份生产输入在本地重放，五个配置 artifact 的 content/generation 和 lineage 完全相等。首次比较 110/136 条 route 一致；14 条差异为 origin_status_reason/route_policy，1 条还包含 origin_status，11 条为 exclusion_lifecycle，另有 TLS allowlist/cache policy 差异。
- [x] 后续 137 条路由快照在切换期间因 route/TLS placement 证据不足被 400 拒绝；前后 shadow ReleaseSet、serving artifact、full channel 和 policy-LKG 查询状态不变。未延长证据或降低 gate。
- [x] API 与 DE/US 活动 Edge 均已运行包含该实现的代码：API `8d8045ce`、德国 `26bd5ee6`、美国 `169ec089`；后续 CI 35222667120 / 35225437092 成功，并逐台验证实际 Front/Worker/CurrentAuthority。原失败记录保留；此项只完成代码部署与运行验收，不代表输出等价或全量配置切换已完成。
- [ ] 修复全量路由、TLS allowlist、cache 和 DNS 输出差异，重新采集最新完整输入，再推进 consumer gray/full/rollback。

### P0-CS：空候选下恢复已验证 Caddy 缓存

- [x] 回归复现：已验证缓存首次应用 Caddy 失败后，inactive slot 持续 204，Caddy 恢复可用也无法恢复 worker readiness。
- [x] 204 分支按正常同步节奏调用既有缓存重试逻辑；失败继续显示 caddy-error，实际应用成功后恢复 readiness。测试验证 cache bytes、publication、bundle expiry 和 Front activation 不变；完整 `make test` 通过。
- [x] 修复 `6336275e` 与 OpenAPI/web 契约已推送；前端 [contract-drift 35212045123](https://github.com/yym68686/fugue-web/actions/runs/35212045123) 成功。
- [x] 原 [CI 35212043085](https://github.com/yym68686/fugue/actions/runs/35212043085) 失败后，已通过 P0-CU/CV 完成两地正式恢复。三台实际活动 Worker 均运行包含本修复的代码，cache/bundle/Caddy 应用版本一致且无 stale cache；Front 激活文件与 CurrentAuthority 精确匹配。
- [x] 修复配置 supersede 候选后的受控重新暂存、Guardian 异步提交观察和 Worker 快照刷新；普通配置继续独立推进，新候选重新绑定签名 artifact 并通过 canary，未接受旧候选或绕过 CAS。

进行中证据：[compiler-v15-recovery-progress-2026-09-17.json](verification/compiler-v15-recovery-progress-2026-09-17.json)。本记录明确保留发布失败及未完成项，不作为全量上生产成功证据。

### P0-CT：配置更新期间的代码候选恢复

- [x] 发布执行器区分“候选因健康配置更新而失效”与一般故障；滚动启动、候选等待、提交等待均可识别该事件。重新暂存最多四次，必须证明原 Front 授权、活动槽位、代码镜像及节点集合未变，运行事实新鲜且健康；每次重新绑定当前签名 artifact 并重新通过 canary。
- [x] Guardian 已异步提交精确候选时，执行器验证 CurrentAuthority、实际 Worker 代码/镜像和不倒退的配置版本，不再因旧候选已清除而误判失败。
- [x] Guardian 完成 Front CAS 后允许已验证配置独立前进。公网响应缺少候选标签时，每个成功样本都必须重新取得精确代码/镜像/Front 授权与配置版本的运行态证明；仍验证响应内容与连续成功次数，错误或部分标签继续拒绝，不伪造响应头。
- [x] 回归覆盖三个失效阶段、重试上限、活动授权变化、陈旧事实、错误镜像、错误响应、不完整标签和纯空白标签；完整 `make test` 通过。已合并同期 main API 诊断修复，代码提交 `78f6cd9718df7e6aed634e191e275e43b50e6fcb`。
- [x] P0-CU/CV 已完成 DE/US 实际活动槽位验收。历史 [CI 35220258498](https://github.com/yym68686/fugue/actions/runs/35220258498) 的两地失败保留：德国遇到提交中事务被误判失效，美国遇到旧 ServingAuthority 快照持续 409；后续分别通过 journal 观察和新鲜 Worker 证据修复。

本步骤不解除 full promotion 保护；全量 route/DNS/TLS 等价、可信 serving apply/probe、policy verified LKG 和旧路径删除仍需继续完成。

### P0-CU：候选失效判断等待 Guardian 事务结束

- [x] 回归复现 prepared/activated journal 存在、journal 不可读，以及 journal 检查期间 CurrentAuthority 已提交的四种竞态；另用真实等待循环验证旧指针经过 pending journal 后收敛到精确的新指针，整个观察过程只有 GET。
- [x] 判断候选已被配置替代前，必须确认两个阶段的 journal 均不存在，再重读 CurrentAuthority；事务存在、无法读取或活动槽位已变化时继续观察，禁止把仍在提交的代码事务当作重新暂存理由。完整 `make test` 通过。
- [x] 正式修复 `26bd5ee60cf79040f4bdf33cad467b029766a92d` 已推送；声明式计划仅选择 Guardian 与德国 Edge。美国的旧 Worker 快照问题单独保留，未盲目重试。
- [x] [CI 35222667120](https://github.com/yym68686/fugue/actions/runs/35222667120) 全部成功。独立验收德国 Front/CurrentAuthority 均为 A 槽位、`26bd5ee6`、generation 257，精确镜像一致；Guardian/canary prober 为新版本且零重启，德国发布状态 stable，实际 Worker cache/bundle/Caddy 版本一致。三台活动 Worker 的隔离执行回执及可信 shadow 心跳有效，仍为 required 3 / observed 3 / passing 0，未伪报 serving。配置指针和 DNS/SSH 消费者保持健康。
- [x] P0-CV 修复美国候选暂存期间 Worker 运行证据不刷新的问题，并完成全组代码恢复；美国在 A 槽位稳定运行 `169ec089`，Front generation 821。

进行中证据：[candidate-code-transaction-progress-2026-09-17.json](verification/candidate-code-transaction-progress-2026-09-17.json)。失败后的 API 健康端点为 200，两地 authority 健康；原 shadow/full/policy-LKG 指针状态未变。本文不将这次失败记录计作完整上线。

德国与 Guardian 恢复成功证据：[candidate-journal-recovery-2026-09-17.json](verification/candidate-journal-recovery-2026-09-17.json)。该快照时美国仍使用 `64b2e4ad`；随后的 P0-CV 完成美国与全组运行验收。

### P0-CV：健康配置推进后的候选暂存证据刷新

- [x] 通过 HTTP 暂存回归复现旧实现：控制面已发布新配置，但四次重试复用最初 Worker 快照，持续提交旧 ServingAuthority，并错误调用 LKG 恢复端点。
- [x] 健康 current publication 上的 sequence conflict 只重新读取 Worker/Front snapshot；必须保持活动授权、槽位、代码镜像、节点集合和新鲜健康事实，publication sequence 不得倒退，再把实际加载的新版本绑定到签名暂存请求。此分支不刷新 LKG、不增加 recovery epoch，仍限制四次尝试。
- [x] 回归覆盖成功刷新、活动授权变化、代码变化、事实过期、版本倒退、读取失败和重试耗尽，并断言没有 recovery POST 或代码授权写入；完整 `make test` 通过。
- [x] `169ec08986b6b3e55760c0564cb4fe15576a8ad3` 已推送，声明式计划仅包含 Guardian 与美国 Edge，前驱分别绑定 `26bd5ee6` 和 `64b2e4ad`，失败目标精确绑定 `78f6cd97`。
- [x] [CI 35225437092](https://github.com/yym68686/fugue/actions/runs/35225437092) 全部成功。美国两台 Front/活动 Worker 均为 A 槽位、`169ec089`，CurrentAuthority generation 821，切换时 recovery epoch 保持 179；两地 Guardian 发布状态 stable，三台活动 Worker 的实际 cache/bundle/Caddy、镜像、零重启、隔离执行回执与可信心跳均通过独立核对。原 shadow/full/policy-LKG 指针状态不变，DNS/SSH 消费者健康。

全组代码恢复证据：[candidate-snapshot-recovery-2026-09-17.json](verification/candidate-snapshot-recovery-2026-09-17.json)。required consumer passing 仍为 0；全量 route/DNS/TLS 输出等价、serving apply/probe、gray/full/rollback、policy verified LKG 和旧路径删除仍未完成，不把代码恢复计作整个架构重构完成。

### P0-CW：Cache policy 比较保留执行优先级

- [x] 全组恢复后重新采集稳定输入，生产 compiler v15 成功生成 137 条 route、165 条 DNS record、136 条 TLS 引用；ReleaseSet `artifact_1789652034_38ee013dd19f`、route artifact `artifact_1789652034_41a4f9ec2ab1` 均 validated，未 promote。比较为 111/137 条 route 一致，其余为 origin/policy、exclusion lifecycle、TLS allowlist 和 cache policy 差异。
- [x] 核实并发 import/deploy 会改变 deployment generation 与 cache namespace；快照与 serving 证明不一致时编译拒绝，旧指针不变。等待实际部署完成后重新采集成功，未删除证明字段或降低 readiness 门槛。
- [x] 比较器按 cache policy ID 比较内容，忽略没有执行含义的集合排序；保留多个 HTML fallback policy 的相对顺序、全部字段和嵌套规则顺序，空或重复 ID 拒绝比较。
- [x] OpenAPI 优先更新并生成后端契约，前端契约/类型同步；回归覆盖默认集合换序、TTL、增删、嵌套顺序、HTML fallback 优先级、非法 ID 与输入不变性，完整 `make test` 和前端 `contract:check` 通过。
- [x] API 提交 `8196648bb8c37ea76160235544c652b0e2661e4c` 的 [CI 35228644963](https://github.com/yym68686/fugue/actions/runs/35228644963) 成功，生产两个副本均更新就绪且 Guardian stable。对同一 artifact 只读比较，snapshot differences 从 TLS/cache 两项变为仅 TLS allowlist；origin/policy/exclusion 真实差异仍在、equivalent=false。期间业务配置继续变化，当前匹配 106 条，不能把两次 route 匹配数变化归因于本次排序修复。前后配置指针未变，两地活动代码授权保持一致。

证据：[cache-policy-comparison-2026-09-17.json](verification/cache-policy-comparison-2026-09-17.json)。前端契约 [CI 35228670770](https://github.com/yym68686/fugue-web/actions/runs/35228670770) 成功。仍需修复真正的 TLS allowlist、停用路由状态/策略、exclusion lifecycle 差异和完整 serving 发布验收。

### P0-CX：停用意图、路由策略与 origin 事实分别保留

- [x] 回归复现：旧 artifact 投影将 `enabled=false` 的显式 edge policy 改写为 `route_a_only`，丢失 replicas=0 的原因，并将实际 unavailable origin 改写为 disabled。
- [x] compiler v16 保留固定快照中的非 active origin 状态/原因，显式 maintenance intent 仍优先；artifact 投影保留明确配置的 route policy，用独立停用状态阻止 upstream，缺省旧策略仍按 legacy route_a_only 处理。
- [x] 端到端 compile→projection 回归覆盖缩容为零、runtime 缺失、origin 恢复、显式 maintenance 和旧 payload 缺省策略；停用 route 的普通/加权 upstream 始终为空，固定输入重放不受 wall clock 影响且不修改 intent/facts。compiler/artifact/Edge 测试、完整 `make test` 和前端契约检查通过。
- [x] OpenAPI 优先更新并同步前端。`13311f51ccef6f7c6147429b86632f4631dcbf25` 已推送，声明式计划仅选择 API 和 DE/US Edge。
- [x] [CI 35230472183](https://github.com/yym68686/fugue/actions/runs/35230472183) 全部成功。API 两个副本、DE/US 三台活动 Worker 与 Front 均为 `13311f51`；德国 B 槽位/generation 258、美国 B 槽位/generation 822，实际镜像、CurrentAuthority、cache/bundle/Caddy 和 fresh 隔离回执均一致，Guardian stable，旧配置指针不变。
- [x] 重新采集完整生产输入及 DNS placement 证明，v16 编译得到 137 条 route、165 条 DNS record、136 条 TLS 引用。route artifact `artifact_1789653944_e6c2e79486b9`、ReleaseSet `artifact_1789653944_8972c2c5b107` 均 validated，未 promote；route 匹配提升为 126/137，剩余 11 条差异全部为 exclusion_lifecycle，snapshot 差异仅 TLS allowlist。生产输入在本地直接重放，五类 artifact content/generation 和 lineage 完全相等，未重写 placement digest。

证据：[disabled-route-policy-origin-2026-09-17.json](verification/disabled-route-policy-origin-2026-09-17.json)。前端契约 [CI 35230502568](https://github.com/yym68686/fugue-web/actions/runs/35230502568) 成功；完整配置尚未 promote，required passing 仍为 0，整个架构重构尚未完成。

### P0-CY：排除策略生命周期进入确定性 artifact

- [x] PolicySnapshot 保存 exclusion owner digest、generation、fence；迁移投影保留授权元数据，缺少完整元数据的旧排除继续按 legacy_hold 处理。
- [x] compiler v17 和 DNS placement 采集器共用固定 `RuntimeSnapshot.captured_at` 的生命周期评估，结果进入 CompiledRoute 和 artifact executor 投影；有完整身份且带 expiry 的排除缺少固定时间时拒绝编译。
- [x] clear、active、expiring_24h、expiring_1h、expired_hold、legacy_hold 均被端到端回归覆盖；到期后排除名单、reason 和 expiry 保持不变，wall clock 重放不改变 artifact，runtime 时间变化不修改 intent/policy 身份。
- [x] OpenAPI 优先更新并同步前端；完整 `make test` 与 `contract:check` 通过。`1fe61753fb5b6998c3fb9513754e20584b74f9f5` 已推送，发布计划选择 API 和 DE/US Edge。
- [x] [CI 35234496493](https://github.com/yym68686/fugue/actions/runs/35234496493) 全部成功。API 两个副本和 DE/US 三台实际活动 Worker/Front 均为 `1fe61753`，德国 A/generation 259、美国 A/generation 823；Guardian stable，cache/bundle/Caddy、精确镜像、fresh 回执、心跳与 DNS/SSH 健康通过独立验收，配置指针不变。
- [x] v17 使用重新采集的生产输入生成 137 条 route、165 条 DNS record、136 条 TLS 引用，route artifact `artifact_1789656195_c1cac5c34377`、ReleaseSet `artifact_1789656195_4a959b5a77e5` 均 validated，未 promote。实际过期排除在所有匹配路径保持原名单/expiry 且为 expired_hold；本地直接重放五类 artifact content/generation 与 lineage 相同。
- [x] P0-CZ 修复“无任何排除名单时，省略 lifecycle 与显式 clear”的通用表示差异，存在排除名单时不应用该规则。v17 初次比较 136/137 条 route 一致；后续真实业务部署引入的新 generation/upstream 差异继续报告，TLS allowlist 仍是实际缺失输出。

证据：[exclusion-lifecycle-2026-09-17.json](verification/exclusion-lifecycle-2026-09-17.json)。前端契约 [CI 35234529394](https://github.com/yym68686/fugue-web/actions/runs/35234529394) 成功。required passing 仍为 0，完整 ReleaseSet serving 发布与恢复验收继续未完成。

### P0-CZ：空排除状态的语义比较

- [x] 比较器仅在 route 没有 excluded edge/group IDs 时，将省略 lifecycle 与显式 clear 视为等价；存在排除名单或非 clear 生命周期时保留字段比较，expiry/reason 及所有排除名单不被忽略。
- [x] 回归复现双向省略/clear 误报，并覆盖 edge/group 排除、active→expired、legacy/expired hold 和 expiry/reason 变化；完整 `make test` 与前端契约检查通过。
- [x] OpenAPI 优先更新、同步前端。提交 `21fd334cb57d97a572d1b581d56dd34741f5b07a` 已推送，声明式发布只包含 API。
- [x] [CI 35238423605](https://github.com/yym68686/fugue/actions/runs/35238423605) 成功，API 两副本为 `21fd334c`，Guardian stable。同一 v17 artifact 比较不再出现 lifecycle 差异，snapshot 仍报告 TLS allowlist，equivalent=false；当前 133/137 route 相同，剩余四条为业务部署后的 cache namespace/deployment generation/upstream 变化。配置指针与两地 `1fe61753` 活动授权不变。

证据：[empty-exclusion-comparison-2026-09-17.json](verification/empty-exclusion-comparison-2026-09-17.json)。前端契约 [CI 35238480650](https://github.com/yym68686/fugue-web/actions/runs/35238480650) 成功。本步骤仅完成表示等价诊断修复，仍需重新采集业务输入以及 TLS/ReleaseSet serving 迁移验收。

### P0-DA：域名 TLS 生命周期进入 route/TLS artifacts

- [x] P0-CZ 后重新采集的 v17 草稿达到 137/137 条 route 等价，仅剩 TLS allowlist 差异；完整 ReleaseSet 仍未 promote。
- [x] TLSIntent 仅新增域名引用与 app/tenant 归属；RuntimeSnapshot 单独保存域名验证状态、TLS 生命周期状态和原始 verified/check/ready 时间。历史 ready 不声明新鲜证书 readiness，缺少/陈旧 TLS check 时间原样保留，DNS 独立 route/TLS placement 门槛继续强制执行。
- [x] compiler v18 从同一份 typed intent/facts 生成 route/TLS 两份一致 allowlist，并在 TLS artifact 保留原始 domain states；拒绝错误归属、缺少原始 verified/ready 时间、未来时间、重复或无引用事实。executor 投影按 route owner 验证 allowlist，按组物化只保留实际 Host 路由对应的条目。
- [x] 测试覆盖 intent 与事实分离、原时间保真、确定性重放、跨 tenant/app 拒绝、缺少证据、pin 组过滤、DNS readiness 不被历史 ready 绕过，以及带 TLS allowlist 的可信 shadow consumer 不修改 serving。完整 `make test` 与前端契约检查通过。
- [x] OpenAPI 优先更新并同步前端；`2a232bdf60ac02992478089f823ab6fb2ddba961` 已推送，计划仅包含 API 和 DE/US Edge。
- [x] [CI 35240814548](https://github.com/yym68686/fugue/actions/runs/35240814548) 全部成功。API 两副本与三台活动 Worker/Front 均为 `2a232bdf`；德国 B/generation 260、美国 B/generation 824，精确镜像、CurrentAuthority、cache/bundle/Caddy、fresh 隔离回执及可信心跳均通过独立验收，Guardian stable、原配置指针未变。
- [x] 新采集的 v18 生产输入生成 137 条 route、165 条 DNS record、136 条 TLS 引用；route artifact `artifact_1789659600_5325e89e6692`、DNS `artifact_1789659600_2491179f0697`、TLS `artifact_1789659600_472a827c80f9`、ReleaseSet `artifact_1789659600_e4e70915870d` 均 validated，未 promote。route 比较 137/137 相同，TLS allowlist/cache policies 均相同，equivalent=true。route/TLS 两份产物有相同的 11 条 allowlist，原始 domain events 完整保留；同一输入本地重放五类 content/generation 与 lineage 相同。

证据：[domain-tls-artifact-equivalence-2026-09-18.json](verification/domain-tls-artifact-equivalence-2026-09-18.json)。前端契约 [CI 35240842288](https://github.com/yym68686/fugue-web/actions/runs/35240842288) 成功。这里的 equivalent 是 route 投影（含 TLS allowlist/cache）等价；DNS 实际输出、完整 shadow/gray/full、serving convergence 和恢复演练仍未完成。

### P0-DB：DNS 消费者兼容当前 versioned policy

- [x] 核实生产 DNS/SSH client 仍为 `b120cd3b`，其严格 policy 解码早于当前 exclusion 元数据；完整 shadow 切换前先更新消费者，不放宽 unknown-field 校验。
- [x] 以 legacy policy 与包含 tenant_hostname scope、owner digest、generation、fence、expiry 的 policy 分别运行签名 artifact shadow 回归；真实 DNS 回答、serving/LKG bytes 不变，错误签名拒绝、重启游标单调且不伪报 serving。完整 `make test` 通过。
- [x] `921bbd90d6bd5663373b7d77c8031ffd267c940a` 已推送，声明式计划仅升级 edge-client-de/us，前驱绑定各组精确 `b120cd3b` 镜像。
- [x] [CI 35245043626](https://github.com/yym68686/fugue/actions/runs/35245043626) 全部成功。两台 DNS 与三台 SSH front 均为 `921bbd90`、Ready 且零重启；DNS 健康、无 stale cache、仍验证原 13 条记录 shadow artifact 并报告新鲜心跳，SSH 无错误。API/三台 Edge Worker 保持 `2a232bdf`、两地 authority 健康，原配置指针未变。

证据：[dns-versioned-policy-consumer-2026-09-18.json](verification/dns-versioned-policy-consumer-2026-09-18.json)。本步骤完成消费者代码兼容；完整 DNS artifact 输出和 shadow/serving 发布仍待下一步验证。

### P0-DC：平台业务域名 DNS 覆盖静态地址

- [x] 对照实际 DNS 缓存和查询发现：平台业务域名的旧静态地址/TTL 残留在迁移草稿中，未保留旧发布器的已验证域名覆盖优先级。
- [x] 平台 app base 内已验证且归属正确的域名生成带完整 path owner bindings 的 FUGUE_ROUTE intent，使用配置的 DNS TTL；仅替换精确匹配的静态 A/AAAA/CNAME 并记录 digest 审计。非地址记录、保留域名、未验证域名和 custom target 命名空间保持原值；冲突 hosted address 保留并显式阻止编译。
- [x] 测试覆盖 apex/www、A/AAAA/CNAME、保留 TXT、共享路径、跨 tenant/app 拒绝、缺失/重复 owner、输入不变性和确定性排序；没有 placement 证明仍不能编译。完整 `make test`、前端 `contract:check` 通过，OpenAPI/类型已同步。
- [x] `06ad65be33c2c6a9f6eb707f9a9629f3b14e89c2` 已推送，声明式计划只更新 API。
- [x] [CI 35246715831](https://github.com/yym68686/fugue/actions/runs/35246715831) 成功，API 两副本为 `06ad65be`，独立验收 authority、Guardian、三台 Worker、两台 DNS/三台 SSH 与旧配置指针均正常。新草稿中主域名和 www 为 owned FUGUE_ROUTE、期望 TTL 60，编译成三台有实际证明的 Edge 地址，每值都有原始到期时间；剩余证明租期将本次有效 TTL 压至 52 秒，未延长租期。137/137 route 与 TLS/cache 仍 equivalent=true，未 promote。

证据：[platform-domain-dns-precedence-2026-09-18.json](verification/platform-domain-dns-precedence-2026-09-18.json)。前端契约 [CI 35246746138](https://github.com/yym68686/fugue-web/actions/runs/35246746138) 成功。

DNS 尚有明确待完成的行为：disabled/unavailable 自定义目标在现网仍解析到 Edge（已直接向 DNS 容器 localhost 查询确认），新 compiler 省略记录并不等价；还需补齐各权威 zone 的探测记录、剩余 TTL 差异与 geo/ECS/latency 选择策略，再进行 full serving 验收。

### P0-DD：完整配置进入真实隔离 shadow

- [x] 新鲜固定输入编译出的 ReleaseSet `artifact_1789663153_c9385581d825` 只发布到 shadow，release `artifactrel_1789663168_d6b9bf2ea7fd`、fencing token 2；route `artifact_1789663152_b1931bcb8a09`、DNS `artifact_1789663152_8a4538b7621d`、TLS `artifact_1789663153_461dbba2c0b7` 均由同一 lineage 绑定，137/137 route 含 TLS/cache 比较相同，未绕过发布门。
- [x] 三台活动 Edge 实际执行完整 137 路由的隔离 Caddy，每台 receipt 为 passed、137 probes，绑定 artifact digest、ReleaseSet、expected set、generation sequence、fencing token 和 node/group；回执 digest 重算一致且有限期新鲜。serving、TLSVerified、OriginVerified 保持 false。
- [x] 两台真实 DNS 校验新完整候选并报告新鲜可信 shadow 心跳；临时地址按真实时间到期，有效候选 record count 可下降，未延长旧证明。
- [x] 独立验收 Front activation 文件与发布前完全一致，正式 full channel、policy/route LKG 查询身份不变，API/两地 authority 健康。所有 consumer 仍为 staged/shadow_validated，required passing 保持 0，没有把隔离执行伪报为 serving。
- [x] P0-DE 修复 DNS expected topology：持久化 9 行历史/zone 记录保持不变，当前拓扑投影为 2 个 physical DNS consumer，独立生产验证 2 expected / 2 observed / 0 passing。
- [x] P0-DF 补齐 TLS artifact 的 Worker consumer 协议与独立 shadow 校验，caddy_route_config expected 3、observed 3、passing 0；签名、成对 lineage、域名归属及独立 cursor 均通过生产验收。
- [ ] 完成 DNS 输出语义、新鲜 TLS/serving apply/probe、gray/full/rollback 后才能宣称完整 serving 收敛。

证据：[full-configuration-shadow-2026-09-18.json](verification/full-configuration-shadow-2026-09-18.json)。此步骤替换了旧两条 route 的 shadow fixture，不改变生产 serving 授权；整个重构目标继续进行。

### P0-DE：DNS 按物理进程计算 expected topology

- [x] 构建 expected set 时按 physical node 去重，zone 行仅提供归属；历史 set 按当前权威节点策略投影，保存的 ID、revision、lineage 和全部原始行不变。
- [x] DNS 健康与进程存在性分离：陈旧或不健康节点仍须提供自己的可信心跳；冲突物理归属、跨组身份和 alias 环拒绝或产生 unknown，空拓扑不能通过，zone 心跳不能冒充物理进程。无关 DNS 错误不阻断仅依赖 Edge 的拓扑计算。
- [x] prepare、convergence 和发布 gate 使用同一拓扑读取逻辑；OpenAPI 优先同步，针对性回归、完整 `make test` 和前端 `contract:check` 通过。
- [x] `e27c3a57603585cd5cd7bf278d0363e2dfbd5c51` 的 [CI 35249939306](https://github.com/yym68686/fugue/actions/runs/35249939306) 全部成功，只更新 API；前端契约 [CI 35249991565](https://github.com/yym68686/fugue-web/actions/runs/35249991565) 成功。
- [x] 生产两个 API 副本就绪；完整 shadow 的 DNS 为 2/2/0，Edge 为 3/3/0，TLS 为 3/0/0（expected/observed/passing）。原始 DNS expected set 的 9 行与发布前逐字段一致；三台 Worker 每台 137 条隔离 probe passed，两台 DNS 健康且心跳新鲜，Front activation 和正式 serving/LKG 指针不变。

证据：[dns-physical-consumer-topology-2026-09-18.json](verification/dns-physical-consumer-topology-2026-09-18.json)。这一步完成拓扑身份修复，尚不构成 serving 收敛；继续完成 TLS consumer 与 DNS 输出语义。

### P0-DF：由实际 Worker 消费 TLS reference artifact

- [x] Caddy 归实际 Edge Worker 所有；TLS expected set 的新记录使用 Worker 身份，旧 caddy-edge-front 行只在 assignment、可信心跳绑定和 convergence（含 CLI）中投影到同一节点 Worker。原始 expected set 不变，旧 Front、其他节点/租户/scope 和缺少 TLS kind 授权的身份不能冒充。
- [x] Worker 的 Pod identity 显式授权 TLS kind；TLS consumer 校验同一 active shadow ReleaseSet 内的 route/TLS 签名、artifact/release/fence/scope、完整 lineage、policy digest、hostname/path owner、原始 domain events 和两份 allowlist。共享 hostname 的平台/应用路径保留各自 policy，SNI 级 TLS reference 必须匹配真实路由 policy。
- [x] TLS 使用独立持久化 cursor 和本地 platform_tls_candidate 状态；重启、响应丢失后 sequence 单调，损坏 cursor 与回放拒绝。只有活动 A/B Worker 报告，下载前后核对 activation；不写 serving/cache/Caddy/证书或 LKG，不把历史 ready 改写为新鲜 TLS 证明，actual/LKG TLS generation 保持空。
- [x] 回归覆盖错误签名、混用 release/fence、错误 lineage/policy/owner/hostname/reference、未来 domain event、allowlist 不一致、inactive/changed activation 和重启。以完整生产快照在本地校验 136 条 TLS 引用和 11 条 allowlist；完整 make test、CLI owner 投影补充回归及前端 contract:check 通过。
- [x] `a90ca9bcaca65e061b3662c2f382b5760fcd3c4d` 已推送，只发布 API 与 DE/US Edge；[CI 35252222335](https://github.com/yym68686/fugue/actions/runs/35252222335) 成功，前端契约 [CI 35252239945](https://github.com/yym68686/fugue-web/actions/runs/35252239945) 成功。
- [x] 生产 API 两副本、三台活动 Worker/Front 均为新代码；德国 A/generation 261、美国 A/generation 825。精确镜像、CurrentAuthority、cache/Caddy 版本、零重启、独立 TLS/route cursor、三台各 137 条隔离探测和真实心跳通过核对。TLS 3/3/0、Edge 3/3/0、DNS 2/2/0（expected/observed/passing），原始 expected set、正式 serving 和 LKG 指针不变。

证据：[worker-tls-shadow-consumer-2026-09-18.json](verification/worker-tls-shadow-consumer-2026-09-18.json)。本步骤完成 TLS artifact 的独立 shadow 消费；新鲜证书/serving 探测、DNS 输出语义、gray/full/rollback、policy verified LKG、恢复演练和旧路径删除仍待完成。

### P0-DG：用显式策略和精确状态证明保留 inactive DNS 目标

- [x] compiler v19 增加强类型 `dns_route_state_constraints`，按 record kind 指定 omit/serve_error_page；默认 omit，迁移投影明确保留 custom-domain-target 的错误页解析行为。策略有界、唯一、可版本化，进入 digest/lineage；不恢复任何 upstream。
- [x] Edge 新增可选 `X-Fugue-Route-Probe-State`，仅证明精确加载的 disabled/unavailable 本地路由，要求无 upstream、正确 group、允许的 route policy、未排除、非 candidate 且 bundle 未过期。普通 active-only 探测语义保持；响应绑定 nonce、digest、版本、节点、group 与原始到期时间。
- [x] placement collector 对每个依赖路径执行真实 TLS/Host 状态证明，单独记录 inactive_routes_verified；编译继续要求所有 TLS/route/健康/quorum/期限门槛。只有部分路径通过、错误状态、错配 digest、陈旧证明、TLS 失败不能生成可发布地址。
- [x] 测试覆盖默认省略、显式策略、输入不可变和重放、所有依赖路径、错误状态/身份/排除/过期/残留 upstream；DNS 消费者严格解析新 policy 回归通过。完整 make test、前端 contract:check 通过，OpenAPI/类型已同步。
- [x] `57264616331bd2ccdfbf1490c317f0fddb003baf` 的 [CI 35256630040](https://github.com/yym68686/fugue/actions/runs/35256630040) 全部成功；API、DE/US Edge 与两地 DNS/SSH 客户端均完成声明式发布。前端契约 [CI 35256653817](https://github.com/yym68686/fugue-web/actions/runs/35256653817) 成功。
- [x] API 两副本、三台活动 Worker/Front 和五个 DNS/SSH 客户端均新版本且健康；德国 B/generation 262、美国 B/generation 826。每台 Worker 对 disabled/unavailable 的两项真实公网 HTTPS 探测返回精确 digest/原始 expiry，默认或错配状态返回 503 且无证明。137 路由隔离执行、TLS 136 引用/11 allowlist、独立 cursor、精确镜像、零重启和原始 expected sets 均通过验收；旧正式配置和 LKG 指针不变。
- [x] 新鲜完整编译在某个自定义域名三节点 TLS 证明全部失败时返回 400，旧配置指针不变，未绕过校验。诊断发现共享证书已于 2026-08-30 过期，但旧诊断仅检查存在性而误报通过；停用 custom-domain 路由又被排除在证书维护之外。
- [x] P0-DH 修复停用域名证书维护与过期诊断，证书实际恢复后重新采集得到 214 条 DNS record，49 条 inactive 目标补回，137 route 含 TLS/cache 等价；DNS 策略/TTL/zone probe/持续 serving 仍待完成，不能据此宣称完整 DNS 等价或 full 发布成功。

证据：[inactive-dns-route-proof-2026-09-18.json](verification/inactive-dns-route-proof-2026-09-18.json)。另外已发现 Edge expected topology 仍用心跳 freshness 过滤成员，必须改为失联节点继续 required、只由权威拓扑移除；在 full 发布前补上该回归与修复。

### P0-DH：停用域名 TLS 维护与过期证书恢复

- [x] Edge 对停用 custom-domain 路由继续维护证书，要求同一不可变 bundle 的精确 hostname/app/tenant verified allowlist、唯一授权、允许的 route policy、本地 group 且无 upstream；缺少/重复/跨 owner/未验证授权拒绝。TLS ask 使用同一个 immutable index 中的 route 与 allowlist，不能混用版本。
- [x] 新增共用证书校验，检查实际 key pair、leaf hostname、NotBefore、NotAfter；API 上传、diagnosis、repair、TLS report 和 Edge 安装均使用它。存在性或历史 ready 不等于有效性；过期/未来/错配证书不能刷新 ready，数据存储读取错误不被改写为成功。拒绝的 incoming certificate 不修改本地可用证书。
- [x] diagnosis 从同一份证书读取摘要和有效性，保留历史 domain events；回归覆盖伪造未来 metadata 配实际过期 leaf、跨 owner、repair/report 不提升无效证据、续期后恢复、同 bundle 授权与新 bundle 撤销、停用 origin 不被重新启用。更新旧“停用域名完全跳过 TLS”断言为真实维护流程回归，完整 make test 与前端 contract:check 通过。
- [x] `8cfb9786d68b17e5d7135114ae41ffcd0afbc4a4` 的 [CI 35261876693](https://github.com/yym68686/fugue/actions/runs/35261876693) 全部成功，只发布 API 与两地 Edge；前端契约 [CI 35261906711](https://github.com/yym68686/fugue-web/actions/runs/35261906711) 成功。API 两副本、三台 Worker/Front 均新版本健康，德国 A/generation 263、美国 A/generation 827，Guardian 全部 stable，客户端继续健康。
- [x] API 上线后先独立确认旧过期证书的 shared_tls_certificate/tls_ready/route_active 检查失败；随后 Edge 正常维护流程将证书续期至 2026-12-16，三台公网 HTTPS disabled-state proof 均为 204，应用仍 disabled、无 upstream。未手工修改证书文件、重装或伪造 TLS ready；最初 TLSReadyAt 保留，TLSLastCheckedAt 来自实际新上报。
- [x] 新鲜 compiler v19 生成 route `artifact_1789672802_57a900abf279`、DNS `artifact_1789672802_285fbc29e72d`、TLS `artifact_1789672802_a27ba0c63367`、ReleaseSet `artifact_1789672802_d87cef1ee7b7`，均 validated、未 promote；137 route、214 DNS、136 TLS，route/TLS allowlist/cache 比较完全等价。固定输入本地重放五类 content/generation 和 lineage 相同，未重写 placement 证明。
- [x] 对照已保存 legacy DNS 多 zone 缓存：49 条 inactive 自定义目标补回，新记录无多余项，集合仅差四条 zone probe。正式 serving/LKG 与原始 expected sets 不变；原 shadow 仍为 TLS 3/3/0、Edge 3/3/0、DNS 2/2/0。

证据：[stopped-domain-tls-recovery-2026-09-18.json](verification/stopped-domain-tls-recovery-2026-09-18.json)。集合一致性不等于 DNS 查询行为一致性，剩余 geo/ECS/latency、各 consumer 的优先组、TTL、probe records 与持续租期处理继续待办。另需修复失联 Edge 从 required 集合消失，以及 domain diagnosis 的 route_active 未独立核对 origin/应用停用状态的问题。

### P0-DI：失联 Edge 继续计入 required membership

- [x] 回归复现错误通过：两个 required 节点中一台心跳已陈旧 24 小时，另一台提交真实可信 applied/passed 回执，旧 API 把前者过滤后返回 1 expected / 1 passing / pass=true。
- [x] expected topology 只按权威节点策略确定成员；移除 Edge heartbeat freshness 过滤，收敛评估单独处理缺失/陈旧事实。修复后保持 2 expected / 1 observed / 1 passing / pass=false，full gate 阻止发布；明确的权威节点移除仍可投影，持久化 expected set 不变。
- [x] prepare、convergence 和 full gate 共用修复后的来源；OpenAPI 优先同步，针对性回归、完整 make test 与前端 contract:check 通过。
- [x] `4acdff460caecdcc222d503abe15c857790e9044` 仅更新 API，[CI 35265609380](https://github.com/yym68686/fugue/actions/runs/35265609380) 成功；前端契约 [CI 35265629960](https://github.com/yym68686/fugue-web/actions/runs/35265629960) 成功。
- [x] 生产 API 两副本更新就绪，原完整 shadow 的 TLS/Edge 分别 3 expected / 3 observed、DNS 2/2，passing 仍全为 0；原始 expected sets、shadow/serving/LKG 指针未变。三台 Worker 的 137 路由隔离执行与独立 TLS consumer、五个 DNS/SSH 客户端保持健康。

证据：[required-edge-membership-2026-09-18.json](verification/required-edge-membership-2026-09-18.json)。后续必须继续收紧 ReleaseSet 回执身份、expected set、fence、generation sequence 绑定，并确保 full gate 要求全部成员的当前 expected set；当前尚未 full 发布。

### P0-DJ：收敛结果绑定完整的当前 ReleaseSet 证据

- [x] ReleaseSet 收敛要求服务器校验后的 active release 与 child artifact 上下文，以及真实 verified consumer identity、credential/token、精确 expected set/ReleaseSet、fence、artifact generation sequence、sequence/issued-at/nonce/evidence hash。缺上下文为 unknown，错误或未验证身份不能 pass；原始事实与 expected set 不被重写。
- [x] full gate 选择目标 ReleaseSet 最新的 active publication，必须包含全部成员的最新 expected set。lane fence 各自计数，跨 channel 按发布记录时间排序；旧 shadow 回执不能授权新 gray，缺 DNS/TLS 期望或新增 required 节点未收敛均阻止发布。
- [x] prepare 同一发布/拓扑保持幂等；新 release 或 topology 创建递增 immutable revision，历史行保留，并处理并发冲突的身份核对。可信 heartbeat 在更新持久化 cursor 前验证当前发布、child sequence 与最新 expectation。CLI 读取服务器收敛结果并检查全部 ReleaseSet 成员，不再用缺少上下文的本地计算宣称通过。
- [x] 合法跨 lane 切换必须由同一数据库事务加载的旧/新 expected set、release 和锁定的新 lane 证明；只切换 fence 比较域，保留 sequence、issued-at、artifact sequence 和 nonce 防重放。PostgreSQL 同步支持同一发布、相同 fence/generation 下的新 topology revision，拒绝冻结、旧发布或错配 lane。
- [x] 完整 make test、前端 contract:check、拒绝性回归和真实临时 PostgreSQL 集成通过；实际执行 shadow fence 2 → gray fence 1、缺成员、旧回执、新 topology revision、幂等重试及历史不变测试。临时数据库已停止，没有修改生产数据库或跳过 schema migration。
- [x] `5deb506412a21e8212654d835aa95babadfe563e` 仅发布 API，[CI 35270308142](https://github.com/yym68686/fugue/actions/runs/35270308142) 成功，前端契约 [CI 35270359027](https://github.com/yym68686/fugue-web/actions/runs/35270359027) 成功。
- [x] 生产 API 两副本更新就绪，全部 8 个实际 consumer 的身份/expected set/ReleaseSet/fence/sequence 绑定通过独立核对；TLS 3/3/0、Edge 3/3/0、DNS 2/2/0，未通过原因仅为 shadow 尚未 applied/serving。三台 Worker 的 137 路由隔离执行、TLS 引用校验、五个 DNS/SSH 客户端及 Guardian 状态正常；原始 expected sets、shadow/serving/LKG 指针未变。

证据：[current-release-consumer-binding-2026-09-18.json](verification/current-release-consumer-binding-2026-09-18.json)。这一步收紧发布证据；gray/full 实际 serving、原子提交时复核、回滚/恢复和其余 DNS 输出迁移仍待完成。

### P0-DK：域名 TLS 与应用 route 活跃状态独立诊断

- [x] domain diagnosis 不再用 DNS/domain/TLS 元数据推导 route_active。期望 replicas=0 明确失败；其他应用复用现有运行态 observation 和 appObservedReadyForServing 判断，只有新鲜、当前 generation、具备 cluster/endpoint/image/replica 证据才通过，缺失或陈旧事实显示 unknown。
- [x] 保留证书有效性和 TLS 检查独立结果；只读诊断不修改 app spec、serving、证书或原始 domain events。回归覆盖停用但历史 ready、有效证书、缺失/陈旧证据、旧 generation、未知 cluster、缺少 endpoint 和正向完整证据。
- [x] OpenAPI 优先更新，专项测试、完整 make test 和前端 contract:check 通过。`abe2456ff3cf4a3c03ea7297e28fee645fa4d468` 仅发布 API，[CI 35297455450](https://github.com/yym68686/fugue/actions/runs/35297455450) 成功；前端契约 [CI 35297471054](https://github.com/yym68686/fugue-web/actions/runs/35297471054) 成功。
- [x] 生产 API 两副本新版本就绪。此前续期成功的停用自定义域名，shared_tls_certificate/tls_ready 通过，route_active 失败并明确 replicas=0；证书到期时间保持 2026-12-16。八个真实 consumer 的当前发布绑定、3×137 路由隔离执行、TLS 校验、DNS/SSH 健康及 Guardian 状态均正常，原始 expected sets 和正式配置/LKG 指针不变。

证据：[domain-runtime-diagnosis-2026-09-18.json](verification/domain-runtime-diagnosis-2026-09-18.json)。route_active 的运行态判断不替代 ReleaseSet 的独立 Edge apply/probe 和 serving 收敛门。


### P0-DL：签名 DNS consumer zone 视图与声明来源修复

- [x] compiler v20 增加 `DNSConsumerIntent` 和独立 endpoint observation：intent 保存 physical node、group、zones、probe label、TTL；地址和 capture time 进入 runtime snapshot digest。DNS artifact 保存按 node/zone 排序的 `consumer_views`，不把两地 listener 地址合并成全局 probe 答案，也不将 listener 可达性当作应用 route/TLS readiness。
- [x] 迁移投影从 DNS DaemonSet 模板读取主 zone、静态附加 zone，从同一固定业务快照读取 publishable hosted zones；节点策略决定 required membership，失联节点不会因健康过滤而消失。历史 zone 心跳不能新增期望 zone；缺失/冲突 workload 声明、归属冲突、probe 碰撞和无 endpoint 的 required consumer 均拒绝。
- [x] DNS shadow consumer 仅按签名的 node/group/zone materialize，使用最长 zone 归属和实际 wire encoder 校验，保留逐值原始期限；全局 record_count 与本进程的 consumer_view_count/probe_record_count 分开。校验失败不更新已验证统计或持久化候选，不写 serving/LKG，也不报告 applied/passed。
- [x] 回归覆盖多物理进程同 zone、嵌套 zone、删除/暂停 zone、无历史心跳的新声明、静态附加 zone、失联节点、地址/group 冲突、缺失/未来 observation、不可变输入、排序重放、错误身份和坏签名。实现和修复两次完整 make test、前端 contract:check 均通过。
- [x] `d723d70f3c3de1c60cced3e00083a4be8fc7ca81` 更新 API 和两地 DNS/SSH 客户端，[CI 35299287543](https://github.com/yym68686/fugue/actions/runs/35299287543) 成功。验收发现旧投影将已移除 zone 的心跳重新加入，生成 8 个视图；该候选未发布。修复 `fce36906bd5c603c71e3a3573d0426de303646be` 仅更新 API，[CI 35300664667](https://github.com/yym68686/fugue/actions/runs/35300664667) 成功；两次前端契约 CI 亦成功。
- [x] 业务应用同时发布期间，旧/新 generation 的路由证明不匹配时两次编译拒绝，配置指针不变。应用部署稳定后重新采集成功：137 route、214 全局 DNS record、136 TLS reference、2 physical DNS consumer × 3 zones = 6 views。137 路由含 TLS/cache 对比全部等价；固定原始输入重放 intent/policy/route/DNS/TLS 内容和 generation、lineage 相同，另核对持久化 child ID 的 ReleaseSet membership，未改写 placement 证明或延长 lease。
- [x] 新完整 shadow ReleaseSet `artifact_1789701583_d70fcc81cd86`、release `artifactrel_1789702981_7536bdc990e2`、fence 3 已由真实消费者验证：两台 DNS 各 3 views/3 probe records，三台 Worker 各 137 条隔离探测，TLS 各 136 引用/11 allowlist；可信发布绑定为 TLS 3/3/0、Edge 3/3/0、DNS 2/2/0（expected/observed/passing）。API 两副本、五个 DNS/SSH 客户端、Front/Worker 和 Guardian 健康，原始历史 expected sets 及正式 serving/LKG 指针不变。
- [x] 对候选声明的每个节点/zone 执行公网 UDP/TCP probe，共 12 项通过，地址与签名视图一致。这证明 listener 声明匹配当前 DNS 端点，不代表新候选已承载 serving。

证据：[dns-consumer-zone-views-2026-09-18.json](verification/dns-consumer-zone-views-2026-09-18.json)。继续完成 DNS geo/ECS/latency/TTL 与每 consumer 优先组、持续有效的 readiness facts、真正的 serving apply/gray/full/rollback、policy verified LKG 和旧路径删除；此步骤不勾选完整 DNS 语义等价或 serving 收敛。


### P0-DM：按物理节点和 zone 查询真实 DNS 迁移差异

- [x] 增加管理员只读接口 `GET /v1/admin/platform-config/dns/compare?artifact_id=...&node_id=...&zone=...`。必须指定精确 validated、签名可信的 global DNS artifact 和其中的 physical node/zone；校验 schema、policy lineage 和 view 归属。参考侧使用现有 bundle 端点选择的可信 full artifact 或 verified LKG，不重新读取业务表生成 DNS 内容。
- [x] 使用同一个服务器观察时间比较 RRset 值、有效 TTL、policy、candidate/scoped candidate、归属和原始期限，保留 TXT 字节及嵌套选择顺序；忽略 record_generation 与顶层记录枚举顺序。到期值不会续期，保留已声明 RRset 名称并计数 expired_candidate_value_count。结果绑定双方 digest、reference scope/generation 与 captured_at，只覆盖请求的 node/zone，不作为 serving ACK 或 promote 授权。
- [x] 回归覆盖相同 IP 下的 ECS/preference/candidate/TLS/scope/TTL/owner 差异、TXT 空格、绝对过期、空权威名称、重复 RRset、lease 与动态 candidate 的不兼容、错误类型/ID/身份/zone、缺参考、坏签名和冲突 alias。验证比较前后 artifact 与 full publication 不变；完整 make test、前端 contract:check 通过。
- [x] `d0ef632026924e0af70da58c8873c23b7fbec921` 仅更新 API，[CI 35306322653](https://github.com/yym68686/fugue/actions/runs/35306322653) 成功；前端契约 [CI 35306347028](https://github.com/yym68686/fugue-web/actions/runs/35306347028) 成功。API 两副本就绪，三台 Worker 各 137 条隔离探测、TLS consumer、两台 DNS/三个 SSH 客户端、Front 与 Guardian 均正常，8 个 consumer 仍为 staged/shadow_validated，正式 serving/LKG 指针不变。
- [x] 对当前完整 shadow 的 6 个视图逐一查询成功，6 个 reference scope 唯一且 digest 完整。每个主 zone 两侧各 213 条声明 RRset、12 条匹配，201 条报告差异；每个主 zone 的候选有 385 个值按原始期限到期。两个附加 zone 各有 2 条记录，probe 均匹配，其余记录的状态或选择/租期差异如实报告。结果 equivalent 均为 false，查询前后配置指针不变。

证据：[dns-scoped-migration-comparison-2026-09-18.json](verification/dns-scoped-migration-comparison-2026-09-18.json)。接口已完成验收，报告中的 DNS 语义缺口尚未消除。下一步迁移选择策略及候选事实，并解决短期 readiness lease 与长期恢复 artifact 的分离，不能仅延长旧证明或忽略差异来完成 full 发布。


### P0-DN：DNS 独立采集与 artifact 绑定的新鲜 route/TLS 事实

- [x] compiler v21 增加显式 `dns_readiness` 策略，配置探测周期、超时、事实有效期、并发和总预算。固定 `dns_edge_endpoints` 只保存身份/group/公网地址及捕获时间，权威拓扑中的失联节点仍被保留；heartbeat 健康不会改变授权对象。原有限期 DNS 地址与 readiness requirements 分开，要求不直接授权任何 DNS 答案。
- [x] 将 route artifact 投影合并到 compiler 内部，执行器通过同一实现使用它；从每条 DNS 的所有 hostname/path 依赖生成精确 group route digest，保留 active/disabled/unavailable 语义并去重 probe。既有 API placement 与 DNS 共享 HTTPS nonce-bound 探测实现，校验 Host/SNI、真实证书、节点/group、原始 bundle version/expiry，事实期限取策略 freshness 与证书/bundle 原期限的最小值。
- [x] DNS shadow 持续读取签名要求，在预算内独立探测并保存绑定 artifact digest、ReleaseSet、expected set、fence 与 DNS node 的事实；重新读取 assignment 后才能发布结果，变更时拒绝旧 scan。重启缓存重算全部 proof 归属和期限，不相信缓存中的成功计数，不续期旧事实，损坏文件不静默重置；失败/缺失事实未就绪，每个地址要求全部路径、每条记录要求 quorum 与声明的双栈条件。
- [x] `platform_candidate.readiness` 报告 plan digest、探测/记录计数、观察时间、期限和 `serving=false`。不写 serving bundle、不延长 ValueExpirations、不伪报 applied/passed、positive LKG 或解开 gray/full 保护；ACME TXT 等内容期限继续使用原始绝对时间。
- [x] 测试覆盖共享投影摘要、多个依赖路径、排序重放、输入不可变、明确 inactive policy、地址归属/私网/未来 observation/预算拒绝、错误摘要/身份/状态/未来或过期 proof、quorum、缓存重算、重启、取消与 assignment fence 改变。完整 make test、补充发布切换回归与前端 contract:check 通过。
- [x] `312272fc3e7dd37f3a8bdc2b31ee352f06329cf3` 的 [CI 35309037781](https://github.com/yym68686/fugue/actions/runs/35309037781) 全部成功，API、两地 Edge 和两地 DNS/SSH 均通过声明式发布；前端契约 [CI 35309061138](https://github.com/yym68686/fugue-web/actions/runs/35309061138) 成功。德国 B/generation 264、美国 B/generation 828，精确镜像/authority、零重启、Front/Worker、API 两副本、五个客户端及 Guardian 通过独立核对。
- [x] 并发业务发布导致摘要不匹配时拒绝完整编译；稳定 capture 得到 138 route、214 DNS、137 TLS，138/138 路由含 TLS/cache 等价，6 views、396 probes、202 readiness records、3 authorized edges；固定输入重放内容、generation、lineage 和 ReleaseSet membership 一致。完整候选进入 shadow：ReleaseSet `artifact_1789709559_769cd5b03ec0`、release `artifactrel_1789709659_82f824c89623`、fence 4，三台 Worker 各完成 138 条隔离探测，TLS 137 引用/11 allowlist，8 个 consumer 身份绑定与心跳通过。
- [x] 两台 DNS 首次实际探测各 390/396 probes、199/202 records 就绪；capture 后两项业务发布使 6 个摘要不匹配，独立路由字段对比确认 cache namespace/deployment generation 已改变。数分钟后同一 artifact/plan 的事实继续刷新，均为 387/396 probes、198/202 records；9 个失配证明保持拒绝。此时 artifact 内 387 个临时地址值仍按原始期限到期，未被新事实续期；正式 serving/LKG 指针及历史 expected sets 不变。

证据：[dns-independent-readiness-2026-09-18.json](verification/dns-independent-readiness-2026-09-18.json)。此步骤完成独立事实采集与失配识别，尚未让这些 facts 驱动 DNS serving。继续迁移 query policy/geo/ECS/latency/TTL，建立稳定授权候选与新鲜事实的实际执行流程，并处理 verified LKG 下的 route proof、gray/full/rollback 与故障恢复演练。


### P0-DO：修复大配置请求被临时 HTTP 响应改写最终状态

- [x] 查询策略迁移验收发现：1,129,142 字节的编译请求通过公网返回 200，但 API 契约与 origin 为 201；关闭 Expect 时同一输入返回 201，两次 artifact ID 与 lineage 相同。根因是 Edge observation/cache response writer 把 100 Continue 或 103 Early Hints 当成最终状态，抑制后续 201，发送正文时隐式提交 200。
- [x] 两个 response writer 对普通 1xx 只转发、不记录最终状态/TTFB/cache；101 协议升级仍为最终响应，已提交最终响应后不再转发临时状态。真实 net/http origin + reverse proxy 回归复现两个包装器的旧错误，修复后保留最终 status/header/body；WebSocket 升级专项与完整 make test 通过。
- [x] `aaa32747ecce4b2a6a82721ee9e5e2c09260888b` 仅更新两地 Edge，[CI 35316314814](https://github.com/yym68686/fugue/actions/runs/35316314814) 全部成功，德国 B/generation 266、美国 B/generation 830。独立核对 Front/Worker authority、镜像、零重启、Guardian 健康及全部现有 shadow consumer，正式 serving/LKG 指针不变。
- [x] 使用原始大请求并显式发送 `Expect: 100-continue`，通过公网 HTTPS 分别直连三台 Edge，全部返回正确 201，artifact ID 与 lineage 保持同一组；请求前后配置指针不变。

证据：[http-informational-status-2026-09-18.json](verification/http-informational-status-2026-09-18.json)。DNS 查询策略代码 `c2560ec7` 已通过代码发布健康验收，但隔离查询的完整生产验收及部分 TXT 过期修复尚未在此项中勾选。


### P0-DP：DNS 查询策略编译并结合新鲜事实执行隔离查询

- [x] compiler v22 增加按 physical consumer/hostname/type 绑定的 `DNSAnswerRule`：选择模式、scoped 模式、首选/回退 group、TTL、ECS、探索比例和冷却时间进入 PolicySnapshot。签名源 generation/digest、原始生成时间、排名/score/candidate 元数据进入独立 RuntimeSnapshot；不复制 legacy healthy/route-ready/TLS-ready 等正向状态。
- [x] 迁移适配器只读取当前可信 full DNS bundle 或 verified LKG，并按声明的最长 zone 归属捕获配置与排名；不在查询执行器读取业务表。编译得到 `query_views`，地址与 edge/group 必须受同一个 readiness plan 的全部 route/path 要求限制，static/probe 原始内容保持独立。错误归属、缺失规则/事实、未来观察、无效 score、越界策略或伪造 readiness 拒绝。
- [x] DNS 将签名 query views 与同一 artifact/ReleaseSet/expected set/fence/node 的新鲜事实关联，要求每个地址全部路径与节点 quorum/双栈门槛，再复用原 DNS geo/latency/scoped/exploration selector 编码 wire answer。TTL 受所有相关 required 证明的剩余期限限制；不把旧 ValueExpirations 延长，不写正在 serving 的 bundle，不发 applied/passed 或 positive LKG。
- [x] 新增 `platform_candidate.query` 和持久化隔离回执，记录 view digest、记录/可用记录、查询/答案计数、观察时间及 `serving=false`。覆盖 global 和有界客户端 geo 提示矩阵，不读取环境中的 GeoIP override 充当新配置；实际公网入口仍待切换。
- [x] 回归覆盖 geo/ECS 开关、延迟、scoped 候选、探索顺序、动态地址的全部路径/quorum/过期/TTL 上限、错误事实身份、政策变更进入 digest、排序/墙钟重放与输入不可变。完整 make test、补充绑定/TTL 回归和前端 contract:check 通过。`c2560ec7b0fa7b5aa05989286bd4a90dba171f6e` 的 [CI 35314008025](https://github.com/yym68686/fugue/actions/runs/35314008025) 成功，前端契约 [CI 35314035724](https://github.com/yym68686/fugue-web/actions/runs/35314035724) 成功。
- [x] 部分 TXT 值到期的补充回归发现重复编码时仍保留已移除值的 expiry 引用，导致未到期值被错误丢弃；隔离投影现只保留存活值对应的原始期限。修复前复现、修复后重复读取与 TTL 递减通过，完整 make test 通过；`fa8047bf5cc005d2c93ad741c506ce2e1e139ff9` 仅更新两地 DNS/SSH 客户端，[CI 35318939155](https://github.com/yym68686/fugue/actions/runs/35318939155) 成功。未伪造生产 ACME challenge 来宣称业务 E2E。
- [x] 新鲜完整编译得到 137 route、213 DNS、136 TLS、6 consumer/query views、402 query rules/selection observations、393 probes/201 readiness records；137/137 路由含 TLS/cache 等价，固定输入重放一致。候选进入 shadow：ReleaseSet `artifact_1789717017_88dabc19ac08`、release `artifactrel_1789717145_08f9db34a36f`、fence 5。
- [x] 两台 DNS 均 393/393 probes、201/201 readiness records 通过，各有 216/216 可用记录，隔离执行 601 次查询并编码 603 条答案；从实际持久化事实独立重放各 801 个查询/803 条答案。数分钟后同一 artifact/view digest 的回执继续刷新，原始快照中 585 个临时地址值保持到期，没有续期旧证明。三台 Worker 各 137 条隔离探测、TLS 136 引用/11 allowlist、8 个可信 consumer、API 两副本、五个客户端、authority 与 Guardian 正常，正式 serving/LKG 指针及历史 expected sets 不变。
- [x] 记录有限公网对照：36 个 TCP A/AAAA 请求全部成功，29 个答案与固定快照一致，7 个差异均在 latency 策略，其中 3 个确认排名输入变化，4 个仍待同客户端提示/同探索时间窗验证；全部公网答案均在候选授权集合内。本机 UDP 超时，双向生产节点 UDP probe 正常；不将本机连通性问题写成 DNS server 故障，也不把 29/36 样本写成完整等价。

证据：[dns-query-policy-shadow-2026-09-18.json](verification/dns-query-policy-shadow-2026-09-18.json)。此步骤完成查询配置分层及真实消费者隔离执行，尚未完成公网 serving 切换。继续消除 legacy selection 迁移适配器作为持续来源的依赖，迁移 GeoIP/客户端作用域配置，解决动态排名事实与完整查询等价、verified LKG 的 proof、gray/full/rollback 和故障恢复演练。


### P0-DQ：ReleaseSet full publication 的事务内收敛复核

- [x] Store full ReleaseSet 发布不再依赖 API 先前的只读收敛结果。文件存储在 state lock 内复核；PostgreSQL 按规范化 scope 获取 advisory transaction lock，并在同一事务重新加载 parent/child artifact、最新 active publication、最新 expected-set revision、trusted consumer facts、fence、generation sequence 和完整 lineage。
- [x] expected-set 创建、trusted heartbeat 写入和 ReleaseSet full publication 共用同一个 scope 锁；发布等待并发 writer 提交后再复核。required topology 发生变化必须先生成新的 immutable expected-set revision；live inventory 不会在 full gate 中静默减少 required 成员。heartbeat scope 以可信 component identity 为准，不能用空或大小写变体绕过锁。
- [x] 失败的 probe、过期 heartbeat、错误 fence、未验证 identity、旧 expected revision、child integrity/lineage 变化、并发 active publication、未知或重复 member 都在 Store 内拒绝；失败路径不新增 release/message、不推进 lane、不改 verified LKG。soft override 不能绕过收敛。
- [x] 回归覆盖完整成功、失败探测、事实过期、拓扑 revision、并发新 publication、expected-set 等待 scope lock、identity scope 绑定、幂等成功和已有 heartbeat SQL 语义；完整 make test、API convergence 回归与前端 contract:check 通过。
- [x] `52073edadc6ba98cd758052a9a896723a7d0c4a6` 已推送，发布计划含 API/controller；[CI 35327448002](https://github.com/yym68686/fugue/actions/runs/35327448002) 成功，前端契约 [CI 35327568570](https://github.com/yym68686/fugue-web/actions/runs/35327568570) 成功。生产 API/controller 均 2/2 Ready，API、controller、Guardian stable，两地 authority ready；8 个 consumer 仍 staged/shadow_validated，TLS/Edge/DNS passing 仍为 0，正式 serving/LKG 和历史 expected sets 不变。
- [x] disposable PostgreSQL `fugue_test_atomic_promotion` 的并发集成验证 6 个场景全部通过：完整 full publication 成功；事实变坏、过期、拓扑变更、并发 publication 和旧 revision 均被拒绝并保持账本/LKG不变；scope lock 等待后重新复核，未使用 stale preflight。

证据：[atomic-release-convergence-2026-09-18.json](verification/atomic-release-convergence-2026-09-18.json)。这一步只完成发布门的原子复核和并发安全，当前仍保持 shadow；后续继续完成真实 serving apply、gray/full/rollback、positive policy LKG、故障恢复和旧配置来源删除。


### P0-DR：合并消费者传输与观察结束后的 assignment 复核

- [x] DNS 的 Pod 身份交换、assignment 下载、HTTP JSON 边界和受限文件读取合并到 `internal/platformconsumer`，删除重复实现；DNS 现在与 Edge/TLS 一样校验精确 scope 和 artifact capability，并拒绝超限或含尾随 JSON 的响应。
- [x] 公共客户端增加显式 `SyncChannel`，只读取调用方指定的 shadow/gray/full 通道，未知值拒绝、缺失 assignment 不跨通道回退。当前真实消费者仍调用 shadow；没有新增决定 serving 的环境变量。
- [x] Edge 隔离执行、TLS 双 artifact 验证和 DNS 查询观察结束后，持久化/上报前统一重读 assignment；相同通道的 fence、revision 或其他绑定变化、缺失、重复及请求失败均拒绝。DNS 无 readiness plan 的旧 artifact 同样复核。服务端事务内绑定验证继续作为最终约束。
- [x] DNS 持久化 sequence 到达 int64 上限时拒绝，不通过溢出重置单调游标。覆盖多通道同时存在、身份 scope/capability、发布变更、无 plan、重复 assignment、重启、损坏缓存和游标溢出；完整 `make test` 通过。
- [x] 后端 `5d2e3457ee0afe0f4ddc0fbbc63e3c97e006372e` 已推送，声明式计划仅含两地 Edge Worker 和 DNS/SSH 客户端；[CI 35332602428](https://github.com/yym68686/fugue/actions/runs/35332602428) 的四次构建及四次部署全部成功。API/controller 保持 `52073eda`、2/2 Ready，六次连续 `/healthz`、`/readyz` 采样全部 200。
- [x] 独立核对新镜像、Front activation 和 authority：德国 A/generation 267、美国 A/generation 831；三台 Worker 各 137 条隔离执行，TLS 各 136 引用/11 allowlist，两台 DNS 与三个 SSH 客户端健康，活跃容器零重启。八个可信 consumer 保持精确 ReleaseSet/expected set/fence 绑定，TLS/Edge/DNS 分别 3/3/0、3/3/0、2/2/0，Guardian stable。
- [x] 两台 DNS 均保留 216 条 query records，实际 199 条可用、567 次查询/552 条答案；新鲜 readiness 为 363/393 probes、184/201 records，30 条 `route_digest_mismatch` 均未变成正向证明。核对持久化候选、query/readiness 归属和原始期限；global ReleaseSet/policy LKG 响应与 immutable expected sets 不变，不将隔离结果计作 serving ACK。

证据：[consumer-transport-consolidation-2026-09-18.json](verification/consumer-transport-consolidation-2026-09-18.json)。此步骤合并传输与绑定校验；继续完成 gray/full serving apply、positive policy LKG、恢复演练与旧配置来源删除。


### P0-DS：DNS 客户端 GeoIP 匹配规则进入强类型 policy

- [x] OpenAPI 优先新增按物理 consumer 绑定的 `dns_client_policies`；规则包含有序 CIDR、country、region、ASN 和 group 提示。compiler v23 将规则及顺序纳入 PolicySnapshot digest；规则 first-match，不因排序改变重叠优先级，声明 owner 必须与完整 DNS consumer topology 一致。
- [x] 同一次 DNS DaemonSet 读取同时冻结 zones 和显式 GeoIP 声明，逐 consumer 生成独立 policy。无变量生成显式空数组；重复、未知字段、尾随 JSON、无效 CIDR、超限、间接 ValueFrom/EnvFrom、缺少 group/consumer 映射均拒绝。失败不会部分写入草稿，执行器不读取 workload 或业务表。
- [x] DNS 隔离 query 使用签名 policy 编译的 CIDR matcher。IPv4/IPv6 ECS 先验证 family、prefix、scope 和唯一性，再应用网段掩码；没有有效 ECS 时可以使用 resolver 地址。查询选择仍受每记录 ECS 开关、授权候选、全路径 readiness、quorum 和期限限制。
- [x] `platform_candidate.query` 与持久化回执增加 client policy digest 和规则数，最多 16 类客户端提示进入隔离查询矩阵。任何 GeoIP 提示均不能授权新地址、延长证明或产生 serving ACK。
- [x] 测试覆盖重叠优先级/顺序版本、固定输入重放、输入不变、IPv4/IPv6、坏 ECS、未授权 owner、缺少 consumer、显式空映射、冲突环境、迁移失败原子性。完整 `make test` 与前端 `contract:check` 通过。
- [x] 代码发布、完整真实配置 capture/compile/replay 与生产 shadow 证据验收。原代码发布的 Guardian/inventory 故障经 P0-DT 修复，最终 CI 35412800639 全部成功，详情和证据见下方完成记录。

当前生产两个 DNS workload 均未声明 GeoIP override；真实 capture 应为两个显式空映射。非空匹配由合成配置回归验证，不写成公网 serving 验证。后续仍需执行正式 serving apply、gray/full/rollback、policy verified LKG 和旧配置来源删除。


### P0-DT：代码发布提交后的恢复与 inventory CAS 冲突

- [x] P0-DS 的美国发布已提交新 authority，但 Guardian 在 2026-09-18 11:17:58 UTC OOM（exit 137），丢失终态回执。保留真实现场：旧 stable monitor、新 authority、健康路由、错误状态和容器退出信息，不把失败 CI 写成成功。
- [x] Guardian 增加已提交版本的精确复核入口：只在发布候选、旧 LKG、Desired、健康与 Edge A/B 归属完全绑定时尝试；复核 CurrentAuthority、Front、当前/上一槽、镜像、manifest、ownership 和完整观察窗口后，在组件 Lease 与 CAS 下补齐发布账本，不执行 rollout/rollback。
- [x] 处理中断发生在 monitor 已提交、Desired 尚未完成时的重试。候选记录与 canonical monitor 允许不同的 LKG/envelope digest，但代码、镜像、manifest 和健康契约必须完全一致；保留原始候选的前驱引用，拒绝其他目标。未知回执/失败进程不能标记 verified。
- [x] Guardian memory limit 从 384Mi 调整为 1Gi、request 128Mi；主进程 Go 内存预算 256MiB，子执行器独立 96MiB。恢复失败原因进入日志，观察期间主进程约 100MiB、零重启；不是通过放宽健康 gate 消除错误。
- [x] 自动复核识别另一项实际缺口：同组慢节点 inventory 心跳持续 409，没有成功 heartbeat timestamp/generation。客户端对明确 sequence_conflict 和传输错误有界重试，每次读取新游标并生成新 nonce/身份，加随机延迟；其他 HTTP 错误不重试，持续冲突最多三次且不伪造成功。
- [x] 两地 Worker 修复发布与生产验证，包括两个美国 producer、持续成功心跳、Guardian stable/monitor 一致、原配置继续 serving。

进行中记录（2026-09-19）：P0-DS 代码 `c537952a` 已在 API、DNS/SSH 和两地 Worker 执行，但原 [CI 35336454692](https://github.com/yym68686/fugue/actions/runs/35336454692) 因 Guardian OOM 后发布账本未收尾而失败，不能视为整步上线成功。Guardian 修复 `40deeb2a`、`b6d0ccfb` 的 CI 成功；进一步发现正常已提交发布被重复纳入恢复，已补 `a726cc6d`，当前 [CI 35411135744](https://github.com/yym68686/fugue/actions/runs/35411135744) 正在执行。inventory CAS 重试 `2ccc23c6` 的德国 authority 已更新到 A/generation 269，但 [CI 35409950644](https://github.com/yym68686/fugue/actions/runs/35409950644) 已取消以释放等待中的生产 runner；美国尚未更新。待 Guardian 修复上线后重跑原发布流程，验证全部消费者，再完成 P0-DS 的新 shadow 配置发布。当前不勾选这些生产终态。

进行中证据：[dns-client-policy-recovery-progress-2026-09-19.json](verification/dns-client-policy-recovery-progress-2026-09-19.json)。

P0-DT 后续修复：明确 `supersedesFailedConfigSha` 的候选发布，在活跃 producer 身份仍有效、签名 group publication 和完整 Worker cohort 一致时，允许缺失或陈旧 inventory 心跳不阻塞候选重试与配置 publication witness 刷新。普通发布和 standby 不使用此例外；source/image、activation/slot、required node 集合、ready/restart、publication 不得回退或变更。新版本提交后的健康 gate 仍要求新鲜 inventory 心跳，不生成伪造的成功事实。

另修复 inventory sequence conflict 响应解析：严格接受生产 `edge-control-error/v1` 的 `schema` 与 `error=sequence_conflict`，拒绝未知/缺失 schema、其他冲突和尾随数据。每次有界重试重新读取 cursor、重新签名并使用新 nonce。测试覆盖持续冲突上限，以及恢复时错误代码身份、镜像、inactive producer、authority 缺失、activation 改变和普通发布拒绝；最终提交 `892249bae11cbab9fb320c94562ded49b09c9a71` 完整 make test 通过。CI：[35412800639](https://github.com/yym68686/fugue/actions/runs/35412800639)。

- [x] `892249ba` 的上述 CI 全部成功，Guardian 和两地 Worker 均新版本；德国 B/generation 270、美国 A/generation 833。三台活动 Worker 连续五轮（超过两分钟）成功心跳，每轮 generation 递增；原持续 409 的节点恢复，两地 Guardian stable，活跃容器零重启。
- [x] 独立核对三台 Front/Worker 的精确镜像和 authority、3×137 路由隔离执行、TLS 136 引用/11 allowlist、DNS/SSH 健康、八个可信 consumer 与不可变 expected sets。正式 serving/policy LKG 指针未变，shadow passing 仍为 0；没有把 shadow 验证写成 full serving。

完成证据：[inventory-recovery-2026-09-19.json](verification/inventory-recovery-2026-09-19.json)。上面的进行中记录保留为真实故障历史，终态以本次完整 CI 和运行证据为准。P0-DS 的新 policy shadow 发布仍独立验收。

### P0-DS 生产完成记录（2026-09-19）

- [x] API `9a221c24`、两地 DNS/SSH `c537952a` 执行 compiler v23/client policy 功能，两地 Edge 和 Guardian 使用恢复修复 `892249ba`；相关声明式发布及独立健康验收完成。
- [x] 应用部署中一次 capture 因三个 hostname 的 route digest 变化返回 400，旧配置/LKG 不变；应用达到 2/2 Ready 后重新捕获，139 route、216 DNS records、138 TLS references、6 consumer/query views、408 answer rules/selection observations，route 比较完全等价，固定输入的全部 artifact 与 lineage 重放一致。
- [x] 新 ReleaseSet `artifact_1789783049_273d40981040` 发布到 shadow/fence 6；八个可信 consumer 全部切换到精确 release/expected set/fence。三台 Worker 各 139 条真实隔离探测，TLS 各 138 引用/11 allowlist；原始 expected set 内容和正式 serving/policy LKG 不变。
- [x] 两地 DNS 从签名 policy 读取各自显式空映射，运行状态与持久化 query receipt 的 policy digest 完全一致、rules=0。每台 219 query records、217 eligible、606 次查询/606 条答案；实际 readiness 为 396/399 probes、202/204 records，失败项保持排除，serving=false。
- [x] 核对两地 workload 无 GeoIP override、无 ValueFrom/EnvFrom；非空规则、优先级和 ECS 只记为合成配置回归结果，不冒充生产非空映射测试。

证据：[dns-client-policy-shadow-2026-09-19.json](verification/dns-client-policy-shadow-2026-09-19.json)。P0-DS 与 P0-DT 已完成；当前架构仍处于 shadow，鲜活 TLS 证据、实际 gray/full apply、verified policy LKG、恢复演练及旧路径删除继续待办。

### P0-DU：签名策略驱动本机 TLS 新鲜证据

- [x] OpenAPI 优先增加可选 `tls_readiness`，与 DNS 共用强类型探测参数结构，各自独立纳入 PolicySnapshot digest。compiler v24 校验时间、并发、探测数量上限和固定输入重放；迁移投影显式提供参数，执行器不读取业务表。
- [x] Worker 只连接本机 Caddy，按自身 group 的签名 route projection 选择 hostname，且当前 serving bundle 必须有一致的 hostname/path/owner/policy；自定义域名还需同一 bundle 的唯一 verified allowlist。平台通配符证书没有 tenant owner 时，从签名 route 获得 owner，不能放宽成通配授权。
- [x] 真实 TLS 握手验证系统信任链、SNI hostname、有效期和 PROXY protocol。独立回执绑定 TLS/route artifact、assignment、ReleaseSet、expected set、fence、generation、node/group、policy 和当前 bundle；每条事实记录证书指纹、有效期、观察时间和期限，失败保留明确负向原因。
- [x] 原始期限取 policy freshness、整条已验证证书链到期、serving bundle deadline 的最小值；每次状态查询重新计算 freshness，Caddy 未加载对应 bundle 不显示 TLS verified。仅复用同进程内同 binding/同 bundle 的短期事实，重启重新握手；assignment 或 activation 改变拒绝上报。TLS 结果不宣称 route apply、origin health、serving 或 positive LKG。
- [x] 回归覆盖真实握手信任/hostname/过期/未来证书、PROXY header、超时、owner/allowlist/局部 group、部分失败、变更 binding/bundle、取消和重启；完整 make test、针对性 race 与前端 contract:check 通过。
- [x] 完成声明式代码发布，并以新的完整 v24 ReleaseSet 进行真实 shadow 验收，保存生产证据。


P0-DU 发布恢复记录：原提交 `aaaecf18` 的 API、DNS/SSH 和德国 Worker 已成功，美国连续两次在五分钟 prewrite 总期限内失败，分别最终报在 registry 和备用 DaemonSet 读取；均未生成 mutation 执行计划，旧 authority/LKG 正常。后续 `0566bc39` 在单次 release execution 内按精确镜像 digest/revision 复用已成功验证的不可变 registry 身份，失败结果不缓存、新执行重新验证；US intent 显式 supersede 原失败 atom，并保留最终完整健康 gate。恢复 CI [35418194340](https://github.com/yym68686/fugue/actions/runs/35418194340) 全部成功，美国 B/generation 834、Guardian stable。德国仍为 `aaaecf18` A/generation 271；API 随其他任务更新到包含该功能的 `aa09ad20`，客户端为 `aaaecf18`。完整 make test 与专项 race 通过，第一次全量检查因本地磁盘耗尽失败，清理可再生成 Go 缓存后重跑通过，未把该环境失败当成代码通过。


- [x] 完整 v24 capture/compile/replay：139 route、216 DNS records、138 TLS references，route 行为完全等价，全部 content/generation/lineage 精确重放。新 ReleaseSet `artifact_1789788804_65581461056e` 仅 shadow/fence 7，所有八个 consumer 完成精确绑定。
- [x] 三台 Worker 每台 138/138 TLS hostname 实际握手通过；逐条校验证书指纹、NotBefore/NotAfter、verified-chain expiry、原始 bundle deadline 和 policy freshness。每台抽查两个公网 hostname（平台/自定义）指纹与本地事实一致；跨刷新周期再验仍 138/138，并有更新的实际握手时间。
- [x] 三台 Worker 各 139 条路由隔离执行，两台 DNS 各 399/399 readiness probes、204/204 records、219 eligible query records。TLS/Edge/DNS expected/observed/passing 仍为 3/3/0、3/3/0、2/2/0，真实 TLS 结果没有伪装成配置 applied/serving。
- [x] 精确镜像/源码、Front authority、Caddy 版本、活跃容器零重启、inventory、DNS/SSH、Guardian stable、immutable expected sets 与正式配置/policy LKG 保留均通过独立复核。前端契约 CI 35416021065 成功。

证据：[tls-readiness-shadow-2026-09-19.json](verification/tls-readiness-shadow-2026-09-19.json)。本步骤补齐独立新鲜 TLS 观察；gray/full 的实际 artifact apply、verified policy LKG、故障演练、唯一配置来源切换和旧路径删除仍未完成。

### P0-DV：TrafficReleaseSet 的 gray 目标绑定签名 cohort

- [x] PolicySnapshot 增加有界强类型 `traffic_rollout_cohorts`，明确 cohort ID 和 Edge group 集合；compiler v25 规范化但不修改输入，将其纳入 policy digest，并把相同不可变投影保存在 ReleaseSet。父 artifact 与三个 child 的完整 policy digest、release generation 和 cohort 必须一致，不能产生第二个可编辑配置来源。
- [x] gray TrafficReleaseSet 只接受 `cohort=<id>` 指向已签名的规则；自由字符串 selector、未知/非规范 ID、重复/无效 group 和超限内容拒绝。File/PostgreSQL 在同一发布/回滚事务验证所有 child；soft/break-glass 不绕过 cohort 边界，失败保持 lane、账本及 LKG。
- [x] assignment 与 download 只向 cohort 内的 immutable expected members 暴露 gray artifact；非目标 group 保留 shadow/full assignment。可信 heartbeat 和 convergence 拒绝非目标 gray 事实。prepare 要求目标 group 存在完整 Edge/DNS 声明，失联节点不会因心跳过滤消失。
- [x] expected sets 始终保存完整 topology，full gate 继续要求全部 required 成员；单 group canary 不等于全平台通过，只有显式覆盖全部 group 的签名 cohort 且全部成员实际 applied/probed 才能进入完整收敛。
- [x] 固定输入重放、跨 policy/父子篡改、未授权下载/心跳、保留其他 channel、单 group 不通过 full、回滚拒绝和真实 PostgreSQL 原子/并发门回归通过；完整 make test 与前端 contract:check 通过。
- [x] 完成代码发布，捕获真实完整 v25 配置并验证 lineage/cohort/消费者 shadow；保留 DNS 租期及实际 serving apply 尚未完成的发布门，不把本步骤记为 gray serving 成功。


- [x] 后端 `5eeab38a8317c302668aef65100611e3ac6594a8` 的 [CI 35420893190](https://github.com/yym68686/fugue/actions/runs/35420893190) 九个组件构建/部署全部成功：API、controller、Guardian、两地 Edge Control、Worker 和 DNS/SSH 客户端。前端契约 [CI 35420906362](https://github.com/yym68686/fugue-web/actions/runs/35420906362) 成功。
- [x] API/controller 2/2 Ready；德国 B/generation 272、美国 A/generation 835，精确镜像/Front/authority 一致，活跃容器零重启，全部 Guardian 健康。旧 v24 配置在升级后的九个组件上继续运行，正式 serving/LKG 指针不变。
- [x] 最新 v25 capture 为 142 route、220 DNS records、141 TLS references；路由比较完全等价，全部 artifact 与 lineage 固定输入重放一致。policy/ReleaseSet 同时绑定德国、美国与两地完整集合三个 cohort。
- [x] ReleaseSet `artifact_1789793583_74b25402c918` 只发布 shadow/fence 8，八个消费者完成精确 binding；三台各 142 路由隔离执行、141/141 TLS 实际验证，公网证书指纹抽查一致，DNS/SSH 健康，expected sets 保持不可变。
- [x] 生产独立 scope 的合法 cohort 发布返回 200；自由 selector、未知/非规范 cohort 及非法回滚共五项返回 409，原 lane/fence 与全局配置不变。真实全局 ReleaseSet 即使使用合法 cohort，gray/full 仍因 DNS value expiration serving 支持未完成而返回 409；未绕开旧门或把隔离 scope 验证冒充生产切流。

证据：[traffic-canary-policy-2026-09-19.json](verification/traffic-canary-policy-2026-09-19.json)。本步骤完成配置化的 gray 作用范围和授权边界，未完成实际 gray/full serving。后续沿现有唯一 Group Authority 执行链绑定 ReleaseSet，完成 DNS 租期执行、actual apply/probe、positive policy LKG 与恢复演练，再删除旧 serving 来源。

### P0-DW：签名 ReleaseSet 绑定到 Edge 投影与执行回执

- [x] consumer 通过当前 child assignment 读取精确签名父 ReleaseSet；父子成员关系、policy digest、完整 lineage、发布 channel/fence/scope 与 generation 必须一致。未知父 artifact、非目标 cohort、错误 expected set 均被拒绝。
- [x] EdgeRouteIntent 投影携带 `traffic_release`，保存 parent/child digest、ReleaseSet、release/fence、compiler、intent/policy/input digest 和 projection digest；Group compiler 保留这些字段并纳入 generation，runtime inventory 不能改写来源。
- [x] Group authority 发布和 Worker bundle 验证拒绝 shadow 进入 serving、拒绝非目标 gray group；绑定进入 bundle 签名，删除绑定不能降级为 legacy 验证通过。旧无绑定的已签名 bundle 保持兼容。
- [x] 活跃 Worker 下载并独立验证父子 artifact，将绑定保存在本地 shadow cache、状态和隔离执行回执中；下载和隔离 HTTP probe 仍然只上报 staged/shadow_validated。
- [x] 回归覆盖篡改、错 release/fence、越组、未知 cohort、投影变更、channel 导致 generation 改变、删除签名字段与 shadow 拒绝保留旧 serving；完整 make test、干净检出 prepush 和前端 contract:check 通过。
- [x] 代码经 main/Actions 部署生产；生产现有 v25 配置无需重新编译即被新 Worker 正确消费，确认生产配置和 LKG 指针不变。

本步骤提供 Group Authority 使用 ReleaseSet 的可信输入结构和防误发布校验。当前 Group Authority 的默认 serving 来源尚未切换；真实配置 gray/full apply、DNS 租期 serving、policy positive LKG 和恢复演练仍未完成。

- [x] 后端 `d607054bf27ceecdf43c7203e2da3f461d924313` 的 [CI 35424603837](https://github.com/yym68686/fugue/actions/runs/35424603837) 九个组件构建/部署全部成功。前端契约 [CI 35424607410](https://github.com/yym68686/fugue-web/actions/runs/35424607410) 成功；干净检出 prepush 150 秒全部通过。
- [x] 德国 A/generation 273、美国 B/generation 836 已使用本步骤镜像，三台 Worker 和 Front/authority 的精确镜像及版本一致，活跃容器零重启。API/controller 后续正常更新至包含本步骤的 `33b9424d`（[CI 35425130628](https://github.com/yym68686/fugue/actions/runs/35425130628) 成功），均为 2/2 Ready，healthz/readyz 返回 200。
- [x] 现有 v25 ReleaseSet `artifact_1789793583_74b25402c918`、shadow fence 8 无需重新编译；三台 Worker 均验证父子签名并保存相同 `projection_digest=sha256:65171759c42b426366e9c91ad33841bfa5323328a1cb55749b8776421a9bfc4e`，状态、本地文件、执行回执的 binding 完全一致。
- [x] 每台 142 条 route 隔离执行通过，141/141 TLS 实际观察通过；两台 DNS 正常，8 个 required consumer 完成 shadow 观察，passing 仍为 0。新代码发布前后的 shadow/full 配置和 policy/artifact LKG 指针不变，expected topology 未改变。

证据：[traffic-release-binding-2026-09-19.json](verification/traffic-release-binding-2026-09-19.json)。实际 serving 尚沿原 Group Authority 配置来源；后续必须完成上层 ReleaseSet 驱动的 apply/rollback，不能将本步骤视作全量 serving 迁移完成。

### P0-DX：TrafficReleaseSet 驱动现有 Group Authority 与真实 serving 观察

- [x] Edge Control 请求携带自身 canonical group；API 从最新适用 gray/full ReleaseSet 选择路由，gray 只作用于签名 cohort，后发 full 取代旧 gray。读取所有 route/DNS/TLS child 的签名和 immutable expected topology，未完成准备或验证失败时保留原 serving，不回退业务表。
- [x] 实际 Group compiler/publisher 使用绑定投影，发布前重新确认上层 ReleaseSet；签名包含可执行 cache policy。已进入 ReleaseSet 的 group 拒绝无绑定配置降级、同 channel 旧 fence 和同 fence 不同内容；合法更高 fence 可携带旧 artifact 作为恢复目标。
- [x] 活跃 Worker 增加真实 serving 观察，确认已应用的 Group bundle、Caddy version、路由索引和持久化 cache 完全一致，执行本地 Caddy HTTPS/nonce 路由证明及全部本地 TLS 引用检查。只在当前 assignment、activation 和新鲜证据一致时上报 route/TLS applied/passed；没有 serving ReleaseSet 时明确 awaiting_release。
- [x] 当前运行事实只有一个报告来源：一旦 serving 配置带 ReleaseSet，旧 shadow 不再覆盖 applied 事实。probe interval/concurrency/freshness 读取签名 policy；在进程内复用尚新鲜证据时不延长原始时间，重启必须重新探测。回执持久化不自动提升中央 policy/artifact LKG。
- [x] 回归覆盖未准备 topology、目标组移除、gray/full 顺序、shadow 不切流、签名撤销、并发发布变化、cache policy 篡改、无绑定降级；实际 TLS 传输和 Worker 成功/失败报告、缓存缺失、Caddy 未应用、伪造 proof、assignment/serving 中途变化、重启证据更新均通过。完整 make test、关键路径 race、干净检出 prepush、前端 contract:check 通过。
- [x] 经 main/Actions 部署并验证三台 Worker、两台 DNS、Front/authority 和 Guardian 健康；当前生产仍为 shadow，serving observer 返回 awaiting_release，配置/LKG 指针不变。

本步骤接通 route 的正式执行入口与 apply/probe 报告代码。当前生产尚未发布 gray/full：DNS 租期、artifact serving 切换与回滚协议仍需完成，不能将 awaiting_release 或 shadow 观察记录为生产实际 applied/passed。

- [x] 后端 `312fd174406802bbe7e7250cc027dc4e9c6115fb` 的 [CI 35428158551](https://github.com/yym68686/fugue/actions/runs/35428158551) 九个组件构建/部署全部成功，CLI 构建通过；前端 `f40264c1` 的 [契约 CI 35428171170](https://github.com/yym68686/fugue-web/actions/runs/35428171170) 成功。干净检出 prepush 153 秒通过，完整 make test 与关键路径 race 均通过。
- [x] API/controller 2/2 Ready，德国 B/generation 274、美国 A/generation 837 的 Worker/Front/authority 精确镜像一致，活跃容器零重启；两地 Edge Control、Guardian 均健康。US rollout 等待独立 canary 证据期间保留旧 authority，随后正常切换并变为 stable，无手工绕过。
- [x] 三台 Worker 每台验证 142 条 route 隔离执行及 141/141 TLS；两台 DNS 健康，route/TLS/DNS 共 8 个 expected consumer 保持 shadow 观察且 passing=0。三个新 serving observer 均为 awaiting_release，不生成 applied/passed 假象。
- [x] 现有 v25 ReleaseSet `artifact_1789793583_74b25402c918`、shadow fence 8、完整 expected topology 与代码发布前一致；shadow/full 配置、policy 和 artifact LKG 指针保持不变。

证据：[traffic-release-source-2026-09-19.json](verification/traffic-release-source-2026-09-19.json)。此处完成的是正式执行入口及报告代码的生产发布；实际配置切流与回滚尚未验收，相关总任务不打勾。

### P0-DX 续期故障修复：专用 TLS 入口遗漏 group query

- [x] 后续巡检发现 P0-DX 新增的 `edge_group_id` 被 API 专用 TLS wrapper 的旧“禁止所有 query”规则拦截，Edge Control 持续 fetch_failed，旧 bundle 租期耗尽后 authority 变为 unavailable。先前短时 Ready 验收未覆盖持续拉取，这是已确认的验收遗漏。
- [x] `d3cf7568b8c046735a1788ecb1cb91becb085e71` 只允许契约声明的单个 canonical group 参数，保留路径、Host/SNI、认证和其他参数拒绝规则；专用 TLS wrapper、合法/重复/非法参数回归及完整 make test、干净 prepush 通过，经 [CI 35432343799](https://github.com/yym68686/fugue/actions/runs/35432343799) 正常部署 API，未手工修改生产。
- [x] 两地 authority 恢复 Ready，API 为 2/2 Ready；修复后的连续日志显示 published=1/failed=0，publication sequence 与未来租期跨多个后续周期持续推进。验证同时比较故障前、首次恢复和后续续期，避免只用一次缓存健康作为证明。公网 API/网站抽查均为 200。

证据：[route-intent-tls-query-recovery-2026-09-19.json](verification/route-intent-tls-query-recovery-2026-09-19.json)。后续发布验收必须包含定期拉取成功和租期持续前进。

### P0-DY：DNS artifact 回答、逐次租期校验与本地恢复

- [x] PolicySnapshot 增加按 physical consumer/zone 绑定的强类型 DNS authority（NS、TTL、SOA 时间参数）；迁移捕获一次性读取明确 workload 声明和原默认值，compiler v26 将其纳入 policy digest，并验证完整 zone 所有权。消费者不再从 ambient 环境推导这些参数。
- [x] assignment 支持 serving_only，DNS 与 Group Authority 使用相同的最新适用 gray/full 选择与 immutable topology；parent/child 签名、成员关系、lineage、cohort、release/fence 均独立校验。路由 HTTPS 证明携带已应用 TrafficReleaseBinding，跨父 artifact 或发布批次的 readiness 被拒绝。
- [x] 一个 immutable DNS snapshot 负责本机全部 zone，真正 ServeDNS 路径使用签名 client matcher、authority 和 query records；按最长 zone 归属处理 NS/SOA、CNAME、通配符、空 NOERROR 与 NXDOMAIN。每次请求按所有依赖 path、quorum 和原始 proof 截止时间重新筛选动态地址，TTL 不得超出 quorum/证据剩余时间；静态 ACME/address value expiry 保留。
- [x] 候选先通过完整 detached wire 验证，再原子替换内存 snapshot，真实 UDP/TCP listener 验证和持久化失败会恢复原 snapshot。旧 legacy sync、动态 zone worker 和 ambient override 不能覆盖 bound serving；真实成功后才发送 applied/passed，当前 serving readiness 失败立即发送失败事实。
- [x] 持久化本地 authenticated positive checkpoint，包括 signed parent/child、assignment 和 release 引用。重启校验完整性并丢弃 transient readiness；当前文件丢失/损坏只回退另一个已验证 positive predecessor，没有有效记录时 fail closed。控制面不可用时保留配置并独立刷新 readiness；重连清除 fallback 状态且不续期旧证据。
- [x] 本地回归覆盖真实 UDP/TCP serving、quorum 与逐值过期、错发布/签名/所有权、失败候选/监听器保留旧 snapshot、重启/损坏恢复、API 断连与重连、失败心跳、实际 TLS/nonce/provenance 传输；完整 make test、关键路径 race、干净 prepush 和前端契约检查通过。
- [x] 经 main/Actions 部署验证全部生产组件；编译完整 v26 配置并在 shadow 上执行新的 DNS answerer，验证六个 zone policy 和完整 query snapshot。正式配置仍保持原 serving/LKG，gray/full 保护门尚未解除。

本步完成 DNS 正式执行与本地恢复实现，并以生产完整 shadow 输入验证新回答器。首次 positive policy/ReleaseSet LKG、跨 channel/旧 artifact rollback、全局灰度和公网配置切流仍未验收，不能将本步记为生产已切换 artifact serving。

- [x] DNS 执行代码 `e9e206fb99e44ab9b8ffd07634b1a63f70f5caea` 的 [CI 35431746521](https://github.com/yym68686/fugue/actions/runs/35431746521) 九个组件全部构建/部署成功；前端契约 `3d14a7f0` 的 [CI 35431754464](https://github.com/yym68686/fugue-web/actions/runs/35431754464) 成功。API 后续使用上述 TLS 修复版本。
- [x] 德国 A/generation 275、美国 B/generation 838，三台活跃 Worker、Front、两地 Edge Control、DNS/SSH 客户端精确镜像一致，活跃容器零重启，Guardian 均 stable。先验证旧 v25 配置继续工作，再捕获 v26，期间 serving/LKG 指针保持不变。
- [x] 最新完整 v26 为 147 route、231 DNS records、146 TLS references、6 个 authority policy；147 条路由全部等价，固定输入重放的 intent/policy/route/DNS/TLS digest 与 lineage 一致。业务路由变化后重新捕获，未使用过时比较结果。
- [x] ReleaseSet `artifact_1789808249_13038b2c4d0a` 只发布 shadow/fence 9。三台 Worker 各完成 147 条隔离路由与 146/146 TLS 验证；两台 DNS 各执行 3 个 authority policy、234 个回答快照记录，并完成已有 query 矩阵。八个 required consumer 保持准确的 shadow 事实，passing=0。
- [x] 两台 DNS 和三台 Worker 均明确 awaiting_release，正式 serving 和 policy/artifact LKG 不变。对真实 v26 进行合法 cohort gray/full 请求仍返回 409，保护门未绕过；必须完成首次 LKG 和 rollback 条件后再解除。

证据：[dns-artifact-serving-2026-09-19.json](verification/dns-artifact-serving-2026-09-19.json)。生产公网配置尚未切换为 v26 artifact serving；本步骤验证执行实现、完整 shadow 输入和旧版本兼容，实际灰度/全量/回滚的总任务保持未完成。

### P0-DZ：真实收敛验证与成套 LKG 原子保存

- [x] TrafficReleaseSet 首次 LKG 只允许显式 gray bootstrap；shadow 即使提交全部 true 也不能成为 serving LKG。已有 LKG 只能经 full 的新鲜实际收敛替换。
- [x] 验证事务重新读取当前发布、lane/fence、三个成员签名和 lineage、最新 immutable expected topology 与所有 required 的可信 applied/passed 心跳；不以请求中的布尔值代替真实证据。
- [x] 将父 ReleaseSet、route、DNS、TLS、匹配的 signed typed PolicySnapshot 五份恢复引用原子保存，绑定同一个 verification release/evidence hash。缺失、篡改、过期、错误 fence、并发探针失败均保留旧五份引用；历史可查询、重试不重签。
- [x] Member LKG 不授予灰度范围外的 serving 权限。旧 route/DNS reader 使用现有 ledger 中最后一个独立验证的配置，直到父 ReleaseSet 明确选择该 group；不增加第二套发布状态机。
- [x] 修复 gray→full 两个 lane 的 fence 数值相同导致 PostgreSQL 拒绝合法心跳的问题；只允许新且当前的跨 channel 发布，保留 sequence、issued-at、nonce 和 artifact generation 的防重放检查。
- [x] 文件存储、真实 PostgreSQL 并发、race、完整 make test、干净 prepush、前端契约检查全部通过；main/Actions 部署后验证持续续期、完整 shadow、生产 LKG/serving 未被误推进。

本步是恢复记录与验证事务的实现。首次生产 positive LKG、旧 artifact 的显式 rollback、Group 代码恢复与上层配置绑定、真正 gray/full 切流仍须后续步骤验收，不能据此解除流量发布保护门。

- [x] 后端 `90240dc35e0a887c56d9052a51160ab844d2676b` 经 [CI 35435520598](https://github.com/yym68686/fugue/actions/runs/35435520598) 九个组件全部成功；前端契约 `f32f20f9` 经 [CI 35435527913](https://github.com/yym68686/fugue-web/actions/runs/35435527913) 通过并自动部署，两个副本/endpoints 和镜像一致。
- [x] 生产独立测试 scope 验证 shadow 拒绝建立 LKG；合法 gray 但没有 trusted consumer facts 时，即使提交全部通过声明仍返回 409，五份恢复引用均不存在，全局 serving/LKG 未变化。
- [x] 德国 B/276、美国 A/839 的活跃 Worker/Front 精确匹配新代码和 digest；三台 Worker 各验证 147 route、146 TLS，两台 DNS 完成六个 zone 的既有完整 shadow 回答。八个 required consumer 均有报告且 passing=0，未把隔离验证提升为 serving 成功。
- [x] API/Controller 为 2/2 Ready，所有活跃 Edge/Front/DNS/SSH 容器零重启。两地 authority 续期的 sequence 与截止时间在后续巡检继续推进；Edge Control 日志 `published=1、failed=0`，公网 API/网站均为 200。

证据：[traffic-lkg-atomic-recovery-2026-09-19.json](verification/traffic-lkg-atomic-recovery-2026-09-19.json)。首次生产 positive traffic/policy LKG 仍待真正 gray/full 及 rollback 验收，本步没有解除发布保护。

### P0-EA：Group 代码恢复不得改写 TrafficReleaseSet

- [x] 在 Group Authority 的持久化 CAS 边界校验恢复前后完整 TrafficReleaseBinding 一致；拒绝跨 channel 历史发布、旧父/子 digest、不同 release/fence/cohort 和退回无绑定来源，失败时 serving bundle 与 ledger 均保持不变。
- [x] 对冲突返回明确的 `409 traffic_release_conflict`，避免将配置授权冲突误认为单纯 sequence 过期而反复重试。
- [x] 保留当前 traffic 配置的正常续期，以及上层明确授权后以新 fence 通过普通配置发布路径恢复旧 artifact；legacy 无绑定 bundle 的既有恢复行为不变。
- [x] 使用真实签名、持久化 store、认证恢复 HTTP、直接 CAS、重启和新 fence 旧 artifact 发布测试验证边界；关键路径 race、完整 make test、干净 prepush 和前端契约检查通过。
- [x] main/Actions 部署后验证两地 Edge Control、新 API、现有 Worker/DNS/Front、真实周期续期与完整 shadow 输入，保存运行证据。

本步收紧代码恢复权限，仍不代表生产已完成 traffic gray/full、首次 positive policy LKG 或旧 artifact 的 consumer heartbeat 回滚验收。

- [x] 后端 `a786d6ebee7f1ffd4891519fb303115b9beb0c79` 经 [CI 35437768735](https://github.com/yym68686/fugue/actions/runs/35437768735) 完成 API 与两地 Edge Control 部署；前端契约 `05c35871` 的 [CI 35437769433](https://github.com/yym68686/fugue-web/actions/runs/35437769433) 通过并自动部署为 2/2 Ready。
- [x] API 2/2、新 Edge Control 镜像精确匹配。既有三台 Worker、三个 Front、两台 DNS/三个 SSH 客户端保持 `90240dc3` 正常运行且零重启，德国 B/276、美国 A/839 未改变。
- [x] 三台 Worker 各完成 147 route 和 146 TLS 引用验证，两台 DNS 各完成 3 zone/234 回答记录。一次初始检查遇到 DNS shadow 回执超出两分钟阈值，后续日志证实持续生成新回执，完整复验在原阈值下通过；没有降低新鲜度标准或误报 serving。
- [x] 两地 authority 的 sequence 与有效租期均比发布前继续推进，周期日志 `published=1、failed=0`，间隔内正常返回 unchanged。公网 API/网站 200，global serving/LKG 指针和 expected topology 不变，required 8/observed 8/passing 0。

证据：[group-traffic-recovery-boundary-2026-09-19.json](verification/group-traffic-recovery-boundary-2026-09-19.json)。实际 bound traffic 的历史恢复拒绝由本地真实签名/持久化/HTTP 回归验证；生产仍是旧 serving 加新完整 shadow，不宣称已完成正式 traffic 切流。

### P0-EB：旧 artifact 回滚的可信 consumer 游标

- [x] 降低 artifact generation 仅接受明确 rollback ledger message，核验当前 lane/fence、最新 expected set、签名 parent/三个 child、lineage、cohort 与目标 generation；普通发布的 pinned rollback target 不视为授权。
- [x] 允许同 lane 的新 fence 和跨 lane 的较低数字 fence 恢复旧 artifact，但完整保留 sequence、issued-at、nonce/evidence 校验；重放、冻结、superseded 或更新的适用 serving 发布保持旧 consumer fact。
- [x] 文件与 PostgreSQL 使用相同授权证明。PostgreSQL 预判 generation 回退后取得 scope 排他锁，避免持有行锁时升级共享锁；提交事实前阻止 publication/LKG 并发改变授权。
- [x] 测试覆盖 route/DNS/TLS 三类旧成员、同/跨 channel、恢复后的持续心跳、普通 message、签名篡改、最新 topology、cohort、sequence/nonce/时间重放和排队期间撤销授权；真实 PostgreSQL、race、完整 make test、干净 prepush 和前端契约检查通过。
- [x] main/Actions 完成 API/Controller 部署，验证当前业务配置持续 serving、完整 shadow、持续 authority 续期和实际代码版本，再保存证据。

本步实现回滚后的事实接收能力。正式生产旧 artifact 回滚演练仍须与 Edge 失败事实、gray/full 切流一起完成，不以局部测试代替端到端恢复验收。

- [x] 后端 `cf3c54c1030666d19d2f245ddae4a70c31d36cc6` 经 [CI 35439439717](https://github.com/yym68686/fugue/actions/runs/35439439717) 完成 API/Controller 部署，均为 2/2 Ready；CLI 构建通过。前端契约 `a60ce9cb` 的 [CI 35439451560](https://github.com/yym68686/fugue-web/actions/runs/35439451560) 通过并自动部署为 2/2 Ready，公网 200。
- [x] 两地 Edge Control 保持 `a786d6eb`；三台 Worker、Front、两台 DNS 与三个 SSH 客户端保持 `90240dc3`，活跃容器零重启，德国 B/276、美国 A/839 的镜像和 authority 一致。
- [x] 三台 Worker 各完成 147 route/146 TLS shadow 验证，两台 DNS 各完成 3 zone/234 回答记录；8 个 required consumer 全部观察到，passing=0。expected topology、global serving、policy/artifact LKG 指针不变。
- [x] 两地 authority 的 sequence 和有效租期均继续推进，周期日志 published=1、failed=0。文件与真实 PostgreSQL 测试覆盖合法旧 generation 回滚、三类成员、防重放和并发撤销；完整 make test、race、干净 prepush、前端契约检查通过。

证据：[consumer-rollback-cursor-2026-09-19.json](verification/consumer-rollback-cursor-2026-09-19.json)。生产仍运行旧 serving 与完整新 shadow；本步不宣称已完成实际 traffic gray/full 或端到端回滚演练。

### P0-EC：Edge 失败事实及时上报

- [x] route/TLS serving observer 只查询当前适用的 gray/full assignment；后发 full、topology 或 activation 变更不能被旧观察覆盖。
- [x] 验证签名 parent/route/TLS/policy 后，真实 Caddy apply、cache 或探测失败立即提交 route/TLS failed heartbeat，不声称未验证的 actual/LKG generation。
- [x] 正负事实共用持久化递增游标；失败保留成功回执与现有 serving bundle，清除内存正向证据，恢复与重启后重新探测。
- [x] 覆盖失败后恢复、重启、时钟落后持久化游标、部分上报拒绝、签名错误、配置/activation 中途变化、inactive Worker、游标损坏/不可写；race、完整 make test、干净 prepush、前端契约检查通过。
- [x] main/Actions 部署 API 和两地 Worker 后验证实际镜像、Front/authority、持续续期、完整 shadow 和现有 serving，再记录证据并勾选。

本步为正式 traffic promotion 提供及时的负向运行事实。生产实际 gray/full、首次 positive policy LKG 和端到端回滚仍须单独验收。

- [x] 后端 `570f9c5a8e2bd1f393e5a6e3238b7f8c28fffae4` 经 [CI 35441052316](https://github.com/yym68686/fugue/actions/runs/35441052316) 完成 API、两地 Worker 发布，CLI 构建成功。前端契约 `21aa3401` 的 [CI 35441068639](https://github.com/yym68686/fugue-web/actions/runs/35441068639) 通过，自动部署 2/2 Ready，公网 200。
- [x] API 2/2；德国 A/277、美国 B/840 的活跃 Worker/Front 镜像和 authority 精确匹配，零重启。两地 Edge Control 保持 `a786d6eb`，Controller 保持 `cf3c54c1`，DNS/SSH 保持 `90240dc3` 且健康。
- [x] 德国等待独立 canary 新鲜证据时保留旧 serving，随后两地均正常完成 Actions 更新、Guardian stable；没有绕过门禁。一次中间库存读取遇到美国 Pod 被更新替换，最终重新取得库存后完整验证通过。
- [x] 三台 Worker 各完成 147 route/146 TLS shadow 验证，两台 DNS 各完成 3 zone/234 回答记录；8 个 required consumer 全部观察到、passing=0。global 配置/LKG 指针与 immutable expected topology 不变。
- [x] 发布后两地 authority 继续增加 sequence 与租期，日志 published=1、failed=0。负向 fact 的实际失败/恢复语义由本地真实 HTTP、持久化、重启、race 回归验证；生产本步保持 awaiting_release，不伪造失败或应用事实。

证据：[edge-negative-serving-facts-2026-09-19.json](verification/edge-negative-serving-facts-2026-09-19.json)。正式 gray/full、初始 positive policy LKG 和旧 artifact 生产回滚仍未完成。

### P0-ED：可信 traffic 执行能力声明

- [x] route/TLS/DNS executor 在 shadow 与 serving 的可信 heartbeat 中声明版本化 `traffic_release_v1`，声明受对应 component/node/kind 身份和 evidence hash 保护。
- [x] 声明覆盖 signed parent/current assignment、持久化恢复、显式回滚；DNS 包含逐值和 proof 到期执行，Edge 包含 Caddy/route/TLS 观察及负向事实。声明不能来自 desired assignment。
- [x] 能力声明不授予 applied/passed 或 LKG；现有 shadow 状态和生产 DNS 租期发布保护保持生效，下一步 admission 必须结合新鲜可信事实和 required topology。
- [x] 回归覆盖三类 shadow/serving 回执、声明篡改拒绝、原有失败恢复行为；race、完整 make test、干净 prepush、前端契约检查通过。
- [x] Actions 更新 API、两地 Worker 与 DNS/SSH 客户端，生产八个 required consumer 的新鲜可信回执均包含能力声明且仍 passing=0，验证真实版本、完整 shadow、旧 serving 和持续续期。

- [x] 后端 `b28219599029a7c3400e1f1fcf26b1764fb471aa` 经 [CI 35442896880](https://github.com/yym68686/fugue/actions/runs/35442896880) 完成 API、两地 Worker 和 DNS/SSH 客户端发布；CLI 成功。前端契约 `e0b70df1` 的 [CI 35442922591](https://github.com/yym68686/fugue-web/actions/runs/35442922591) 成功并自动部署 2/2 Ready，公网 200。
- [x] API 2/2；德国 B/278、美国 A/841，三台活跃 Worker/Front 镜像、source commit、authority 一致且零重启；两台 DNS、三个 SSH 客户端均为本步版本。Controller 保持 `cf3c54c1`，两地 Edge Control 保持 `a786d6eb`。
- [x] route/TLS 各三条、DNS 两条，共八条新鲜且身份验证通过的 consumer fact 全部包含 `traffic_release_v1`；仍为 staged/shadow_validated、passing=0。147 route、146 TLS 与每个 DNS 的 3 zone/234 query records 完整消费，global serving/LKG 指针和 expected topology 不变。
- [x] 两地 authority 序号及有效租期持续推进，Guardian stable，周期发布 failed=0。切换期美国 DNS shadow 曾出现额外探测失败，稳定后两台均为 384/423 ready probes、195/219 ready records、210/234 eligible query records；39 个拒绝分别为 27 个 route digest 失配和 12 个 probe failed，未进入 serving。

证据：[traffic-executor-capability-2026-09-19.json](verification/traffic-executor-capability-2026-09-19.json)。最新只读业务投影与固定 v26 intent 有 13 条 route 的 deployment generation/cache namespace/启用状态不同。正式切流前必须重新捕获并验证 DNS/release target 等价性，并接通业务变更到 intent/artifact 的自动发布链路；不能把能力声明、全部消费者 observed 或旧 serving 健康解释为所有新 DNS 记录已具备 serving 条件。DNS 租期发布保护仍生效。

### P0-EE：事务内的 leased traffic 兼容性 admission

- [x] 将临时“包含 DNS expiration 即拒绝”保护收敛为完整签名 TrafficReleaseSet 的兼容性检查；单独 leased DNS 的 serving 发布与回滚仍拒绝。
- [x] 目标 artifact 必须有完整 parent/route/DNS/TLS 签名、lineage、cohort 和 prepared expected topology；每个目标 required consumer 必须有新鲜、身份验证通过的 `traffic_release_v1` 事实。
- [x] 文件与 PostgreSQL 发布/回滚在同一事务内检查，提交前复核事实新鲜度；scope 锁先于行锁取得，soft override 不可绕过。失败不修改 lane/ledger/LKG。
- [x] 能力允许来自当前不同 generation 的执行器，便于恢复旧 artifact；负向事实可证明执行器支持协议，但不能证明 applied/passed 或 LKG。既有 full 收敛与 verified LKG 门保留。
- [x] 覆盖 route/DNS/TLS 缺失能力、过期或缺失时间、未验证身份、topology 变化、cohort 缺员、单独 DNS、override、回滚、排队期间撤销；文件/真实 PostgreSQL、race、API、完整 make test、干净 prepush 和前端契约检查通过。
- [x] main/Actions 部署 API/Controller 后验证新版本、全体消费者、旧 serving/LKG、持续续期，并在隔离 scope 验证无能力事实的发布仍拒绝；本步骤不发起全局 gray/full 切流。


P0-EE 生产验证（2026-09-19）：

- [x] 后端 `26924da381eada22086e80d782ec71c819d5b115` 经 [CI 35447468034](https://github.com/yym68686/fugue/actions/runs/35447468034) 完成 API/Controller 发布，CLI 构建成功。前端契约 `0c440a36` 的 [CI 35447468710](https://github.com/yym68686/fugue-web/actions/runs/35447468710) 通过，自动部署 2/2 Ready、2 endpoints，无待处理操作，公网 200。
- [x] API/Controller 各 2/2 Ready，四个容器的实际 source commit 精确匹配且零重启；三台活跃 Worker/Front、两台 DNS、三个 SSH 客户端保持 `b2821959`，两地 Edge Control 保持 `a786d6eb`，Guardian 健康。
- [x] 八条新鲜可信事实包含 `traffic_release_v1` 且保持 shadow/passing=0；147 route、146 TLS 和两台 DNS 的 3 zone/234 query records 继续执行。DNS 仍为 384/423 ready probes、195/219 ready records、210/234 eligible records，旧快照失配没有被能力声明掩盖。global serving/LKG 与 expected topology 不变，两地 authority 序号和有效租期推进。
- [x] 生产隔离 scope 编译带 ACME expiration 的完整签名 ReleaseSet 并准备 8 个消费者；缺少该 scope 的能力事实时，gray 发布、gray 回滚均为 409，单独 leased DNS 发布仍为 409。发布状态与五份 LKG 引用不变，全局配置和健康不受影响。成功 admission、负向能力事实和并发撤销由文件/真实 PostgreSQL 回归验证，本步未执行全局切流。

证据：[leased-traffic-admission-2026-09-19.json](verification/leased-traffic-admission-2026-09-19.json)。目标 topology 来自该 parent 已准备的最新各成员声明；能力事实可以来自同一节点当前运行的其他 generation。实际 serving assignment 和 applied/passed/LKG 仍要求新发布的精确 release、fence、topology 与新鲜证据。下一步优先接通业务变更到 intent/artifact 的自动编译发布，之后再刷新生产输入并验证真实 gray/full/rollback。


### P0-EF：共享业务捕获与编译持久化流程

- [x] 业务快照捕获使用 context/principal 接口，HTTP handler 与未来后台 producer 可直接调用同一流程；保留一次业务快照、运行观察原始时间和迁移问题。
- [x] 合并 inline compile 与 artifact replay 的重复持久化流程；保留签名、lineage、原输入作者、完整 parent 引用校验及原有 API 行为。
- [x] 开始前已取消时不写入；执行中取消在下一检查边界停止，部分 immutable 写入重试复用原 identity，重放保留原 intent/policy 引用，编译过程不修改 release lane 和 LKG。
- [x] 直接调用回归、既有 API 回归、race、完整 make test、干净 prepush 通过；main/Actions 更新 API 后检查捕获、固定输入重放和全体生产消费者。
- [x] 保存生产证据并勾选。本步提供后台自动发布要复用的内部入口；自动调度、版本化输入选择和实际发布推进仍须后续实现。


P0-EF 生产验证（2026-09-19）：

- [x] 后端 `08ae59b9227e444bbae6c8c26054ad21b61de96e` 经 [CI 35449822867](https://github.com/yym68686/fugue/actions/runs/35449822867) 仅更新 API，CLI 构建成功。完整 make test、关键 API race 与干净检出 prepush（129 秒）通过；接口和生成契约没有变化。
- [x] API 2/2 Ready；Controller 保持 `26924da3` 且 2/2 Ready，四个控制面 Pod 的实际 source commit 与容器状态匹配、零重启。Worker/Front/DNS/SSH 保持 `b2821959`，Edge Control 保持 `a786d6eb`，八个 required consumer 持续可信 shadow 报告，passing=0，现有 serving 正常。
- [x] 生产共享捕获返回 147 route、明确的业务 snapshot revision/time 和两项未完成的输出等价性问题。以保存的 v26 固定输入分别调用 inline compile 与 compile-from-artifacts，六个 artifact 的 ID、generation、内容、digest、metadata、签名和原作者全部一致，父子 lineage 一致，global serving/LKG 与 expected topology 不变。
- [x] 两地 authority 的序号和未来租期持续推进，公网 200。固定 shadow 输入已有 15 条 route 的 deployment generation/cache namespace 与最新业务不同，其中 4 条启用状态变化；两台 DNS 分别拒绝 29 个 digest 失配和 12 个 probe failure。本步没有将旧快照声明为可切流，也没有启用自动调度。

证据：[shared-platform-producer-2026-09-19.json](verification/shared-platform-producer-2026-09-19.json)。下一步应将这些共享入口接入受版本化 intent/policy 控制的后台协调流程，实际完成变更捕获、输入选择、幂等编译和 shadow 发布；复用现有 release ledger、锁和恢复引用，不新增一套发布状态机。正式 gray/full/rollback 及旧来源删除仍未完成。


### P0-EG：版本化策略控制的后台 shadow 发布

- [x] 用现有 `policy_snapshot`、shadow lane 和签名控制 `platform-config-producer`；强类型策略只允许 paused/shadow、business-migration/global 和有界周期，禁止任意动作与 gray/full 控制。
- [x] API 副本通过现有 advisory lock 选出发布者；实际捕获业务变化、编译、保存和发布 shadow，准备最新 consumer topology。输入未变时复用当前 producer 发布，按策略期限刷新运行快照，重启后仍能复用和完成中断的准备。
- [x] 文件/真实 PostgreSQL 的提交边界重新检查当前策略、fence/frozen、目标前驱、三个签名成员和 lineage；计算期间暂停、冻结或手动发布不能被旧任务覆盖，失败不修改 serving/LKG。
- [x] 编译器返回精确规范化运行快照并保存在现有内容存储；新增受 artifact.read 保护的 compiler-input 查询，验证 digest/generation。管理员可用保存的 intent/policy/input 重放，保留首次作者和 producer 来源，缺失或损坏时禁止从 live 数据补齐。
- [x] 完成类型边界、业务变化/重启/重复执行、失败/取消/并发撤销、快照持久化和重放测试，真实 PostgreSQL/race、完整 make test、干净 prepush、前端契约检查通过。
- [x] main/Actions 部署后先验证旧配置不变，再通过正常 artifact API 启用、暂停与恢复策略；验证自动 shadow、八个消费者、代码版本、旧 serving/LKG、持续续期及真实固定输入重放，保存证据后勾选。

本步是现有业务/迁移输入的自动写入阶段。它不声明 legacy serving 输入已删除，也不自动推进 gray/full 或 verified LKG；后续仍需完成独立 intent/policy 输入、输出等价性与真实切流恢复。


P0-EG 生产验证（2026-09-20）：

- [x] 后端 `85303876dcde627d28788821f1c7d5748c242074` 经 [CI 35454496419](https://github.com/yym68686/fugue/actions/runs/35454496419) 第 2 次执行成功完成 API/Controller 部署，CLI 成功。首次 API 镜像 registry manifest 返回 404，缺少有效回执导致部署在写入前停止；同一 Actions 重试通过原有完整校验，没有降低门槛。前端契约 `f3f78ec7` 的 [CI 35454496622](https://github.com/yym68686/fugue-web/actions/runs/35454496622) 通过并自动部署 2/2 Ready，公网 200。
- [x] 新代码且没有 producer policy 时保留原 fence 9；发布 paused 策略并跨过后台检查周期后仍不变。启用 shadow 策略后自动发布 fence 10，捕获 148 route/230 DNS/147 TLS，并准备 8 个 required consumer。一次 DNS 迁移来源短暂不可用保留旧版本，下一周期恢复发布。
- [x] 暂停策略后跨多个周期保留 fence 10。通过 compiler-input 读取保存的规范化运行快照，管理员使用 inline 与 stored-artifact 两个编译入口重放，六份 artifact 的 ID、generation、完整内容、digest、metadata、签名和原作者全部一致，serving/LKG 不变。
- [x] 通过普通 policy rollback 恢复原 enabled artifact，新策略 fence 4 授权后台自动产生 traffic shadow fence 11；后续周期日志 unchanged，复用同一发布。全程只有一个 API 副本写入，八个消费者均有新鲜可信 shadow 事实，passing=0。
- [x] 两次自动候选均验证三台 Worker 的 148 条 route 和 147 TLS；两台 DNS 均有 3 个 zone、426/426 readiness probes、218/218 records 和 233/233 eligible query records。活跃 Worker/Front/DNS/SSH、控制面实际版本和容器健康正常；两地 authority 序号/有效租期继续推进，global serving/LKG 未改变。

证据：[platform-shadow-producer-2026-09-20.json](verification/platform-shadow-producer-2026-09-20.json)。producer 保持 shadow 启用；production 使用 PostgreSQL。另发现文件存储的 advisory lock 原先没有按名称隔离，长期 leader 会阻塞其他 writer，下一原子步骤修复该通用行为。

### P0-EH：文件存储后台任务锁隔离

- [x] 文件存储按 lock name 互斥，同名 producer 排他、不同名 writer 独立；退出/错误释放锁，取消上下文不启动任务。
- [x] 验证实际后台 producer 获得/释放领导权、取消退出及无关 writer 继续运行；race、完整测试、prepush 后经 main/Actions 发布，检查启用中的自动 shadow 和旧 serving。
- [x] 保存生产证据并勾选。


P0-EH 生产验证（2026-09-20）：

- [x] 后端 `542fd6c5a8fd4f1e3921f31cbf514a7eae0b3b53` 经 [CI 35456481744](https://github.com/yym68686/fugue/actions/runs/35456481744) 完成 API/Controller 发布，CLI 构建通过。完整 make test、race、命名锁回归和干净 prepush（143 秒）通过；前端 `1b5e67e5` 的 [CI 35456254831](https://github.com/yym68686/fugue/actions/runs/35456254831) 通过并完成 2/2 Ready、2 endpoints、公网 200。
- [x] 新 API 两个副本实际运行 `542fd6c5`，一个副本取得 producer 领导权，另一个没有重复写入；日志显示领导权获取和 unchanged 复用。不同名称的文件锁可同时进入，无关 writer 不被长期 producer 锁阻塞；取消后台 producer 后锁释放由真实测试证明。
- [x] producer 策略保持 shadow，自动 shadow 当前为 `artifact_1789837433_3fe06cb430a2`、release `artifactrel_1789837433_d83c90c59608`、fence 16；3 Worker、2 DNS、3 Front 动态检查通过，8/8 consumer observed、passing=0，148 route、147 TLS、230 DNS records 保持 shadow，serving/LKG 不变。
- [x] 两台 DNS 的最新候选持续执行 426/426 readiness probes、218/218 records、233/233 eligible query records；两地 authority 序号和租期继续推进。代码发布失败保护、业务 readiness 失败保留旧 shadow、producer unchanged 重用和文件锁隔离均已验证。

证据：[named-file-locks-2026-09-20.json](verification/named-file-locks-2026-09-20.json)。


### P0-EI：producer 静态输入绑定签名 PlatformIntent

- [x] producer 策略支持 business-static-intent，必须固定 static intent 的 exact ID/content hash；现有 business-migration 保留为迁移兼容入口，显式引用失效时不得回退环境。
- [x] 同一业务捕获流程显式传递静态 route/DNS 输入，不改共享 Server 字段；启用新模式后这两项输入不再读取 `FUGUE_PLATFORM_ROUTES_JSON`、`FUGUE_DNS_STATIC_RECORDS_JSON`，App/Domain 变更继续投影。
- [x] 保留静态禁用状态、DNS 值到期和原有覆盖/排除语义；不支持的动态/路径/cache/TLS 字段明确拒绝。固定输入的签名、scope、generation 和 digest 在读取及发布事务内重验。
- [x] 签名 parent 和保留的 runtime snapshot 均记录基础 intent ID/digest；切换引用产生新 shadow，管理员固定输入重放保留来源和原作者。
- [x] 文件/真实 PostgreSQL 的并发失效、篡改/错误 digest、来源混用拒绝，以及 ambient 环境变化隔离、导入等价性、版本切换与重放测试通过；完整测试、race、prepush、前端契约检查通过。
- [x] main/Actions 部署后通过正常 importer 保存生产的 2 条平台 route、13 条静态 DNS，比较显式投影再启用策略，验证自动 shadow、消费者、重放和旧 serving/LKG，保存证据后勾选。

本步只迁移 producer 的两项静态输入；DNS authority、默认值、selection policy 和 legacy serving 路径的迁移仍须完成。


P0-EI 生产验证（2026-09-20）：

- [x] 后端 `a6371ccfe0731cbfc2b97a57e767d8039750d6f9` 经 [CI 35458484071](https://github.com/yym68686/fugue/actions/runs/35458484071) 完成 API/Controller 部署，CLI 成功。完整 make test、文件/真实 PostgreSQL race、导入等价性和干净 prepush（127 秒）通过；前端契约 `ac1ace51` 的 [CI 35458484629](https://github.com/yym68686/fugue-web/actions/runs/35458484629) 通过并自动部署 2/2 Ready、2 endpoints、公网 200。
- [x] 正常 importer 保存静态 intent `artifact_1789839892_b3ca868a5aad`，content hash `sha256:e44c5337791a7e38ffc9dd43a6b5262e1bd82f402099bf5c574f5fbe8716f10b`，包含 2 route/13 DNS，并保存 env source digest、时间和操作者。第一次生产比较中显式输入与旧路径的完整 desired intent、policy、DNS exclusions 一致，均为 151 route。
- [x] 新 producer policy `artifact_1789840050_cacf678b9f17`/release `artifactrel_1789840051_79f1a6bf97d5` 固定上述 ID/hash；后台自动发布 shadow fence 28 的 `artifact_1789840168_ff23a96cb992`，parent 和 runtime snapshot 均携带静态引用。基础 intent 的完整内容、metadata、签名和作者未变，错误 ID/generation 别名明确拒绝。
- [x] 管理员用保存的输入经 inline 和 stored-artifact 两种入口重放，六份 artifact 完全复用原 ID、generation、内容、digest、签名、metadata 和作者，global serving/LKG 不变。三台 Worker 的 151 route/150 TLS、两台 DNS 的 3 zone/239 query records 完整检查通过；八个可信 consumer observed，passing=0。
- [x] DNS 详细观察为 432/435 ready probes、222/224 readiness records、237/239 eligible query records，3 个 route digest 失配均拒绝。迁移期间旧 DNS 来源短暂不可用会保留旧 shadow，随后新静态来源发布成功；后续业务变化已自动生成 fence 29，仍绑定同一静态 intent，八个消费者继续上报。两地 authority 序号/租期推进，公网 200。

证据：[static-producer-intent-2026-09-20.json](verification/static-producer-intent-2026-09-20.json)。静态来源环境隔离由改变 ambient 配置的回归验证，生产通过 importer、完整 desired 等价性、签名引用、重放与自动更新验证；未通过改坏生产环境来测试。当前残留的 DNS 迁移来源依赖是下一阶段的具体目标。


### P0-EJ：producer DNS 声明与执行策略脱离 workload 环境

- [x] 基础 PlatformIntent 保存 DNS consumer 身份、group、基础 zone 和 probe 参数；producer 固定另一份签名 PolicySnapshot 的 exact ID/hash，提供完整 NS/SOA、客户端规则、route/TLS 探测参数和 rollout cohorts。
- [x] 显式输入模式不再读取 DNS DaemonSet 环境；运行库存只提供已声明身份的 endpoint facts，缺失/冲突拒绝。历史 zone 心跳不能重新创建已删除的 desired zone。
- [x] producer 策略中的 hosted_zone_templates 明确指定每个消费者的基础 authority 模板，保持新增 hosted zone 自动投影、删除/暂停退出的语义；空模板只保留显式基础 zone。
- [x] 完整 producer policy 可只读预览；读取及文件/PG 发布事务重验两个来源签名、digest、scope、validation 和完整所有权，失效不回退旧环境。parent 和运行快照保留 DNS 来源，重放不改变来源/作者。
- [x] 覆盖迁移等价性、runtime 地址与 intent 分离、旧别名、模板增删、探测参数保持、遗漏/错误引用、篡改/排队失效和精确重放；race、真实 PostgreSQL、完整测试、prepush、前端契约检查通过。
- [x] main/Actions 部署后一次性保存生产 DNS 配置、比较完整 desired 输出、启用新引用，验证自动 shadow 与全体消费者、固定输入重放、持续续期及 serving/LKG 不变，保存证据后勾选。

本步尚未迁移 base-domain/应用默认值与 DNS query selection 来源，不表示正式 gray/full 切流完成。


P0-EJ 生产验证（2026-09-20）：

- [x] 后端 `9584db4000ac1ab7338aff50cf90449dcdf1239b` 经 [CI 35460954343](https://github.com/yym68686/fugue/actions/runs/35460954343) 完成 API/Controller 发布，CLI 成功；完整 make test、API/文件/真实 PostgreSQL race、干净 prepush（136 秒）通过。前端契约 `ebe8742d` 的 [CI 35460955226](https://github.com/yym68686/fugue-web/actions/runs/35460955226) 通过并自动部署 2/2 Ready、2 endpoints、公网 200。
- [x] 先验证新代码保持旧配置，再从明确的 workload 声明一次性保存两地基础 zone（fugue.pro/i00.pro/oaix.cc）、2 个 consumer、6 份 NS/SOA authority、2 份客户端策略、DNS/TLS 探测参数与三个 cohort。新引用保持未激活时，只读完整 producer preview 第一次比较即证明 intent/policy/DNS exclusions 与旧路径一致（151 route）。
- [x] producer policy `artifact_1789842730_23e80fe8b01f` 的 source release `artifactrel_1789842886_452603416a35`（policy fence 6）固定新的基础 intent/DNS policy ID 和 hash，并为每个节点显式指定 fugue.pro authority 作为 hosted-zone 模板。正常发布后后台自动生成 traffic shadow fence 35，后续 unchanged 复用同一发布。
- [x] 两个来源的完整内容、digest、metadata、签名和作者保持不变；编译结果的 consumer、authority、客户端规则、探测参数和 cohort 与输入精确一致。错误 ID、generation 别名及互斥 preview 参数均拒绝。保存的 runtime snapshot 和签名 parent 都携带两份来源引用；管理员 inline/stored 两种重放均复用六个 immutable artifact。
- [x] 新 API/Controller 各 2/2 Ready；三台 Worker 的 151 route/150 TLS、两台 DNS 的 3 zone/239 query records 完整验证通过。两台均为 435/435 ready probes、224/224 readiness records、239/239 eligible records，八个可信消费者 observed、passing=0。active Worker/Front/DNS/SSH 镜像与容器健康正常，authority 租期有效且相对发布前推进，global serving/LKG 不变。

证据：[pinned-dns-inputs-2026-09-20.json](verification/pinned-dns-inputs-2026-09-20.json)。hosted-zone 增删、历史别名、地址变化和声明缺失的边界由明确回归验证；生产本步保持原 zone/authority 行为。下一步继续移除 base-domain/默认值及 legacy query selection 来源，不将本次 shadow 成功记为正式切流完成。


### P0-EK：producer 应用域名声明脱离进程配置

- [x] 基础 PlatformIntent 保存 application_domains：应用域名范围、自定义域名 target 范围、保留主机名与默认 DNS TTL；严格校验完整字段、规范域名、重复声明和 TTL 范围，摘要覆盖声明。
- [x] producer 的应用路由、项目路径路由、平台域名 DNS、应用默认 DNS 与共享自定义域名 target 使用同一显式声明；旧兼容入口复用相同函数，producer 不读取 ambient namespace 配置。
- [x] require_application_domains 在捕获和文件/PG 发布事务中要求来源声明存在；缺失、无效、失效来源均拒绝，不回退环境。一次性 importer 保存有效配置与 source digest，保留基础 intent 的原 DNS consumers 和静态数据。
- [x] 签名 TTL 按声明生效，旧 60–120 秒截取仅留在迁移适配器；默认值不再在新路径被静默覆盖。原始已存在业务 hostname 不被域名声明重命名。
- [x] 完整本地测试、环境隔离/等价性、必需字段、真实 PostgreSQL 事务和 race、干净 prepush、前端契约检查通过。
- [x] main/Actions 发布后对比完整 desired 输出，正常 API 保存并启用新签名来源，验证自动 shadow、来源 lineage 与固定输入重放、真实消费者、持续租期及 serving/LKG，保存证据后勾选。

本步骤覆盖 producer 的应用域名投影来源；业务创建 API 的默认域名、路由健康阈值、DNS query selection 以及最终 gray/full/rollback、旧路径删除仍分别待完成，不把 shadow 当作实际 serving 验收。


P0-EK 生产验证（2026-09-20）：

- [x] 后端 `af35d3a85b3979f0bb4781d280a72a34e4892f55` 经 [CI 35463459889](https://github.com/yym68686/fugue/actions/runs/35463459889) 完成 API/Controller 更新，CLI 成功；完整 make test、专项 race、真实 PostgreSQL 和 137 秒干净 prepush 通过。前端契约 `38d222b8` 的 [CI 35463467342](https://github.com/yym68686/fugue-web/actions/runs/35463467342) 成功并自动部署为 2/2 Ready、2 endpoints、公网 200。
- [x] 新代码保持原 producer 来源时完整验证通过，再从 importer 预览取得有效声明：app base `fugue.pro`、custom target base `dns.fugue.pro`、保留 `api.fugue.pro` / `registry.fugue.internal`、默认 TTL 60。复制现有基础 intent 后原静态路由、DNS records 和 consumer 声明完全保留；新旧 producer preview 的完整 intent/policy/DNS exclusions 第一次比较一致，共 151 routes。
- [x] 新基础 intent `artifact_1789848966_aa79d274ac50`（hash `sha256:600a016b39260fd64d8d8ef9dcb5027cd88c3c1872396fda982ae760489d2d92`）由 producer policy `artifact_1789848968_c42d6ed6d2be` 固定；正常 policy release `artifactrel_1789849201_fc85391dc4cf`、fence 7 启用必需域名声明，原 DNS policy 引用和 hosted-zone 模板不变。
- [x] 自动生成并验证 traffic shadow `artifact_1789850444_a447c6de4fa7`、fence 53，包含 151 routes、236 DNS records、150 TLS references。两台 DNS 均为 435/435 readiness probes、224/224 readiness records、239/239 eligible query records、3 zones；八个消费者 trusted observed，passing=0，保持正确的 shadow 语义。
- [x] 来源完整性、签名、作者、metadata 与 digest 不变；保留的 compiler input、inline 和 stored 两种 replay 复用六个 artifact，lineage 为 compiler v27，重放不改变配置指针。旧 intent/新 policy 内容均保持不可变，缺失及 generation 别名拒绝。
- [x] 新 API/Controller 各 2/2 Ready；Worker/Front/DNS/SSH 健康，global serving/LKG 不变，两地 authority 序号和租期推进。扩大只读日志窗口后确认新 API 仅一个 producer leader，持续 published/unchanged，之后自动推进到 fence 55，仍绑定同一新来源。

证据：[application-domain-intent-2026-09-20.json](verification/application-domain-intent-2026-09-20.json)。验证时发生的两次 release/heartbeat 不一致来自自动 shadow 更新，重新采集当前 release 后按原门槛通过；未放宽 consumer 验证。环境隔离、TTL 可修改、缺失声明及事务拒绝由回归测试验证，生产保持原域名和 TTL 行为。


### P0-EL：producer 路由默认约束固定到签名 PolicySnapshot

- [x] 复用现有 pinned policy 引用，扩展完整四字段组：minimum_healthy_edges、max_stale_seconds、route_constraints、dns_route_state_constraints；不增加 artifact 引用、独立配置源或发布状态机。
- [x] 显式来源不再注入代码中的每类路由健康数与不活跃 DNS 默认行为；全局健康数、每主机例外和 DNS 行为由输入声明，业务显式路由策略优先。新增主机遵守已声明全局值，不隐式继承路由 kind 的代码例外。
- [x] require_route_defaults 同时保护捕获与文件/PG 发布事务；四字段必须完整，空数组明确表示没有例外，null/部分字段/非法范围拒绝，引用不存在的主机也拒绝。
- [x] 回归证明同一 intent 下仅 policy 变化即可改变实际编译投影、事实新鲜度和 DNS inactive 行为；覆盖迁移等价、显式策略优先、租户隔离、不可变来源重放与事务拒绝，完整/race/真实 PostgreSQL/prepush/前端契约通过。
- [x] 代码 main/Actions 上线后先验证旧配置健康，保存当前默认约束的新签名输入，比较完整 desired 等价后正常激活；验证自动 shadow、来源 lineage、六 artifact 重放、实际消费者、续期和 serving/LKG 不变并保存证据。

本步骤只迁移上述默认约束。业务创建 API 默认域名、默认路由 enable/route-policy、DNS query selection 及其他仍在兼容适配器中的参数继续待迁移；正式 gray/full/rollback 与旧路径删除也尚未完成。


P0-EL 生产验证（2026-09-20）：

- [x] 后端 `a07807922e616ab173930d4d5c4767553d108ca4` 经 [CI 35475435925](https://github.com/yym68686/fugue/actions/runs/35475435925) 完成 API/Controller 发布，CLI 成功；完整 make test、专项 race、真实 PostgreSQL 事务回归和 138 秒干净 prepush 通过。前端契约 `67bb2021` 的 [CI 35475593139](https://github.com/yym68686/fugue-web/actions/runs/35475593139) 成功并确认 2/2 Ready、2 endpoints、公网 200。
- [x] 新代码先保持旧来源完成全部生产检查，再一次性把现有 global minimum=1、max stale=86400、api 主机 minimum=2 的例外与 custom-domain-target 的 serve_error_page 保存到新签名 PolicySnapshot。新旧完整 intent/policy/DNS exclusions 首次比较一致，共 151 routes；原静态 intent、域名声明、DNS authority/client/probe/cohort 全部保留。
- [x] 输入 policy `artifact_1789861465_909b18347c81`（hash `sha256:c8ae5f2ba2dba5363b344d4d40efd19a790455fc7ef8686d251970b728581a9a`）由 producer policy `artifact_1789861466_53baf5b54928` 精确固定；正常 release `artifactrel_1789861618_0cae6a778603`、policy fence 8 启用必需 route defaults。
- [x] 首轮捕获因 DNS placement 缺少 route/TLS-ready 证据拒绝并保留旧 shadow；随后下一轮自动生成并验证 `artifact_1789861780_6d3e657ca8c7`、traffic shadow fence 78。完整内容为 151 routes、236 DNS records、150 TLS；两台 DNS 都是 435/435 probes、224/224 readiness records、239/239 eligible query records、3 zones。八个可信消费者 observed、passing=0。
- [x] 生产编译 policy 与签名输入四字段及原 DNS 配置一致；前后 policy、静态 intent 的内容/摘要/签名/作者均不变。固定 runtime input 的 inline/stored 重放复用六个 immutable artifact，未改变配置指针；无效 exact reference 拒绝。
- [x] API/Controller 各 2/2 Ready、真实镜像匹配；Worker/Front/DNS/SSH 正常，两地 authority 持续续期，global serving/LKG 不变。单一 producer leader 后续持续 published/unchanged；没有用 shadow 结果替代 actual apply/probe convergence。

证据：[pinned-route-defaults-2026-09-20.json](verification/pinned-route-defaults-2026-09-20.json)。不同阈值、新鲜度和 DNS inactive 行为由完整编译回归验证，生产迁移保持现有数值；后续策略可通过新 generation 和正常发布独立修订。


### P0-EM：DNS 查询从固定 intent、查询策略与独立运行事实生成

- [x] 扩展强类型 dns_query_policy，固定 ranking mode、runtime-locality 选择、ECS、探索比例、冷却时间与 TTL 范围；严格要求完整字段，沿用原签名 projection policy 引用。
- [x] producer 显式查询路径不读取旧 DNS bundle；只使用冻结的 route/DNS intent、policy、声明消费者，以及 Edge 库存/独立排名观察。生成 per-consumer/per-record 查询投影和独立事实，保留原始观测时间/内容摘要。
- [x] 新增/删除/嵌套 zone 和共享 target 由声明展开；保留地址/租户/路径所有权、显式 exclusions、原选择器与共享 target 排序语义。无效输入拒绝整个候选，不回退旧 bundle。
- [x] required query policy 在捕获与文件/PG 发布事务重验；策略修订按原始 switched_at 计算冷却时间，不受旧进程默认值覆盖。独立 route/TLS readiness 仍是 DNS apply 的必要条件。
- [x] 覆盖固定事实下旧/新语义比较、新域名增删、策略生效、无旧 bundle、冲突拒绝、完整编译/固定输入重放和 readiness 拒绝；完整/race/真实 PostgreSQL/prepush/前端契约通过。
- [x] 代码 Actions 上线后验证原配置健康；保存未激活查询策略，比较真实完整输出并处理差异；正常激活后验证新来源、全部消费者、精确重放、持续续期及 serving/LKG，附生产证据后勾选。

本步骤先移除 producer 查询对旧 DNS 发布物的依赖；排名采样、打分和默认业务策略仍有后续迁移项。正式 gray/full、verified traffic LKG、回滚与旧 serving 路径删除未因此自动完成。


P0-EM 迁移中发现并已修复的恢复阻塞：

- [x] 修复单一 DNS target 提前过滤 preferred group 的兼容差异；只有多来源共享 target 执行交集约束。
- [x] 平台自有 apex 不作为外部自定义域名覆盖默认 target；保持 target 的实际路由与排名来源。
- [x] DNS 捕获错误保留 hostname/release 证据上下文，避免所有失败都退化成来源不可用。
- [x] stable release 初始化保存 canonical Deployment/Service 身份；历史隐式 canonical 引用只能在同一 tenant/app/runtime/image 和精确 service URL 下解析，并继续验证真实当前 Deployment 代次、镜像和 endpoint。缺失证据保留旧 artifact，不将 ready 状态标签当作 serving 事实。

一次新增的 implicit stable release 暴露了“应用正常，但 release 身份无法观察，从而阻止整个配置编译”的真实缺口；修复与新 DNS 来源现已分别通过生产验收。


P0-EM 消费者兼容与共享 target 确定性：

- [x] 两地 Edge Worker、DNS/SSH 客户端在激活新 policy 前升级，严格 schema 能识别 dns_query_policy；新旧 artifact 的消费者回归均通过，真实 serving/LKG 不受代码更新影响。
- [x] 共享 target 在流量类别和模式同优先级时先比较稳定路由偏好，再比较排名内容；不再通过包含 readiness/heartbeat generation 的整条记录哈希选择不同 policy。独立路线和旧兼容路线复用同一决胜函数。

持续业务部署和排名变化导致不同采集时点不能直接当作同一 runtime snapshot；仍需完整固定输入回归、真实候选 apply/probe 和具体差异检查，不通过放宽签名、所有权或 readiness 门来满足比较。


P0-EM 已完成的故障修复证据：`c116c486`（[CI 35491304236](https://github.com/yym68686/fugue/actions/runs/35491304236)）修复单目标偏好与平台 apex 所有权；`3606c3e4`（[CI 35506949728](https://github.com/yym68686/fugue/actions/runs/35506949728)）保留精确失败上下文；`4bbefb1f`（[CI 35508366498](https://github.com/yym68686/fugue/actions/runs/35508366498)）恢复隐式 stable release 的真实身份观察。后者生产验证确认原历史 release 完整内容不变，未填写的名称仍为空，但真实镜像/runtime/Deployment 代次/端点匹配后已有正确 serving_release_id；独立 endpoint 缺失仍由回归拒绝。producer 随后从 fence 163 恢复生成新 shadow，未更改 serving/LKG。

这些修复已上生产；独立 DNS 来源、消费者兼容与共享 target 比较的最终验收见下方。


P0-EM 生产验证（2026-09-20）：

- [x] 最终成员排序修复 `4574e3e8` 经 [CI 35511984077](https://github.com/yym68686/fugue/actions/runs/35511984077) 发布；先按每个来源选择共享 target 排名，再执行地址交集，保留原 traffic-class 语义。消费者兼容与稳定决胜修复 `2517d586` 经 [CI 35509675425](https://github.com/yym68686/fugue/actions/runs/35509675425) 部署到两地 Worker、DNS/SSH。完整 make test、专项 race、文件/真实 PostgreSQL、固定输入与干净 prepush 通过。
- [x] 同时点旧/新只读投影的完整 intent、非 query policy、DNS exclusions 与 464 条 query rules 完全一致；前一轮有 4 条排名观察变化，保留原比较门槛，重新成对捕获后全部一致。单一 target 偏好、共享 target 顺序、apex 所有权及历史 stable 身份缺口均有独立回归。
- [x] 输入 policy `artifact_1789878236_47513717480a`、hash `sha256:351c731967a3d1289cd60935868001faf0946899cb6e73053b685c20e64df375` 保存 active ranking、runtime locality、ECS、5% exploration、1800 秒 cooldown、60–120 秒 TTL，保留所有已有策略字段及静态来源。正常发布启用新 producer policy `artifact_1789910205_9d856f3b606d`、release `artifactrel_1789910207_dbda531d2df4`。
- [x] 为稳定检查暂时发布 paused 策略后，较早创建的草稿被 generation 单调保护以 409 拒绝；创建内容与引用完全相同的新 generation 后正常启用，未绕过版本保护，最终 producer 为 shadow。后台自动生成 fence 180，159 routes/244 DNS/158 TLS，全体八个可信 consumer observed，passing=0。
- [x] 三台 Worker 各完成 159 条隔离 route probe 与 158 TLS reference 验证；两台 DNS 各有 459/459 readiness probes、232/232 readiness records、247/247 eligible queries 和 3 个 zone。实际持久化 candidate、签名 binding、fence、expected set、Front/Worker authority 与客户端镜像均匹配。
- [x] parent、runtime snapshot 与六个 immutable artifact 的来源完整；查询 facts 使用独立 `dns-observation_` generation，无旧 bundle 来源。inline/stored 两种重放精确复用 ID、内容、digest、metadata、签名和原作者，重放期间配置指针不变；无效 exact reference 拒绝。
- [x] 并行正常发布将 API 更新为包含上述修复的 `5431a9b1`，[CI 35512636505](https://github.com/yym68686/fugue/actions/runs/35512636505) 成功；按实际版本重新完成生产验证。API/Controller 各 2/2 Ready，单一 producer leader，两地 authority 持续续期，global serving/LKG 不变。前端契约 `5edd24eb` 已通过 [CI 35510343530](https://github.com/yym68686/fugue-web/actions/runs/35510343530)，实际 2/2 Ready、2 endpoints、无待处理操作、公网 200。

证据：[direct-dns-selection-2026-09-20.json](verification/direct-dns-selection-2026-09-20.json)、[canonical-release-identity-2026-09-20.json](verification/canonical-release-identity-2026-09-20.json)。本步完成独立查询来源迁移，不代表真实 gray/full 或 positive LKG 已完成。


### P0-EN：解除 DNS 编译与新路由 serving 的循环依赖

代码核对确认：现有 placement 捕获要求每条新 route 的当前公网 proof digest 已匹配，compiler 随后才生成包含该 route 的 ReleaseSet。旧业务 serving 路径停用后，新增/修改路由会因此无法生成自己的发布物；placement 的短时事实仍阻塞新候选生成。现有 query view 已分离动态 readiness 与内容到期，本步应复用这条执行链，解除编译前置循环，不再建立另一套 readiness 或续期机制。

- [x] 使用冻结的声明、端点库存和签名约束生成候选，不要求新 route 已在公网 serving；新建及变更 route 均有无旧 serving 来源的回归。
- [x] 候选 DNS 地址必须绑定同一 parent 的 route/TLS readiness plan；下载、schema 或 shadow 通过不授予回答资格。
- [x] DNS 实际回答继续要求新鲜、精确 identity/digest/fence 的 route/TLS proof，缺少证明、旧 parent、重启或证据过期均拒绝；已有 positive LKG 按原规则恢复。
- [x] 分离可持续重新探测的运行事实与内容本身的到期；ACME/flatten 等真实内容租期不可被新心跳续期。
- [x] 编译与消费者完整测试、race、真实 PostgreSQL/契约及 prepush 通过；分原子提交 main/Actions，先兼容消费者再启用新语义，逐步验证生产。
- [x] 正常策略发布后验证自动候选、全部消费者、固定输入重放、持续恢复能力与旧 serving/LKG，附证据后勾选。正式持续 promotion、gray/full 与 rollback 仍是后续独立验收。


P0-EM 后续运行异常：候选拒绝不得否定已验证 serving LKG（2026-09-20）：

本步验收与文档 `571e97a8` 已部署后，美国 Worker 拒绝一个可路由数量从 95 降到 32 的候选，仍保留有效的旧 Caddy bundle；但 inventory 将配置同步的 stale 状态当成 serving unhealthy。两台 Worker 同时报告负向状态，Group Authority 因 `no_healthy_active_instances` 无法继续生成恢复候选。实时应用检查随后确认镜像、端点、serving release 正常；这不能自动修复上述反馈循环。

- [x] 仅在旧 group LKG 未到期、Caddy 已应用相同 bundle、generation 与 LKG 一致且无 failure/drain 时，继续报告真实 serving 健康；保留更新失败与 stale 诊断。
- [x] 过期、缺失 lease、未应用、候选未激活、LKG 身份不符、signature/Caddy 错误和 draining 均不得借此声明健康。原发布 fence、签名及灾难性路由丢失保护保持生效。
- [x] 使用真实签名下载、Caddy apply、坏候选拒绝与磁盘恢复测试，配合边界回归、race、完整 make test 和干净 prepush。
- [x] `5f808282` 经 main/Actions 更新两地 Worker 后，验证 authority 恢复、续期、完整 DNS/route/TLS shadow、producer 自动推进和 serving/LKG，保存证据后勾选。

生产证据：[serving-lkg-inventory-recovery-2026-09-20.json](verification/serving-lkg-inventory-recovery-2026-09-20.json)。部署后德国 authority 已切到 `5f808282`；美国随后在新版本发布前已通过精确旧 LKG 到期恢复恢复健康，之后新 Worker 发布完成。最终两地均 ready，shadow fence 183 的 159 route/243 DNS/158 TLS 被 8 个可信消费者观察，passing=0。此次记录区分了代码修复和既有到期恢复，未把后者归因于新代码。


P0-EN 生产验证（2026-09-20）：

- [x] `f3f14685` 经 [CI 35518951402](https://github.com/yym68686/fugue/actions/runs/35518951402) 完成 API、Controller、两地 Worker 和 DNS/SSH 六个组件部署，CLI 成功。完整 make test、关键路径 race、临时 PostgreSQL 发布/回滚/并发撤销与 producer guard、134 秒干净 prepush 通过。前端 `ce66bdd5` 的 [CI 35518964573](https://github.com/yym68686/fugue-web/actions/runs/35518964573) 及实际部署通过，2/2 Ready、2 endpoints、无待处理操作、公网 200。
- [x] 强类型 `dns_placement_mode` 默认保留 captured_readiness；consumer_readiness 要求完整的 query、authority、client、cohort 和 DNS/TLS readiness policy，拒绝混用旧 placement facts。编译复用冻结 endpoint 与同一 route proof plan；实际查询、checkpoint、重启和失败候选测试均验证新鲜精确 proof 门仍生效。ACME/flatten 的内容到期不被新心跳续期。没有新增发布服务、第二套 readiness 或独立 LKG 状态机。
- [x] 先检查新旧消费者并存和全部升级后的原配置，再保存未激活输入 policy。相同业务 snapshot revision 下第一次完整比较即通过：159 routes、462 query rules、完整 intent、其他 policy 与 DNS exclusions 相同；新模式 placement facts 为 0。生产正常 compile 得到未发布候选、精确 replay 一致；单独发布 DNS 返回 409。
- [x] 只读预览发现沿用旧路径的 `dns_app_placement_not_projected` 诊断，`f3704748` 经 [CI 35519969139](https://github.com/yym68686/fugue/actions/runs/35519969139) 修复，完整测试及 130 秒 prepush 通过；新模式不再误报该条，其他 origin/equivalence 诊断保留。
- [x] 输入 policy `artifact_1789917932_e90aeeb2510d`，hash `sha256:15af50c758d1aae79172d63bc94ab4447d137bb7eb756bd807a3089996c5a436`，由 producer policy `artifact_1789917933_9f90cbb02a89` 固定。正常 release `artifactrel_1789919409_32c952c29dfe` 启用新模式；后台自动生成 fence 199，随后 unchanged 复用同一发布。
- [x] 三台 Worker 各有 159 条隔离 route probe、158 TLS reference；两台 DNS 各有 3 zones、459/459 probes、231/231 readiness records、246/246 eligible queries。签名来源、expected sets、持久化候选、Front/Worker authority、真实镜像、单一 producer leader 和持续续期通过；全体 8 consumer observed、passing=0。
- [x] 保存的 compiler input 明确没有 DNSPlacements，使用固定 topology 与独立查询 observations。inline/stored 两种 replay 精确复用六份 artifact 的 ID、内容、digest、metadata、签名、作者和 lineage，重放期间配置指针不变。所有来源和旧 policy 保持不可变，无效 exact reference 拒绝。

证据：[consumer-dns-placement-2026-09-20.json](verification/consumer-dns-placement-2026-09-20.json)。新增/修改路由在没有旧 serving bundle 时可以编译，由冷启动输入回归验证；生产本步迁移现有声明，未故意破坏真实路由来制造故障。正式持续 serving 发布、gray/full、positive LKG、回滚与旧路径删除仍未完成。

### P0-EO：用现有发布账本驱动自动 serving 与失败恢复

P0-EN 解决了新 route 编译前必须已经 serving 的循环依赖；还需要把已编译候选持续送入现有 gray/full 和 verified LKG 流程。本步复用当前 producer、发布 lane、可信 consumer facts 与 LKG，不增加第二套发布服务或状态机。首次完整配置的真实 gray/full 验收与切换在下一步单独执行。

- [x] producer 签名策略增加显式 `serving` 模式；强类型配置 cohort、gray/full 最小观察时间及每阶段超时，要求完整固定 intent/policy 和 `consumer_readiness`。
- [x] 已有 full verified TrafficReleaseSet LKG 才能自动推进；缺少初始 LKG 时只产生 shadow，不用 shadow ACK 或调用方布尔值制造成功。
- [x] 当前 gray 的真实 apply/probe 收敛后才允许 full；full 使用自己的新鲜证明才能写入成套 LKG。事务内复核来源策略、当前发布、baseline、cohort、时间门和消费者证据。
- [x] 超时或 serving 策略修订后，通过现有 rollback 恢复精确 verified LKG；旧候选/来源无效不阻塞恢复，失败证据与恢复发布原子写入。
- [x] 同一策略下的同一失败输入不反复发布；修正后的输入或新策略可以重新推进。重启从现有发布账本续接；paused/shadow 停止自动 serving 操作，保留人工正常回滚入口。
- [x] 连续回滚后独立 gray/full fence 仍可合法转换；保持全局防重放序号、artifact 代次、当前 lane/expected-set 校验，旧 artifact 仍必须经过独立 LKG 回滚证明。
- [x] 后台流程、文件存储、真实 PostgreSQL、等待事务锁期间撤销策略、race、完整 make test、契约和干净 prepush 通过。
- [x] main/Actions 正常发布后验证实际 API/Controller 版本、全部现有 consumer、producer 持续推进、authority 续期和原 serving/LKG；保存证据再勾选。

P0-EO 生产验证（2026-09-21）：

- [x] 后端 `4e6e0ecc` 经 [CI 35524800863](https://github.com/yym68686/fugue/actions/runs/35524800863) 正常部署 API、Controller，实际镜像和 source annotation 一致，各 2/2 Ready。完整 make test、后台流程与关键路径 race、真实 PostgreSQL 生命周期/排队撤销、前端契约及 136 秒干净 prepush 通过。
- [x] 验收修复了三个恢复阻塞：无效 full 候选的 topology preparation 不得先于超时回滚；PostgreSQL 必须在同一事务中先记录失败再 supersede；连续回滚后独立 lane fence 不得按全局数字比较。拒绝的旧 shadow 不再阻塞修正输入的捕获。以上故障均由隔离回归验证，未在生产故意破坏路由。
- [x] 新进程自动接管 producer leadership，保持原签名 shadow 策略，正常继续生成并复用候选。最终 fence 226 的 160 routes/245 DNS/159 TLS 被全部 8 consumer 观察，passing=0；3 台 Worker 的隔离执行/落盘记录、3 台 Front authority 与两地 DNS 精确证明通过。
- [x] 六份 artifact inline/stored 重放的内容、digest、metadata、签名、作者与 lineage 相同；旧 serving、policy/LKG 和 immutable expected sets 不变；两地 authority 的 publication sequence 与原始 bundle 到期持续推进。
- [x] 前端契约 `3979108b` 的 [CI 35525369183](https://github.com/yym68686/fugue-web/actions/runs/35525369183) 成功，Fugue 实际部署完成，2/2 Ready、2 endpoints、无待处理操作、公网 200。

证据：[automatic-serving-producer-2026-09-21.json](verification/automatic-serving-producer-2026-09-21.json)。本步没有启用生产 serving 模式，没有初始 global full positive LKG；首次真实接管与启用继续由 P0-EP 验收。

### P0-EP：完整配置首次接管与自动发布启用

接管前检查（2026-09-21）：当前 160 条 route、TLS allowlist/cache 和同一业务 snapshot 下 466 条 DNS 查询规则已通过等价检查。短暂暂停 producer 固定候选后，另一个应用正常代码发布改变了 upstream/版本，发布前检查按预期阻止 gray；已恢复 shadow，未创建 gray/full，原 serving/LKG 保持不变。随后代码审查发现 `servingReleaseTrafficTargetWithSnapshot` 仅支持 single/100% stable，compiler 的 release facts 仍来自该 app 级 serving 观察；而代码 canary 会先写入非 single 权重再等待 Edge apply。因此首次接管前必须补齐独立的逐 release readiness，不能借用或伪造 serving 证明。

- [x] 对 stable/candidate 分别从固定 runtime snapshot 取得精确 owner、deployment/image、replicas、service/endpoints readiness；允许真实 ready 的新 release 编译，缺失/过期/身份不符仍拒绝。见 P0-EQ 的回归与生产证据。
- [ ] 应用代码发布的 Edge gate 核对目标 release/权重确实已应用，不能仅凭任意新鲜健康 bundle 判断成功；旧 runtime 的回收必须等待真实流量迁移。
- [ ] 覆盖新应用、正常更新、canary、回滚和旧 runtime 保留的完整回归；核对 sticky 语义兼容，不能在去除 legacy 后让既有发布功能因 compiler 拒绝而失效。

- [ ] 冻结同一版本的完整 intent/policy，核对所有 route、DNS、TLS、cache 与当前 serving 的差异、依赖闭包和回滚准备。
- [ ] 通过正常配置发布执行首次 gray；逐个确认实际 Worker/Front/DNS 的 artifact identity、apply/probe 和对外服务，建立明确的初始 verified baseline。
- [ ] full 发布使用自己的 expected sets 和新鲜 consumer 证明；确认成套 policy/artifact positive LKG，不把 shadow 观察当成 serving。
- [ ] 正常签名策略启用自动 serving，验证后续配置 generation 自动经过 gray/full/verify，代码与配置发布仍分别推进。
- [ ] 完成受控恢复与连续更新验证后，记录生产证据；随后删除旧 serving 输入/实时构造路径并完成最终清单核对。

### P0-EQ：逐 release 的独立运行就绪事实

这是 P0-EP 接管前的第一项兼容工作。原 compiler 输入只接受 app 级 single/100% stable 的 serving 观察，无法为 canary 中的两个独立工作负载建立 readiness。本步复用现有 Kubernetes 快照读取与编译输入存储，保留实际 serving 的 consumer apply/probe 门。

- [x] 按固定业务 snapshot 引用的 managed release 逐个核对 owner、runtime/image、Deployment UID/当前代次、Service owner/selector/port 和当前 Service UID 所属的 EndpointSlice。
- [x] 新 candidate 无需预先 serving；stable/candidate 均有独立 readiness。未知或读取失败不冒充成功，已确认缺失/不就绪保存带原始观察时间的负向事实。
- [x] 使用当前 Deployment 的完整副本和端点事实，正常扩缩容不受历史 code snapshot 的初始副本数阻塞。
- [x] `runtime_snapshot.facts.release_readiness` 保存 cluster/resource identity 和结果，使用强类型契约；不复制 workload 环境或秘密，不修改 intent/policy。
- [x] 完整业务捕获链覆盖目标镜像已前进、stable/candidate 并存且均没有 app 级 serving release 标记；编译得到正确 80/20 路由与 DNS 候选。身份、镜像、代次、selector、端口、旧 Service UID、读取失败/集群切换等反例均拒绝。
- [x] make test、race、生成契约、干净 prepush 通过，经 main/Actions 更新 API；生产验证新事实、编译重放、消费者和原 serving/LKG 后再勾选。

应用 code rollout 的精确 release/权重确认、sticky 语义兼容、首次 gray/full 与自动 serving 启用仍由 P0-EP 后续步骤完成，不以本步 readiness 冒充 serving 成功。

### P0-EP-T：应用流量证明协议与 Edge gate 原子步骤

这是 P0-EP 的代码门禁原子步骤。它只证明应用 release/weight 已经被当前 Edge serving index 实际加载；配置仍必须经过独立的 TrafficReleaseSet、consumer apply/probe 和 verified LKG 门禁。没有 app traffic proof 时 Controller fail closed，不把任意健康 bundle 当作代码流量迁移成功。

- [x] OpenAPI-first 增加 `X-Fugue-App-Traffic-Proof` 可选响应头和 `fugue.edge.app-traffic-proof/v1` canonical digest；摘要绑定 hostname/path、app/tenant、release、role、weight、upstream、runtime 和 deployment generation，正权重必须合计 100，返回值不泄露 upstream payload。
- [x] Edge 只在非 candidate、未过期、健康、当前 Caddy exact apply 且无 apply error 的 immutable index 上生成 app traffic proof；旧 single-upstream route 保持兼容并不伪造摘要。
- [x] Controller safe rollout gate 通过新鲜 HTTPS route probe 核对 Edge/Group identity、bundle version、目标 release 和期望权重摘要；缺 header、旧 worker、错误 release、错误权重、错误 bundle 或 probe 失败均阻止推进，旧 runtime 回收继续等待 gate 和 drain。
- [x] 覆盖摘要 canonicalization、非法/重复 release、权重不完整、旧协议响应、candidate/过期/失败 apply、错误身份与错误 bundle；`make test`、目标 race、affected tests、vet、compile-all、OpenAPI 生成检查和干净 prepush 通过。
- [x] 经 [CI 35548949497](https://github.com/yym68686/fugue/actions/runs/35548949497) 部署 commit `9b03be637fc8005b8dafe3460acff09cbdce1500`；生产 API/Controller 2/2 Ready，两个 Edge Front active slot 均报告相同 source commit，`/healthz`、`/readyz` 为 200，两地 authority ready。公网旧 single-upstream route 的 nonce-bound proof 返回 204 和 route digest，未错误返回 app traffic proof，证明 legacy 兼容和新门禁的 fail-closed 边界。
- [ ] 生产首次真实 canary/weighted app release 产生正向 app traffic proof，并完成 stable/candidate、sticky、rollback、drain 与旧 runtime 保留的完整端到端验收。P0-EP-U 已确认带显式 release 的单目标 100% 路由能产生正向证明；它不代替双 release canary 验收。

证据：[app-traffic-proof-2026-09-21.json](verification/app-traffic-proof-2026-09-21.json)。

### P0-EP-U：流量门禁保留失联节点与回收前重新验证

复查纠正：生产 cache 中有 10 条带显式 release 的单目标路由；上一轮仅筛选多 upstream，漏掉了已有正向证明。另发现原 observer 会跳过不健康/过期节点，并在节点集合为空时判成功，不能据此声称完整 fail-closed。本步修复该行为。

- [x] 每次有界等待保留已经要求确认的节点与 group；失联、不健康、心跳过期、draining、group 改变和节点从库存消失均不减少成功门槛。空库存与缺少 traffic source 不再成功。
- [x] 精确绑定 rollout state 的 release/upstream/runtime/image、policy owner/mode/weight；探测前后检查目标未改变。所有节点的证明须为本次新鲜探测，最终仍未过期，且 Caddy 与库存的 bundle 精确一致。
- [x] 探测后复查库存，新增或变化节点要求重新确认；完整等待遵守 context deadline，取消不返回成功。等待期间的期望仅在内存中保存，不增加另一套发布账本。
- [x] drain 完成后、标记 previous retired 和清理资源前重新验证流量；回归证明先前成功但随后失去证明时 previous 继续 draining，未执行回收。
- [x] 全量 make test、rollout race、干净 prepush 及声明式发布计划通过；[CI 35552533597](https://github.com/yym68686/fugue/actions/runs/35552533597) 仅发布 Controller `b28ad1fbc9357c8c19f15c6c063f44fa29d662ae`，2/2 Ready。
- [x] 使用 metadata-only 输入调用实际 Controller observer，三台公网 Edge 均通过 TLS/nonce/bundle/release 摘要验证，required=3 / ready=3。API/Controller、三台 Front、两地 authority 正常；八个配置消费者 observed，passing=0，生产仍为 shadow，未创建 full release。

证据：[app-traffic-proof-membership-2026-09-21.json](verification/app-traffic-proof-membership-2026-09-21.json)。本步完成门禁错误放行修复与真实单 release 验证，P0-EP 完整 canary、sticky、gray/full 和恢复任务继续保持未完成。

### P0-EP-V：默认 release cookie 与 artifact 编译兼容

原 compiler 对所有非空 sticky 声明拒绝 canary，连 Controller 默认写入、Edge 已实现的 `Fugue-Release-Stickiness` cookie 也被拒绝。该行为会在首次 artifact serving 接管后阻塞既有 canary 发布。

- [x] compiler v30 接受默认 cookie 或省略声明，保留 policy digest 和原有 Edge identity 优先级；自定义 cookie 名和 sticky_header 覆盖继续拒绝，不能接受未执行的语义。没有增加新的 route 字段或改变旧 route proof canonicalization。
- [x] 业务 snapshot → 独立 stable/candidate readiness → compiler 的完整回归使用默认 cookie，两个精确 ready 的 workload 可以编译为 80/20。
- [x] compiler → artifact projection → Edge weighted selector 的 1000 个 session 回归与 legacy 选择一致；cookie/header/API key/Authorization 与匿名请求均覆盖。20%、50%、100% candidate 和 stable 100% 的 materialized route 执行了 200 次真实 HTTP origin 请求，并通过 nonce-bound app traffic proof 解析。
- [x] 全量 make test、compiler/Edge/readiness race、前端 contract check 和干净 prepush 通过；[CI 35553727740](https://github.com/yym68686/fugue/actions/runs/35553727740) 仅发布 API `2ddc6b916d7fc713cb851c6c5f21f6cdcac1f1a8`，2/2 Ready。
- [x] 生产 compile API 接受默认 cookie 的合成 80/20 输入，六份 artifact 的 inline/stored 重放一致；自定义 cookie/header 均返回 400。这些合成事实仅验证编译，不 prepare consumers、不发布流量、不充当生产 readiness。
- [x] producer 自动继续产生 v30 shadow；八个消费者 observed，passing=0。代码更新前后 serving 指针、policy LKG 和 producer policy 身份保持一致；对比剔除了接口附带且正常推进的异步 shadow messages。三台 Front、两地 authority 和健康检查正常，前端契约 `ce43c5a5` 的 [CI 35553745058](https://github.com/yym68686/fugue-web/actions/runs/35553745058) 成功。

证据：[default-release-stickiness-2026-09-21.json](verification/default-release-stickiness-2026-09-21.json)。默认 sticky 兼容已完成；真实双 release 代码发布、gray/full 接管与回滚恢复仍由 P0-EP 验收，不能把本步合成编译当作 serving 验证。

### P0-EP-W：声明的 Edge 成员与候选资源生命周期

首次真实 canary 暴露两个问题：已明确撤销 Edge 角色的历史 heartbeat 被要求确认，导致门禁超时；候选进入 failed 后，普通清理器可能在 Edge 回退前删除其 workload。本步修复并通过相同验证应用重试。

- [x] 从 machine 的显式 `AllowEdge` 声明解析成员；明确撤销角色的历史节点可排除，仍声明 Edge 的失联或缺失节点继续阻止发布。成员读取失败和歧义不会放行。
- [x] apply 前保存候选 Deployment/Service identity；creating 和 failed release 的已保存资源继续受保护，直到显式 retired。
- [x] 全量 `make test`、race、prepush 通过；commit `b0acde19527dd142c604cf3e7b2ebe297d54a87e` 经 [CI 35555718066](https://github.com/yym68686/fugue/actions/runs/35555718066) 部署，Controller 2/2 Ready。
- [x] 生产操作 `op_1789960043_73343115c9b8` 完成 50/50 canary、100% 提升和 canonical upstream 对齐；真实 observer 确认 required=3 / ready=3，三台 Edge 最终摘要一致，连续业务采样为 200。
- [x] 300 秒长连接完整返回 300 条 tick，curl 正常退出；120 次额外短请求全部 200。该应用未回显 release 身份，且采样跨越 promotion，因此不据此认定 sticky 验收通过。
- [ ] 完成退役与回滚验收。previous retire 因排空证据不足保留 draining；另发现 canonical 对齐覆盖 target 字段后，原 candidate revision 仍会被普通清理删除，见 P0-EP-X。

证据：[canary-membership-retention-2026-09-21.json](verification/canary-membership-retention-2026-09-21.json)。这是应用代码发布验证，未接管全局 TrafficReleaseSet serving。

### P0-EP-X：Canonical 对齐后的独立 revision 保护

- [x] 回归复现 serving、draining、failed release 改指向 canonical 后，普通清理删除独立 revision 的问题。
- [x] 同时保护保存的 target 和按不可变 release ID 推导的 revision；Controller 重启后仍有效，显式 retired 后才交给普通清理。
- [x] Controller 全量测试、专门 race 和全量 `make test` 通过。
- [x] commit `48a917cac8317f6d0c86245449fb03be3d866cab` 经 [CI 35557821147](https://github.com/yym68686/fugue/actions/runs/35557821147) 部署，两个新 Controller Pod Ready、零重启，API/authority 正常，serving/LKG 指针未改变。干净 worktree 的 prepush 全部通过。
- [x] 生产操作 `op_1789962119_d4697625b9db` 最终完成；原独立 revision 的 Deployment/Service 在 canonical 对齐及 Controller 再次更新后保持相同 UID、Ready。正式日志 API 证明 360 秒长连接进入该 revision，完整返回 360 条 tick；50 轮跨三台 Edge 的 150 次业务采样全部 200。
- [ ] 补齐完整 retirement/retry 生命周期、生产 sticky、受控失败回滚与后续配置 serving 验收；不得以保留资源代替完整恢复闭环。

证据：[canonical-revision-retention-2026-09-21.json](verification/canonical-revision-retention-2026-09-21.json)。验证期间另一个 main 发布将 Controller 更新到包含本修复的 `0cd5e2d2`；原操作重新执行并创建第二个 candidate。本步骤证明资源没有被普通清理提前删除，不代表重启恢复、origin 隔离或退役闭环已经完成。

### P0-EP-Y：隔离真实 origin 与恢复已有 rollout

P0-EP-X 生产取证确认 canonical Service selector 仅有 app 标签，会同时匹配 canonical 和两个 candidate Pod。Edge 即使选中 stable upstream，Kubernetes 仍可将请求转发到 candidate；这会破坏灰度权重、默认 sticky 和 rollback 的真实含义。必须修复后再推进首次全局 artifact serving。

- [x] 为 app workload 增加独立的执行身份标签，使 canonical Service、Compose alias 和 revision Service 只选择各自 workload；Deployment 的不可变 selector 保持原值。见 P0-EP-Y1 的生产与渲染回归证据；历史 candidate Service 已有 release ID 隔离，新建 revision 同时携带 workload 标签。
- [x] 先核实 owner/UID，再补齐既有 Pod 与模板标签，最后缩小 Service selector。验证应用原 Pod UID 保留，canonical endpoints 仅包含 canonical Pod；初次上线的并发冲突及错误 failed 状态经两个恢复提交处理，见 Y1 事故记录。
- [x] 增加 selector 匹配回归：stable Service 不得包含 candidate 或 previous；不同 revision 不得互选。Y8 已验证实际 endpoints 的 Pod→ReplicaSet→Deployment UID 链和目标 workload 归属。
- [x] Controller 重启接管同一 operation 时恢复既有 candidate/已提升 release 和进度，不得重新创建 candidate 或重置已经批准的流量。使用已有持久化账本并验证 owner、spec 和 operation identity。Y7 生产验证 50% canary 接管并最终完成；已提升/canonical 与 promotion 中间状态另有本地回归覆盖。
- [x] drain 证据绑定 release/workload/Pod 身份与观察时间；不能用同 app 其他 revision 的排空日志授权删除。Y10 已完成绑定 revision 的后台重试、条件退役与 UID 删除；缺少 binding 或正向证据的历史资源继续保留，历史迁移单独验收。
- [ ] 修复后通过真实 50/50 请求按 Pod 日志核对 origin：同 cookie 在各 Edge 的重复请求保持同 release，权重分配正确；再验证长连接、失败回滚、重启恢复与最终资源回收。
- [ ] 每个原子修复通过本地测试、main/Actions 和生产证据后分别勾选；完成前保持全局配置 producer shadow 和原 positive LKG。

### P0-EP-Y1：Service workload 隔离与既有 Pod 迁移

- [x] 增加 `fugue.pro/app-workload`，canonical/Compose alias/revision Service 只选择对应 workload；原 Deployment selector 不变，派生标签不改变 executable release key。
- [x] 迁移校验 Deployment/ReplicaSet/Pod 的 UID 归属和 resourceVersion；暂停 Deployment 后同步 ReplicaSet 模板、现有 Pod 和 Deployment 模板，再恢复原暂停状态。中断恢复记录保存在同一 Deployment annotation。
- [x] 渲染匹配、错误 owner/UID、恢复与幂等回归、runtime/controller race、全量 make test 和干净 prepush 通过。初始提交 `7dc14e52` 经 [CI 35560584868](https://github.com/yym68686/fugue/actions/runs/35560584868) 上线。
- [ ] 完成生产迁移与故障恢复验收。初次上线出现持续 409：Kubernetes 状态更新使 migration 的 resourceVersion 失效，部分对象保持 paused/resume；普通错误路径又将实际 Ready workload 报为 failed，验证应用出现过 503。不能将该初始发布标记为生产成功。
- [x] 修复纯状态冲突的有界重读重试，仍拒绝 UID、owner、labels、annotations 或 spec 变化；迁移前置失败复用 fresh Deployment readiness 保留 serving，历史 ReplicaSet 已被删除时重新采集即可。Controller 全量测试、专门 race 和干净 prepush 通过，恢复提交 `d6190302` 已 push。
- [x] [恢复 CI 35561420949](https://github.com/yym68686/fugue/actions/runs/35561420949) 成功，`d6190302` 两副本 Ready。验证应用恢复 200，迁移标记清除、paused=false，原 Pod UID 保留，canonical Service 的实际 endpoints 仅包含 canonical Pod；serving/LKG 指针未改变。
- [x] 全局迁移恢复完成。待迁移数量从 139 降至 7 后，发现剩余对象被镜像可用性检查挡住；`6c52c5ff` 上线后全局标记清零，7 个 Deployment 同 UID、Ready 副本保留且恢复 unpaused。验证应用保持 200，API/authority 正常。
- [x] 将已开始的 metadata migration 恢复入口前移到代码/镜像 preflight 前，保留 owner/UID/version 校验；Controller 全量测试、恢复 race 和干净 prepush 通过。提交 `6c52c5ff` 经 [CI 35562160993](https://github.com/yym68686/fugue/actions/runs/35562160993) 部署，两副本 Ready；原镜像检查受阻的三个抽查应用恢复 deployed。
- [x] 生产操作 `op_1789966513_84496585e1ac` 通过真实 50/50 origin 验证：12 个 cookie session、3 台 Edge、每台重复 2 次，共 72 请求全部 200，stable/candidate 各 36 次，同一 session 始终落同一 release。以请求标记匹配正式 Pod 日志，解析所有并发拼接记录，不借用 Edge 摘要代替 origin 证明。
- [x] 操作已提升 100% 并完成；新 revision 的 180 秒长连接完整返回。全局 migration 标记仍为 0，Controller/API/authority 健康。
- [ ] 完整 rollout/退役仍未通过：100% 提升后的 `edge_bundle_wait` 超时，Controller 保留旧 workload，未完成 canonical 对齐。重启恢复、按 revision drain 和 readiness endpoints 归属验证也仍待完成。

证据：[service-workload-isolation-2026-09-21.json](verification/service-workload-isolation-2026-09-21.json)。本步骤包括一次真实生产回归与恢复，不能将初始 CI 成功解释为无故障上线。最终完成的是 Service origin 隔离及迁移恢复，不是 P0-EP 的完整发布闭环。

### P0-EP-Y2：实时应用证明与异步 heartbeat 的版本顺序

生产采样确认应用 release/weight/upstream 摘要已匹配时，group bundle 可因其他路由变化或续期前进，heartbeat 仍携带旧版本。原门禁要求二者字符串完全相等，会拒绝已实际应用的目标；旧操作 100% 阶段保存的期望摘要与三台 HTTPS 证明相同。

- [x] 继续要求 exact app traffic digest、nonce/TLS、当前 healthy 非 candidate Caddy index、未过期证明及完整 required membership；不以健康 heartbeat 代替实际 apply 证明。
- [x] 允许实时证明领先健康 inventory 的规范 `edgegroupbundle_<digest>.p<sequence>.r<epoch>` 版本；必须同恢复 epoch 且序号严格递增。旧证明、同序号不同内容、跨 epoch、非规范/legacy 无序版本仍拒绝。
- [x] 探测后重新核对目标、inventory、节点地址、健康和 Caddy 错误；inventory 超过证明或倒退必须重新探测，失联成员仍保留 required。
- [x] 版本顺序与错误目标、地址变化、恢复 epoch、并发变化等回归通过；Controller 全量测试、rollout race、`make test`、干净 prepush 通过。
- [x] `f899071d46b69992546cf408cd0e2f4534c5c462` 经 [CI 35564328406](https://github.com/yym68686/fugue/actions/runs/35564328406) 部署，两个 Controller Pod Ready、零重启；API/authority 正常，原 serving 和 policy/artifact LKG 指针未变。
- [x] 操作 `op_1789968533_c4b26a63ba42` 完成 50% canary、100% 独立 revision 与 canonical 对齐；实际 Controller observer 三阶段均 required=3/ready=3，未出现上轮的 `edge_bundle_wait` 超时。51 次跨 Edge 健康采样全部 200。
- [x] 12 个 cookie session、三台 Edge 的 72 次实际 origin 请求全部 200且黏性一致；固定 candidate session 的 360 秒长连接完整返回，canonical 对齐后 candidate Deployment/Service/Pod 保留原 UID。
- [ ] 最终 retire、重启恢复、失败回滚与全局配置 serving 尚未完成。previous release 因排空证据不足仍为 draining，不能把门禁修复当作完整回收闭环。

证据：[live-publication-app-proof-2026-09-21.json](verification/live-publication-app-proof-2026-09-21.json)。

### P0-EP-Y3：按 Pod 身份观察排空，移除不可靠回收依据

旧 Loki 查询只按 app 聚合，可能把其他 revision 的 idle 日志用来授权 previous 退役；Deployment 不存在也不能证明孤立或正在终止的 Pod 没有连接。另经代码复查确认 `/drain/prestop` 会关闭 agent 的一次性终止等待信号，不能复用为周期性观察接口。

- [x] 删除 app 级 Loki drain parser/querier，以及 missing Deployment、scaled-to-zero 的直接成功回退；保留已存在资源直到取得正向证据。
- [x] 增加只读 `/drain/observe` 和 `fugue.drain-observation/v1`：每次直接读取 TCP/IPv6 状态，回传 nonce、Pod、namespace、监听端口和 active connections，不修改 prestop 信号、终止日志或 prestop metrics。空文件、损坏输入和观察错误拒绝，不返回假零值。
- [x] Controller 先确认当前 stable 100% 的实际 Edge proof，再沿 Deployment→ReplicaSet→Pod UID 核对目标；要求完整副本集合、镜像、Ready container identity 和连续安静期内零连接。观察后复查 UID、容器重启、Pod 集合、release target 和 traffic policy；标签漂移不能隐藏属于旧 workload 的 Pod。canonical 或共享 stable workload、缺少协议和身份、任何读取错误均继续保留。
- [x] 覆盖协议缺字段、旧 nonce、错误 Pod/port、超大/额外响应、旧 agent、busy deadline、替换/终止 Pod、agent 重启、owner 变化及并发 policy/release 变化；全量 `make test`、Controller/agent race、干净 prepush 通过。
- [x] `874d2f525c7ece6057284dd5939b750f8d2849d2` 经 [CI 35567987047](https://github.com/yym68686/fugue/actions/runs/35567987047) 部署 Controller，两副本 Ready、零重启。CI 同时构建新 agent digest `sha256:818be7253656b85eb1afcfe8b4cb24800ac6027669ace3eb3f88f07bbd46948b`，真实 TCP 连接验证 `0→1→0`，观察不改变 prestop 计数。
- [x] 生产三台 Front、两地 authority、API 健康，八个配置消费者 observed、passing=0、producer shadow。验证应用的 15 个资源 UID、17 个 release 记录、traffic policy、serving/LKG 指针保留，12 次业务请求全部 200。
- [x] 通过正常声明式发布激活已验证 agent 镜像，保持已有 serving workload；新应用发布后完成生产按 Pod 正向连接归零和长连接观测，见 Y4。此项只验证实时观测，不能授权仍指向 canonical 的 previous release 退役。
- [ ] 接入后台重试、持久化 revision target 与条件退役/UID 删除，完成历史 canonical release 的资源归属迁移和最终回收；再验收 Controller 重启恢复与失败回滚。P0-EP-Y 的完整 drain 任务保持未勾选。

证据：[pod-drain-observer-2026-09-21.json](verification/pod-drain-observer-2026-09-21.json)。本步骤完成观察协议和错误授权路径修复，不代表完整退役闭环或全局 artifact serving 接管。

### P0-EP-Y4：激活观察镜像并验证真实连接，修复 Pod proxy 权限

- [x] 将已验证 agent 固定到 digest `sha256:818be7253656b85eb1afcfe8b4cb24800ac6027669ace3eb3f88f07bbd46948b`。同 release key、完全 Ready 且只改变 helper image 的 reconcile 保留当前 Pod 模板；真实 restart/application change 和其他生命周期变更仍走原门禁。回归、Controller race、全量 make test、干净 prepush 通过。
- [x] `5a21bb22a2e6c6b3ea3e41204cac288586047470` 经 [CI 35569449154](https://github.com/yym68686/fugue/actions/runs/35569449154) 成功上线；激活前后 202 个 Deployment、139 个 Pod 的身份和 agent image 未变。稍后其他应用的一个 helper image 变化有独立的已完成 deploy 记录解释，详见证据，不能将正常并行发布误报为隐式迁移。
- [x] 验证应用通过正常 deploy 操作 `op_1789973245_abed9b90ac3d` 创建新 revision，并完成 50% canary、100% 提升及 canonical 对齐。72 次请求按真实 Pod 日志核对，12 个 session 跨三台 Edge 保持同 release；54 次健康采样全部 200。独立取证保存了 50% 与最终 100% stable 的正向证明，未截获短暂 candidate=100 阶段，故不额外声称该阶段有独立采样。
- [x] 初次真实 proxy 请求返回 Forbidden，修复为版本化 `pods/proxy` GET 规则和独立配置 lane，Helm 默认规则同步。`9dc40ea0b1e04f4bd1529081f25af628e7d89a97` 的 [CI 35570373647](https://github.com/yym68686/fugue/actions/runs/35570373647) 中 prepush、`drain_observation_access` 成功，组件发布均 skipped；整体状态 cancelled 来自并行 `diagnostics_package_activation` 被取消，不能记为整条 CI 成功。修复未重建生产组件，真实 proxy 请求随后成功。
- [x] 新 agent 在生产 canonical Pod 以新 nonce 连续取证 `active_connections=0→1→0`；180 秒流完整返回 180 个 tick，origin 日志标记吻合，Pod UID、container ID、restart count 保持一致，prestop requests 为 0。首轮流也完整返回，但末次取证使用的 Controller Pod 被并行发布替换；脚本修复为刷新取证传输 Pod 后重跑并完成证据链。
- [x] 最终 API/Controller 为包含激活修复的 `436dbb5b`，2/2 Ready；三台 Front、两地 authority 健康，migration pending=0，serving/LKG 配置指针未变，八个消费者 observed/passing=0，producer 仍为 shadow。
- [ ] 保存不可变 revision workload target，接入后台观察重试和条件退役/UID 删除；旧 canonical previous 尚未获准回收。当前正向生产证据来自正在服务的 canonical Pod，只证明观测能力，不是旧 revision 的退役授权。

证据：[drain-observer-activation-2026-09-21.json](verification/drain-observer-activation-2026-09-21.json)。完整 rollback、Controller 重启复用、旧资源最终回收和全局 artifact serving 接管继续保持未完成。

### P0-EP-Y5：不可变 revision 身份的兼容数据库迁移

- [x] 独立 schema lane 增加 nullable `revision_workload_json`，既有 release 保持未绑定。数据库 trigger 禁止已绑定身份被替换、清空或转移 app/tenant/release owner；旧代码只更新路由 target/status 的 SQL 继续有效。
- [x] 真实本地 PostgreSQL 覆盖重复迁移、旧写入方兼容、身份不可变、非法 JSON 类型及两个并发首次绑定仅一个成功；race、全量 make test、干净 prepush 通过。
- [x] `8ba2a7feca844ec616e94294ba69ff8a8faa5166` 经 [CI 35609099165](https://github.com/yym68686/fugue/actions/runs/35609099165) 完成 schema/API 声明式发布。只读 SQL 验证生产列为 nullable JSONB、trigger 启用、函数正文与仓库完全相同；schema Pod 日志确认迁移完成，API 2/2 Ready。
- [x] 原 release/traffic policy、workload UID 和 serving/LKG 指针保留，两地 authority 健康，12 次业务采样全部 200。
- [x] Controller 保存来源 operation、Deployment/Service UID 等实际 revision 身份，canonical 对齐后保持不变；已完成 Y6 的真实新 release 绑定验证。历史未绑定 release 不会自动获得回收授权。
- [ ] 基于已绑定身份完成历史资源迁移、后台 drain 重试、条件退役与 UID 删除，再完成重启恢复/rollback 和全局 artifact 接管。

证据：[revision-workload-schema-2026-09-21.json](verification/revision-workload-schema-2026-09-21.json)。

### P0-EP-Y6：新 revision 实际身份绑定与 canonical 对齐保留

- [x] OpenAPI-first 增加只读 `AppRelease.revision_workload`：来源 operation、namespace、Deployment/Service 名称和 UID、Deployment generation、release key、runtime/image 与绑定时间。前端生成契约同步，`61ede2de` 的 [CI 35628574047](https://github.com/yym68686/fugue-web/actions/runs/35628574047) 成功。
- [x] 候选 apply 后读取并复核 Kubernetes 资源，校验 app/tenant/release owner、完整已声明模板字段、Service selector/ports、非 terminating 和稳定 UID/generation；Kubernetes 补入的默认字段不构成虚假差异。Store 按 operation→release 顺序加锁，比较预期 release 版本，首次绑定仅允许 running deploy 的 creating candidate；相同绑定可重试，不同绑定拒绝。
- [x] 一般 Create/Update 不能新增或替换绑定；旧调用方不传新字段时继续保留原值。元数据读取携带绑定且不加载 executable spec，canonical 对齐只更新当前 target。JSON store、真实 PostgreSQL 并发/旧写入兼容、Controller owner/UID/selector/image/代次变化回归、race、全量 make test 和干净 prepush 通过。
- [x] `8332c5ea7522d316a26332a5bb12afe1ca68a776` 经 [CI 35628572891](https://github.com/yym68686/fugue/actions/runs/35628572891) 发布 API/Controller。首轮验证 `op_1790010289_6b8cf4c85f73` 被门禁错误拒绝：Kubernetes 序列化省略了显式为 0 的 probe initial delay，严格比较误判不同；候选未接流量，原 stable 100% 服务，三台 Edge 为 200。此首轮不计为验收成功。
- [x] 仅将 probe `initialDelaySeconds=0` 与缺省视为等价，非零缺失继续拒绝；增加正反回归。`389fd31ebb4012a5ae14428f3c4bdb11179f215a` 经 [恢复 CI 35630895296](https://github.com/yym68686/fugue/actions/runs/35630895296) 只更新 Controller，专门 race、Controller 全量和干净 prepush 通过。
- [x] 新生产操作 `op_1790011354_129ba25020c4` 完成 50% canary、100% 提升和 canonical 对齐。候选到 stable 的连续记录保持完全相同绑定；原 Deployment UID `d70a7bb0-649a-46c3-991a-04c42f46175b`、Service UID `0854ef98-319b-4fc8-a309-540da019cb92` 与 Kubernetes 实物一致，revision 仍 Ready。只读 SQL 与 API 返回的绑定 JSON 完全一致。
- [x] 72 次真实 origin 黏性请求全部 200，同 session 跨三台 Edge 保持同 release；96 次健康采样全部 200。API/Controller 2/2 Ready，三台 Front、两地 authority 正常，serving/LKG 指针保留，八个消费者 observed、passing=0，producer 仍为 shadow。
- [ ] 基于已绑定身份接入后台 drain 重试、条件退役及 UID 删除，迁移历史未绑定资源；恢复同一 operation 时复用既有 release，并完成失败 rollback。当前绑定只覆盖新候选，不代替旧 runtime 最终回收或全局 artifact serving 接管。

证据：[revision-workload-binding-2026-09-22.json](verification/revision-workload-binding-2026-09-22.json)。

### P0-EP-Y7：Controller 重启复用同一 operation 与发布进度

- [x] candidate ID 从 tenant/app/operation 确定性派生，长度符合 Kubernetes label 限制；创建时保存 rollback target。恢复优先于 canonical baseline 初始化，读取既有 release、不可变 workload binding 或历史 creation receipt，校验 owner、执行 spec、来源、runtime/image、operation、生命周期和当前 policy；重复 candidate、身份歧义或冲突拒绝恢复。
- [x] 重启不重新 apply 已绑定 revision，也不改写其当前 serving target；只读复核原 Deployment/Service UID 和已声明模板。canary 从已发布权重继续并重新取得新鲜证明；已提升、canonical 和 promotion 中间状态不退回初始 canary。Controller shutdown 的 context cancellation 保留当前流量，不触发自动 abort 或错误完成 operation。
- [x] 覆盖创建 receipt 缺失、50% 恢复、提升中断、promoted/canonical、重复/错误 owner/spec/operation、取消、requeue/reclaim 和资源只读验证；全量 `make test`、Controller race、干净 prepush 通过。实现 `a574b678ee62d45c8e2435e6ac65946163651da7` 经 [CI 35635848445](https://github.com/yym68686/fugue/actions/runs/35635848445) 上线。
- [x] 正常 main/Actions 发布 `fa292dfea3c2d39beef464caf4d9b96109e05677` 的 [CI 35641201761](https://github.com/yym68686/fugue/actions/runs/35641201761) 替换两个 Controller Pod；新进程在 `2026-09-21T18:58:00.88942315Z` 认领原操作 `op_1790016761_a910f794f5f7`，保留 release `apprel_op_10e539b159adcdd4ae4e055b28bb27dd0a7a72d84adcc893` 和 50/50 权重，之后完成 100% 提升及 canonical 对齐。88 份身份样本一致，实际 revision Deployment/Service UID 与绑定相符，candidate Pod UID 在接管前后相同。
- [x] 重启前后各 72 次请求按实际 Pod 日志核对 origin，12 个 session 跨三台 Edge 保持黏性，共 144 次全部 200；246 次独立健康采样全部 200。一次 Pod inventory 请求传输失败造成 112 秒身份采样空窗，脚本从已保存样本继续，未重提 deploy；之后六次相同接口请求均为 200、耗时 1.27–1.44 秒。该空窗保留在证据中，不声称逐时刻连续取证。
- [x] 分开记录失败恢复：操作 `op_1790015292_1d46d6487779` 在 [CI 35638571187](https://github.com/yym68686/fugue/actions/runs/35638571187) 的 Controller 替换后由新进程接管，600 秒流完整返回；流时长被计入 p99，超过原有 30 秒门槛，操作正确 failed 并自动恢复旧 stable 100%。没有放宽门禁，本轮成功验收未再混入长流量。较早一次观察窗口未覆盖 Controller 替换，不计作重启成功证据。
- [x] 最终 API `6ab204e2`、Controller `fa292dfe` 均 2/2 Ready，三台 Front 和两地 authority 健康；serving/LKG 指针保持，八个消费者 observed、passing=0、producer 仍为 shadow。通过正式 continuity API 的操作 `op_1790018040_7d07452473f9` 将临时观察窗口恢复为原 120 秒，未创建新 candidate，33 个 Deployment/Service/Pod UID 和流量目标未变。
- [ ] 完成 endpoint Pod 归属校验、历史未绑定资源迁移、后台 drain 重试、条件退役/UID 删除及其余 rollback 场景，再推进全局 artifact serving。生产重启正向验收覆盖 canary；其他恢复阶段的回归测试不冒充全部生产故障演练。

证据：[controller-operation-resume-2026-09-22.json](verification/controller-operation-resume-2026-09-22.json)。这是应用 code rollout 恢复能力，不代表首次全局 TrafficReleaseSet serving 或 positive configuration LKG 已完成。

### P0-EP-Y8：EndpointSlice 到 Pod/ReplicaSet/Deployment 的 readiness 归属证明

- [x] release readiness 不再用 Service-owned EndpointSlice 的地址数量直接代表副本就绪；每个 ready endpoint 必须有真实 Pod `targetRef`、UID、namespace、Running/Ready 状态，并且地址属于该 Pod。双栈地址和重复 slice 按 Pod UID 去重，地址被多个 Pod 复用、终止 Pod、未知 ready、错误 target 或删除中的对象均 fail closed。
- [x] 沿 Pod → ReplicaSet → Deployment 的 controller owner UID 链核对目标 workload、`fugue.pro/app-workload`、`fugue.pro/release-key`、Service selector、镜像和 immutable revision binding；同 app 其他 revision 即使伪造标签也不能成为当前 release 的 readiness 证据。Deployment generation 允许向前推进但不能回退，UID、Service UID、runtime/image 和 release key 保持不变。
- [x] OpenAPI 增加 `endpoint_pods` 运行事实，限制为 Pod 名称/UID、ReplicaSet 名称/UID、release key 和已验证地址；不保存环境变量、managedFields 或其他 workload payload。覆盖 owner 链错误、UID 替换、地址漂移、双栈去重、终止/不 Ready Pod、API 读取失败和绑定代次变化；API 定向测试、race、全量 `make test` 和干净 prepush 通过。
- [x] 后端 `8cf7a49e4bac3fb16c8f44810088b35251bb8c78` 经 [CI 35646941098](https://github.com/yym68686/fugue/actions/runs/35646941098) 发布，API 2/2 Ready；前端 OpenAPI 同步 `f0ac4a9c118845ebb31a8aaff5650b62f45479aa` 经 [CI 35646964191](https://github.com/yym68686/fugue-web/actions/runs/35646964191) 通过。
- [x] 生产 projection 观察到 9 个 managed release 均 `ready=true` 且有 endpoint Pod 身份链；shadow artifact `artifact_1790020827_745d1c49d8d1` 的冻结 compiler input 同样保存 `endpoint_pods`。使用精确 intent/policy/runtime snapshot 重放 route、DNS、TLS、ReleaseSet 六类 artifact，内容和 lineage 全部一致；这次只生成 shadow 验证结果，没有切换全局 serving。
- [x] 生产三台 Edge、API/Controller、两地 authority 健康；验证应用保持原 release binding 和 Pod 身份，12 次跨三台 Edge 的公网健康请求全部 200。非 shadow serving release、policy LKG、artifact 指针和 producer 配置均与发布前一致，8 个 consumer observed、passing=0、producer 仍为 shadow。
- [ ] 继续完成历史未绑定资源迁移、后台 drain 重试、条件退役/UID 删除、完整 rollback，并在这些基础上推进首次全局 TrafficReleaseSet serving。endpoint readiness 证明不等于旧 revision 已经可以回收。

证据：[release-endpoint-pod-ownership-2026-09-22.json](verification/release-endpoint-pod-ownership-2026-09-22.json)。

### P0-EP-Y9：退休 release 终态 fence 与旧 writer 隔离

- [x] Store 层拒绝已退休 release 的任何后续更新，拒绝把 retired release 写入 stable/candidate traffic policy；自动 stable 同步不会复用 retired release。API promote/traffic patch 对 retired release 返回冲突，当前 serving policy 保持不变。
- [x] PostgreSQL schema migration 增加 `fugue_guard_app_release_retirement` 与 `fugue_guard_retired_traffic_references` 两个 trigger：退休记录成为不可变 tombstone，traffic policy 不能引用 retired release；迁移可重复执行，旧 writer 仍能更新未退休 release 的非身份字段。覆盖 Store JSON、PostgreSQL、旧 writer、并发退休/引用和 API 反向回归。
- [x] schema/API/Controller 发布声明与代码同 commit，干净 prepush 通过；提交 `d657089accf144abfe644ad581c4e7abdd5bfb07` 经 [CI 35696356786](https://github.com/yym68686/fugue/actions/runs/35696356786) 发布，API/Controller 2/2 Ready，schema migration 成功。
- [x] 生产只读 SQL 确认两个 trigger 启用、函数正文与仓库源码一致、`referenced_retired=0`；非 shadow serving、traffic policy、artifact/policy LKG 未改变。23 个 release 记录和 33 个 Deployment/Service/Pod UID 保持，三台 Edge 健康，12 次公网采样全部 200，producer 仍为 shadow、8 个 consumer observed/passing=0。
- [ ] Y9 只建立终态安全边界，不代表资源已经回收。继续完成 binding-based drain 观察、退休条件 CAS、UID 删除重试、历史未绑定资源迁移和完整 rollback 后，才能勾选完整退役闭环。

证据：[release-retirement-fence-2026-09-22.json](verification/release-retirement-fence-2026-09-22.json)。


### P0-EP-Y10：按不可变 binding 排空、条件退役与 UID 删除

- [x] drain 观察使用不可变 revision binding，核对 Deployment/Service UID、release key、workload/owner、代次和实际 Pod 集合；canonical 对齐后的当前 target 不会覆盖旧 revision 身份。先取得当前 stable 100% 的新鲜 Edge proof，再观察连续安静期，观察后复核 workload 和 policy。
- [x] exact previous/stable/policy CAS 提交退役；retention、retire grace、取消、并发 policy/release 变化都会阻止旧证据写入。JSON Store 与真实 PostgreSQL 覆盖成功、previous/stable/policy/retention 改变及取消，旧 writer 仍受 Y9 终态 fence 限制。
- [x] 后台 reconcile 重试 completed deploy 的 draining revision；cleanup 要求 retired 身份，复核 owner/release key/Service selector，并使用 UID+resourceVersion 删除前置条件。普通 prune 继续保护尚未清理的 bound tombstone，Controller 中断后可以继续 cleanup。
- [x] 全量 `make test`、Controller race、PostgreSQL CAS 回归和干净 prepush 通过；`e5378e17f76f160bb41a24684b7566119c3082a8` 经 [CI 35700275472](https://github.com/yym68686/fugue/actions/runs/35700275472) 发布，API/Controller 均 2/2 Ready。
- [x] 生产两条已绑定 previous 从 draining 进入 retired；持久化审计包含 binding、Pod/container 身份、nonce、连续安静期与零连接回执。对应 2 个 Deployment、2 个 Service、2 个 Pod 已移除，其余 27 个资源 UID 保持，active release 列表仅减少这两条，流量策略完全不变。
- [x] 93 次跨三台 Edge 的健康采样全部 200；API、两地 authority 正常，非 shadow serving 和 policy/artifact LKG 保留。此步没有激活全局配置 serving。
- [ ] 完成历史未绑定和 failed release 的可验证迁移/退役路径，以及其余 rollback 与全局 TrafficReleaseSet 首次 serving 验收；不能将本步两条 bound previous 的回收扩展声称为所有历史资源已回收。

证据：[release-drain-retirement-2026-09-22.json](verification/release-drain-retirement-2026-09-22.json)。


### P0-EP-Y11：失败回滚 candidate 的后台排空与退役

- [x] 将已绑定且来源 deploy operation 已 failed 的 candidate 接入同一后台 drain 流程；仍要求 stable 100%、实际 Edge proof、连续零连接、binding/Pod 身份复核和 exact release/policy CAS，不以 failed 状态本身授权删除。
- [x] 保留原 operation 的 failed 结果，退役审计单独保存原 role/status/reason 和实时 drain 回执。宽限期从 traffic policy、withdrawn release 与 stable promotion 的最近变化计时，避免沿用旧 stable 的历史时间。
- [x] 覆盖 busy、未确认流量、仍被 policy 引用、retention/retire grace、来源 operation outcome 不符和排空后状态变化；Controller race、真实 PostgreSQL previous/failed 双场景 CAS、全量 `make test` 与干净 prepush 通过。
- [x] `c9f1a1cd13b03ed861648b637a488e244a78853c` 经 [CI 35702371067](https://github.com/yym68686/fugue/actions/runs/35702371067) 发布，API/Controller 2/2 Ready；生产一条 failed candidate 成为 retired，零连接/nonce/Pod 身份审计完整，原 failed operation 结果保留。
- [x] 对应 Deployment、Service、Pod 三个 UID 已移除，其余 24 个资源 UID、其他 release 和 traffic policy 保留；93 次跨 Edge 请求全部 200，API/两地 authority 正常，serving/policy/artifact LKG 未变。
- [ ] 历史未绑定资源及不支持正向观测的旧 agent 尚需迁移；本步骤不授权缺少来源或排空证明的资源回收，完整全局配置 serving 仍待完成。

证据：[failed-candidate-drain-retirement-2026-09-22.json](verification/failed-candidate-drain-retirement-2026-09-22.json)。


### P0-EP-Y12：历史 revision 的来源校验与不可变绑定迁移

- [x] 从同 tenant/app/release 的系统 promote 或 auto-abort 审计解析唯一来源 deploy operation；核对 terminal outcome、保存的 executable spec、runtime/image。Store 在 operation→release 锁内重新校验完整版本及来源；来源缺失、冲突、并发变化和重复绑定均拒绝。
- [x] 复用新 revision 的只读资源校验：release 派生名称、owner、release key、完整已声明模板、Service selector/ports、UID 和代次；要求资源创建时间落在来源 operation 期间。使用现存 placement 核对 runtime 约束，不重新选择节点，不 apply 历史 spec、不重建 Pod。
- [x] JSON Store、真实 PostgreSQL 并发/过期快照/来源冲突、Controller Kubernetes mutation 拒绝和替换资源回归、race、全量 make test 与干净 prepush 通过；初始 `fcb19eaf0d3d725170558fac3b522b26c45d4b4f` 经 [CI 35704895621](https://github.com/yym68686/fugue/actions/runs/35704895621) 发布，但生产 CAS 因附带的 timing facts 不一致拒绝迁移，资源保留。初始 CI 成功不算迁移验收成功。
- [x] 修复普通 GetOperation 附带 Controller timing，而事务读取不附带造成的误冲突；仅排除该独立运行事实，operation 身份、终态、版本和执行配置仍严格比较。真实 PostgreSQL 新增 timing 附带回归；恢复提交 `8f974a58c72dd3e55e8021f2be3ed73a3fafb57f` 经 [CI 35706278216](https://github.com/yym68686/fugue/actions/runs/35706278216) 发布，API/Controller 2/2 Ready。
- [x] 生产历史 previous 与 failed 各一条补建原 Deployment/Service UID 的 binding；failed candidate 随后通过新鲜 Edge/Pod/nonce/quiet-period 证明退役并删除 3 个资源。原 failed operation 保持失败结果，其余 21 个资源 UID、其他 release 和 traffic policy 保留。
- [x] previous 的 Pod 在发布前已经容器终止且 reason=Unknown，无法提供实时排空证明；迁移只补 binding，未授权删除。已核对前后相同 Pod UID 和容器状态，缺少正向证明时继续保留是本次验收的预期行为。
- [x] 最终 API/authority 与 serving/policy/artifact LKG 核对通过。330 次观测中 328 次为 200、两次为 curl 连接超时；另有 authority 和 Pod inventory 取证超时。随后本机 36 次与集群内 3 次独立复查全部 200；不将这些超时归因于已证实的服务故障，也不声称全程零失败。20 分钟监控续跑产生的最大 134.7 秒采样间隔保留在证据中。
- [ ] 为旧 agent、异常/失联 Pod 和更早缺少可验证来源的资源建立正向观察或隔离后的回收路径；完成后才能勾选“所有历史资源最终回收”。首次全局 TrafficReleaseSet serving、完整恢复演练和旧 serving 输入删除仍未完成。

证据：[historical-revision-workload-migration-2026-09-22.json](verification/historical-revision-workload-migration-2026-09-22.json)。


### P0-EP-Y13：异常 Pod 的独立 CRI 运行事实探针

- [x] 在独立诊断包增加 `pod-runtime-state`，签名 catalog 配置指定 runtime adapter、Pod namespace/name/UID 与节点；只执行固定 CRI list/inspect，输出 sandbox/container ID、状态、网络命名空间关闭标志、PID 存在性、node boot 与 containerd PID/start time。连续两次观测集合必须一致；不输出原始 CRI spec、环境变量或其他 payload。
- [x] 空清单、缺字段、错误 UID/owner、来源读取失败、截断、状态变化和取消均报告 unavailable；正在运行或网络未关闭时 `quiescent=false`。CRI 可能保留已退出容器的旧 PID，因此另读 host proc 判断该 PID 是否仍存在。诊断事实本身不授权删除。
- [x] race、诊断包全量测试、全量 `make test`、干净 prepush 通过。首次 `2a05d59f` 的 [CI 35711361438](https://github.com/yym68686/fugue/actions/runs/35711361438) 成功，但正式探针因 K3s bootstrap launcher 在只读容器尝试解包而 unavailable；`cb6b4df8` 的 [CI 35713350218](https://github.com/yym68686/fugue/actions/runs/35713350218) 改用已安装 crictl 后又发现 host absolute symlink 在容器根解析失败。两轮均 fail closed，保留失败报告，不算验收成功。
- [x] 校验并解析版本化安装目录的绝对/相对 host symlink，拒绝目录越界、非版本目录、错误 binary link 与缺失文件；恢复提交 `a01be8322267640e3ed3ffe3b0fd8efdb5190e04` 经 [CI 35714498209](https://github.com/yym68686/fugue/actions/runs/35714498209) 发布，签名 catalog 激活诊断镜像 `sha256:f5ec82db85bdd5e014b0d968104d2e4842c7d45e1b7c84736fefead22de7f863`。
- [x] 正式 session `diagnostic-1790072339-69fe9ea689b7` 对旧 Pod 返回 complete、quiescent=true：sandbox NOTREADY/PID=0/process deleted/network closed，两个容器 EXITED 且旧 PID 均不存在。session `diagnostic-1790072372-fa3c8895c2ed` 对 canonical 返回 complete、quiescent=false：sandbox Ready/network open，两个容器 Running 且 PID 存在。每个报告保存一次完整采样，内部均执行两次身份稳定性读取；不宣称历史连接连续性。
- [x] 本次仅发布独立诊断包和 catalog，API/Controller 保持 `8f974a58`、2/2 Ready；21 个业务资源 UID、全部 release/traffic、serving/policy/artifact LKG 保留。API/两地 authority 正常，节点侧 18 次跨三台 Edge 请求全部 200。期间本机外连 TCP/TLS 超时同时影响 GitHub；使用临时 SSH SOCKS 转发续查，节点侧 API 正常，未改系统代理。最终正式 session 和核对成功。
- [ ] 将新鲜 CRI 事实与 workload 退役屏障、流量退出、完整 Pod 集合及条件删除结合，完成异常旧资源回收；此步只建立可靠观测，不将诊断成功直接当作清理授权。全局配置首次 serving 和剩余重构继续未完成。

证据：[pod-runtime-state-probe-2026-09-22.json](verification/pod-runtime-state-probe-2026-09-22.json)。


### P0-EP-Y14：签名 CRI 运行事实接入停止 revision 的安全退役

- [x] HTTP drain 观察不可用时，仅对完整绑定、已退出全部应用/辅助容器、无 ephemeral container/host network 的 Pod 集合进入停止态观察；仍核对 Deployment/Service/ReplicaSet/Pod owner、release key、image、UID、resourceVersion、完整副本集合以及节点 UID/boot/fresh Ready。
- [x] Controller 复用签名 catalog 与现有 diagnostic admission lease 创建限时 Job；诊断 Pod 必须属于精确 Job UID，执行指定镜像并成功结束。Job 模板、参数、来源和报告 envelope 均核对；结束后重新读取 catalog/trust，变更或撤销拒绝。
- [x] 报告要求 complete、未截断、无 gaps、30 秒内的新鲜事实，完整覆盖 Kubernetes container IDs；全部 sandbox 必须 NOTREADY/PID=0/process deleted/network closed，全部容器必须 EXITED 且 host PID 不存在。报告不声称容器退出前的连接连续性，也不能单独授权删除。
- [x] 观察前后复核 workload、Pod 集合/版本、node boot 与 traffic policy，再取得 stable 100% Edge proof；最后复用 previous/stable/policy CAS 与 UID/resourceVersion 删除。并发 policy 变化、Pod 重启、node reboot、错误镜像/Job owner、过期报告与信任撤销均保留资源。
- [x] 正反向集成回归、Controller race、全量 `make test`、干净 prepush 通过；`fffcd610b9de8bdd5f5a7afa36db19ff905b1114` 经 [CI 35717137964](https://github.com/yym68686/fugue/actions/runs/35717137964) 仅发布 Controller，最终 2/2 Ready，API 保持 `8f974a58`。
- [x] 生产自动 Job `diagnostic-retire-2e025dfebbed68007a00e085b1e47d4e6622dd82` 成功；原异常 previous 取得新鲜完整运行事实并成为 retired，审计保存签名 catalog/probe/image 身份、节点启动与容器证据。精确删除原 Deployment/Service/Pod 三个 UID，其余 18 个资源、其他 release、traffic/serving/policy/artifact LKG 保留。
- [x] 欧洲节点发起的 69 次跨三台 Edge 业务采样全部 200，API/两地 authority 正常。本轮发布前本机采样含连接超时，保留原记录并明确区分采样来源；不将其改写为零失败。
- [ ] 完成其余历史未绑定 revision 的可验证迁移和更早缺失资源的账本收敛，再完成剩余 rollback、首次全局配置 serving 和最终旧路径删除。

证据：[stopped-revision-cri-retirement-2026-09-22.json](verification/stopped-revision-cri-retirement-2026-09-22.json)。


### P0-EP-Y15：历史 helper 镜像保持与节点 Lease 新鲜度

- [x] 历史 binding 迁移固定实际读取的 drain helper 镜像，不要求它等于当前默认 helper 版本；其余模板、应用 executable key、owner、来源、UID/代次仍校验。两次读取间镜像变化拒绝；增加对 helper 未声明 command/args/envFrom/workingDir 的拒绝，避免 subset comparison 漏掉额外执行字段。
- [x] Controller race、全量 make test 与干净 prepush 通过；`1fe9134b54458e3c76cbfd29c0266d1eb2d1fea2` 经 [CI 35719257886](https://github.com/yym68686/fugue/actions/runs/35719257886) 仅发布 Controller。两条旧 helper revision 成功绑定原 UID，随后后台签名 CRI 观察和安全回收完成。
- [x] 生产观察发现低频 Node status 时间戳导致在线节点被间歇拒绝；改为同时要求 Node Ready、精确 Node UID/boot 和未过期的对应 kubelet Lease。核对 Lease owner/holder、TTL 和 renewTime，缺失/过期/外部 owner 均拒绝；paused 审计增加 observer_error，避免丢失拒绝原因。
- [x] 旧 status+fresh Lease、错误 owner/holder、过期/缺失 Lease 回归及 race、全量 make test、干净 prepush 通过；恢复 `d43dc00f64f58fb28879ca3d382b8e92aa91ed9e` 经 [CI 35721056910](https://github.com/yym68686/fugue/actions/runs/35721056910) 部署，Controller 2/2 Ready。
- [x] 两条历史 revision 的退役审计保存完整 binding 和新鲜 CRI 证据；精确删除 2 个 Deployment、2 个 Service、2 个 Pod，其余 12 个资源、其他 release/traffic、serving/policy/artifact LKG 保留。两次回收均发生在 `1fe9134b` 的后台重试中；`d43dc00f` 验证的是部署健康与 Lease 校验修复，不将先前回收归到后续版本。
- [x] 213 次欧洲节点发起的跨三台 Edge 业务采样全部 200，API/两地 authority 正常。控制 API 取证曾遇本机传输超时，续跑及采样间隔保留在证据中。
- [ ] 处理剩余两条更早 revision：一条缺少 workload 隔离标签，另一条保存的 executable env 与其来源 operation 当前值不同。继续保留资源；完成精确来源与标签迁移后才可回收。更早已缺失资源的账本收敛、rollback 和全局配置 serving 继续待完成。

证据：[historical-helper-retirement-2026-09-22.json](verification/historical-helper-retirement-2026-09-22.json)。


### P0-EP-Y16：历史 revision 的隔离标签迁移与恢复

- [x] 先核对来源 operation、保存的 executable spec、实际 release key、Deployment/Service owner 和 UID；仅在验证副本上补派生 workload label，验证通过后才进入现有 metadata migration。预检后的 UID、spec、labels、annotations 或创建时间变化均拒绝写入。
- [x] 复用暂停 Deployment→更新 ReplicaSet/Pod 标签→更新模板→恢复原暂停状态的可恢复流程，最后在 UID/resourceVersion 条件下收窄原 Service selector；不 apply 历史应用配置。迁移后重新执行严格 binding 和现有排空/CRI 退役门禁。
- [x] 缺标签、Pod patch 中断恢复、错误 owner/image 零写入、预检后替换、原 Pod UID 和暂停状态保持回归通过；Controller race、全量 make test、干净 prepush 通过。
- [x] `79e28964ad945f28836eb85a0f7658413c6d9dc5` 经 [CI 35723231574](https://github.com/yym68686/fugue/actions/runs/35723231574) 仅发布 Controller，2/2 Ready。生产目标 binding 的 Deployment/Service UID 和排空报告的 Pod UID 均与发布前一致，随后条件退役并删除这三个资源。
- [x] 其余 9 个资源 UID、其他 release、traffic/serving/policy/artifact LKG 保留；33 次欧洲节点发起的跨 Edge 请求全部 200，API/authority 正常。控制 API 一次本机传输超时后续跑，最大采样间隔保留在证据中。
- [ ] 最后一条存在资源的历史 revision 保存了早于 operation 最终 spec 的执行配置；需要按该 revision 的历史 promote 证据核对，不能把最终 operation spec 当作所有中间 revision 的同一份配置。已缺失资源的账本、其余 rollback 与全局配置 serving 继续待完成。

证据：[historical-revision-label-migration-2026-09-22.json](verification/historical-revision-label-migration-2026-09-22.json)。


### P0-EP-Y17：按 revision 的历史 promote 来源核验，保留损坏快照

- [x] 已提升历史 revision 的来源不再要求等于 operation 完成时保存的最终 spec；改为该 release 的系统 safe-zero-downtime promote 审计、PromotedAt 与 operation 生命周期一致，同时仍严格校验该 release 的保存 spec、实际完整模板及 executable key。未提升的 failed candidate 继续比较来源 operation spec。
- [x] JSON Store/真实 PostgreSQL 覆盖 operation completion 更新最终 spec、缺失/错误 promote、时间越界、来源冲突和 CAS；Controller 完整模板拒绝回归、race、全量 make test、干净 prepush 通过。`9525c444099e0f13414445993bc93acd8285c791` 经 [CI 35725027354](https://github.com/yym68686/fugue/actions/runs/35725027354) 发布 API/Controller，均 2/2 Ready。
- [x] 生产确认最后一条历史 release 自己的 SpecSnapshot 也与原 Pod 环境变量不同；旧 canonical baseline 对齐曾覆盖 snapshot。迁移按预期拒绝，没有建立错误 binding 或删除资源；9 个资源 UID、所有 release/traffic、serving/LKG 保留，165 次节点侧采样全部 200，API/authority 正常。
- [ ] 该历史 revision 未完成迁移/回收。需要用现存资源的精确 owner/UID 与新鲜已停止运行时证据，原子记录退休 tombstone 后回收，不能伪造已丢失的原始 intent 或让不一致 snapshot 获得重新 serving 资格。
- [ ] 防止后续 canonical 对齐覆盖已绑定 revision 的执行快照；继续全局配置接管和剩余任务。Y17 的生产正向验收是“错误快照安全保留”，不声称历史回收完成。

证据：[historical-release-source-retained-2026-09-22.json](verification/historical-release-source-retained-2026-09-22.json)。


### P0-EP-Y18：损坏历史快照的原子停止态退役

- [x] 对 unbound previous/draining 且有明确系统 promote 来源的历史资源，按 release 派生名称、tenant/app/release owner、operation 生命周期、实际 Deployment/Service/Pod/ReplicaSet UID 和 key 核对归属；保留原 SpecSnapshot，不推断或修复丢失的历史 intent。
- [x] 仅接受全部容器已退出、无 ephemeral/host network 的完整 Pod 集合；stable 100% Edge proof、新鲜签名 CRI runtime closure、node UID/boot/Lease、观察后 workload 与 policy 复核均通过后，才进入原子事务。
- [x] Store 在 operation→traffic→release 锁内复核来源与 exact previous/stable/policy，把实际 resource binding 和 retired tombstone 一次提交；任何冲突不留下 binding。PostgreSQL/JSON 并发 reactivation 只能一方提交，已退休的旧 writer/traffic reference 仍被终态 fence 拒绝。
- [x] 缺失历史 workload label 仅在此停止态路径中允许：实际 Service 必须有精确 release selector 且匹配模板，owner UID 链和所有容器仍验证；只在已退休 tombstone 上按 UID/resourceVersion 删除，绝不重建或赋予 serving 资格。审计显式 `intent_snapshot_verified=false`。
- [x] 完整 Controller 正反回归、race、真实 PostgreSQL 原子/并发测试、全量 make test、干净 prepush 通过；`548f1ae74b2419accc7c41353cf237c1ed615950` 经 [CI 35729508135](https://github.com/yym68686/fugue/actions/runs/35729508135) 发布 API/Controller，均 2/2 Ready。
- [x] 生产最后一条存在原 workload 的历史 previous 完成原子退役；数据库保留发布前完全相同 SpecSnapshot，审计记录未还原 intent、原 UID 和 complete CRI 回执。仅删除该 Deployment/Service/Pod 三个 UID，其余 6 个资源（canonical 与当前 stable revision）保留，其他 release/traffic、serving/policy/artifact LKG 未变。
- [x] 90 次节点侧采样中 89 次 200，一次 SSH 连接 exit=255 未取得 HTTP；随后 18 次复查全部 200，API/两地 authority 正常。采集失败如实保留，不宣称全程零失败。
- [x] 防止未来 canonical 对齐覆盖绑定快照，已由 Y19 完成并上线验证。
- [ ] 处理更早已经缺失 workload 的账本收敛，再完成其余 rollback、首次全局配置 serving 和旧路径删除。

证据：[historical-stopped-tombstone-2026-09-22.json](verification/historical-stopped-tombstone-2026-09-22.json)。


### P0-EP-Y19：绑定执行快照不可变与 canonical 对齐保护

- [x] Controller 对已绑定 release 保留 source、image、runtime、owner 和 SpecSnapshot；下一次发布保留原 stable 的已验证服务目标。promoted 对齐和后台 reconciler 核对执行模板，同镜像但环境变量不同也拒绝对齐；未绑定 baseline 保持迁移兼容。
- [x] JSON Store 与独立 PostgreSQL trigger 拒绝绑定后的执行配置替换/清空，包括不认识 binding 字段的旧 writer；服务目标与状态仍可更新。独立新增约束不被旧 schema migrator 的函数替换移除，重复迁移和旧 migration 重放均验证。
- [x] 真实 PostgreSQL、race、执行配置拒绝、合法目标更新、baseline 保持与同镜像异配置回归通过。旧 drain 测试改用可变服务目标模拟并发变化并检查写入结果，继续验证观察期间变化阻止退役。最终全量 make test 和干净 checkout prepush 通过；工作目录历史未跟踪诊断程序导致的首次 prepush 失败未绕过，文件原样保留。
- [x] `edc72b9bf5b43527afd27f92a317a8cdc3a76c55` 经 [CI 35732965170](https://github.com/yym68686/fugue/actions/runs/35732965170) 发布 schema、API、Controller；独立约束启用，函数保护四项执行配置且绑定后才生效，三个组件不可变发布回执与提交一致，API/Controller 均 2/2 Ready。
- [x] 生产 14 条活动 release（含 1 条当前 bound stable）、traffic policy、6 个应用资源 UID 与 serving/policy/artifact LKG 保持；222 次欧洲节点发起的跨三台 Edge 请求全部 200，API/两地 authority 正常。错误写入和旧 migration 重放在一次性 PostgreSQL 测试库执行；生产只读核对约束及状态，不声称已执行新的应用发布演练。
- [ ] 完成更早无 workload 的账本收敛、其余 rollback、完整配置首次 gray/full 接管、positive LKG 和旧 serving 路径删除。此步不代表全局配置已经 serving。

证据：[bound-release-intent-2026-09-22.json](verification/bound-release-intent-2026-09-22.json)。


### P0-EP-Y20：默认 DNS 归属修复与全量查询对比

- [x] 从两台 DNS 的实际 legacy cache、签名候选和新鲜 readiness 回执重放选择器，定位唯一额外记录来自项目 HTTP 路由别名。修复 `projectDefaultAppDNS`，必须匹配冻结 App 的默认 route hostname、App ID 和 tenant；项目 route table 别名不再隐式获得 DNS。显式 DNS 和 verified domain projection 保持原有规则，不引入项目名称判断。
- [x] OpenAPI 先更新投影语义并重新生成；默认匹配、别名、缺 App/route、错误 owner、显式别名保留、歧义归属回归和 race 通过。全量 make test、前端 contract:check 通过；干净 checkout 完整 API 测试后 prepush 在 26 秒内通过。此前两次本地 prepush 因 API 完整测试超过默认 55 秒而超时，未忽略失败或缩减检查。
- [x] `56a7eeb1707eae8714bf752a3fbc18a568d8018e` 经 [CI 35736262352](https://github.com/yym68686/fugue/actions/runs/35736262352) 仅更新 API，2/2 Ready；Controller 保持 `edc72b9b`、2/2 Ready。前端契约同步 `9c22bd5b` 的 [CI 35736293859](https://github.com/yym68686/fugue-web/actions/runs/35736293859) 成功。
- [x] 自动 producer 在原 policy 下生成 shadow `artifact_1790085542_92ea6c7b216b`，fence 745：162 route 与当前 serving 完全一致，DNS artifact 为 246 records，两台 consumer 各执行 249 个 zone record。原 HTTP 别名路由仍保留，仅移除缺少 DNS 声明的隐式地址记录。
- [x] 两台 DNS 各 700 个默认/地域选择器重放零差异；从欧洲节点经临时 SOCKS 向两台公网 TCP/53 各查询全部 249 条记录，249/249 RRset 均与候选一致，无传输失败。比较排除 TTL 与答案顺序，覆盖当前公网请求来源；不扩大声称所有 ECS/UDP 场景都已经验证。
- [x] 八个消费者 identity-verified 且 observed，serving passing=0；API/两地 authority 正常，219 次跨 Edge 健康采样全部 200，当前 serving 和 policy/artifact LKG 保留。
- [ ] 固定完整候选，继续首次 gray/full 接管、positive LKG、自动 serving 与恢复演练，以及其余旧路径删除；本步骤仍是 shadow 验收。

证据：[default-dns-owner-projection-2026-09-22.json](verification/default-dns-owner-projection-2026-09-22.json)。


### P0-EP-Y21：首次完整 gray 与 DNS 通配监听恢复

- [x] 通过签名 producer policy 暂停候选刷新；初期应用部署/缩容及 DNS 选择观测变化使旧候选过时，预检拒绝且未发布 gray，恢复 shadow 后重新捕获。最终固定 `artifact_1790087479_550a3c8023a6`，162 route、246 DNS records，六 artifact 重放一致，两地各 700 个选择器检查与 249 条公网 TCP 查询通过，八个 trusted consumer 能力及最终 route 一致性通过。
- [x] 正式 release API 发布 `artifactrel_1790087645_0acc5580b15b`（gray fence 1，cohort=complete），随后建立三类 expected consumer sets。美国两个 Edge 提供真实 route/TLS serving 证据；DNS 初次 apply 因把 `:53` 通配监听判为非 IP 失败，回到旧配置并保留失败状态。
- [x] 修复通配 host 到本机 IPv4 探针地址的映射，仍拒绝非 IP 与非本地地址；真实 UDP/TCP 激活回归、DNS 全包 race、全量 make test、干净 prepush 通过。`bb75bea646957e8fa5f26f0fb9d925e251c176c2` 经 [CI 35742260065](https://github.com/yym68686/fugue/actions/runs/35742260065) 更新两地 client lane。
- [x] 两台 DNS 重新尝试同一已批准 artifact 后实际 serving：各 465/465 route/TLS probes、234/234 dependency records；持久化带签名 positive checkpoint，两个发布回执匹配提交。两台公网 DNS 三个 zone 共六条 TCP SOA 回应全部 authoritative，serial=799 与 DNS artifact generation sequence 一致。
- [x] 从首次接管预检至本步验收累计 534 次跨 Edge 健康采样全部 200。DNS 已切换实际 gray；全局 full/LKG 仍未推进，不将本地 positive checkpoint 当成全局 verified LKG。
- [ ] 修复欧洲 Edge 对明确排除路由的验证：要求可核对的 negative exclusion proof，不能跳过检查或给予 DNS serving 资格。完成全部 required consumer 收敛后才能 full promotion；随后继续 LKG 和恢复演练。

证据：[first-gray-dns-listener-2026-09-22.json](verification/first-gray-dns-listener-2026-09-22.json)。


### P0-EP-Y22：排除路由的负向证明与完整 gray 收敛

- [x] 明确区分“加载了排除配置”与“可以接收流量”。只有本 worker/group 被精确加载路由排除时，显式 excluded 请求才能得到 nonce/digest/version/expiry/node/group 绑定证明；普通 readiness、错误 owner、候选索引、过期配置仍拒绝，探针不访问 origin，不发 AppTraffic proof。
- [x] serving 验证器核对全部路由：本地排除条目必须返回 excluded，其他路由仍要求真实 active 或允许的 inactive proof；不跳过排除项。DNS readiness 对 excluded 状态始终拒绝，保留排除约束的安全语义。
- [x] OpenAPI 先更新协议，生成与前端契约同步完成；实际 HTTPS/nonce/negative proof、错误状态、DNS 拒绝回归，race、全量 make test、前端 contract:check、干净 prepush 通过。发布计划要求同时更新提供契约的 API，已补同提交 intent 后重新通过计划和 prepush。
- [x] `7cff4f63a98194b749e7ad8bcb24c8fd897493a9` 经 [CI 35744021956](https://github.com/yym68686/fugue/actions/runs/35744021956) 完成 API、欧洲与美国 worker A/B 发布，三个正式回执匹配提交；Controller 保持 `edc72b9b`，两地 DNS 保持已验证 `bb75bea6`。
- [x] 欧洲持久化 162 个真实路由 proof，其中 2 个 excluded；公网两条路径各验证普通请求 503/无 proof 与 excluded 请求 204/正确 digest/无 AppTraffic proof。所有 active worker serving_verified；gray 的 route 3/3、TLS 3/3、DNS 2/2 经多次新鲜检查持续通过。
- [x] 累计 882 次跨 Edge 采样有 3 次 SSH 连接关闭和 1 次 US A/B 期间 TLS EOF，均未取得 HTTP 响应；其余采样为 200。后续美国节点独立 60 次请求全部 200，最近 18 次原监控请求也全部 200。没有足够证据确定单次 EOF 原因，不声称零中断；原记录、最大采样间隔保留在证据中。
- [ ] 建立 gray verified LKG，再推进同一 artifact full、验证新 fence 收敛及 full LKG；随后开启自动 serving、完成故障与恢复演练。US A/B 单次 EOF 需在后续受控发布中继续验证，不能将一次复查通过扩展为所有连接连续性已验收。

证据：[excluded-route-serving-proof-2026-09-22.json](verification/excluded-route-serving-proof-2026-09-22.json)。


### P0-EP-Y23：首次 full serving 与统一 verified LKG

- [x] gray 的八个 required consumer 均以当前期望集合、artifact sequence、release 身份和 fence 持续通过；本地持久化回执、TLS/route 真实探针、公网 DNS 与健康观察齐全后，正式 verify-lkg API 建立初始恢复基线。
- [x] 核对 ReleaseSet、route、DNS、TLS、policy 五份 LKG，全部绑定 gray `artifactrel_1790087645_0acc5580b15b` 与同一个 verification evidence hash，不以 shadow 或手工 ACK 代替正向运行证据。
- [x] 正式 full release API 发布同一 artifact `artifact_1790087479_550a3c8023a6`，新 release `artifactrel_1790091416_15e293b47203`，full fence 1；未重新编译或替换 artifact。建立新的三类 expected consumer sets，gray 回执不计为 full 收敛。
- [x] 过渡期旧 gray 继续服务，full 身份不匹配时不报通过；最终三台 active Edge serving_verified、两台 DNS serving，route 3/3、TLS 3/3、DNS 2/2 经超过 120 秒的新鲜重复检查保持通过。六个公网 SOA authoritative 且 sequence=799。
- [x] full verify-lkg 成功；五份签名 LKG 全部更新为同一 full release/evidence hash，内容 digest 与固定 artifact 一致。API/两地 authority 正常。
- [x] full 发布之后至本次验收 72 次跨三台 Edge 请求全部 200；此前代码 A/B 阶段的 4 次采集/传输失败仍保留在 Y22 证据中，不混入本阶段统计。
- [ ] 启用签名 producer serving policy，验证自动灰度/full/LKG 更新与失败回退；继续控制面/consumer 重启恢复、旧来源移除及剩余简化方案任务。

证据：[first-full-traffic-lkg-2026-09-22.json](verification/first-full-traffic-lkg-2026-09-22.json)。


### P0-EP-Y24：签名 producer 自动 gray→full→verified LKG

- [x] 仅在现存 full verified TrafficReleaseSet 基线通过后启用 producer `serving` 模式；原基础 intent、输入 policy、应用域名与 DNS query policy 引用保持。签名策略设置 complete cohort、gray/full 各 120 秒、600 秒超时恢复，interval=60 秒、refresh=600 秒。
- [x] 新 producer policy `artifact_1790091911_5e876f84e521` / release `artifactrel_1790091915_7c818829cd03` 通过正式创建、验证与 release API 激活；未发布代码。
- [x] producer 自动生成 artifact `artifact_1790091931_a98b6cae07d2`，shadow 后发布 gray `artifactrel_1790091932_92417538b1ea`（fence 2），保留旧 full verified LKG；灰度时间和收敛通过后自动 full `artifactrel_1790092057_49124bed1c6d`（fence 2）。
- [x] full 实际消费者 route 3/3、TLS 3/3、DNS 2/2 通过，超过 full 最小观察窗口后 producer 自动验证并原子推进 ReleaseSet/route/DNS/TLS/policy 五份 LKG，均绑定同一 full release/evidence hash。整个成功链路不依赖人工 ACK 或手工 full/LKG 调用。
- [x] API/两地 authority 正常；60 次跨 Edge 采样中 59 次 200、一次 SSH 连接关闭未取得 HTTP，失败如实保留。既有后台监控继续正常。
- [ ] 验证 policy 版本变化和超时导致的自动恢复、failed-source 去重、consumer/控制面重启恢复及其余旧来源删除；自动成功路径不代表失败路径已经验收。

证据：[automatic-traffic-serving-2026-09-22.json](verification/automatic-traffic-serving-2026-09-22.json)。


### P0-EP-Y25：policy 授权版本变化的自动配置恢复

- [x] 等待正常自动 full verified 基线后，以新签名 producer policy 将 gray 最小观察临时延长到 1800 秒，生成正式 gray `artifactrel_1790092573_cccdbab82b19`；八个 required consumer 实际收敛，但候选尚未取得 verified LKG。未制造坏签名或伪造运行事实。
- [x] 发布另一份新 policy generation，撤销该候选的 producer authority。后台检测 policy release 不匹配，5.321 秒后正式发布 recovery full `artifactrel_1790092696_b2d907cf9173`（fence 4），复用已验证 artifact `artifact_1790092253_5f659a203e9a`，不重新编译恢复内容。
- [x] 原 gray 记录持久化 failed、failed_source_digest、当前 producer policy release 与 recovered_by_release_id；系统审计记录 failed release、恢复 release 和 LKG artifact 的映射。
- [x] 暂停 producer 固定恢复状态后验证 route 3/3、TLS 3/3、DNS 2/2 全部回到恢复发布；ReleaseSet/route/DNS/TLS/policy 五份 LKG 保持原 verification release 和 evidence hash，没有用失败 candidate 覆盖 positive LKG。
- [x] API/两地 authority 正常，演练阶段 48 次跨 Edge 健康采样全部 200；随后通过新签名策略恢复正常 serving 模式、gray/full 各 120 秒和 600 秒超时。
- [ ] 继续验证超时恢复、失败来源去重、控制面与 consumer 重启恢复，以及剩余策略迁移和旧来源移除。policy 变更恢复不等于所有故障类型已经验证。

证据：[producer-policy-recovery-2026-09-22.json](verification/producer-policy-recovery-2026-09-22.json)。


### P0-EP-Y26：删除 Edge route-intents 的 legacy serving fallback

- [x] OpenAPI 将 edge_group_id 设为必需，并明确只读取适用的已发布 gray/full TrafficReleaseSet。HTTP serving handler 删除业务表即时 derive 和 standalone route LKG fallback；缺参数 400，缺失/损坏/未准备好的发布 503，保留 consumer 原 serving artifact。
- [x] standalone LKG 读取帮助函数从生产代码移至历史兼容测试；compiler/迁移诊断仍可显式投影 artifact。业务 App 与配置 producer 保留，不再从 consumer 请求中临时推导 serving intent。
- [x] 回归覆盖已有业务 App/环境 route/standalone LKG 时仍拒绝 fallback，未选中 cohort 保留 consumer cache，不把成员 LKG 扩散到其他组；正常已发布投影、签名/拓扑错误、race、全量 make test 和前端 contract:check 通过。干净 prepush 采用仓库 CI 的 240 秒预算，全部通过。
- [x] `3bde90882755cbe9399d9b03e8cf93ad62a308e5` 经 [CI 35753217572](https://github.com/yym68686/fugue/actions/runs/35753217572) 仅发布 API，2/2 Ready；前端契约 `85bce63f` 的 [CI 35753854167](https://github.com/yym68686/fugue-web/actions/runs/35753854167) 成功。
- [x] 两地 authority 的新鲜 reconcile generation 与当前发布的 route artifact 一致，route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 正常。后台 producer 持续执行后续正常 gray/full 更新，verified LKG 保持。
- [x] 186 次监控采样含 185 次 200 和一次 SSH 连接关闭未取得 HTTP，最近 18 次全部 200；生产未删除有效 release 做负向试验，缺发布拒绝行为由本地集成测试验证。
- [ ] 删除 DNS 启动与其他 legacy serving 路径，完成剩余故障恢复与简化方案任务；此步不声称所有业务表/环境变量依赖均已移除。

证据：[traffic-only-route-intents-2026-09-22.json](verification/traffic-only-route-intents-2026-09-22.json)。


### P0-EP-Y27：已登记 DNS 启动必须使用 artifact 与运行事实修复

- [x] 配置 platform identity 的 DNS consumer 从启动起要求 TrafficReleaseSet artifact，缺少全部 positive checkpoint 时保持 bound/recovery_failed，返回 SERVFAIL，禁止 legacy cache/previous cache/业务 bundle SyncOnce/ambient override 回退。有效 current/previous checkpoint 仍严格校验并重新采集瞬态 readiness。
- [x] enrolled Run 不启动旧 zone bundle sync、legacy health/override 循环，只运行 artifact serving 与 inventory heartbeat；新盘在真实发布+route/TLS+UDP/TCP 自检通过后可正常加载 artifact。未登记的旧兼容实现暂时保留，下一步退役其生产配置入口。
- [x] inventory heartbeat 读取真实 artifact serving 状态、generation、记录数与 stale 边界，避免重启后一直报告休眠 legacy snapshot。保留候选诊断状态，但 shadow 不能使 enrolled consumer 获得 serving 数据。
- [x] 缺全部 checkpoint 且存在旧 cache/环境地址、启动前查询、旧 API 零请求、真实 UDP/TCP 新盘激活、current/previous 恢复、损坏/签名失败、API outage 刷新事实、准确 heartbeat 回归，DNS 全包 race、全量 make test、前端 contract:check、干净 prepush 全通过。
- [x] `d92d9d51ff7c5b9415379d23e3072b381289c8e2` 经 [CI 35756622479](https://github.com/yym68686/fugue/actions/runs/35756622479) 发布 API 与两地 client。首次 API 镜像下载 Go module 遇 proxy.golang.org HTTP/2 INTERNAL_ERROR；重跑失败任务后 attempt 2 全部成功，没有改代码绕过失败。
- [x] 两个 DNS Pod 均由正常发布替换，实际从签名 positive checkpoint 恢复后 refresh readiness，健康 serving full artifact；inventory 的 dns-* generation、249 record count 与实际状态一致。启动日志为 artifact consumer，无 legacy bundle sync；两台公网三个 zone 的六条 SOA 均为 artifact sequence 813。API 2/2 Ready、两地 authority 正常。
- [x] 本步累计 276 次跨 Edge 健康采样全部 200。发布前临时 SOCKS 隧道断开导致取证失败，重建临时隧道并重新读取基线后才推送；未计入成功样本。生产 checkpoint 未人为删除，全部丢失负向路径由本地测试验证。
- [ ] 退役生产 serving 环境变量和残余 legacy reader/publisher，补齐超时、代码发布失败及其余恢复演练，继续最终简化方案清单。

证据：[enrolled-dns-artifact-recovery-2026-09-22.json](verification/enrolled-dns-artifact-recovery-2026-09-22.json)。


### P0-EP-Y28：DNS inventory bootstrap 与环境字段删除的自动补偿

- [x] enrolled DNS 启动不再校验 ambient answer/TTL/nameserver，改为要求 node/group、durable cache 和显式 public inventory address；缺失身份或无效地址仍拒绝启动。新增回归、DNS race、全量 make test 和干净 prepush 通过。
- [x] 首次 `25fffcf2` 尝试删除 13 项 serving 环境变量，经 [CI 35760588954](https://github.com/yym68686/fugue/actions/runs/35760588954) 两地均因 manifest 未收敛自动补偿到 `d92d9d51`。10 项变量仍由旧 Helm 和声明式发布器共同拥有，普通 SSA 保留了它们；不是成功部署，失败回执和探针告警保留。
- [x] 将兼容升级拆开：`f0588c6ef4089c7221ca1f0c24d3af97f5ff4498` 先保留旧字段、增加明确的 `FUGUE_DNS_PUBLIC_IPV4` 并上线新启动逻辑，经 [CI 35762677653](https://github.com/yym68686/fugue/actions/runs/35762677653) 两地成功。这样后续删除旧变量时，上一版本已兼容 artifact-only bootstrap。
- [x] 两地正式回执、替换后的 Pod、positive checkpoint、新鲜 readiness、249 records 与准确 inventory generation 一致，route 3/3、TLS 3/3、DNS 2/2 按当前 release 的精确 expected sets 收敛。六个公网 SOA 查询 authoritative，sequence=818、TTL=60；API 2/2 和两地 authority 正常。
- [x] 两轮发布期间监控累计 339 次跨 Edge 健康请求全部 200。SOCKS 取证失败、过早读取 US 回执、自动配置切换期间的 convergence 失败均重试并留记录；不以 HTTP 成功声称 DNS rolling replacement 全程无中断。
- [x] 共享环境字段删除与 13 项生产 DNS serving 变量退役已由 Y29 完成；Y28 当时仅完成兼容启动和 inventory 分离。

证据：[dns-inventory-bootstrap-2026-09-22.json](verification/dns-inventory-bootstrap-2026-09-22.json)。


### P0-EP-Y29：声明式共享环境字段删除与 DNS serving env 退役

- [x] 发布器从已校验摘要的 forward/LKG manifest 推导双向 literal env 删除集合，只允许本组件的命名 container、旧 manifest 中存在而目标已删除的字段。live-only 字段、引用型变量、未知 owner、旧值漂移均无删除权限；只接受本声明式 owner 及历史 Helm Update 的共同所有权。
- [x] dry-run 不写生产；执行 JSON Patch 同时测试 UID、resourceVersion 和每个旧 entry，再删除。严格核对返回对象只发生已审核删除与一次 generation 增长，随后普通 SSA 应用目标。补偿由同一 manifest 对推导反向删除；首次安装不授予删除权限。
- [x] `0d7e50a3` 的 [CI 35764737713](https://github.com/yym68686/fugue/actions/runs/35764737713) 更新 guardian 成功，两地 client 在字段删除后的 apply 失败并补偿回 `f0588c6e`。原始 Kubernetes 错误被旧 ownership parser 覆盖为“not a typed SSA conflict”，不能仅凭该回执断言原始错误类型。
- [x] 补充 observation-only CAS 有限重试与原始错误保留：只有同 UID、同 generation、完整 spec/metadata 等价的状态更新才能刷新 resourceVersion；配置、UID、generation 变化立即拒绝。生产只读 shared-ownership 快照重放、真实 JSON Patch CAS 正反例、dry-run、引用字段/首次安装兼容、race、全量 make test 和干净 prepush 通过。
- [x] `eac7d1136a352e3b4347b32f39d271322267aedd` 经 [CI 35766566247](https://github.com/yym68686/fugue/actions/runs/35766566247) 成功发布 guardian 与两地 client。实际 DNS DaemonSet 均由 32 项 env 降为 19 项：删除 answer、route-A、extra-zone、TTL、nameserver、stale、旧 health probe、sync 和 override 共 13 项；保留公网地址为 inventory，主 zone 暂供 bootstrap identity。
- [x] 新 Pod 在无上述环境配置下正常恢复 signed checkpoint、249 records、465 route/TLS probes 和 234 readiness records；准确 inventory generation 与实际 artifact 一致。current release 的 route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 正常。两台 DNS 三个 zone 六条公网 SOA 同为 sequence 824、TTL 60；另一美国节点直接查询也通过。
- [x] 本轮验收时累计 390 次跨 Edge HTTP 全部 200。连续公网 TCP DNS 监控保留 10 次 EOF（与两轮发布/补偿的 Pod 替换时间重合）及一次后续 SOCKS 查询超时；之后连续检查与独立来源复查正常。不能将发布完成等同为连接连续性完成。
- [ ] 修复 DNS liveness 与外部 serving readiness 的耦合，以及单 Pod/hostPort rolling replacement 的节点级连接空窗；继续 API 环境来源和旧 publisher 删除。DNS consumer env 退役不代表全平台同名变量均已删除。

证据：[dns-serving-env-retirement-2026-09-22.json](verification/dns-serving-env-retirement-2026-09-22.json)。


### P0-EP-Y30：DNS 执行 liveness 独立于 serving readiness

- [x] DNS 新增节点本地 `GET /livez`：执行存活且没有致命监听错误时 200/status=ok，监听失败时 503/status=failed。独立于 artifact、控制面、外部 route/TLS readiness 与 serving 状态锁；不会给 DNS serving 授权。
- [x] 两地 livenessProbe 改用 `/livez`，readinessProbe 保持 `/healthz`。缺 artifact、损坏 cache、短暂外部依赖失败仍保持 readiness 失败，但不会单因该状态触发 Kubernetes liveness 重启。
- [x] OpenAPI 先记录节点接口语义并生成；DNS race、缺配置与锁隔离回归、全量 make test、前端 contract:check 全通过。API `7ea99db5` 与前端契约 `9692c7f9` 已上线；初次两地 client 在 dry-run 因旧 Helm probe path owner 冲突拒绝，未写生产。
- [x] 声明式发布器复用 UID/RV/旧值绑定的标量迁移机制，允许已声明 HTTP probe path 从 Helm Update owner 迁移；probe port/timing/exec、整个 probe 和 image 不在此扩展范围。正反回归、发布器 race、全量测试通过。
- [x] 本地最终 prepush 首次因磁盘不足失败；清理本任务 24 小时前可重建 Go cache 约 3.97 GB 后重跑完整检查通过。`7faf072a169828f1a6bb2ed280c3bb84e5aa791a` 经 [CI 35770850060](https://github.com/yym68686/fugue/actions/runs/35770850060) 正式发布两地 client 和 guardian；不绕过检查或手工改生产字段。
- [x] 两台新 DNS `/livez` 均 200/status=ok，实际 DaemonSet 路径正确；`/healthz`、signed checkpoint、249 records、readiness、inventory generation 正常。当前 release route 3/3、TLS 3/3、DNS 2/2 收敛；六条公网 SOA 同为 sequence 829，API/authority 正常。
- [x] 本步验收累计 354 次跨 Edge HTTP 全部 200。连续 DNS 采样保留欧洲 Pod 替换时三个 zone 的一次 EOF 轮次，之后连续复查通过；没有主动在生产破坏 readiness，依赖故障与锁隔离由本地测试验证。
- [ ] 修复单 Pod 独占 hostPort 53 的 rolling replacement 连接空窗；继续其余 legacy 来源、策略迁移和恢复演练。liveness 修复不代表已实现无间断 DNS 更新。

证据：[dns-independent-liveness-2026-09-22.json](verification/dns-independent-liveness-2026-09-22.json)。


### P0-EP-Y31：退役独立 DNS bundle 的 HTTP serving 出口

- [x] OpenAPI 将 `GET /v1/edge/dns` 标记 retired/deprecated，合法旧请求返回 410 和保留当前 verified LKG 的说明；删除 HTTP handler 对独立 full DNS bundle 的查询、签名返回和 serving 响应。原认证、node/group/zone 范围及参数校验保留。
- [x] 即使数据库仍有旧 full bundle、环境静态记录和业务 App，也不能从该出口取得 serving 配置。历史编译/迁移测试使用明确的 test-only adapter，生产 router 不注册它；正常 TrafficReleaseSet consumer 协议保持。
- [x] 存储不变、无 artifact body/ETag、合法旧请求 410、错误凭证拒绝、原 scoped zone 校验及迁移正反回归通过；API race、全量 make test、前端 contract:check 和干净 prepush 全通过，完整 API prepush 使用 240 秒预算，实际 146 秒。
- [x] DNS 排障手册改为查询 full/gray TrafficReleaseSet、hostname lineage 和 DNS inventory；历史架构说明标明旧接口已退役。
- [x] `4f161581fb4b13cba37eecd74e7b58260e671394` 经 [CI 35773591993](https://github.com/yym68686/fugue/actions/runs/35773591993) 仅发布 API，2/2 Ready；前端契约 `f12741e8` 的 [CI 35773594523](https://github.com/yym68686/fugue-web/actions/runs/35773594523) 成功。
- [x] 两台实际 DNS consumer 使用自己的 scoped token 请求旧接口，均返回 410；token 不进入日志或 URL。它们继续正常 artifact serving，当前 release route 3/3、TLS 3/3、DNS 2/2 收敛、verified LKG 保留，API/authority 正常。另一美国节点直查两台 DNS 三个 zone 的六个 SOA，全部 sequence 833。
- [x] 本步累计 186 次跨 Edge HTTP 全部 200。上线未完成时的副本检查、自动配置切换中的 convergence 检查均先拒绝后重试；一次 SOCKS DNS EOF 保留，独立来源复查正常。
- [ ] 删除后台 legacy DNS publisher 及剩余迁移输入/环境读取点，并将必要排序冷却状态交给受签名 policy 控制的观测流程；继续 DNS 更新连续性和其余简化方案任务。

证据：[retired-legacy-dns-endpoint-2026-09-22.json](verification/retired-legacy-dns-endpoint-2026-09-22.json)。


### P0-EP-Y32：删除后台独立 DNS publisher，保留 verified-policy 观测

- [x] API 启动改为 DNS observation loop；独立 DNS 的编译、每 node shadow/full 发布、旧 LKG 初始/持续推进函数全部移入迁移测试文件，不进入生产构建。普通 compiler/read-only migration reader 暂留，不再有后台独立发布 owner。
- [x] 新循环仅刷新 flatten 与排序冷却事实，模式和 cooldown 读取全局 signed validated verified PolicySnapshot LKG，捕获完成后再核对 policy 身份。缺失/草稿/坏签名保留原排序事实；环境 ranking 无法授权写入。复用历史 writer lock 保证滚动更新中旧新进程不并发写排序事实。
- [x] 验证 180 秒策略保持原 switch time、改为 verified 60 秒策略后允许切换；disabled 策略不受 ambient active 覆盖。观测不创建/修改 artifact，不发布 serving/LKG 指针；取消循环可及时退出。API race、全量 make test、前端 contract:check、干净 prepush 全通过。
- [x] 生产 metrics 改为 `fugue_dns_observation_*`，旧 publisher 指标退出生产输出；文档更新观测与 serving 的边界。
- [x] `aad532c04def4179a440ac1cd1d349433925cd3a` 经 [CI 35776847426](https://github.com/yym68686/fugue/actions/runs/35776847426) 仅发布 API，2/2 Ready；前端契约 `56ccfb68` 的 [CI 35776852308](https://github.com/yym68686/fugue-web/actions/runs/35776852308) 成功。
- [x] 发布前旧循环每分钟编译约 158 route 并写 2 份 node-scoped shadow。发布后新 Pod 只报告 observation，使用 verified policy active/1800 秒 cooldown，连续至少 10 次成功且错误为 0；跨 145 秒复查两份 legacy artifact ID/digest/创建时间完全未变。
- [x] 统一 producer 继续生成并自动验证新的 full `artifactrel_1790107775_06a383a4adca` / `artifact_1790107650_1c3ec22ad6a8`，LKG 正常推进。route 3/3、TLS 3/3、DNS 2/2 收敛、DNS serving 正常、旧请求仍 410。六条美国节点直查 SOA 均 sequence 839，本步 246 次跨 Edge HTTP 全部 200。
- [x] metrics 首次读取碰到退出旧 Pod、自动配置切换期间 convergence 首次不通过，均拒绝后重读，保留实际过程。
- [ ] 迁移 hosted DNS 委派/诊断等剩余 API 环境读取，删除只读 legacy migration 入口及其余重复投影；继续 DNS 无中断更新和未完成的恢复演练。

证据：[verified-policy-dns-observations-2026-09-22.json](verification/verified-policy-dns-observations-2026-09-22.json)。


### P0-EP-Y33：候选拒绝时持续验证旧 DNS artifact

- [x] 统一 serving sync 失败后的恢复收尾：旧 positive artifact 仍为实际 serving snapshot 时，重新采集其独立 route/TLS proof。覆盖 child/parent 下载、签名/schema/replay、候选 readiness、监听自检和持久化失败，避免坏候选长期占据同步流程而饿死旧 readiness。
- [x] 保留原 artifact、release、applied-at、签名、静态值 expiry 和磁盘 checkpoint；只刷新瞬态事实。不同 release 的 proof 不计为通过，max-stale 超期继续 SERVFAIL；取消操作不发起恢复探测。已经应用的候选或明确负向 readiness 观察不被旧状态覆盖，不报告候选 apply success。
- [x] OpenAPI 先记录语义并生成；九类失败/拒绝的真实同步回归、旧 artifact 持续应答、错误 proof 拒绝、expiry 不延长、DNS 全包 race、全量 make test、前端 contract:check 与干净 prepush 全通过。
- [x] `56749f65db0946a3adc58bb6b56939722da7d5e9` 经 [CI 35780051047](https://github.com/yym68686/fugue/actions/runs/35780051047) 正式发布 API 与两地 DNS client；前端契约 `a31dd86e` 的 [CI 35780052706](https://github.com/yym68686/fugue-web/actions/runs/35780052706) 成功。
- [x] 两台新 DNS positive checkpoint、新鲜 readiness、249 records、accurate inventory、独立 `/livez` 和 artifact serving 正常；当前 release route 3/3、TLS 3/3、DNS 2/2 收敛，API 2/2 与两地 authority 正常。美国独立节点六个 SOA 查询均 sequence 843。
- [x] 本步验收 189 次跨 Edge HTTP 全部 200。DNS 监控保留发布前本机 SOCKS 端口断开导致的 72 个 connection-refused 样本，以及欧洲 Pod 替换时三个 zone 的一次 EOF 轮次；恢复后连续复查通过。第一轮 Ready 清单过早读取也明确拒绝后重试。
- [ ] 继续 hosted DNS 与其他 API 环境配置迁移、DNS 无中断替换、超时恢复等未完成任务。生产未注入坏候选，本地失败回归不扩大为所有生产故障已演练。

证据：[dns-rejected-candidate-recovery-2026-09-22.json](verification/dns-rejected-candidate-recovery-2026-09-22.json)。


### P0-EP-Y34：委派配置绑定 verified traffic，修复多域 DNS 预检

- [x] 托管域创建与委派预检的 NS/glue 改为读取 verified TrafficReleaseSet LKG 绑定的 signed intent、输入 DNS policy 和明确 hosted-zone template；逐层验证签名、状态、digest 和来源引用，并在返回前重查 LKG。更新的未验证 producer policy、环境 NS 与 inventory 不能覆盖已声明配置。
- [x] 缺失或损坏 verified 配置时，创建域返回 503 且不写入；预检返回明确失败与空委派计划，保留已有 expected nameservers。静态 apex NS 不覆盖 authority policy，过期 glue 不复活，声明 glue 不被 inventory 地址改写。
- [x] 多域 DNS 使用 signed consumer node/group 约束下的新鲜物理节点 heartbeat，再执行目标域真实 UDP/TCP 探测；旧 per-zone alias 不覆盖物理 serving 状态。修复两个托管域实际解析正常、预检却报告零个节点的问题。
- [x] OpenAPI 先更新并生成，前端 contract:check、签名引用/错误配置/无写入/模板/glue/多域节点回归、API race、全量 make test 与干净 prepush 通过。vet 曾发现测试 fixture 复制带锁 cache，已改为只保存/恢复条目，再次通过完整检查。
- [x] `f002943fa75fff59414714e9e4e5963ae0efc466` 经 [CI 35785375428](https://github.com/yym68686/fugue/actions/runs/35785375428) 仅发布 API，2/2 Ready；前端契约 `4744e87f` 的 [CI 35785443326](https://github.com/yym68686/fugue-web/actions/runs/35785443326) 成功。
- [x] 两个现有托管域预检从 0 个健康节点/pass=false 恢复为 2 个真实物理节点、2/2 healthy/pass=true，NS 与 verified 源一致。当前 release route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 与实际 DNS serving 正常；美国独立节点直查六个 SOA 均 sequence 849。
- [x] 本步验收累计 294 次跨 Edge HTTP 全部 200。第一次读取 API 版本过早、第一轮预检出现一个非健康 heartbeat，均先拒绝后重新核对真实状态和新鲜事实；后续两域重复预检通过。生产只做只读预检，域创建和损坏输入由本地回归覆盖，没有修改 registrar。
- [ ] 继续删除 legacy migration/配置预览入口及 API 环境来源，将余下诊断中的旧 bundle simulation 改为 artifact/facts；DNS 无中断替换、超时恢复等其余任务仍未完成。

证据：[verified-dns-delegation-2026-09-22.json](verification/verified-dns-delegation-2026-09-22.json)。


### P0-EP-Y35：退役 ambient producer capture，预览必须选择签名 policy

- [x] producer schema 只接受 `business-static-intent` 和准确 intent ID/digest；删除 `business-migration` 生产分支。新策略验证、shadow 发布及已存储历史策略重新发布都执行相同强类型约束；历史内容仍可只读查询。
- [x] `routes/project` 必须传入唯一的 signed validated `producer_policy_artifact_id`：缺失、空值或重复返回 400；retired static-only selector 返回 410。无引用时不再从进程环境生成预览，错误引用不回退；原环境 capture adapter 只保留在历史比较测试。
- [x] 明确引用的草稿仍保留一致业务 snapshot、独立 runtime facts 和固定配置来源；预览不创建 artifact、release 或 LKG。生产 serving policy 已固定完整输入，本步没有修改其版本或观察窗口。
- [x] OpenAPI 先改并生成，前端 contract:check、非法/历史策略重新激活拒绝、原始内容可读、无写入、固定输入预览、API/producer race、全量 make test、真实 PostgreSQL producer guard 回归和干净 prepush 全通过。旧临时 PG 端口不可用、新测试库缺 schema marker 两次环境失败已记录；用仓库 schema migrator 初始化后成功重跑。
- [x] `6d48ba725e19593d2dcfe0abbb5d67ce83ead3c3` 经 [CI 35787806649](https://github.com/yym68686/fugue/actions/runs/35787806649) 仅发布 API，2/2 Ready；前端契约 `e4065ed9` 的 [CI 35787840132](https://github.com/yym68686/fugue-web/actions/runs/35787840132) 成功。
- [x] 生产旧入口分别返回预期 400/410，错误引用 503，现有准确 policy 预览 200、162 routes。新 API Pod 取得 leadership 后自行创建 `artifact_1790114170_21c7dfbf1863`，正常完成 gray、full 和 verified LKG；观察过程中保留原始创建日志，绑定当前 Pod 和准确 artifact。
- [x] 当前 release route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 正常；六个公网 SOA 同为 sequence 854。验收累计 333 次跨 Edge HTTP 全部 200。新周期按原 600 秒刷新及 gray/full 各 120 秒窗口等待，日志 tail 截断不当作生产失败或忽略证据。
- [ ] 继续迁移剩余 legacy defaults、显式 importer、API 环境 reader 与诊断模拟。已确认 Runtime Facts 查询漏掉 producer 发布事件且先 limit 后过滤，下一步修复；DNS 无中断更新和其余恢复演练仍未完成。

证据：[pinned-producer-inputs-2026-09-22.json](verification/pinned-producer-inputs-2026-09-22.json)。


### P0-EP-Y36：完整 Runtime Facts 历史查询与索引恢复

- [x] Runtime Facts 查询在已有 audit log 中先按 consumer/release/artifact kind 过滤，再排序和 limit；纳入 producer shadow、gray、full、verified LKG、rollback 事件。原事件 metadata、hash、provenance 不改写，不补造历史。
- [x] ReleaseSet 可通过 typed target、artifact reference 和 rollback 的显式恢复 LKG 引用找到历史；逻辑 consumer ID 兼容已保留 instance 映射，新签名 heartbeat 明确写入 consumer_id。非法/重复/越界 limit 返回 400，查询仍要求 platform admin 与 artifact.read。
- [x] OpenAPI 返回类型补齐事实列表及 audit chain/hash/provenance，并区分 unsigned operational audit 与 signed consumer evidence。前端同步、文件/PG 同义结果、旧事件验签、筛选前 limit、未知身份和注入字符串、只读、race、全量 make test 与 prepush 通过。
- [x] 首版 `de63f37342831c74df27d856221128e59cc41873` 经 [CI 35791548027](https://github.com/yym68686/fugue/actions/runs/35791548027) 上线。生产验收确认 `limit=1/2` 因历史查询执行路径在 10 秒超时返回 500，而 `limit=20/1000` 约 3.8 秒返回；该版本未作为本步验收通过，失败响应保留。
- [x] 增加现有 audit 表的 target-history B-tree 与 metadata JSONB GIN 索引，通过 schema migrator 在线、有限资源、有锁且可重试地创建；不匹配的已有索引拒绝替换。查询使用可索引的身份/JSON 条件，先解析旧 consumer 实例，避免小 limit 扫描无关最近事件；十秒超时保持。
- [x] 真实 PG 验证在线写入、取消恢复、重复执行不重建、错误定义拒绝、EXPLAIN 使用索引；十万条更新心跳之前的历史筛选仍约 3–5 毫秒。全量 make test、race、干净 prepush 再次通过。
- [x] 修复版 `43e0052dc7d25e61ec33f9c5596bba97973bdb5f` 经 [CI 35793247630](https://github.com/yym68686/fugue/actions/runs/35793247630) 先发布 schema，日志确认 migration complete/Ready，再发布 API 2/2 Ready，两个正式回执匹配；前端 `3d60cc88` 的 [CI 35791568513](https://github.com/yym68686/fugue-web/actions/runs/35791568513) 成功。
- [x] 同一历史 ReleaseSet 从空列表恢复为四条原始 producer 事件，逐条匹配发布前 audit source。生产 `limit=1/2` 耗时 0.941/0.776 秒，kind-only 查询 0.845 秒；逻辑 consumer 返回 20 条签名心跳，实例查询兼容。当前 route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 正常，六个公网 SOA 同为 sequence 860。
- [x] 两轮发布累计验收 393 次跨 Edge HTTP 全部 200。历史查询超时属于本步发现并已修复的问题，不以 serving 正常或 CI 成功掩盖；接口修复不等于全部 runtime fact 生命周期已实现。
- [ ] 继续把 robustness/委派中的旧生成器诊断改为 artifact 与当前运行事实，删除剩余 migration reader、API 环境来源，并完成 DNS 连续更新与其余故障恢复任务。

证据：[runtime-fact-history-2026-09-22.json](verification/runtime-fact-history-2026-09-22.json)。


### P0-EP-Y37：诊断读取真实 traffic artifact，删除请求式 DNS 生成

- [x] 委派 `route_dns_invariant` 和 robustness 的 route/DNS artifact 检查改为读取当前 group 选中的 signed TrafficReleaseSet、全部三个成员及准确 publication 的新鲜 authenticated consumer facts；不再读取业务表/环境临时编译 DNS 来证明 serving。
- [x] 验证成员签名、完整 lineage、route schema、准确 node/group/zone 的 DNS view、三类 expected sets 与消费者收敛；读取结束再次核对 publication。缺失、坏签名、陈旧/错误 release 事实、unknown zone/node、缺 expected sets 均失败，零 Edge 不再自动跳过并通过。
- [x] 复用只读 DNS artifact 视图解码，将旧请求式 `deriveEdgeDNSBundle` 移入历史测试；原 robustness check 名称兼容，evidence 改为实际 ReleaseSet/release IDs、三个 digest 和 required consumer count。诊断不写 artifact、release 或 LKG。
- [x] OpenAPI 先改并生成、前端 contract:check、环境/业务变化隔离与失败路径回归、API race、全量 make test、干净 prepush 通过。测试 fixture 初期类型/字段错误及空 route fixture 已在检查前修正；本地缓存空间不足风险通过清理本任务旧可重建缓存缓解，未跳过检查。
- [x] `9e6efa8e2e25b82271b58c1dfe42dd8ca1ae5d68` 经 [CI 35795639121](https://github.com/yym68686/fugue/actions/runs/35795639121) 仅发布 API，2/2 Ready；前端 `8503663d` 的 [CI 35795671089](https://github.com/yym68686/fugue-web/actions/runs/35795671089) 成功。
- [x] 发布前 production diagnostics 报告临时 `dnsenv_*`/2 records。发布后两个域预检及 robustness 都引用 full `artifactrel_1790118747_f337ee27450e` / `artifact_1790118623_486e6e883592`，162 routes、每域两台 consumer 共 4 条 view records，三个成员 digest 逐条匹配，required consumers=8。
- [x] 当前 route 3/3、TLS 3/3、DNS 2/2 收敛，API/authority 正常；六条公网 SOA 均 sequence 864，165 次跨 Edge HTTP 全部 200。首轮 route convergence 未通过时新诊断明确失败，之后核对准确 full publication 并重跑完整验收通过；不把其他 robustness 检查扩大为全部通过。
- [ ] 继续删除不再使用的 legacy compiler、migration comparison 入口及剩余环境/default reader；DNS 无间断替换、超时恢复及最终简化版其余任务仍待完成。

证据：[published-traffic-diagnostics-2026-09-22.json](verification/published-traffic-diagnostics-2026-09-22.json)。


### P0-EP-Y38：退役 legacy migration comparison API 与旧 DNS compiler

- [x] `/v1/admin/platform-config/routes/compare` 和 `/v1/admin/platform-config/dns/compare` 生产接口退役：认证请求返回 410，未认证/租户请求仍先返回 401/403；不读取旧 business/env serving 输入，不创建 artifact/release/LKG。
- [x] route/DNS 等价比较器与请求式 DNS compiler 移到 test-only adapters；历史语义回归继续可运行，但 production router、diagnostics、consumer 不再链接旧 compiler。测试只通过显式 adapter 调用。
- [x] OpenAPI 标记 retired/deprecated，runbook 改为使用 signed TrafficReleaseSet diagnostics、artifact/hostname lineage 和 Runtime Facts。全量 make test、API race、前端 contract:check、干净 prepush 通过。
- [x] `d6a84905d5d84e4fde7b722af740fe4a0de49a83` 经 [CI 35797366470](https://github.com/yym68686/fugue/actions/runs/35797366470) 仅发布 API，2/2 Ready；前端 `f67f4c12` 的 [CI 35797390023](https://github.com/yym68686/fugue-web/actions/runs/35797390023) 成功。
- [x] 生产旧接口均返回 410；两个域 route/DNS invariant 均引用真实 full `artifactrel_1790119829_74e6394ebd24`、required consumers=8，当前 route/TLS/DNS 3/3/2/2 收敛，API/authority 正常。六个公网 SOA 同 sequence 867，189 次跨 Edge HTTP 全部 200。
- [x] 生产验证全程只读，没有写 registrar、artifact、release 或 LKG；过渡发布中的旧 Pod/连接观察已保留，不能扩展为所有 rolling DNS 连接连续性已完成。
- [ ] 继续删除 remaining legacy reader、API 环境/default 来源和 migration-only adapters，完成 DNS 无中断替换、超时恢复和最终简化版清单。

证据：[retired-legacy-comparisons-2026-09-22.json](verification/retired-legacy-comparisons-2026-09-22.json)。


### P0-EP-Y39：Discovery route 摘要绑定 verified route artifact

- [x] Discovery bundle 的 `platform_routes` 改为从 verified global TrafficReleaseSet 的 route child artifact 投影；不再读取 `FUGUE_PLATFORM_ROUTES_JSON` 解析结果或 Server ambient routes。
- [x] 缺少 verified ReleaseSet 时 Discovery 仍返回 bootstrap topology，但 `platform_routes=[]`，不将旧环境 routes 作为 serving fallback。route child 损坏、签名/lineage 无效时 fail closed。
- [x] route artifact projection 保留 hostname、kind、upstream、TLS、route policy、group 和 status 摘要；结果数量和生成身份可与当前 full artifact 对照。新增 no-artifact ambient isolation 回归。
- [x] backend `8f6d69a09c0a1ef5fbaac8f8272abd00b2841c00` 的首次 CI 因 declarative release 缺同提交 API intent 被拒绝；在远端 main 上补 `1a33d5911a8d5210d32ff89a0f8de378df84f82e` intent-only 提交后，[CI 35801237504](https://github.com/yym68686/fugue/actions/runs/35801237504) 成功并部署 API。拒绝过程和补偿提交保留。
- [x] Discovery route count=162，与 verified full route artifact 的 162 条一致；API 2/2、route/TLS/DNS 3/3/2/2 收敛，两个域预检使用真实发布 artifact。独立六条 SOA sequence 保留在证据中；短窗口跨 Edge HTTP 监控无失败。
- [ ] 继续删除其他 API/default reader 和 serving 环境变量；Discovery 的其他非 serving bootstrap 字段仍待逐项迁移，DNS rolling 无中断和其余恢复演练仍未完成。

证据：[discovery-route-artifact-2026-09-23.json](verification/discovery-route-artifact-2026-09-23.json)。

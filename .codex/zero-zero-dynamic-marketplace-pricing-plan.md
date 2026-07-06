# 0-0 ChatGPT 账号池动态价格与临时动态分成方案

本文固定 0-0 账号池下一阶段的产品与工程方案：**先做动态价格**，让号商可以在平台模型配置价以内自行报价；**临时动态分成只做最小可控版本**，先保证平台不被低价报价穿透、结算可审计、线上可回滚。后续再把速度、稳定性、补号能力、失效率等质量因素纳入动态分成。

## 背景

当前 0-0 的 ChatGPT 账号池模型大致是：

- 管理员在模型配置里设置用户调用价格，例如按官方原价的 2.5% 收费。
- 用户把自己的 ChatGPT 账号放入账号池后，其他普通用户调用平台模型时，可能由 OAIX 调度到这些共享账号。
- 如果请求使用了其他用户的共享账号，0-0 根据 OAIX 返回的 token owner 信息给账号拥有者结算收益。
- 资源包余额、管理员手动调整余额、邀请奖励、试用额度、账号池收益再消费等非真实充值来源，不能参与账号池收益分配。

这个模型解决了“平台不用自己维护所有账号”的问题，但没有把调用用户利益放进市场机制里。所有账号都按同一个用户侧价格销售，低成本、高效率的供给无法通过更低价格让调用用户受益，也无法通过更高调度优先级自然胜出。

## 目标

1. 让账号拥有者可以给自己的 ChatGPT 账号池设置市场报价。
2. 普通调用用户实际支付价格不能高于当前模型配置价格。
3. 价格越低，在账号健康相近时越优先被调度。
4. 平台仍保留最低手续费 / 最低分成，避免变成纯粹给号商打工。
5. 只允许真实充值余额进入用户共享池和产生号商收益。
6. 动态价格先落地；动态分成先采用简单、可解释、可审计的临时公式。
7. 保持 uni-api 忠实透传，不把定价和调度策略写进 uni-api。

## 非目标

- 第一阶段不做完整自动竞价市场。
- 第一阶段不让调用用户手动选择号商或账号。
- 第一阶段不按每个模型、每个计划、每个地区设计复杂价格曲线。
- 第一阶段不把质量分、补号速度、失效率、429 概率等全部纳入分成公式，只记录观测数据。
- 不让账号池报价突破管理员模型配置价；管理员模型配置仍是用户侧最高价。

## 核心定义

### 官方原价

`official_cost_usd_micros`：按官方输入、输出、缓存、图片等原始价格计算出来的本次请求理论成本。它是所有折扣、报价、收益分配的共同基准。

### 模型配置价

`model_config_charge_usd_micros`：按 0-0 管理员模型配置计算出来的用户侧价格。当前线上类似“官方原价的 2.5%”属于这个层。

模型配置价是动态市场的用户侧价格上限：

```text
marketplace_charge <= model_config_charge
```

### 号商报价

`seller_price_bps`：号商给自己账号池设置的用户侧报价，单位是官方原价的万分比。

例如：

- `250 bps` = 官方原价的 2.5%
- `200 bps` = 官方原价的 2.0%
- `100 bps` = 官方原价的 1.0%

第一阶段把它定义为**最终用户侧市场价**，不是“号商拿到的成本价”。平台再从这个实际成交价里按临时分成公式扣除平台费用。

### 实际成交价

```text
marketplace_charge = min(
  model_config_charge,
  official_cost * seller_price_bps / 10000
)
```

这保证：

- 号商报价不会让用户比当前模型配置价付得更多。
- 号商报价越低，调用用户越便宜。
- 平台模型配置仍然是保底上限和兜底价格。

### 平台池请求

管理员、owner、资源包余额、不可分账余额、没有真实充值余额支撑的请求，只能使用平台自有池。它们不进入用户共享池，也不产生号商收益。

## 调度原则

0-0 仍然只负责请求身份、计费和收益结算；OAIX 负责账号池候选和 token 调度。

普通用户使用可分账真实充值余额时：

```http
X-OAIX-Act-As-User: <platform owner id>
X-OAIX-Selection-Mode: marketplace
X-OAIX-Exclude-Owner: <当前用户 oaix owner id>
```

如果管理员开启动态价格，0-0 将 `X-OAIX-Selection-Mode` 从 `marketplace` 提升为显式 opt-in 的 `marketplace-priced`：

```http
X-OAIX-Act-As-User: <platform owner id>
X-OAIX-Selection-Mode: marketplace-priced
X-OAIX-Exclude-Owner: <当前用户 oaix owner id>
```

`marketplace` 仍走既有共享池策略；`marketplace-priced` 才允许 OAIX 在新 lane 候选里使用报价排序，并要求 0-0 按 OAIX 返回的报价 header 结算。这样动态价格关闭时不会改变现有缓存率和 affinity 行为。

管理员 / owner / 资源包余额 / 不可分账余额请求：

```http
X-OAIX-Act-As-User: <platform owner id>
```

不带 `X-OAIX-Selection-Mode: marketplace`，OAIX 自然只走平台自有池。

动态价格上线后，OAIX marketplace 调度必须保护现有 prompt cache affinity。价格不能替代已有 affinity 选号策略，只能参与“新候选”的排序。

实际优先级：

1. 如果 `previous_response_id` 命中已有 response owner，优先继续使用原 token。
2. 如果 prompt affinity lane 里已有 `primary_token_id` 且可用，继续使用 primary。
3. 如果 affinity lane 里的 secondary token 可用，继续使用 lane。
4. 只有需要创建新 lane，或已有 lane token 冷却、禁用、并发满、失效时，才进入新候选排序。
5. 新候选必须是 `share_enabled=true` 且 `share_status=active` 的共享账号。
6. 新候选必须不属于 `X-OAIX-Exclude-Owner` 指定 owner。
7. 新候选必须未禁用、未冷却、并发未满。
8. 新候选先按价格桶排序，再按现有 rendezvous / stable hash / 健康状态排序。
9. 价格相同或同桶时，再按健康度、剩余额度、并发占用、近期失败率、计划类型等排序。

第一阶段的策略是：

```text
缓存亲和命中 > 健康可用性 > 新 lane 价格优先 > 稳定散列 / 健康 tie-break
```

这样动态价格主要影响新 prompt、新 lane 和 global fallback，不会把已经形成缓存亲和的流量频繁迁走。

### 缓存率保护原则

动态价格实现必须满足：

- 不因为某个账号报价更低而抢占已有 `previous_response_id` 命中的 token。
- 不因为某个账号报价更低而抢占已有 prompt affinity primary token。
- 不因为 1 bps 的报价差导致大量已有 lane 迁移。
- 报价变化只影响新 lane 创建，或 lane TTL 过期后的重新选择。
- 价格排序建议使用价格桶，例如每 10 bps 一个桶；同桶内继续保持当前稳定选择逻辑。
- 动态价格必须通过 `marketplace-priced` 显式开启，默认 `marketplace` 不做价格排序。
- 启用后必须持续对比 `cache_hit_ratio`、`cached_input_tokens/input_tokens`、`cache_affinity_result` 分布和 token 切换率。

只有当显式 opt-in 观察证明缓存率没有实质下降，才能扩大动态价格流量。

## OAIX 修改方案

OAIX 需要成为账号报价和调度报价的真实来源，因为 token 是 OAIX 选择的，0-0 不能在请求完成后凭本地缓存猜测这次选中了哪个报价。

### 数据模型

给 token 或 owner 级共享配置增加报价字段：

```text
marketplace_price_bps integer nullable
marketplace_price_updated_at timestamptz nullable
marketplace_price_source text not null default 'owner_default'
```

建议第一阶段支持：

- owner 账号池默认报价。
- token 级 override 预留字段，但前端可先不开放。

### API

新增或扩展 OAIX API：

```http
PATCH /api/tokens/marketplace-price
```

请求体：

```json
{
  "all": true,
  "token_ids": [],
  "price_bps": 200
}
```

规则：

- 必须按当前 owner scope 操作。
- service/admin + `X-OAIX-Act-As-User` 只能改 act-as owner 的 token。
- 不能跨 owner。
- `price_bps` 必须在 OAIX 允许范围内，例如 `0 <= price_bps <= 250`，实际上限由 0-0 管理端配置或服务端配置同步。
- 返回更新数量和最新 pool summary。

扩展：

```http
GET /api/me/pool-summary
GET /api/tokens
```

返回字段增加：

```json
{
  "marketplace_price_bps": 200,
  "marketplace_price_source": "owner_default"
}
```

### 响应 Header

OAIX 在 marketplace 请求成功选中共享账号时，必须返回：

```http
X-OAIX-Token-ID: <token id>
X-OAIX-Token-Owner-User-ID: <oaix owner id>
X-OAIX-Marketplace-Price-BPS: <seller price bps>
X-OAIX-Marketplace-Price-Source: owner_default|token_override
X-OAIX-Selection-Mode: marketplace
```

0-0 没拿到这些 header 时，不能按动态价格结算，只能走安全兜底。

## 0-0 后端修改方案

### 配置

新增管理员级动态市场配置：

```text
marketplace_dynamic_pricing_enabled boolean default false
marketplace_min_price_bps integer default 0
marketplace_max_price_bps integer default 250
marketplace_price_change_cooldown_seconds integer default 300
marketplace_missing_price_header_policy text default 'fallback_to_model_price'
marketplace_temporary_share_enabled boolean default true
marketplace_platform_min_share_bps integer default 1000
marketplace_platform_min_rate_bps_of_original integer default 20
marketplace_owner_share_min_bps integer default 5000
marketplace_owner_share_base_bps integer default 7000
marketplace_owner_share_low_price_bonus_bps integer default 2000
marketplace_owner_share_max_bps integer default 9000
```

说明：

- `marketplace_max_price_bps` 不能高于当前模型配置价对应的有效 bps。实际请求结算时仍以 `min(model_config_charge, seller_quote_charge)` 为准。
- `marketplace_platform_min_rate_bps_of_original=20` 表示平台至少保留官方原价的 0.2% 作为平台费用，可根据线上数据调整。
- 所有默认值只是第一阶段建议值，上线前应在管理员设置里可见、可调、可审计。

### 数据表

新增账号池报价设置表：

```sql
create table user_chatgpt_pool_marketplace_settings (
  id bigserial primary key,
  user_id bigint not null references users(id),
  oaix_user_id bigint not null,
  pricing_enabled boolean not null default true,
  default_price_bps integer not null,
  price_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
```

预留 token 级报价 override：

```sql
create table user_chatgpt_token_marketplace_prices (
  id bigserial primary key,
  user_id bigint not null references users(id),
  oaix_user_id bigint not null,
  oaix_token_id bigint not null,
  price_bps integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, oaix_token_id)
);
```

扩展 `llm_usage_events`：

```text
official_cost_usd_micros
model_config_charge_usd_micros
actual_charge_usd_micros
marketplace_price_bps
marketplace_pricing_applied
marketplace_pricing_fallback_reason
marketplace_discount_usd_micros
```

如果现有字段已经承载其中一部分语义，迁移时必须保持旧字段含义不变，只新增缺失字段或建立清晰兼容注释。

扩展 `oaix_marketplace_settlements`：

```text
marketplace_price_bps
model_config_price_bps
pricing_mode
price_source
owner_share_bps
platform_fee_usd_micros
owner_earning_usd_micros
dynamic_pricing_applied
eligible_settlement_base_usd_micros
```

### 计费流程

请求完成后，0-0 结算流程应按以下顺序执行：

1. 用现有模型价格逻辑计算 `official_cost_usd_micros`。
2. 用管理员模型配置计算 `model_config_charge_usd_micros`。
3. 判断请求是否真实使用 marketplace 账号：
   - `X-OAIX-Selection-Mode=marketplace` 或 `marketplace-priced`
   - 有 `X-OAIX-Token-Owner-User-ID`
   - owner 映射到其他 0-0 用户
4. 判断是否可以应用动态价格：
   - 动态价格功能已开启，且本次请求使用 `marketplace-priced`。
   - 请求使用真实充值可分账余额。
   - OAIX 返回合法 `X-OAIX-Marketplace-Price-BPS`。
5. 如果可以应用动态价格：

```text
quote_charge = official_cost * seller_price_bps / 10000
actual_charge = min(model_config_charge, quote_charge)
```

6. 如果不能应用动态价格：

```text
actual_charge = model_config_charge
```

7. 钱包扣费按 `actual_charge` 分配。
8. 只有真实充值来源对应的实际扣费部分进入 `eligible_settlement_base_usd_micros`。
9. 用临时动态分成公式计算 owner earning 和 platform fee。
10. 写入 usage event、settlement、ledger、日志。

### 缺 Header 的安全兜底

如果 OAIX 返回 owner token 但缺少价格 header：

- 不应用动态价格。
- 按模型配置价扣费。
- 可以继续按当前固定分成逻辑结算，或按管理员配置关闭该次分成。
- 必须记录 `marketplace_pricing_fallback_reason='missing_price_header'`。

不能凭 0-0 本地缓存猜测 token 报价，否则会出现“OAIX 实际选中 A 账号，但 0-0 按 B 账号报价结算”的错账风险。

## 临时动态分成方案

临时分成只考虑价格，不考虑质量。原因是质量因子需要更长时间收集稳定数据，否则容易让用户觉得分成规则不可解释。

### 默认参数

```text
owner_share_min_bps = 5000
owner_share_base_bps = 7000
owner_share_low_price_bonus_bps = 2000
owner_share_max_bps = 9000
platform_min_share_bps = 1000
platform_min_rate_bps_of_original = 20
```

### 公式

```text
discount_score =
  clamp((model_config_price_bps - seller_price_bps) / model_config_price_bps, 0, 1)

desired_owner_share_bps =
  clamp(
    owner_share_base_bps + discount_score * owner_share_low_price_bonus_bps,
    owner_share_min_bps,
    owner_share_max_bps
  )

platform_fee =
  max(
    eligible_settlement_base * (10000 - desired_owner_share_bps) / 10000,
    official_cost * platform_min_rate_bps_of_original / 10000,
    eligible_settlement_base * platform_min_share_bps / 10000
  )

owner_earning =
  max(0, eligible_settlement_base - platform_fee)

effective_owner_share_bps =
  owner_earning / eligible_settlement_base
```

### 解释

- 号商价格越低，分成比例可以越高。
- 价格越低时，单次绝对收益可能下降，但调用概率提高。
- 平台始终保留最低收入，避免价格竞争把平台抽成压到 0。
- 调用用户获得直接低价收益，不只是平台和号商之间零和分配。

## 未来动态分成方向

第二阶段再引入质量分：

```text
quality_score =
  额度健康分
  + 并发可用分
  + 近 24h 成功率
  + 近 24h 429 惩罚
  + 重登频率惩罚
  + 补号及时性
  + 响应延迟分
```

未来分成可改为：

```text
owner_share = base + price_bonus + quality_bonus - risk_penalty
```

但第一阶段只记录这些指标，不参与收益，避免过早把规则复杂化。

## 0-0 前端修改方案

普通用户界面不显示 OAIX 字样。

### 设置页 ChatGPT 账号池

账号池卡片增加“市场价格”控制：

- 当前报价：例如 `官方原价 2.0%`。
- 价格输入：支持 bps 或百分比展示。
- 辅助文案：`价格越低，健康状态相近时越容易被调用。实际收益取决于调用量和平台分成规则。`
- 保存时调用 0-0 后端，0-0 再调用 OAIX，OAIX 成功后本地才更新。

账号池摘要增加：

- 当前报价。
- 近 24h 平均成交价。
- 近 24h 成交请求数。
- 总收益。

### 查看账号表格

账号表格增加：

- 市场价格列。
- 收益列。
- 共享赚钱状态。
- 后续可加 token 级报价 override。

继续使用分页表格，不把大量账号渲染成卡片。

### 管理员设置

管理员设置增加“账号池市场价格”区域：

- 是否启用动态价格。
- 最低报价 bps。
- 最高报价 bps。
- 缺少 OAIX 价格 header 时的兜底策略。
- 平台最低手续费。
- 临时分成参数。

管理员模型配置仍是用户侧价格上限，不在设置页重复做模型折扣配置。

### 管理员用户详情

用户详情里的账号池区域显示：

- 账号池报价。
- 共享账号数量。
- 近 24h 成交请求数。
- 平均成交价格。
- 平台费用。
- 用户收益。

备用渠道区域继续只显示自用路由，不显示赚钱、收益、报价。

### 日志和账单

调用用户日志：

- 显示实际扣费。
- 可选显示“市场价优惠”，不显示号商身份。

账号拥有者日志：

- 显示收益金额。
- 显示成交价格 bps。
- 不显示调用用户身份。

管理员日志：

- 显示 selected owner、token、price bps、platform fee、fallback reason。

## API 草案

0-0 后端新增或扩展：

```http
GET /api/byok/chatgpt/pool
PATCH /api/byok/chatgpt/pool/pricing
PATCH /api/byok/chatgpt/tokens/{token_id}/pricing
GET /api/admin/settings/marketplace-pricing
PATCH /api/admin/settings/marketplace-pricing
GET /api/admin/marketplace/pricing-diagnostics
```

`PATCH /api/byok/chatgpt/pool/pricing` 请求体：

```json
{
  "default_price_bps": 200
}
```

返回：

```json
{
  "default_price_bps": 200,
  "effective_min_price_bps": 0,
  "effective_max_price_bps": 250,
  "updated_count": 12,
  "pool_summary": {}
}
```

## 上线策略

### 阶段 0：文档和数据核对

- 确认现有模型成本字段语义。
- 确认 `wallet lot` 已能区分真实充值和不可分账余额。
- 确认 streaming 请求完成时能拿到 OAIX response headers 和 usage。

### 阶段 1：OAIX 支持报价

- OAIX 支持 owner/token 报价存储。
- OAIX 支持 act-as owner 批量更新报价。
- OAIX marketplace 只在新 lane / global fallback 候选中按报价排序。
- OAIX 已有 `previous_response_id` 和 prompt affinity lane 命中时继续优先使用原 token。
- OAIX 返回价格 header。

### 阶段 2：0-0 显式 opt-in 与审计

- 0-0 记录 OAIX 价格 header。
- 只有管理员开启动态价格时，0-0 才向 OAIX 发送 `X-OAIX-Selection-Mode: marketplace-priced`。
- 动态价格关闭时继续发送原 `marketplace`，不改变既有缓存亲和与共享池调度。
- 管理员诊断页展示缺 header、fallback、成交价、平台 fee 和动态价格命中情况。
- 观察 `cache_hit_ratio`、缓存 token 数、affinity 命中分布和 token 切换率。

### 阶段 3：小流量启用

- 对管理员测试用户开启动态价格。
- 验证扣费、分账、日志、账单一致。
- 验证缺 header 和异常返回都走安全兜底。

### 阶段 4：公开启用

- 打开普通用户报价 UI。
- 启用动态价格。
- 监控平台收入、用户价格、号商收益、可用账号数量。

## 观测与审计

每次 marketplace 请求至少记录：

```text
request_trace_id
user_id
model
marketplace_eligible
dynamic_pricing_enabled
oaix_token_id
oaix_owner_user_id
seller_price_bps
model_config_charge_usd_micros
official_cost_usd_micros
actual_charge_usd_micros
marketplace_discount_usd_micros
eligible_settlement_base_usd_micros
owner_share_bps
owner_earning_usd_micros
platform_fee_usd_micros
fallback_reason
cache_affinity_result
cache_affinity_lane_index
cache_hit_ratio
cached_input_tokens
input_tokens
dynamic_price_candidate_token_id
dynamic_price_candidate_price_bps
dynamic_price_candidate_would_replace_affinity
```

核心指标：

- 动态价格请求占比。
- 平均 seller price bps。
- 平均实际用户折扣。
- 平台 fee 占比。
- 缺 price header 次数。
- 因不可分账余额而回平台池次数。
- 价格最低账号的成功率和 429 率。
- `primary_hit` / `lane_hit` / `lane_created` / `global_fallback` 分布。
- `cached_input_tokens / input_tokens` 缓存率。
- 动态价格候选与实际 affinity token 不一致次数。
- 动态价格导致新 lane 价格分布变化。

## 风险与约束

### 双重打折风险

动态价格必须基于官方原价计算，然后再 cap 到模型配置价，不能在已打折价格上再次按 bps 打折。

### 错账风险

0-0 必须以 OAIX 返回的实际选中 token 和 price header 为准。没有 header 时不能猜。

### 低价穿透风险

必须保留平台最低手续费和最小平台分成。

### 价格频繁变更风险

报价变更建议加冷却期，例如 5 分钟。请求开始时锁定价格，后续报价变化不影响 in-flight 请求。

### 质量不可见风险

第一阶段价格会强影响调度，但质量只做过滤和排序辅助。需要同步记录质量数据，为第二阶段动态分成做准备。

### 缓存率下降风险

OAIX 当前缓存率依赖 prompt affinity lane 和 previous response owner。如果动态价格直接替代 affinity 选择，会把同一个 prompt / session 的请求迁移到不同 token，导致缓存命中下降。

约束：

- 动态价格不能抢占 `previous_response_id` 命中。
- 动态价格不能抢占已有 prompt affinity primary / secondary lane。
- 动态价格只影响新 lane 创建和 global fallback。
- 价格变化不立即打散已有 lane。
- 默认必须保持原 `marketplace` 行为不变；只有显式开启 `marketplace-priced` 才进入动态价格排序。
- 扩大动态价格流量前必须观察证明缓存率没有实质下降。

## 测试重点

### 后端单元测试

- `seller_price_bps < model_config_bps` 时按 seller price 收费。
- `seller_price_bps > model_config_bps` 时按 model config cap 收费。
- 缺 OAIX price header 时不应用动态价格。
- admin / owner / resource pack / adjustment / referral / earning balance 请求不进入 marketplace。
- 只有真实充值 lot 产生 eligible settlement base。
- 平台最低手续费生效。
- owner earning 不超过 eligible settlement base。
- streaming completion 能写入动态价格字段。

### OAIX 集成测试

- owner 默认报价能批量写入 token。
- act-as owner 不能改其他 owner token。
- marketplace 新 lane 候选按价格优先选择。
- 已有 `previous_response_id` 命中时，不因更低价 token 抢占。
- 已有 prompt affinity primary / secondary lane 命中时，不因更低价 token 抢占。
- 报价变化不迁移已有 lane，只影响新 lane 或 TTL 过期后的选择。
- token 冷却、禁用、并发满时不会因为价格低被选中。
- 返回 header 包含 owner、token、price。

### 前端测试

- 账号池报价输入校验。
- 保存失败时不本地假写成功。
- 账号池价格不出现在备用渠道卡片。
- 管理员动态价格设置 loading / error / disabled 状态正确。
- 大账号池分页表格不卡顿。

## 待办清单

### 产品规则

- [x] 确认动态价格启用后，管理员模型配置价就是用户侧最高价。
- [x] 确认 `seller_price_bps` 表示最终用户成交价，而不是号商成本价。
- [x] 确认第一阶段报价范围默认 `0..250 bps`，上线前可由管理员调整。
- [x] 确认不可分账余额继续只走平台自有池。
- [x] 确认动态分成第一阶段只使用价格因素，不使用质量因素。
- [x] 确认动态价格不能抢占已有 prompt cache affinity 命中。
- [x] 确认价格只影响新 lane、lane TTL 过期后的重新选择和 global fallback。

### OAIX

- [x] 增加 owner/token 报价字段。
- [x] 增加批量更新 token 报价 API。
- [x] 支持 service/admin + `X-OAIX-Act-As-User` 按 act-as owner 更新报价。
- [x] `GET /api/me/pool-summary` 返回报价摘要。
- [x] `GET /api/tokens` 返回 token 报价。
- [x] `marketplace-priced` 新 lane / global fallback 按价格和健康状态选择候选。
- [x] 保持 `previous_response_id` 命中优先于动态价格。
- [x] 保持 prompt affinity primary / secondary lane 命中优先于动态价格。
- [x] 报价变化不主动迁移已有 affinity lane。
- [x] 同价格桶内继续使用当前稳定散列 / rendezvous tie-break。
- [x] marketplace 请求返回 token owner、token id、price bps、price source headers。
- [x] 增加 OAIX 报价和调度测试。

### 0-0 后端

- [x] 增加动态市场全局设置。
- [x] 增加账号池默认报价表。
- [x] 预留 token 级报价 override 表。
- [x] 扩展 usage event 记录官方原价、模型配置价、实际成交价、报价 bps、fallback reason。
- [x] 扩展 marketplace settlement 记录动态价格和平台 fee。
- [x] 增加 `PATCH /api/byok/chatgpt/pool/pricing`。
- [x] 增加管理员动态价格设置 API。
- [x] 接入 OAIX 报价 API，OAIX 失败时不本地假写成功。
- [x] 在 llm proxy completion 里解析 OAIX price headers。
- [x] 用 `marketplace-priced` 显式 opt-in 代替默认改写调度，未开启时保持原 `marketplace` 行为。
- [x] 记录动态价格是否应用、fallback reason、成交价、平台 fee 和报价 header。
- [x] 保留 route/usage 观测字段，用于对比缓存率、affinity 命中分布和 token 切换率。
- [x] 实现动态价格实际扣费。
- [x] 实现临时动态分成公式。
- [x] 保持不可分账余额只走平台池。

### 0-0 前端

- [x] 设置页账号池卡片增加市场价格控制。
- [x] 查看账号表格增加市场价格列。
- [x] 管理员设置页增加动态价格配置。
- [x] 管理员用户详情显示账号池报价和成交统计。
- [x] 日志页展示调用用户实际扣费和账号拥有者收益。
- [x] 备用渠道继续不显示赚钱、收益、报价。
- [x] 所有保存失败都显示明确错误，不本地假写成功。
- [x] 大账号池继续使用分页表格和 loading 状态。

### 观测与审计

- [x] usage event 记录动态价格关键字段。
- [x] settlement 记录平台 fee、owner earning、share bps。
- [x] 管理员诊断页展示缺 header、fallback、成交价和平台 fee。
- [x] 动态价格通过显式 `marketplace-priced` 开关隔离，缓存率和 affinity 影响可按启用前后运行指标观察。
- [x] 增加动态价格指标和结构化字段。
- [x] 保留 cache hit ratio、cache affinity result、token switching rate 的运行观测入口。
- [x] 增加价格变更 audit log。

### 测试与上线

- [x] 增加价格公式单元测试。
- [x] 增加 settlement 单元测试。
- [x] 增加 streaming 动态价格集成测试。
- [x] 增加 previous response owner 不被低价 token 抢占测试。
- [x] 增加 prompt affinity primary / secondary 不被低价 token 抢占测试。
- [x] 增加新 lane 才按价格排序测试。
- [x] 增加显式 opt-in 模式不影响默认 `marketplace` 调度的测试。
- [x] 增加 OAIX act-as 权限测试。
- [x] 完成前端报价表单类型检查和 lint 验证。
- [x] 通过管理员动态价格开关进行 opt-in 上线观察。
- [x] 支持对测试用户小流量启用。
- [x] 支持观察平台收入、用户价格、号商收益、失败率。
- [x] 支持由管理员开关控制是否对全部账号池用户开放。

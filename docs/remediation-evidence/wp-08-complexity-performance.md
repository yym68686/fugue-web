# WP-08 / WP-11 复杂度与性能 before/after

日期：2026-07-12

## Client module 与 workbench

| 指标 | Before | After | 行为等价性 |
| --- | ---: | ---: | --- |
| Console mega-module | `interactive.tsx` 5,038 行 / 170,930 bytes / 77 个顶层声明 | 按 Auth、Deploy、Gallery、Workbench、Billing、Keys、Servers、Profile、Admin、DNS vertical slice 拆分 | URL、API、view model 和产品操作名不变 |
| Workbench initial shell | mega-module 整体被 consumer 解析 | `project-workbench.tsx` 735 行 / 23,646 bytes | Route/Overview/Domains 保持首屏；Server Component 传入 serializable initial detail |
| 非活跃 panels | 与主模块同一加载边界 | deferred tabs 586 行，Environment/Logs/Files/Images/Observability 五个 dynamic imports | hover/focus 预加载；只有 active panel mount/fetch，不活跃 panel 不产生请求 |
| endpoint race | 慢 A response 可能晚于 B | request identity + AbortController，旧 completion `O(1)` 丢弃 | 选择 B 后不会显示 A，404/403/network/retry 状态按 endpoint 隔离 |

拆分后的导出、调用方、local state 与副作用完整清单见
`wp-08-client-module-inventory.md`。没有为无测量依据的普通 lookup 引入全局 memo/Map；
稳定排序、重复 key、引用 identity、授权过滤和 cache invalidation 语义保持不变。

## 大列表与缓存

| 优化 | Before complexity | After complexity | 证据 |
| --- | --- | --- | --- |
| Admin users/apps | 无界 `O(N)` 数据传输、内存与前端 render | 索引 seek `O(log N + k)`，users `k <= 100`、apps `k <= 200` | 10,000+ row EXPLAIN/遍历、无重复/遗漏和内存上限见 `wp-11-admin-pagination.md` |
| Expiring cache invalidation | invalidate 时旧 inflight loader 可复活 stale value | key generation 比较和 clear generation，旧 loader completion `O(1)` 拒绝写入 | deferred Promise unit tests；billing mutation 同时驱逐 summary/image 五分钟 cache |
| Gallery/workbench first data | mount 后 client waterfall | Server Component 首取并传递 serializable view model | E2E request-count 和 no-waterfall contract；手动 refresh 仍强制重新读取 |

## Bundle 与 4x CPU 测量

最终 settled build 重新生成 `artifacts/route-bundles.json`。当前测量中 `/` 183.9 KiB、
Docs 184.8 KiB、Auth sign-in/sign-up 197.5 KiB、Console project route 233.6 KiB gzip，分别低于
200/250 KiB route budget；最大 app-owned chunk 低于 80 KiB。Auth 在 native semantic field
替换重客户端 radio primitive 后从约 204.9 KiB 降到 197.5 KiB，并继续由 200 KiB gate
约束。

`artifacts/performance/console-workbench-4x-cpu.json` 是 Chromium desktop、4x CPU throttle
下的实验室 smoke：本轮完整 205-case matrix 中 Environment 切换 763.4 ms、Logs 312.8 ms、
最大 Event Timing 56 ms、0 个 long task、交互窗口 TBT 0 ms，均低于测试的 1,000 ms fail
threshold。它是低端 CPU 的 synthetic evidence，不冒充 field INP；生产发布后继续监控真实
Core Web Vitals 和客户端错误率。

第一次不限制本机 worker 的完整 `fullyParallel` 回归出现过一次 2,056.1 ms 的冷 deferred
chunk wall-clock outlier；同一窗口 Event Timing 仅 64 ms、TBT 6 ms。随后单 worker 隔离复跑
5/5 通过，清空负载后的完整 205-case matrix 也 107 pass / 98 expected skip / 0 fail，并生成
上述最终 artifact。测试阈值保持 1,000 ms，没有为通过而放宽；后续可把多样本
median/p75 采集拆成独立性能 job，避免把宿主调度抖动误判为主线程回归。

`artifacts/performance/local-browser-smoke.json` 的 Docs navigation 记录 CLS 0、TBT 0、
long task 0、LCP 448 ms 和约 44 ms interaction-to-next-paint approximation。所有优化
都同时有行为回归测试，不能只凭 bundle 变小判定成功。

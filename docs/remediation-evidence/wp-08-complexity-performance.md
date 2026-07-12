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

最终 settled build 重新生成 `artifacts/route-bundles.json`。当前测量中 `/` 180 KiB、
Docs 181 KiB、Auth sign-in/sign-up 193 KiB、Console project route 229 KiB gzip，分别低于
200/250 KiB route budget；最大 app-owned chunk 低于 80 KiB。Auth 在 native semantic field
替换重客户端 radio primitive 后从约 204.9 KiB 降到 194.1 KiB，并继续由 200 KiB gate
约束。

`artifacts/performance/console-workbench-4x-cpu.json` 是 Chromium desktop、4x CPU throttle
下的确定性实验室 smoke：Environment 切换 394 ms、Logs 442 ms、最大 Event Timing 56 ms、
12 个 long task、最大 82 ms、TBT 258 ms，均低于测试的 1,000 ms fail threshold。它是
低端 CPU 的 synthetic evidence，不冒充 field INP；生产发布后继续监控真实 Core Web
Vitals 和客户端错误率。

`artifacts/performance/local-browser-smoke.json` 的 Docs navigation 记录 CLS 0、TBT 0、
long task 0、LCP 348 ms 和约 33.6 ms interaction-to-next-paint approximation。所有优化
都同时有行为回归测试，不能只凭 bundle 变小判定成功。

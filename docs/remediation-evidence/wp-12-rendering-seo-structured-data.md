# WP-12 渲染、缓存、SEO 与结构化数据决策

日期：2026-07-12

## Public 渲染与缓存策略

首页、Docs、Auth 和 Console 共享服务端 locale negotiation。Root layout 必须根据
`fg_locale` Cookie 或 `Accept-Language` 在首个 HTML response 上输出正确的 `lang`、`dir`
与本地化共享 chrome；把 locale 延后到 hydration 会造成错误语言的首屏、读屏语义和
metadata。因此这些页面保留 request-dynamic 渲染，而不是伪装成所有用户共享的一份
静态 HTML。

动态渲染的缓存边界由 `apps/web/proxy.ts` 明确约束：

- rendered page response 使用
  `Cache-Control: private, no-store, no-cache, max-age=0, must-revalidate`；
- `Vary` 保留 Next.js 已有字段，并增加 `Accept-Language`、`Cookie`；
- `/api`、`/healthz`、Next static/image、robots、sitemap 和带扩展名的静态 asset 不被
  page policy 覆盖，各自保留 route/asset 的专用策略；
- E2E 直接读取真实 document response headers，防止 CDN/Caddy 再次把 Docs、Auth 或
  protected redirect 变成 shared public cache。

首页不再为 session CTA 单独获取用户态；保留 dynamic 的唯一 public 产品理由是服务端
locale-correct document。私有 Console 同时依赖 active session，必须同样 no-store。

## SEO 与 JSON-LD

- `/` 与 `/docs` 有唯一 title、description、canonical、Open Graph/Twitter metadata 和
  index/follow robots；`robots.txt` 与 sitemap 只列这两个 canonical public routes。
- Auth、Console、Admin、callback/finalize 和用户私有页面不进入 sitemap，并输出
  noindex/nofollow。
- 当前可见页面没有可诚实映射的组织资质、评分、FAQ、offer 或其他 rich-result 对象，
  所以按“只有存在真实可见对应内容才添加 JSON-LD”的规则明确选择不输出 JSON-LD。
- Playwright 在浏览器渲染后断言首页和 Docs 的
  `script[type="application/ld+json"]` 数量为 0；这同时是当前结构化数据策略的等价
  validator。因为实际结构化数据集合为空，Google Rich Results Test 没有可验证对象，
  结果为 N/A，而不是伪造 schema 以满足工具。

## Docs 深链

Docs 章节有稳定 id、scroll margin、单一可见目录和 `aria-current="location"`。浏览器
E2E 从 `/docs#topology` 直接打开，切换到 `#diagnose`，再执行 history back，逐步断言 URL、
current link 和目标 heading viewport 定位，覆盖直接深链与返回恢复。

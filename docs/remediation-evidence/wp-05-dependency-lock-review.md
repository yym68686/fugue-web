# WP-05 Bun lockfile 与安装脚本人工审查

日期：2026-07-12
审查对象：`package.json`、所有 workspace `package.json`、`bun.lock`、
`patches/next@16.2.10.patch` 与删除的 `package-lock.json`。

## 结论

- 正式 package manager 固定为 Bun `1.3.1`；所有直接依赖使用精确版本或
  `workspace:*`，没有 `latest`、caret、tilde、Git branch 或 floating URL。
- `bun.lock` 的 709 个外部 package resolution 均有 `sha512` integrity；resolution
  source 字段全部为空，未发现 `git+`、GitHub、SSH、HTTP tarball、`file:` 或
  `link:` 外部来源。Workspace 依赖只解析到仓库内 `apps/*` / `packages/*`。
- 唯一 patched dependency 是 `next@16.2.10`，补丁固定在仓库内
  `patches/next@16.2.10.patch`；原因、上游 issue、删除条件和 production runtime
  contract test 记录在 `docs/adr/0002-next-app-router-vary-header-patch.md`。
- 唯一显式 `trustedDependencies` 是仓库内的 `@fugue/ui-registry`。它唯一的 lifecycle
  script 是 `postinstall: fumadocs-mdx`，只生成 registry 文档 source；没有外部 package
  获得 lifecycle script 信任。
- `bun pm untrusted` 返回 `0` 个带未信任脚本的 dependency。Frozen install 不需要
  放宽 script policy，也没有通过环境变量动态改变依赖来源。
- 原 `package-lock.json` 使用 `next/react/react-dom/typescript/@types/* = latest` 或
  宽松 range，且只描述旧的单包 npm 布局；删除它是 Bun workspace cutover 的独立
  toolchain 变更，不再保留第二个互相漂移的 lockfile。

## 审查命令与结果

```text
bun install --frozen-lockfile
PASS；lockfile 未变化

bun pm untrusted
PASS；Found 0 untrusted dependencies with scripts

rg 'https?://|git\+|github:|git@|ssh://|file:|link:' bun.lock package.json apps/*/package.json packages/*/package.json
PASS；没有 dependency source 命中

逐行核对 bun.lock packages resolution
709 external entries；709/709 含 sha512 integrity；0 non-empty source fields

bun run security:audit
PASS；0 Critical / 0 High / 0 Moderate / 0 Low

bun run licenses:check
PASS；COSS provenance、NOTICE、license allowlist 与 CycloneDX SBOM 已生成
```

最终 settled-tree 仍会重新运行 frozen install、security audit、license/SBOM、版本唯一性
和 production container gate；如果随后发生任何 manifest/lockfile diff，本审查结论失效，
必须重新核对后才能勾选发布门禁。

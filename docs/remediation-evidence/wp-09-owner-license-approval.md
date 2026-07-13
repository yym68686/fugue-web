# WP-09 COSS owner 许可证批准

日期：2026-07-13

## Owner 明确批准

项目 owner 在本次整改任务中明确回复：

> 可以使用全部代码。

本批准覆盖固定上游
`cosscom/coss@1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4` 的全部源码，包含
上游以 AGPL 许可的根目录、packages/config 和其他路径；因此不存在“未经 owner 批准的
COSS AGPL source”。批准不免除任何开源许可证、源码提供、NOTICE、provenance、SBOM 或
本地 deviations 归档义务。

## 当前 release 的实际边界

许可范围扩大不等于发布产物必须复制所有上游文件。本次 release 继续采用已经完成全量
门禁的更窄产物：

- 固定上游 SHA，不跟随 mutable `main`；
- 实际同步 68 个经核验的 `apps/ui/` MIT allow-list 文件，其中 54 个 byte-identical；
- `packages/ui`、`packages/typescript-config`、workspace configs 和产品 composition 均为
  Fugue 本地实现，不是复制上游 AGPL source；
- 不包含 COSS/Cal.com 品牌资产、营销文案、示例数据或许可证不明字体；
- `THIRD_PARTY_NOTICES.md`、`docs/coss-upstream-provenance.md`、
  `docs/upstream/coss-files.json`、`artifacts/licenses.json` 和
  `artifacts/fugue-web.cdx.json` 继续作为实际发布边界的权威证据。

## Gate 结论

- Owner license sign-off：**通过**。
- 当前 release artifact 的 license/provenance/SBOM 自动门禁：**通过**。
- 当前产物中的未批准 AGPL 或来源不明代码/字体/品牌资产：**0**。
- 如果未来实际同步新的 AGPL 文件，仍必须更新 provenance、NOTICE、SBOM 和对应源码提供
  方式；本批准不能作为跳过这些义务的理由。


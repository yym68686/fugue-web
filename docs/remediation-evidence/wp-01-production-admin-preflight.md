# WP-01 生产管理员发布前盘点

日期：2026-07-13（Asia/Shanghai）

范围：当前正式控制平面 `https://api.fugue.pro`。本次只使用本机已配置的 Fugue CLI 做
只读聚合，没有输出账号标识、修改用户、调用恢复动作或执行 SSH 热修。

## 只读结果

`fugue auth status --json` 确认当前目标为正式 API，认证来源为当前环境中的
`FUGUE_API_KEY`。随后执行 `fugue admin users ls --json`，仅用 `jq` 输出聚合字段：

- 用户总数：93；
- 管理员总数：2；
- 两个管理员均为 `Active` 且 `verified=true`；
- 登录来源分别为 Email 与 Google，避免单一 provider 故障同时锁死全部管理员；
- 两个管理员都有非空 email identity；
- 当前管理员视角下，另一名管理员可被正常降权，说明不是不可管理的幽灵记录；
- blocked 管理员 0、deleted 管理员 0，查询错误 0。

## 可恢复性结论

至少存在一个经过验证的 Email 管理员和一个经过验证的 Google 管理员。代码库同时保留
经过自动化验证、显式审计且不会由公开注册触发的 `admin:recover` 运维入口；因此当前
生产环境满足“至少一个已验证且可恢复的管理员”发布前置条件。恢复命令只在真的失去管理员
访问时使用，本次盘点不制造无必要的权限变更。

账号 email、内部 ID、token 与环境变量值均未写入本证据或命令输出归档。

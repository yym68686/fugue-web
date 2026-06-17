# Fugue Web 前端页面功能文档

本文只记录当前前端页面及其功能范围，不包含前端样式、视觉规范或交互实现逻辑。范围限定为 `app/**/page.tsx` 对应的页面，不包含 `app/api/**`、`route.ts`、layout、测试页面和健康检查接口。

## 页面总览

```
/                              产品入口页
/docs                          产品文档页
/auth/sign-in                  登录页
/auth/sign-up                  注册页
/auth/finalize                 登录会话完成页
/new/repository                新建项目 / 仓库导入页
/new/template/[slug]           模板部署页
/app                           Console 项目总览页
/app/projects/[projectId]      Console 项目详情页
/app/billing                   Console 计费页
/app/api-keys                  Console 访问密钥页
/app/cluster-nodes             Console 服务器页
/app/settings                  设置入口重定向页
/app/settings/profile          Profile and security 页
/app/apps                      Admin 应用管理页
/app/users                     Admin 用户管理页
/app/cluster                   Admin 集群管理页
```

## Public

| 路由 | 页面 | 功能说明 |
| --- | --- | --- |
| `/` | 产品入口页 | 面向未登录和已登录用户说明 Fugue 的产品模型：从 GitHub 仓库、Docker image 或本地上传创建应用，先运行在共享托管 runtime，再迁移到自有机器。页面同时承接文档入口、快速开始信息、登录/注册入口，以及已登录用户进入 Console 的入口。 |
| `/docs` | 产品文档页 | 展示 Fugue 操作文档，覆盖 CLI 快速开始、导入方式、`fugue.yaml` 拓扑规则、计费边界、stateless migrate 与 managed failover 的区别、inspect/diagnose 排障流程。文档内容按请求语言读取中英文内容。 |

## Auth

| 路由 | 页面 | 功能说明 |
| --- | --- | --- |
| `/auth/sign-in` | 登录页 | 提供进入 Console 的登录入口。支持 Google 登录、GitHub 登录（环境已配置时）、密码登录和邮箱验证链接登录；保留 `returnTo` 目标；展示 OAuth、邮箱链接、密码、账号状态和会话 handoff 相关错误。已登录用户会进入目标 Console 路径。 |
| `/auth/sign-up` | 注册页 | 提供创建账号入口。支持 Google 注册和邮箱验证链接注册；保留 `returnTo` 目标；在邮箱已验证后提示继续进入 Console。已登录用户会进入目标 Console 路径。 |
| `/auth/finalize` | 登录会话完成页 | 用于把第三方 OAuth 或邮箱验证结果转换成站点一方会话。页面接收 handoff token，提交到会话完成端点，并把用户送回 `returnTo` 目标；token 缺失或过期时引导重新登录。 |

## New Project

| 路由 | 页面 | 功能说明 |
| --- | --- | --- |
| `/new/repository` | 新建项目 / 仓库导入页 | 用于创建新项目并导入第一个服务。未登录时可预填 GitHub 仓库、本地上传或 Docker image 信息并进入登录/注册；登录后读取 workspace、已有项目和可用 runtime，支持从 GitHub 仓库、本地上传或 Docker image 创建项目。项目创建功能包含项目名、应用名、分支、私有仓库授权、环境变量、service port、runtime 目标、network mode 和持久化存储配置。 |
| `/new/template/[slug]` | 模板部署页 | 用于基于模板创建项目。页面根据模板 slug 检查 GitHub 模板元数据，必要时重定向到 canonical slug；模板可提供默认 runtime、变量和 `fugue.yaml` 拓扑信息。创建流程与新建项目页一致，并额外提交模板变量和模板 slug。 |

## Console

`/app/**` 页面需要登录会话。

| 路由 | 页面 | 功能说明 |
| --- | --- | --- |
| `/app` | 项目总览页 | 展示当前 workspace 的项目清单、项目生命周期、服务数量、应用数量、资源使用和服务技术标签。页面支持创建项目、导入初始服务、展示项目创建中的进度占位、按项目名称和状态筛选项目，并进入单个项目详情。 |
| `/app/projects/[projectId]` | 项目详情页 | 展示单个项目的应用服务和 backing service。应用服务功能包括 route 管理、项目 route table、custom domain、环境变量、build/runtime logs、文件系统与持久化存储、镜像版本、observability、启动命令、镜像保留数、持久化挂载、自动 failover、runtime 迁移、重建/重新部署、启动/重启、删除和强制删除。Backing service 功能包括 runtime 位置、运行日志、数据库 failover 配置和数据库 switchover。项目级功能包括新增服务、默认 runtime、GitHub image tracking、项目删除和空项目保留。 |
| `/app/billing` | 计费页 | 展示 workspace 计费信息，包括 prepaid balance、当前用量、managed capacity envelope、image storage、价格书、预计月支出、运行时长和计费事件历史。页面提供托管容量调整、充值 checkout、充值状态查询和计费数据刷新。 |
| `/app/api-keys` | 访问密钥页 | 集中管理 workspace API keys 和 node keys。API key 功能包括查看 scopes、创建 workspace admin key、复制 secret、重命名、轮换、启用、停用和删除。Node key 功能包括创建 server enrollment key、复制 secret、复制节点加入命令、重命名、撤销，并展示 key 状态和已关联 VPS 数量。 |
| `/app/cluster-nodes` | 服务器页 | 展示当前 workspace 可见的 runtime servers。功能包括服务器总数、ready/offline/workload 汇总，查看已连接服务器的 heartbeat、角色、ready/pressure 信号、CPU/内存/磁盘容量、运行 workloads、runtime access、sharing/pool 状态，以及查看和清理离线服务器记录。 |
| `/app/settings` | 设置入口重定向页 | 作为设置区入口，直接重定向到 `/app/settings/profile`。 |
| `/app/settings/profile` | Profile and security 页 | 管理当前账号资料和登录方式。功能包括更新显示名称、查看账号邮箱和当前会话、连接/断开 Google 登录、连接/断开 GitHub 登录、启用/停用邮箱链接登录、添加/更新/移除密码，并保证账号至少保留一种可用登录方式。 |

## Admin

Admin 页面位于 `/app/**` 下，除登录会话外还需要管理员权限。

| 路由 | 页面 | 功能说明 |
| --- | --- | --- |
| `/app/apps` | Admin 应用管理页 | 面向管理员展示集群范围内的应用。功能包括查看应用总数、已路由应用数、tenant 数、更新时间，以及每个应用的 owner、资源使用、route、phase、创建时间、应用 ID、项目、runtime/server、来源和技术栈。管理员可对应用执行 rebuild 和 delete。 |
| `/app/users` | Admin 用户管理页 | 面向管理员展示产品用户目录。功能包括查看用户数、管理员数、blocked 数、deleted 数，以及每个用户的邮箱、显示名、账号状态、管理员状态、登录 provider、验证状态、prepaid balance、billing 状态、managed limit、服务资源用量和最后登录时间。管理员可编辑用户计费额度和余额、提升/移除管理员权限、block/unblock 用户和删除用户。 |
| `/app/cluster` | Admin 集群管理页 | 面向管理员展示控制平面和 runtime 集群。功能包括查看 control plane 版本与状态、节点总数、ready/attention/workload 汇总，签发 platform-scoped node join key 和加入命令，以及管理 runtime node policy。节点策略功能包括控制平面角色、build 允许状态、workload placement、policy reconcile 状态和节点容量/压力/workload 信息。 |

# Fugue 管理员部署链路优化方案

目标：让管理员用 `FUGUE_BOOTSTRAP_KEY` 或等价管理 key，通过 `fugue CLI` 快速把本地项目部署到指定用户的 workspace/project，避免手动猜 tenant、project、app、backing service。

核心约束：

- `fugue` 本体不能知道账号系统，不能保存或推导 `email -> workspace`。
- `fugue-web` 是账号系统和 `email -> workspace` 映射的唯一来源。
- 普通用户 CLI 默认只作用于自己的 workspace，不需要 email 映射。
- 管理员 CLI 可以直接接受邮箱；后续映射由 CLI 内部调用 `fugue-web` 完成，使用 CLI 的管理员不需要关心底层 tenant 是什么。

## 1. 当前问题

这次部署慢，不是构建慢，而是管理员链路里有太多不确定项：

- 管理员 key 能看到多个 tenant/workspace，单靠 `tenant ls` 很难知道目标用户是哪一个；管理员理想上只应该输入邮箱。
- `admin users resolve <email>` 能查到映射，但这个能力的职责边界不够清晰。
- 目标动作不明确：是部署到现有 project、创建新 project，还是从已有 project split 出来。
- compose import 对 `.env`、`.dockerignore`、build context 的预检不够早、不够结构化。
- `project split` 语法偏长，管理员搬迁一组 app/service 时需要写很多重复参数。

## 2. fugue-web 怎么改

`fugue-web` 只需要提供一个管理员映射接口，不需要为这个目标改登录页或控制台 UI。

建议新增或正式化一个产品层 API：

```text
GET /api/admin/workspaces/resolve?email=<email>
```

返回结构建议：

```json
{
  "email": "user@example.com",
  "workspace": {
    "tenantId": "tenant_...",
    "tenantName": "example workspace abc123",
    "defaultProjectId": "project_...",
    "defaultProjectName": "default",
    "firstAppId": "app_..."
  }
}
```

鉴权规则：

- 只允许管理员调用。
- `fugue-web` 线上环境里有 `FUGUE_BOOTSTRAP_KEY`，因此可以接受 CLI 传来的管理 key 并验证它是否等价于当前平台管理能力。
- 不要把这个映射下沉到 `fugue` 后端。

这个接口只解决一件事：把 `email` 解析成明确的 `tenant/project/app` 控制面标识。这个接口面向 CLI 内部调用，不要求管理员手动访问，也不要求管理员理解返回里的 tenant。

## 3. fugue CLI 怎么改

CLI 要支持管理员链路，但不应该自己理解账号系统。

建议增加管理员便捷参数：

```text
fugue deploy . --account user@example.com --project uni-api-web
```

执行流程：

1. CLI 检测当前 key 是管理 key。
2. 如果传了 `--account`，CLI 调用 `fugue-web` 的 resolve 接口。
3. CLI 得到明确的 `tenantId/defaultProjectId` 后，继续走现有 `fugue` 控制面 API。
4. 后续 deploy / split / move 都只使用控制面 ID，不把 email 传给 `fugue` 后端。

对管理员使用者而言，交互模型应该是：

```text
邮箱 -> CLI 自动解析 workspace -> CLI 自动转换成控制面目标 -> 部署/拆分/迁移
```

管理员不需要先运行 `tenant ls`，不需要手动复制 tenant slug，也不需要理解 tenant 是什么。tenant 只是 CLI 调用 `fugue` 控制面时使用的内部实现细节。

普通用户流程不变：

```text
fugue deploy .
```

普通用户 key 只看见自己的 workspace 时，CLI 自动选择，不暴露 tenant 选择。

## 4. fugue 后端怎么改

`fugue` 后端不处理 email 映射，只优化纯控制面能力。

需要改进的点：

- deploy/import/split/move 的 plan 输出更结构化。
- compose env 缺失、`.dockerignore` 排除构建文件、Dockerfile 路径错误要提前报出。
- 上传 EOF 这类 retryable 错误要和配置错误分开。
- 多 tenant 可见时，后端仍只返回控制面资源，不解释它们属于哪个账号。

## 5. 推荐管理员最短链路

理想状态下，管理员部署到某个用户应该是：

```text
export FUGUE_API_KEY=<bootstrap-or-admin-key>
fugue deploy . --account yym68686@gmail.com --project uni-api-web
```

管理员只提供邮箱和目标项目名；映射关系由 CLI 自动完成。

如果目标 project 不存在：

```text
fugue deploy . --account yym68686@gmail.com --project uni-api-web --create-project
```

如果要把已有 app/service 拆到用户 project：

```text
fugue project split fugue-web --account yym68686@gmail.com --to uni-api-web --apps uni-api-web,uni-api-web-api --confirm
```

## 6. TODO

- [x] `fugue-web`：新增或正式化管理员 email -> workspace resolve API
- [x] `fugue-web`：resolve API 使用管理 key 鉴权，只返回 tenant/project/app 标识，不返回 secret
- [x] `fugue CLI`：增加 `--account <email>`，仅管理员模式可用
- [x] `fugue CLI`：调用 `fugue-web` resolve API 后，把结果转换成内部 tenant/project/app 参数，对管理员隐藏 tenant 细节
- [x] `fugue CLI`：普通用户单 workspace 自动选择，不提示 tenant
- [x] `fugue CLI`：管理员多 workspace 且未传 `--account/--tenant` 时，明确报错并提示可用参数
- [x] `fugue CLI`：补 `deploy plan` 或强化 `deploy inspect`，提前检查 `.env`、`.dockerignore`、Dockerfile、build context
- [x] `fugue`：把 deploy/import/split/move plan 和错误结构化，供 CLI 稳定消费
- [x] 联调验证：管理员用 `--account` 从空 project 部署一次 compose monorepo
- [x] 联调验证：普通用户 key 直接 `fugue deploy .`，确认不需要 tenant/email

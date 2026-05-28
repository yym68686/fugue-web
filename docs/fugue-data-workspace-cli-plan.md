# Fugue Data Workspace CLI 方案

## 1. 背景

GPU 训练项目通常不是一个单独文件，而是一组需要一起迁移和复用的目录：

- 数据集：`./data`、`./datasets`
- checkpoint：`./checkpoints`、`./ckpt`
- 中间产物：`./outputs`、`./runs`
- 实验记录：`./wandb`、`./logs`
- 预处理缓存：`./cache`、`./features`

用户从一个 GPU provider 切到另一个 provider 时，传统流程通常是：

1. 从旧 GPU 服务器下载数据到本地电脑。
2. 本地电脑再上传到新 GPU 服务器。
3. 手工检查目录是否齐全。
4. 手工恢复路径。
5. 训练失败后再排查是不是少同步了某个目录。

这个流程的问题不是只有慢，还包括：

- 本地电脑磁盘不够。
- 跨 provider 传输容易中断。
- 用户需要记住项目有哪些数据目录。
- checkpoint、数据集版本、中间产物容易混在一起。
- 目标 GPU 机器上的路径和源机器不一致时容易出错。
- 无法证明两台机器拿到的是同一份数据。

Fugue 适合提供 GPU 调度前的数据基础设施。它不需要自己成为 GPU provider，也不需要第一版做 GPU scheduler。它可以先把“训练项目的数据状态”变成一个可创建、可同步、可快照、可校验、可恢复的控制面对象。

## 2. 产品定位

推荐产品名：

```text
Fugue Data Workspace
```

CLI 顶层命令：

```text
fugue data
```

核心定位：

> Fugue Data Workspace 是项目级数据工作区。用户把一个训练项目中需要复用的数据目录交给 Fugue 管理，然后在任意 GPU 服务器上用一条命令恢复同一份项目数据状态。

它不是：

- 不是通用网盘。
- 不是 POSIX 分布式文件系统。
- 不是必须远程挂载的共享盘。
- 不是把每个文件当成用户需要单独管理的对象。
- 不是把 Docker registry 当成大文件仓库。
- 不是把训练数据塞进 Postgres。

它是：

- 项目级数据目录清单。
- 增量上传和下载。
- 不可变快照。
- 可校验 manifest。
- 短期授权。
- 未来 GPU job materialization 的数据基础。

## 3. DX 原则

### 3.1 用户不记远端 prefix

用户不应该记：

```text
datasets/coco/v1
runs/run-42/checkpoints
raw/imagenet-2026-05
```

用户应该记：

```text
这个训练项目的数据工作区
```

Fugue 通过 `.fugue/data.yaml` 记住这个项目有哪些数据目录。用户操作的是项目状态，而不是对象路径。

### 3.2 本地项目优先

最自然的入口应该是：

```bash
cd my-training-project
fugue data track ./data ./checkpoints ./outputs
fugue data push
```

在另一台 GPU 服务器上：

```bash
git clone <repo>
cd my-training-project
fugue data pull
```

或者没有代码仓库时：

```bash
fugue data clone my-training-project --to /workspace/my-training-project
```

### 3.3 快照是默认安全边界

训练数据要尽量不可变。Fugue 应该鼓励用户在关键节点创建 snapshot，而不是默认原地覆盖一个模糊的 remote state。

```bash
fugue data push --version before-l40s-run
fugue data pull --version before-l40s-run
```

### 3.4 直接传输，不经过用户本地中转

Fugue CLI 可以在旧 GPU 服务器上直接上传，在新 GPU 服务器上直接下载。用户本地电脑只需要管理命令和凭证，不需要搬数据。

### 3.5 默认能看懂

每个核心命令都应该告诉用户：

- 当前 workspace 是什么。
- 哪些 asset 被 tracked。
- 哪些 asset changed、new、missing。
- 大概会传多少数据。
- 传输是否可 resume。
- 最终 version id 是什么。
- 校验是否通过。

## 4. 核心概念

### 4.1 DataWorkspace

项目级数据工作区。

在 `fugue data` 里，workspace 是 assets 和 versions 的命名空间。它回答三个问题：

- `dataset` 这个 asset 属于哪个训练项目。
- `before-provider-move` 这个 version 属于哪个训练项目。
- 新 GPU 服务器执行 `fugue data pull --version before-provider-move` 时，应该从哪个项目数据状态恢复。

workspace 是必要概念，但应该是低频概念。日常命令不要求用户反复指定 workspace：

```bash
fugue data track ./data ./checkpoints
fugue data push --version before-provider-move
fugue data pull --version before-provider-move
```

这些命令默认使用当前目录 `.fugue/data.yaml` 里绑定的 data workspace。如果当前目录还没有绑定，`fugue data track ...` 会自动创建一个 workspace，默认名字来自当前目录名。

显式 workspace 只用于跨项目、克隆、切换 backend、排障和自动化：

```bash
fugue data workspace ls
fugue data workspace show my-training-project
fugue data workspace use my-training-project
fugue data clone my-training-project --version before-provider-move
```

字段建议：

```text
id
tenant_id
project_id
name
slug
default_region
storage_backend_id
quota_bytes
used_bytes
created_at
updated_at
```

用户看到的是 `name` 或 `slug`，不需要关心底层 bucket 或 prefix。

`.fugue/data.yaml` 是本地目录到远端 data workspace 的绑定文件。一个本地项目目录通常绑定一个 data workspace。

### 4.2 DataAsset

一个项目内被 Fugue 管理的数据资产。asset 可以是目录，也可以是单个文件，或一组有共同语义的数据路径。

例子：

```text
dataset      -> ./data
checkpoints  -> ./checkpoints
outputs      -> ./outputs
cache        -> ./cache
```

字段建议：

```text
name
local_path
materialize_path
mode
include
ignore
required
```

`name` 是用户可读的短名字。`local_path` 是当前项目里的默认路径。`materialize_path` 是未来 GPU job 里落盘的路径，可以默认等于 `local_path`。

### 4.3 DataSnapshot

一次完整项目数据状态。

字段建议：

```text
id
workspace_id
version
message
manifest_digest
asset_count
file_count
total_bytes
created_by
created_at
```

snapshot 应该默认不可变。删除 snapshot 只删除引用，底层对象可以由 GC 根据引用计数和 retention 回收。

用户可见的术语应该叫 `version`。`DataSnapshot` 可以作为内部/API 对象名保留，但 CLI 参数、输出和文档里的版本标识不要再叫 `name`。

### 4.4 DataManifest

Fugue 内部使用的文件清单。用户通常不直接编辑。

每个文件条目包含：

```text
asset_name
relative_path
kind
size
mode
mtime
sha256
object_key
etag
```

manifest 用于：

- 增量上传。
- 增量下载。
- 校验目标目录。
- 比较 snapshot。
- 恢复缺失文件。

### 4.5 DataTransfer

一次上传、下载、远程导入、预热或复制 operation。

字段建议：

```text
id
workspace_id
snapshot_id
direction
status
source
target
bytes_total
bytes_done
files_total
files_done
started_at
finished_at
error_code
error_message
```

### 4.6 DataGrant

短期、范围受限的数据访问凭证。

用途：

- 临时给 GPU 服务器 read-only 访问。
- 给某个 collaborator 拉取一个 snapshot。
- 给运行中的 Fugue job materialize 数据。

规则：

- 默认有 TTL。
- 默认绑定 workspace 或 snapshot。
- 可限制 asset。
- 可限制 read/write。
- 不暴露全局 API key。

## 5. 本地配置文件

`fugue data init` 在项目目录创建：

```text
.fugue/data.yaml
```

示例：

```yaml
version: 1
workspace: my-training-project
project: vision

assets:
  - name: dataset
    path: ./data
    required: true
    mode: read-mostly

  - name: checkpoints
    path: ./checkpoints
    required: false
    mode: append

  - name: outputs
    path: ./outputs
    required: false
    mode: append

ignore:
  - .git
  - .venv
  - __pycache__
  - "*.tmp"
  - "*.lock"
  - ".DS_Store"
```

配置原则：

- 文件应该可以进 Git。
- 不保存 secret。
- 默认只记录项目数据结构。
- 远端对象 key、presigned URL、临时 token 不写入该文件。
- CLI 支持 `--config` 指定其他配置文件，但默认找 `.fugue/data.yaml`。

## 6. CLI 设计

### 6.1 初始化

```bash
fugue data init
```

`init` 是显式初始化命令，但不是普通用户的必经步骤。主路径应允许用户直接运行 `track`：

```bash
fugue data track ./data ./checkpoints ./outputs
```

如果当前目录没有 `.fugue/data.yaml`，`track` 必须自动执行等价的 `fugue data init`，然后再把传入路径写入 assets。这样从旧 GPU 服务器迁移到新 GPU 服务器的最短路径只需要两步：

```bash
fugue data track ./data ./checkpoints ./outputs
fugue data push --version before-provider-move
```

默认行为：

- 读取当前目录名作为 workspace 名。
- 绑定当前 Fugue project。
- 扫描常见数据目录。
- 生成 `.fugue/data.yaml`。
- 不自动上传。

建议输出：

```text
Created .fugue/data.yaml

Detected data-like directories:
  ./data          128.4 GiB
  ./checkpoints    9.2 GiB
  ./outputs        1.7 GiB

Run:
  fugue data track ./data ./checkpoints ./outputs
  fugue data push
```

可选参数：

```bash
fugue data init --workspace my-training-project
fugue data init --project vision
fugue data init --region us-west
fugue data init --no-detect
```

### 6.2 Workspace 绑定和切换

多数用户不需要先创建 workspace。`fugue data track ...` 会自动初始化并绑定当前目录。

显式 workspace 命令用于这些场景：

- 当前目录要连接到一个已经存在的远端 data workspace。
- 一台 GPU 服务器上同时处理多个训练项目。
- 查看当前 API key 能访问哪些 data workspace。
- 修改 workspace backend 或排障。

常用命令：

```bash
fugue data workspace ls
fugue data workspace show
fugue data workspace show my-training-project
fugue data workspace use my-training-project
```

`workspace show` 不带参数时读取当前目录 `.fugue/data.yaml` 里的 workspace。

`workspace use` 的行为：

- 校验远端 workspace 存在且当前 key 有权限。
- 如果当前目录没有 `.fugue/data.yaml`，写入绑定文件。
- 如果当前目录已有 `.fugue/data.yaml`，要求用户确认或传 `--replace`。
- 拉取远端 workspace 的 asset 配置，但不自动下载数据。

示例：

```bash
cd /workspace/my-training-project
fugue data workspace use my-training-project
fugue data pull
```

如果只想拿一份完整数据，不想手动绑定当前目录，使用 `clone`：

```bash
fugue data clone my-training-project --version before-provider-move --to /workspace/my-training-project
```

### 6.3 添加数据资产

```bash
fugue data track ./data
fugue data track ./checkpoints --as checkpoints
fugue data track ./outputs --mode append
fugue data track ./cache --optional
```

支持一次添加多个路径：

```bash
fugue data track ./data ./checkpoints ./outputs
```

如果当前目录还没有 `.fugue/data.yaml`：

- `track` 自动创建 `.fugue/data.yaml`。
- workspace 名默认使用当前目录名。
- project 默认使用当前 CLI 上下文。
- ignore 默认模板自动写入。
- 自动初始化不上传任何数据。
- 初始化完成后继续 track 用户传入的路径。

默认 asset 名从路径名推导：

```text
./data         -> data
./checkpoints  -> checkpoints
```

如果冲突，CLI 提示用户显式指定 `--as`。

### 6.4 移除数据资产

```bash
fugue data untrack ./outputs
fugue data untrack outputs
```

默认只从 `.fugue/data.yaml` 移除 asset，不删除本地文件，也不删除远端 snapshot。

如果用户要删除远端数据，需要显式：

```bash
fugue data asset delete outputs --remote
```

### 6.5 查看状态

```bash
fugue data status
```

建议输出：

```text
Data workspace: my-training-project
Project: vision
Latest snapshot: snap_20260528_abc123

ASSET         LOCAL PATH       STATUS       FILES       SIZE
dataset       ./data           changed      183,220     128.4 GiB
checkpoints   ./checkpoints    new          14          9.2 GiB
outputs       ./outputs        unchanged    481         1.7 GiB

Untracked large directories:
  ./cache       31.8 GiB
  ./wandb        4.6 GiB

Next:
  fugue data push --version <version>
```

状态语义：

- `new`：本地 asset 未出现在 latest snapshot。
- `changed`：本地文件清单和 latest snapshot 不一致。
- `unchanged`：本地和 latest snapshot 一致。
- `missing`：配置里有 asset，但本地路径不存在。
- `remote-only`：snapshot 有 asset，本地配置没有。

### 6.6 上传项目数据

```bash
fugue data push
```

默认行为：

- 读取 `.fugue/data.yaml`。
- 扫描 tracked assets。
- 和 latest snapshot manifest 比较。
- 只上传新增或变化的对象。
- 生成新的 snapshot。
- 输出 version id。

建议输出：

```text
Data workspace: my-training-project

Planning upload:
  assets: 3
  changed files: 1,240
  skipped files: 182,461
  upload size: 12.7 GiB

Uploading:
  12.7 GiB / 12.7 GiB  186 MiB/s  verified

Created version:
  version: latest
  id: snap_20260528_abc123
  files: 183,701
  size: 139.3 GiB
```

常用参数：

```bash
fugue data push --version before-l40s-run
fugue data push --message "cleaned labels and checkpoint step 8000"
fugue data push --asset dataset
fugue data push --asset checkpoints
fugue data push --dry-run
fugue data push --concurrency 32
fugue data push --no-progress
```

### 6.7 下载项目数据

```bash
fugue data pull
```

默认行为：

- 读取 `.fugue/data.yaml`。
- 未指定 `--version` 时使用 latest version。
- 获取目标 version manifest，并根据 tracked assets 生成本地 apply plan。
- 真实下载前执行 pull preflight：检查目标路径是否已有同名文件或目录、文件类型是否一致、本地文件 checksum 是否一致、父目录是否可写、磁盘空间是否足够。
- checksum 一致的文件直接跳过。
- 缺失文件下载到配置里的路径。
- checksum 不一致、文件/目录类型不一致、symlink 策略不满足时，默认标记为 conflict 并停止，不修改本地文件。
- 不默认清空本地目录，也不默认覆盖本地文件。
- 支持 resume。

常用参数：

```bash
fugue data pull --version before-l40s-run
fugue data pull --asset dataset
fugue data pull --asset checkpoints --to /mnt/nvme/checkpoints
fugue data pull --verify
fugue data pull --dry-run
fugue data pull --keep-local
fugue data pull --overwrite
fugue data pull --prune --confirm
fugue data pull --concurrency 32
```

建议输出：

```text
Data workspace: my-training-project
Version: before-l40s-run

Planning download:
  assets: dataset, checkpoints
  missing files: 183,211
  existing verified: 490
  download size: 137.6 GiB

Downloading:
  137.6 GiB / 137.6 GiB  410 MiB/s  verified

Restored:
  ./data
  ./checkpoints
```

如果真实下载前发现本地冲突，CLI 必须先停止并展示 preflight 结果：

```text
Data workspace: my-training-project
Version: latest

Pull preflight found conflicts.

CONFLICT   PATH                         REASON
type       ./data                       remote asset is a directory, local path is a file
changed    ./checkpoints/model.bin      checksum differs from version manifest

WARNING    PATH                         REASON
extra      ./outputs/debug.log          local file is not in version manifest, preserved by default

No files were changed.

Run one of:
  fugue data pull --dry-run
  fugue data pull --keep-local
  fugue data pull --overwrite
  fugue data pull --prune --confirm
  fugue data push --version local-before-pull
```

这对 `fugue data workspace use my-training-project` 后直接 `fugue data pull` 的场景尤其重要，因为目标机器可能已经有同名 `data`、`checkpoints` 或 `outputs`。

### 6.8 克隆整个数据工作区

```bash
fugue data clone my-training-project
```

适合目标机器没有代码仓库或没有 `.fugue/data.yaml` 的情况。

常用参数：

```bash
fugue data clone my-training-project --to /workspace/my-training-project
fugue data clone my-training-project --version before-l40s-run
fugue data clone vision/my-training-project --asset dataset
```

默认行为：

- 拉取远端 workspace 配置。
- 创建目标目录。
- 写入 `.fugue/data.yaml`。
- 下载 snapshot 数据。

### 6.9 查看快照

```bash
fugue data snapshot ls
fugue data snapshot show before-l40s-run
fugue data snapshot diff before-l40s-run latest
```

建议输出：

```text
VERSION             CREATED              FILES       SIZE       MESSAGE
before-l40s-run     2026-05-28 14:22     183,701     139.3GiB   cleaned labels
latest              2026-05-28 17:41     183,715     140.1GiB   checkpoint step 9000
```

### 6.10 授权和分享

```bash
fugue data grant create my-training-project --version before-l40s-run --read-only --ttl 6h
```

输出应该给出一条可复制命令，而不是泄漏底层对象存储细节：

```text
Grant created. Expires in 6h.

On the target machine:
  fugue data pull my-training-project --version before-l40s-run --grant fugue_grant_...
```

撤销：

```bash
fugue data grant revoke grant_abc123
```

### 6.11 传输任务

```bash
fugue data transfer ls
fugue data transfer show transfer_abc123
fugue data transfer watch transfer_abc123
fugue data transfer resume transfer_abc123
fugue data transfer cancel transfer_abc123
```

这些命令用于排障和自动化，不应该是普通用户的主路径。

### 6.12 诊断

```bash
fugue data doctor
```

检查：

- `.fugue/data.yaml` 是否有效。
- tracked asset 是否存在。
- ignore 是否导致重要文件被跳过。
- 当前机器是否有足够目标磁盘空间。
- API key 是否有 data read/write scope。
- 对象存储直连是否可用。
- 上一次 transfer 是否可 resume。

## 7. 典型工作流

### 7.1 从旧 GPU 服务器迁移到新 GPU 服务器

旧服务器：

```bash
cd /workspace/my-training-project
fugue data track ./data ./checkpoints ./outputs
fugue data push --version before-provider-move
```

如果当前目录还没有 `.fugue/data.yaml`，第一条 `track` 会自动初始化数据工作区，不需要用户先手动运行 `fugue data init`。

新服务器：

```bash
git clone <repo>
cd my-training-project
fugue data pull --version before-provider-move
```

### 7.2 连接到已有 data workspace

适合目标机器已经有项目目录，但还没有 `.fugue/data.yaml`：

```bash
cd /workspace/my-training-project
fugue data workspace use my-training-project
fugue data pull
```

`workspace use` 只绑定当前目录和远端 data workspace，不自动下载数据。真正恢复数据仍然由 `pull` 执行；不带 `--version` 时默认拉取 latest version。

### 7.3 没有代码仓库时克隆数据工作区

适合目标机器只需要数据，或者代码和数据都由 Fugue data workspace 引导：

```bash
fugue data clone my-training-project \
  --version before-provider-move \
  --to /workspace/my-training-project
```

`clone` 会创建目标目录、写入 `.fugue/data.yaml`，然后下载指定 version 的数据。

### 7.4 查看当前 data workspace

```bash
fugue data workspace show
fugue data status
```

建议输出重点：

```text
Data workspace: my-training-project
Project: vision
Backend: fugue-default-r2

Assets:
  dataset       ./data
  checkpoints   ./checkpoints
  outputs       ./outputs

Latest version:
  before-provider-move
```

### 7.5 只恢复数据集，不恢复 checkpoint

```bash
fugue data pull --asset dataset
```

### 7.6 训练中周期性保存 checkpoint

```bash
fugue data push --asset checkpoints --version checkpoint-step-8000
```

### 7.7 共享只读数据集给另一台机器

```bash
fugue data push --asset dataset --version dataset-v3
fugue data grant create --version dataset-v3 --read-only --ttl 24h
```

目标机器：

```bash
fugue data clone my-training-project --version dataset-v3 --asset dataset --grant fugue_grant_...
```

### 7.8 未来 GPU job 自动 materialize

未来可以自然扩展：

```bash
fugue gpu run train.py \
  --data my-training-project@before-l40s-run \
  --mount dataset=/data \
  --mount checkpoints=/checkpoints
```

调度前，Fugue 可以根据 snapshot 的 size、region、目标 GPU runtime、已有缓存来决定是否预热。

## 8. 数据面设计

### 8.1 不让 API server 搬大文件

大文件数据面不要经过 Fugue API server。API server 只负责：

- workspace metadata。
- snapshot metadata。
- manifest metadata。
- transfer operation metadata。
- auth 和 audit。
- 生成短期数据面授权。

实际文件传输：

- CLI 直连对象存储。
- 使用 presigned multipart upload/download。
- 支持并发。
- 支持 resume。
- 支持 checksum。

### 8.2 控制面多提供商，Cloudflare R2 作为默认后端

Fugue Data Workspace 的核心不应该绑定某一个存储厂商。Fugue 应该提供项目数据控制面，底层存储通过 backend adapter 接入。

推荐架构：

```text
Fugue Data Workspace 控制面
  -> Cloudflare R2 backend
  -> Backblaze B2 backend
  -> S3 backend
  -> Hugging Face backend
  -> MinIO/self-host backend
```

默认选择：

- Fugue Cloud 默认使用 Cloudflare R2。
- Self-host baseline 默认使用 MinIO。
- 用户可以通过 BYO backend 接入自己的 S3-compatible storage。

Cloudflare R2 适合作为默认后端的原因：

- R2 是 Cloudflare 的 S3-compatible object storage。
- 跨 GPU provider 下载不收 egress fee，适合“旧 GPU push，新 GPU pull”的场景。
- 没有 1TB 最低消费，适合 100GB 级别的个人训练项目。
- Standard storage 没有最短保存时间，适合 checkpoint 和中间产物反复增删。
- API 模型适合 presigned URL、multipart upload/download、resume 和 checksum verify。
- 账单模型比 AWS S3 跨公网下载更容易预测。

R2 的边界：

- 它不是 POSIX 文件系统，训练时仍应 materialize 到本地 NVMe、PVC 或目标目录。
- 海量小文件会产生操作请求成本，Fugue 仍应提示用户打包或 sharding。
- R2 不应成为不可替换的产品依赖；用户需要能迁移到 B2、S3、HF 或自托管 MinIO。

### 8.3 Backend adapter 设计

后端 adapter 应该收敛成一组通用能力，而不是让 CLI 直接知道每个 provider 的细节。

统一接口能力：

```text
CreateMultipartUpload
SignUploadPart
ListUploadedParts
CompleteMultipartUpload
AbortMultipartUpload
SignDownload
SignRangeDownload
HeadObject
DeleteObject
ListObjects
PutManifest
GetManifest
```

所有 provider 都应被 Fugue 控制面包装成同一种数据面授权：

- CLI 向 Fugue API 请求 upload/download plan。
- Fugue API 根据 workspace backend 生成短期授权或 presigned URL。
- CLI 直连 provider 数据面传输。
- CLI 完成后向 Fugue API 提交 transfer result。

用户不应该在日常命令里看到 bucket、access key、endpoint URL 或 provider-specific object key。

### 8.4 断点续传能力

断点续传是 Data Workspace 的核心能力之一。它不能只依赖 provider 的默认客户端，而应该由 Fugue CLI 和 Fugue transfer operation 共同实现。

Fugue 需要支持三层 resume：

1. 文件级 resume：已完成且 checksum 匹配的文件不再传。
2. 大文件 part 级 resume：multipart upload/download 中断后只重传缺失 part。
3. workspace 级 resume：一次 `push` / `pull` 中断后，可以从 transfer state 恢复整个项目同步。

默认 UX：

```bash
fugue data push
fugue data pull
```

默认就启用 resume。用户不需要额外传参数。

可选参数：

```bash
fugue data push --no-resume
fugue data pull --no-resume
fugue data transfer resume transfer_abc123
fugue data transfer cancel transfer_abc123
```

上传 resume 机制：

- CLI 扫描本地文件，生成 local manifest。
- API 返回 upload plan 和 multipart upload session。
- CLI 把本地 transfer state 写到 `.fugue/transfers/<transfer-id>.json`。
- 每个 part 完成后记录 part number、size、etag、checksum。
- 传输中断后，CLI 根据本地 state 和 provider `ListUploadedParts` 结果恢复。
- 已上传且 etag/checksum 匹配的 part 跳过。
- 最后 `CompleteMultipartUpload` 并提交 snapshot manifest。

下载 resume 机制：

- CLI 对比 snapshot manifest 和本地文件。
- 未完成下载写入临时文件，例如 `.fugue/tmp/<digest>.part`。
- 记录已完成 byte range、目标路径、expected size、expected checksum。
- 传输中断后，通过 `SignRangeDownload` 或 provider range GET 从缺失 offset 继续。
- 完整文件 checksum 通过后再 atomic rename 到目标路径。
- checksum 不匹配时删除临时文件并重新下载该对象。

Transfer state 应记录：

```text
transfer_id
workspace_id
snapshot_id
direction
backend_id
provider
asset_name
local_path
object_key
upload_id
part_size
completed_parts
completed_ranges
expected_size
expected_sha256
last_error
updated_at
```

Provider 能力分层：

| Backend | 上传 resume | 下载 resume | Fugue 策略 |
| --- | --- | --- | --- |
| Cloudflare R2 | Multipart upload，可恢复已上传 parts | Range download | MVP 默认强支持 |
| Backblaze B2 | S3 multipart 或 B2 large file | Range download | 通过 S3-compatible adapter 强支持 |
| AWS S3 | 原生 multipart upload | Range GET | 通过 S3-compatible adapter 强支持 |
| MinIO/self-host | S3-compatible multipart upload | Range GET | 通过 S3-compatible adapter 强支持 |
| Hugging Face | 工具层或 backend-specific resume，不等同于 S3 multipart | HF client/cache 或 range 能力 | 单独 adapter，best-effort resume，不能混进 generic S3 语义 |

实现原则：

- R2、B2、AWS S3、MinIO 走同一套强 resume 语义。
- Hugging Face 作为特殊 backend，使用 adapter-specific resume。
- `fugue data status` 应提示是否存在可恢复 transfer。
- `fugue data doctor` 应检查本地 transfer state 是否损坏。
- presigned URL 过期后，CLI 不应失败退出；应该向 Fugue API 重新换取本次 transfer 的新短期授权。
- 用户显式 `--no-resume` 时，CLI 可以忽略旧 transfer state，但不能自动删除已完成 snapshot。

### 8.5 Provider 分工

| Backend | 推荐用途 | 主要优点 | 主要边界 |
| --- | --- | --- | --- |
| Cloudflare R2 | Fugue Cloud 默认后端；跨 GPU provider 数据复用 | S3-compatible；egress 免费；小规模无最低消费 | 存储单价不是最低；小文件操作仍要计费 |
| Backblaze B2 | 成本敏感用户的 BYO backend | 存储便宜；S3-compatible；下载额度友好 | 默认生态和全球边缘网络不如 Cloudflare |
| AWS S3 | 用户已经在 AWS 内训练或有企业合规要求 | 成熟、区域多、企业能力强 | 跨公网 egress 贵，不适合默认跨 provider 数据后端 |
| Hugging Face | 公开模型/数据集、HF 生态用户 | ML 社区分发好；公开数据集发现和协作强 | 免费 public 是 best-effort；private 免费层有限；不应作为唯一私有训练数据后端 |
| MinIO/self-host | 自托管 Fugue 或用户自有集群 | 数据完全自持；适合内网和私有部署 | 需要用户自己维护可用性、备份和容量 |

第一版实现优先级：

1. Cloudflare R2 backend。
2. Generic S3-compatible backend。
3. MinIO self-host profile。
4. Backblaze B2 profile。
5. Hugging Face backend。

Generic S3-compatible backend 应覆盖 R2、B2、AWS S3、MinIO 的大部分实现。Provider profile 只负责 endpoint、region、签名细节、默认 bucket policy、成本提示和限制提示。

### 8.6 Backend 配置模型

Fugue Cloud 可以由平台提供默认 R2 backend，普通用户不需要配置 provider。

默认体验：

```bash
fugue data track ./data ./checkpoints ./outputs
fugue data push
```

如果用户要接入自己的存储：

```bash
fugue data backend create my-r2 \
  --provider cloudflare-r2 \
  --bucket fugue-data \
  --account-id <cloudflare-account-id>

fugue data backend create my-b2 \
  --provider backblaze-b2 \
  --bucket fugue-data \
  --endpoint https://s3.us-west-004.backblazeb2.com

fugue data backend create my-s3 \
  --provider s3 \
  --bucket fugue-data \
  --region us-west-2

fugue data backend create my-minio \
  --provider minio \
  --bucket fugue-data \
  --endpoint https://minio.example.com
```

然后在 workspace 上选择：

```bash
fugue data init --backend my-r2
fugue data workspace set-backend my-training-project my-r2
```

安全要求：

- backend credential 只保存在 Fugue control plane 的 secret store。
- CLI 不把 backend access key 写入 `.fugue/data.yaml`。
- Data grant 不能暴露 provider master credential。
- Presigned URL TTL 默认短，且只覆盖本次 transfer 需要的对象和 part。
- Provider migration 必须通过 Fugue operation 跟踪，不能让用户手工搬 bucket 后再猜状态。

### 8.7 Backend 迁移

Fugue 控制面要保留 provider 可替换性。后续可以支持：

```bash
fugue data backend migrate my-training-project \
  --from fugue-default-r2 \
  --to my-b2 \
  --version latest
```

迁移语义：

- 默认迁移指定 snapshot 仍引用的 blobs 和 manifest。
- 迁移完成前旧 backend 保持可读。
- 迁移完成后更新 workspace backend pointer。
- GC 在 retention 之后清理旧 backend 上不再引用的 blobs。
- 迁移过程记录为 DataTransfer operation。

底层对象 key 可以是内容寻址：

```text
blobs/sha256/aa/bb/<digest>
manifests/<workspace>/<snapshot>.json
```

用户不直接接触这些 key。

### 8.8 不复用 source_upload

`source_upload` 适合源码 archive，不适合训练数据：

- 它偏单个上传包。
- 它可以存 archive bytes。
- 它不适合 TB 级目录。
- 它不适合增量同步。
- 它不适合 snapshot manifest。

Data Workspace 应该是独立对象模型。

### 8.9 不复用 app storage

`app storage` 是某个 app 的持久化 runtime volume。Data Workspace 是项目级、可跨 runtime、可在训练前 materialize 的数据状态。

两者可以后续打通，但不应该是同一个对象。

可能的打通方式：

```bash
fugue data export my-training-project --version latest --to-app my-app --mount /data
```

或者：

```bash
fugue app storage seed my-app --from-data my-training-project@latest --asset dataset
```

这些是未来能力，不是 MVP。

## 9. API 设计草案

Fugue 后端是 OpenAPI-first。任何接口落地时必须先改：

```text
/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml
```

建议 API 分组：

```text
Data Workspaces
Data Assets
Data Snapshots
Data Transfers
Data Grants
```

端点草案：

```text
GET    /v1/data/workspaces
POST   /v1/data/workspaces
GET    /v1/data/workspaces/{workspace_id}
PATCH  /v1/data/workspaces/{workspace_id}
DELETE /v1/data/workspaces/{workspace_id}

GET    /v1/data/workspaces/{workspace_id}/snapshots
POST   /v1/data/workspaces/{workspace_id}/snapshots
GET    /v1/data/workspaces/{workspace_id}/snapshots/{snapshot_id}
DELETE /v1/data/workspaces/{workspace_id}/snapshots/{snapshot_id}

POST   /v1/data/workspaces/{workspace_id}/transfers/plan-upload
POST   /v1/data/workspaces/{workspace_id}/transfers/plan-download
POST   /v1/data/workspaces/{workspace_id}/transfers/complete
GET    /v1/data/transfers
GET    /v1/data/transfers/{transfer_id}
POST   /v1/data/transfers/{transfer_id}/cancel

POST   /v1/data/workspaces/{workspace_id}/grants
GET    /v1/data/workspaces/{workspace_id}/grants
DELETE /v1/data/grants/{grant_id}
```

上传流程：

1. CLI 扫描本地 asset，生成 local manifest。
2. CLI 调用 `plan-upload`。
3. API 返回已有 blob、需要上传的 blob、multipart presigned URLs。
4. CLI 直传对象存储。
5. CLI 调用 `complete`，提交最终 manifest digest。
6. API 创建 snapshot 和 operation result。

下载流程：

1. CLI 调用 `plan-download`。
2. API 返回 snapshot manifest 和下载授权。
3. CLI 对比本地文件。
4. CLI 只下载缺失或 checksum 不一致的对象。
5. CLI 本地校验完成后记录 transfer result。

## 10. 权限和安全

建议 scope：

```text
data.read
data.write
data.delete
data.grant
data.admin
```

规则：

- 普通用户只能访问自己 tenant/project 下的 data workspace。
- Project member 可以按角色授予 read/write。
- Grant 默认只读、短 TTL。
- Grant 不应该能扩权。
- Presigned URL TTL 要短。
- API 日志和 operation 输出不打印 secret。
- Manifest 可以包含路径和大小，但不应该包含本地绝对路径里的敏感用户名，除非用户显式保留。

路径安全：

- `local_path` 必须是相对项目路径，除非用户显式 `--allow-absolute-paths`。
- `pull --to` 可以是绝对路径。
- 恢复时禁止 `../` escape。
- symlink 默认作为 symlink metadata 保存，不默认跟随到项目外。

## 11. 文件语义

### 11.1 删除

本地删除文件后 `push` 应该记录 snapshot 中的删除结果，但不立即删除底层 blob。

底层 blob 由 GC 根据引用计数和 retention 删除。

### 11.2 重命名

第一版可以把重命名视为 delete + add。由于对象是内容寻址，如果内容未变，不需要重新上传 blob。

### 11.3 小文件很多

GPU 数据集常见问题是小文件太多。第一版先支持，但 CLI 应提示性能风险：

```text
Warning: asset dataset contains 1,240,000 files smaller than 64 KiB.
Consider packing shards for faster GPU materialization.
```

未来可以提供：

```bash
fugue data pack dataset --format tar-shards --target-size 512MiB
```

### 11.4 大文件断点续传

必须支持：

- multipart upload。
- local transfer state。
- upload resume。
- download resume。
- checksum verify。
- retry with backoff。

### 11.5 冲突

`pull` 是可能改写本地文件的命令，所以必须先做 preflight，再进入真实下载。尤其是下面这个流程：

```bash
cd /workspace/my-training-project
fugue data workspace use my-training-project
fugue data pull
```

目标目录可能已经有同名文件夹或文件，CLI 不能直接把远端 version 覆盖进去。

preflight 必须检查：

- 远端 asset 是目录，但本地同名路径是文件。
- 远端 asset 是文件，但本地同名路径是目录。
- 本地文件已存在，但 checksum 和 version manifest 不一致。
- 本地路径存在，但文件类型、权限或 symlink 策略不满足。
- 本地 symlink 指向项目目录外部。
- 本地 asset 目录包含 version manifest 之外的额外文件。
- 父目录不存在或不可写。
- 本地磁盘空间不足。

默认策略：

```text
CASE                         DEFAULT
missing local file           download
checksum matched             skip
checksum mismatched          conflict, stop
remote directory vs file     conflict, stop
remote file vs directory     conflict, stop
extra local file             preserve, warn
not writable                 error, stop
not enough disk              error, stop
```

默认选择应该保护本地数据：不覆盖、不删除、不清空目录。非冲突文件也不应该在 conflict 未解决前提前下载，避免留下半同步状态。

用户可以显式选择：

- `--dry-run`：只展示 apply plan 和 conflict，不下载。
- `--keep-local`：跳过冲突文件，只下载不冲突的缺失文件。
- `--overwrite`：用远端 version 覆盖冲突文件。
- `--prune --confirm`：删除 manifest 之外的本地额外文件，适合严格恢复版本状态。

`pull` 遇到本地文件已修改时，默认不覆盖：

```text
Conflict: ./checkpoints/model.safetensors differs from snapshot.

Run one of:
  fugue data pull --keep-local
  fugue data pull --overwrite
  fugue data push --version local-before-pull
```

## 12. 和 GPU 调度的关系

Data Workspace 是 GPU 调度前的基础设施。第一版不需要 GPU scheduler，但对象模型要给未来留接口。

未来调度器可以使用：

- snapshot total size。
- asset size。
- region。
- storage backend region。
- target runtime region。
- estimated transfer time。
- existing runtime cache hits。
- required disk size。

未来 GPU job 可以声明：

```yaml
data:
  workspace: my-training-project
  snapshot: before-l40s-run
  mounts:
    dataset: /data
    checkpoints: /checkpoints
```

Fugue 在 job 启动前执行：

1. 选择 GPU runtime。
2. 检查数据 locality。
3. 预热或拉取 snapshot。
4. 校验 manifest。
5. 启动训练容器。

## 13. MVP 范围

第一版必须做：

- `.fugue/data.yaml`
- `fugue data init`
- `fugue data track`
- `fugue data untrack`
- `fugue data status`
- `fugue data push`
- `fugue data pull`
- `fugue data clone`
- `fugue data workspace ls/show/use`
- `fugue data snapshot ls/show`
- Cloudflare R2 默认后端
- Generic S3-compatible backend abstraction
- 增量上传下载
- resume
- checksum verify
- snapshot metadata
- transfer operation
- project/tenant 权限

第一版可以不做：

- GPU scheduler 集成。
- POSIX 远程挂载。
- 多写者实时同步。
- 数据可视化 UI。
- P2P 传输。
- 自动打包小文件。
- 全局数据集市场。
- 复杂跨 region replication。

## 14. 分阶段计划

### Phase 0: 产品和契约收敛

目标：定清楚 DX、对象模型、API contract 和不做什么。

交付物：

- CLI command spec。
- `.fugue/data.yaml` schema。
- OpenAPI schema 草案。
- 多 provider backend 配置方案。
- Cloudflare R2 默认后端方案。
- 安全和 scope 方案。

### Phase 1: 最小可用数据工作区

目标：用户能在旧 GPU 机器 `push`，在新 GPU 机器 `pull`。

交付物：

- DataWorkspace metadata。
- DataSnapshot metadata。
- Manifest schema。
- Cloudflare R2 backend。
- Generic S3-compatible backend interface。
- CLI scan/plan/upload/download。
- Transfer progress。
- Resume。
- Checksum verify。

### Phase 2: 可运营能力

目标：能被真实用户长期使用。

交付物：

- Quota。
- Retention。
- GC。
- Grant。
- Transfer list/show/watch。
- Audit events。
- Better errors。
- `data doctor`。

### Phase 3: GPU job materialization

目标：训练 job 启动前自动准备数据。

交付物：

- Job spec data mounts。
- Runtime cache metadata。
- Prewarm operation。
- Local disk capacity check。
- Region and egress estimate。

### Phase 4: 性能增强

目标：改善大规模训练数据集体验。

交付物：

- Small-file packing。
- Sharded dataset helpers。
- Cross-region copy。
- Cache eviction policy。
- Data locality based scheduling hint。

## 15. TODO

> Implementation status: checked items are implemented and verified in the current local code. In the Cloudflare R2 production gate, unchecked items block production push/tag. In later sections, unchecked items are remaining roadmap or hardening tasks unless they are also listed in the gate.

### Cloudflare R2 生产可用 Gate

- [x] Cloudflare R2 作为 Fugue Cloud 默认 data backend 的配置入口
- [x] 后端 env / Helm values / Kubernetes Secret 注入 R2 bucket、endpoint、prefix、access key、secret key 和 presign TTL
- [x] backend credential secret store，避免 provider secret 明文落入 backend metadata
- [x] R2/S3-compatible 真实数据面 adapter
- [x] presigned single-part upload/download
- [x] multipart upload create/list-parts/complete/abort
- [x] upload part 级 resume，使用 provider `ListParts` 跳过已完成 part
- [x] download Range 分片恢复和 checksum verify
- [x] presigned URL 过期后的 CLI refresh/retry
- [x] 本地 `.fugue/transfers/` transfer state
- [x] `fugue data transfer resume <transfer-id>` 真实恢复 upload/download
- [x] GC sweep + retention window，默认 dry-run，`--confirm` 后删除 orphan blobs
- [x] backend migration copy/cutover 基础流程
- [x] backend migration rollback 命令/API
- [x] backend migration copy 后目标对象 HEAD verify
- [x] backend credential rotation API/CLI
- [x] 可跳过的真实 Cloudflare R2 multipart resume 集成测试入口
- [x] 用真实 Cloudflare R2 凭证跑通集成测试：`FUGUE_DATA_INTEGRATION_R2=1 go test ./internal/api -run TestCloudflareR2MultipartResumeIntegration -count=1`
- [x] 用真实 Cloudflare R2 凭证跑通 CLI push/pull 端到端集成测试：`FUGUE_DATA_INTEGRATION_R2=1 go test ./internal/cli -run TestCloudflareR2DataWorkspacePushPullIntegration -count=1`
- [x] production control plane 发布、tag、GitHub Actions 构建和本地 CLI 更新

### 产品和 DX

- [x] 定最终产品名：`Data Workspace`、`Data Volume` 或 `Project Data`
- [x] 定 CLI 顶层命令是否使用 `fugue data`
- [x] 写完整 CLI help 文案
- [x] 设计 `fugue data init` 的目录自动探测规则
- [x] 设计 `fugue data track` 自动初始化规则
- [x] 设计 data workspace 命名、绑定和切换规则
- [x] 设计 `fugue data status` 的文本输出
- [x] 设计 conflict 提示和默认保护策略
- [x] 设计 `pull` preflight 输出、同名路径检查和安全恢复策略
- [x] 设计 version 规则和 latest 语义
- [x] 设计 `.fugue/data.yaml` schema
- [x] 设计 ignore 规则和默认 ignore 模板
- [x] 设计 untracked large directories 提示逻辑

### 后端契约

- [x] 在 `fugue/openapi/openapi.yaml` 增加 Data Workspaces 分组
- [x] 增加 DataWorkspace schema
- [x] 增加 DataAsset schema
- [x] 增加 DataSnapshot schema
- [x] 增加 DataManifest schema
- [x] 增加 DataTransfer schema
- [x] 增加 DataGrant schema
- [x] 增加 upload plan endpoint
- [x] 增加 download plan endpoint
- [x] 增加 transfer complete endpoint
- [x] 增加 multipart upload create/complete/abort endpoint
- [x] 增加 multipart uploaded parts 查询语义
- [x] 增加 presigned URL refresh endpoint
- [x] 增加 range download 授权语义
- [x] 生成 OpenAPI artifacts
- [x] 更新 `fugue-web` vendored OpenAPI snapshot 和 generated client

### 后端实现

- [x] 增加 metadata store 表或文件 store 实现
- [x] 增加 object storage backend interface
- [x] 增加 Cloudflare R2 默认 backend
- [x] 增加真实 Cloudflare R2 数据面 adapter，而不是只登记 backend metadata
- [x] 增加 S3-compatible backend
- [x] 增加真实 S3-compatible 数据面 adapter，覆盖 R2、B2、AWS S3、MinIO
- [x] 增加 multipart presign planner，把 upload/download plan 映射到 provider presigned URL
- [x] 增加 provider profile：Cloudflare R2
- [x] 增加 provider profile：Backblaze B2
- [x] 增加 provider profile：AWS S3
- [x] 增加 provider profile：Hugging Face
- [x] 增加 provider profile：MinIO
- [x] 增加 self-host MinIO 配置方案
- [x] 增加 backend create/list/show/delete API
- [x] 增加 workspace backend 选择和切换逻辑
- [x] 增加 workspace list/show/use 所需 metadata 读取逻辑
- [x] 增加 backend credential secret store
- [x] 增加 backend credential 加密和 redaction 边界
- [x] 增加 backend credential rotation
- [x] 增加 backend migration operation
- [x] 增加 backend migration copy/verify/cutover/rollback 流程
- [x] 增加 transfer state 恢复语义
- [x] 增加 transfer state server-side checkpoint 持久化
- [x] 增加 provider-side multipart checkpoint 恢复语义
- [x] 增加 presigned URL 过期后的重新授权逻辑
- [x] 增加 presigned URL TTL 配置和最小/最大 TTL 约束
- [x] 增加 quota 统计
- [x] 增加 snapshot manifest 持久化
- [x] 增加 content-addressed blob 引用计数
- [x] 增加 transfer operation 状态记录
- [x] 增加 audit events
- [x] 增加 GC sweep
- [x] 增加 retention policy
- [x] 增加 deleted snapshot / orphan blob 的 GC 策略
- [x] 增加 old backend migration object 的 GC 策略
- [x] 增加 grant 创建和撤销

### CLI 实现

- [x] 增加 `fugue data init`
- [x] 增加 `fugue data track`
- [x] 实现 `fugue data track` 在缺少 `.fugue/data.yaml` 时自动初始化
- [x] 增加 `fugue data untrack`
- [x] 增加 `fugue data status`
- [x] 增加 `fugue data push`
- [x] 增加 `fugue data pull`
- [x] 增加 `fugue data clone`
- [x] 增加 `fugue data workspace ls`
- [x] 增加 `fugue data workspace show`
- [x] 增加 `fugue data workspace use`
- [x] 增加 `fugue data snapshot ls`
- [x] 增加 `fugue data snapshot show`
- [x] 增加 `fugue data snapshot diff`
- [x] 增加 `fugue data grant create`
- [x] 增加 `fugue data grant revoke`
- [x] 增加 `fugue data transfer ls/show/watch`
- [x] 增加 `fugue data backend create/list/show/delete`
- [x] 增加 `fugue data workspace set-backend`
- [x] 增加 `fugue data doctor`
- [x] 实现本地 manifest scanner
- [x] 实现 incremental diff
- [x] 实现 multipart upload
- [x] 实现 multipart download
- [x] 实现 resume state
- [x] 实现本地 `.fugue/transfers/` transfer state 文件
- [x] 实现 `fugue data transfer resume`
- [x] 实现 `fugue data transfer resume` 真正恢复旧 transfer，而不是提示用户重跑命令
- [x] 实现 `--no-resume`
- [x] 实现 interrupted upload 的 part 级恢复
- [x] 实现 interrupted upload 通过 provider `ListParts` 跳过已完成 part
- [x] 实现 interrupted download 的 range 级恢复
- [x] 实现 presigned URL 过期后 CLI 自动 refresh 并继续传输
- [x] 实现 checksum verify
- [x] 实现 `pull` preflight apply plan
- [x] 实现本地同名文件/目录类型冲突检测
- [x] 实现本地 checksum mismatch 冲突检测
- [x] 实现本地额外文件 preserve-and-warn 逻辑
- [x] 实现 `pull --keep-local`
- [x] 实现 `pull --overwrite`
- [x] 实现 `pull --prune --confirm`
- [x] 实现 `pull` 前磁盘空间和目录可写性检查
- [x] 实现 progress renderer
- [x] 实现 JSON output

### 安全和权限

- [x] 增加 `data.read` scope
- [x] 增加 `data.write` scope
- [x] 增加 `data.delete` scope
- [x] 增加 `data.grant` scope
- [x] 确认 API key 权限模型和 project membership 的关系
- [x] 确认 presigned URL TTL
- [x] 确认 presigned URL 只覆盖当前 transfer、asset、object 和 part
- [x] 确认 grant 不可扩权
- [x] 确认 data grant 不能暴露 provider master credential
- [x] 确认 audit 不记录 secret
- [x] 确认 manifest 路径脱敏策略
- [x] 确认 symlink 默认策略

### GPU 集成预留

- [x] 定义 data materialization spec
- [x] 在 job/runtime spec 中预留 data workspace materialization 字段
- [x] 定义 runtime cache metadata
- [x] 增加 runtime cache metadata 存储模型或接口占位
- [x] 定义 prewarm operation
- [x] 增加 prewarm operation API/operation 类型占位
- [x] 定义 job 启动前磁盘检查
- [x] 增加 job 启动前 data materialization planner 接口占位
- [x] 定义 data locality hint
- [x] 增加 runtime/data backend locality hint 字段占位
- [x] 定义跨 region egress estimate
- [x] 增加跨 region egress estimate 模型占位

### 测试和验证

- [x] 单元测试 `.fugue/data.yaml` parser
- [x] 单元测试 path normalization
- [x] 单元测试 ignore rules
- [x] 单元测试 manifest scanner
- [x] 单元测试 upload plan
- [x] 单元测试 download plan
- [x] 单元测试 multipart upload create/complete/abort
- [x] 单元测试 multipart uploaded parts 查询
- [x] 单元测试 presigned URL refresh
- [x] 单元测试 provider credential redaction 和 secret store 边界
- [x] 单元测试 pull preflight apply plan
- [x] 单元测试 pull 遇到本地文件和远端目录同名时默认停止
- [x] 单元测试 pull 遇到本地目录和远端文件同名时默认停止
- [x] 单元测试 pull 遇到 checksum mismatch 时默认停止
- [x] 单元测试 pull 遇到本地额外文件时默认保留并 warning
- [x] 单元测试 `pull --keep-local`
- [x] 单元测试 `pull --overwrite`
- [x] 单元测试 `pull --prune --confirm`
- [x] 单元测试 pull 前磁盘空间和目录可写性检查
- [x] 单元测试 snapshot diff
- [x] 单元测试 grant scope
- [x] 单元测试 transfer state 损坏和恢复
- [x] 单元测试 backend migration copy/verify/cutover/rollback 状态机
- [x] 单元测试 GC sweep 和 retention policy
- [x] 单元测试 GPU materialization spec validation
- [x] 单元测试 runtime cache metadata planner
- [x] 增加可跳过的 Cloudflare R2 multipart resume 集成测试入口
- [x] 运行 Cloudflare R2 multipart resume 集成测试
- [x] 集成测试真实 Cloudflare R2 数据面 push/pull
- [x] 模拟 S3-compatible multipart resume 测试
- [x] 集成测试 S3-compatible multipart resume
- [x] 集成测试真实 S3-compatible 数据面 push/pull
- [x] 集成测试 range download resume
- [x] 集成测试 presigned URL 过期后重新授权
- [x] 集成测试 MinIO backend
- [x] 集成测试 backend migration 从 R2 到 S3-compatible backend
- [x] 集成测试 GC/retention 清理 orphan blobs 且不破坏 live snapshot
- [x] 集成测试 data grant 不可扩权且不泄露 provider credential
- [x] 集成测试大文件 resume
- [x] 集成测试 Hugging Face backend best-effort resume
- [x] 集成测试小文件目录
- [x] 集成测试跨机器 push/pull
- [x] 契约测试 OpenAPI drift
- [x] CLI acceptance test 覆盖核心 DX

## 16. 核心判断

这个功能的关键不是“Fugue 支持上传文件”。关键是：

> Fugue 记住一个训练项目的数据结构，用户只需要 push 和 pull 项目数据状态。

底层可以是对象存储、manifest、multipart、content-addressed blob。用户心智必须是：

```text
我把这个项目的数据交给 Fugue 管。
换 GPU 时，我把同一个项目数据状态拉下来。
```

这比让用户记 bucket、prefix、目录名和手工 rsync 命令更符合 Fugue CLI 的产品方向。

export const SUPPORTED_LOCALES = ["en", "zh-CN", "zh-TW"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = Locale | "auto";
export const SUPPORTED_LOCALE_SET = new Set<Locale>(SUPPORTED_LOCALES);
export const LOCALE_COOKIE_NAME = "fg_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type TranslationValues = Record<string, string | number>;

type MessageCatalog = Partial<Record<string, string>>;

const TRADITIONAL_REGIONS = new Set(["HK", "MO", "TW"]);
const TRADITIONAL_SCRIPTS = new Set(["HANT"]);

const enMessages = {
  "Auto": "Auto",
  "Dark": "Dark",
  "Docs": "Docs",
  "Interface language": "Interface language",
  "Light": "Light",
  "No stats": "-",
  "Theme": "Theme",
} satisfies MessageCatalog;

const zhCNMessages = {
  "{count} byte": "{count} 字节",
  "{count} bytes": "{count} 字节",
  "{count} core": "{count} 核",
  "{count} cores": "{count} 核",
  "{count} workload": "{count} 个工作负载",
  "{count} workloads": "{count} 个工作负载",
  "{count} service": "{count} 个服务",
  "{count} services": "{count} 个服务",
  "{count} app": "{count} 个应用",
  "{count} apps": "{count} 个应用",
  "{count} project": "{count} 个项目",
  "{count} projects": "{count} 个项目",
  "{count} user": "{count} 位用户",
  "{count} users": "{count} 位用户",
  "{count} tenant": "{count} 个租户",
  "{count} tenants": "{count} 个租户",
  "{count} node": "{count} 个节点",
  "{count} nodes": "{count} 个节点",
  "{count} replica": "{count} 个副本",
  "{count} replicas": "{count} 个副本",
  "{count} variable": "{count} 个变量",
  "{count} variables": "{count} 个变量",
  "{count} version": "{count} 个版本",
  "{count} versions": "{count} 个版本",
  "{value} KB": "{value} KB",
  "{value} MB": "{value} MB",
  "{value} GB": "{value} GB",
  "{value} TB": "{value} TB",
  "{value} PB": "{value} PB",
  "Abort build & delete": "中止构建并删除",
  "Abort deploy & delete": "中止部署并删除",
  "Abort the in-flight build and force delete this service.": "中止当前构建并强制删除此服务。",
  "Abort the in-flight deploy and force delete this service.": "中止当前部署并强制删除此服务。",
  "Abort transfer & delete": "中止迁移并删除",
  "Aborting…": "正在中止…",
  "Access keys": "访问密钥",
  "Account": "账号",
  "Active": "活跃",
  "Add service": "添加服务",
  "Adding…": "正在添加…",
  "Admin": "管理员",
  "Admins": "管理员",
  "Any available region": "任意可用区域",
  "App": "应用",
  "App id is required.": "必须提供应用 ID。",
  "App name": "应用名称",
  "Application": "应用",
  "Apps": "应用",
  "Attached app": "挂接应用",
  "Attached backing service.": "挂接后端服务。",
  "Attached machine": "接入机器",
  "Auth / Finalize": "认证 / 完成",
  "Auth / Sign in": "认证 / 登录",
  "Auth / Sign up": "认证 / 注册",
  "Available now": "当前可用",
  "Awaiting runtime": "等待运行时",
  "Back to sign in": "返回登录",
  "Background worker": "后台工作进程",
  "Billing": "计费",
  "Blocked": "已封禁",
  "Bootstrap admin": "引导管理员",
  "Build": "构建",
  "Build aborted. Force delete queued.": "已中止构建，强制删除已加入队列。",
  "Build is still running. Switch to Build to follow progress.": "构建仍在进行中。切换到“构建”查看进度。",
  "Builder": "构建器",
  "Cancel rollout & delete": "取消发布并删除",
  "Cancel the in-flight transfer and force delete this service.": "取消当前迁移并强制删除此服务。",
  "Cancel the queued rollout and force delete this service.": "取消排队中的发布并强制删除此服务。",
  "Cancel transfer & delete": "取消迁移并删除",
  "Check your inbox for the verification link.": "请检查收件箱中的验证链接。",
  "Choose a sign-in method.": "选择登录方式。",
  "Choose a sign-up method.": "选择注册方式。",
  "Choose Google or a verified email link. Password can be added later from the profile page.":
    "选择 Google 或已验证的邮箱链接。密码可稍后在个人资料页添加。",
  "Clear": "正常",
  "Cluster": "集群",
  "Cluster apps unavailable": "集群应用暂不可用",
  "Completing sign-in. If the browser stays here, continue manually once.":
    "正在完成登录。如果浏览器一直停留在此，请手动继续一次。",
  "Console": "控制台",
  "Continue manually once": "手动继续一次",
  "Continue to the console": "继续前往控制台",
  "Continue with {label}": "使用 {label} 继续",
  "Continue with email": "使用邮箱继续",
  "Control plane": "控制平面",
  "Core objects": "核心对象",
  "Create account": "创建账号",
  "Create account now": "立即创建账号",
  "Create an account.": "创建账号。",
  "Create project": "创建项目",
  "Creating…": "正在创建…",
  "Current primary": "当前主节点",
  "Current release": "当前版本",
  "Delete empty project?": "删除空项目？",
  "Delete project": "删除项目",
  "Delete queued.": "删除已加入队列。",
  "Delete service": "删除服务",
  "Delete service?": "删除服务？",
  "Delete is already queued.": "删除已在队列中。",
  "Deleting…": "正在删除…",
  "Disk": "磁盘",
  "Deploy apps from source": "从源码部署应用",
  "Deploy completes only after the new Kubernetes rollout is ready.":
    "只有新的 Kubernetes 发布就绪后，部署才会完成。",
  "Deploy completes only after the new Kubernetes rollout is ready and old replicas have drained.":
    "只有新的 Kubernetes 发布就绪且旧副本全部退出后，部署才会完成。",
  "Deploy from source, shared first": "源码部署 更快起步",
  "Deploy onto a machine shared with this workspace.": "部署到此工作区共享的机器上。",
  "Deploy onto a machine.": "部署到机器上。",
  "Deploy onto the internal cluster.": "部署到内部集群。",
  "Deploy onto this machine.": "部署到这台机器上。",
  "Deploy onto this machine. It also contributes to the internal cluster.":
    "部署到这台机器上。它也会为内部集群提供容量。",
  "Docker image": "Docker 镜像",
  "Docs": "文档",
  "Done": "完成",
  "Email": "邮箱",
  "Email access": "邮箱访问",
  "Email link": "邮箱链接",
  "Email or password is incorrect.": "邮箱或密码不正确。",
  "Email route": "邮箱路径",
  "Email verified. You can continue to the console.": "邮箱已验证。你可以继续前往控制台。",
  "Enabled": "已启用",
  "Enter the service name exactly as shown.": "请按显示内容准确输入服务名称。",
  "Environment changes queued.": "环境变量更改已加入队列。",
  "Environment formats": "环境变量格式",
  "Environment variable names cannot be empty.": "环境变量名称不能为空。",
  "Files": "文件",
  "Finalizing your access.": "正在完成你的访问。",
  "Finish DNS setup and Fugue will verify this hostname automatically.":
    "完成 DNS 配置后，Fugue 会自动验证此主机名。",
  "Force delete": "强制删除",
  "Force delete is already queued.": "强制删除已在队列中。",
  "Force delete queued.": "强制删除已加入队列。",
  "Force delete service": "强制删除服务",
  "Force delete service?": "强制删除服务？",
  "Force delete this pending service.": "强制删除这个待处理服务。",
  "Fugue": "Fugue",
  "Fugue could not load the admin apps snapshot right now.":
    "Fugue 当前无法加载管理员应用快照。",
  "Fugue could not load the admin users snapshot right now.":
    "Fugue 当前无法加载管理员用户快照。",
  "Fugue deploys GitHub repositories, Docker images, and local uploads on shared infrastructure first, then lets teams move the same app onto their own machine without losing the route.":
    "Fugue 支持 GitHub 仓库、Docker 镜像和本地上传，直接部署到托管共享环境，帮助你更快上线，也省掉首轮机器和运维成本",
  "Fugue request failed.": "Fugue 请求失败。",
  "Get started": "开始使用",
  "GitHub": "GitHub",
  "GitHub provider": "GitHub 提供方",
  "GitHub repository": "GitHub 仓库",
  "GitHub repository links must use https://github.com/owner/repo.":
    "GitHub 仓库链接必须使用 https://github.com/owner/repo。",
  "GitHub sync controller": "GitHub 同步控制器",
  "Give the project a name, then point Fugue at the first GitHub repository, local folder, or Docker image.":
    "先为项目命名，然后将 Fugue 指向第一个 GitHub 仓库、本地文件夹或 Docker 镜像。",
  "Go live on shared infrastructure first.": "先在共享基础设施上上线。",
  "Google": "Google",
  "Google is fastest. Email still uses a verification link. Password can be added after sign-up.":
    "Google 最快。邮箱仍通过验证链接完成。密码可在注册后添加。",
  "Google is fastest. Password works if you already added one.":
    "Google 最快。如果你已经设置了密码，也可以直接使用密码。",
  "Google or GitHub are fastest. Password works if you already added one.":
    "Google 或 GitHub 最快。如果你已经设置了密码，也可以直接使用密码。",
  "Google route": "Google 路径",
  "Google sign-in": "Google 登录",
  "Headroom": "余量充足",
  "How it works": "工作方式",
  "Image reference": "镜像引用",
  "Auto": "自动",
  "Dark": "深色",
  "Interface language": "界面语言",
  "Light": "浅色",
  "Import is already running.": "导入已在进行中。",
  "Import is still running. Switch to Build to follow progress.":
    "导入仍在进行中。切换到“构建”查看进度。",
  "Internal cluster": "内部集群",
  "Invalid": "无效",
  "Just now": "刚刚",
  "Last update": "最近更新",
  "Live": "在线",
  "Loading app settings…": "正在加载应用设置…",
  "Loading console page": "正在加载控制台页面",
  "Loading files…": "正在加载文件…",
  "Loading projects": "正在加载项目",
  "Loading route settings…": "正在加载路由设置…",
  "Loading saved images…": "正在加载已保存镜像…",
  "Loading service settings…": "正在加载服务设置…",
  "Local files are selected after sign-in, not before the auth redirect.":
    "本地文件需要在登录后选择，而不是在认证跳转之前。",
  "Local upload": "本地上传",
  "Log views": "日志视图",
  "Magic link / 15 min": "魔法链接 / 15 分钟",
  "Managed first path": "托管首发路径",
  "Move cleanly.": "无需先备服务器",
  "Move to your own machine without changing the route.": "迁移到你的机器上，同时保持路由不变。",
  "Need a fresh account boundary?": "需要新的账号边界？",
  "New variable": "新变量",
  "Next release": "下一个版本",
  "No current status message.": "当前没有状态消息。",
  "No environment changes.": "环境变量没有变化。",
  "No log lines were received before the stream closed.": "流关闭前没有收到任何日志。",
  "No logs available.": "没有可用日志。",
  "No stats": "-",
  "Not yet": "尚未",
  "Offline": "离线",
  "One route, two runtimes": "一套路由，两种运行时",
  "Open app": "打开应用",
  "Open menu": "打开菜单",
  "Opening the console": "正在打开控制台",
  "Opening the console with a first-party session.": "正在用第一方会话打开控制台。",
  "Or continue with email": "或继续使用邮箱",
  "Or use your account email": "或使用你的账号邮箱",
  "Partial": "部分可用",
  "Partial admin data: {details}.": "管理员数据部分可用：{details}。",
  "Password": "密码",
  "Password can be added later from Profile and security. Email link access stays available without a stored secret.":
    "密码稍后可在“个人资料与安全”中添加。即使没有保存的密钥，也仍可通过邮箱链接访问。",
  "Password lane": "密码通道",
  "Paste .env": "粘贴 .env",
  "Paste KEY=value lines directly from a .env file. Quoted values, blank lines, comments, and export prefixes are supported.":
    "可直接从 .env 文件粘贴 KEY=value 行。支持带引号的值、空行、注释和 export 前缀。",
  "Paste a .env block to expand it into individual variables.":
    "粘贴 .env 内容块以展开为单独变量。",
  "Pending first import": "等待首次导入",
  "Pending sync": "等待同步",
  "Platform": "平台",
  "Primary database": "主数据库",
  "Privacy-focused browsers sometimes need one extra first-party handoff before the destination session is available.":
    "以隐私为重点的浏览器有时需要额外一次第一方切换，目标会话才可用。",
  "Profile and security": "个人资料与安全",
  "Project": "项目",
  "Project deleted.": "项目已删除。",
  "Project detail is not available yet.": "项目详情暂不可用。",
  "Project unavailable": "项目不可用",
  "This project no longer exists in the current workspace, or you do not have access to it.":
    "当前工作区中已不存在该项目，或你没有访问权限。",
  "Project name": "项目名称",
  "Project name is required when creating a new project.": "创建新项目时必须提供项目名称。",
  "Projects": "项目",
  "Public route": "公开路由",
  "Queued": "已排队",
  "Queued rollout canceled. Force delete queued.": "已取消排队中的发布，强制删除已加入队列。",
  "Queued transfer": "迁移已排队",
  "Raw environment": "原始环境变量",
  "Registration stays on the verification flow. Workspace setup comes next.":
    "注册会停留在验证流程内。接下来才是工作区设置。",
  "Reconnecting to live logs…": "正在重新连接实时日志…",
  "Redeploy": "重新部署",
  "Redeploy is not available for this app.": "此应用暂不支持重新部署。",
  "Redeploy queued.": "重新部署已加入队列。",
  "Redeploying…": "正在重新部署…",
  "Refreshing recent logs…": "正在刷新最近日志…",
  "Region unavailable": "区域不可用",
  "Request canceled.": "请求已取消。",
  "Request failed.": "请求失败。",
  "Request queued.": "请求已加入队列。",
  "Return route": "返回路径",
  "Review image": "检查镜像",
  "Runtime": "运行时",
  "Runtime logs are not ready": "运行时日志尚未就绪",
  "Runtime logs are unavailable": "运行时日志不可用",
  "Save": "保存",
  "Saving…": "正在保存…",
  "See the route": "查看路由",
  "Servers": "服务器",
  "Service": "服务",
  "Service deleted.": "服务已删除。",
  "Service import queued.": "服务导入已加入队列。",
  "Service name": "服务名称",
  "Service panels": "服务面板",
  "Session handoff": "会话切换",
  "Shared runtime": "共享运行时",
  "Show password": "显示密码",
  "Showing refreshed log snapshots…": "正在显示刷新后的日志快照…",
  "Sign in": "登录",
  "Sign in first to open the console.": "请先登录再打开控制台。",
  "Sign in instead": "改为登录",
  "Sign in to the console.": "登录控制台。",
  "Sign in to upload": "登录以上传",
  "Sign out": "退出登录",
  "Sign-up": "注册",
  "Signed in.": "已登录。",
  "Skip to content": "跳转到正文",
  "Something went wrong. Try again.": "出了点问题，请重试。",
  "Source intake": "源码接入",
  "Source import": "源码导入",
  "Start from a GitHub repository, a published Docker image, or a local upload on managed shared k3s first. The same app can move onto your own machine later without rebuilding the route or changing the workflow.":
    "支持 GitHub 仓库、Docker 镜像和本地上传，直接部署到 Fugue 托管环境，更快拿到公开地址，也省掉第一台服务器和首轮运维成本",
  "Start from a repository, Docker image, or uploaded bundle.":
    "从仓库、Docker 镜像或上传的包开始。",
  "Start queued at 1 replica.": "已加入启动队列，副本数为 1。",
  "Start shared.": "从源码直接上线",
  "Start this paused app at 1 replica without rebuilding the image.":
    "在不重建镜像的情况下，以 1 个副本启动这个已暂停应用。",
  "Starting…": "正在启动…",
  "Storage": "存储",
  "This account has been deleted and can no longer sign in.":
    "此账号已被删除，无法再登录。",
  "This account is blocked. Contact an administrator.": "此账号已被封禁。请联系管理员。",
  "This app is paused. Start it to reopen runtime logs without rebuilding, or use Redeploy for a fresh build.":
    "该应用已暂停。启动它即可在不重建的情况下重新打开运行时日志，或使用“重新部署”进行一次全新构建。",
  "This rollout has not reached a live runtime yet. Switch to Build to follow progress.":
    "本次发布尚未进入在线运行时。切换到“构建”查看进度。",
  "This sign-in handoff is missing or expired. Start again from the sign-in page.":
    "此登录切换缺失或已过期。请从登录页重新开始。",
  "This workspace": "此工作区",
  "Transfer in progress": "迁移进行中",
  "Transferring": "迁移中",
  "Unknown": "未知",
  "Unknown actor": "未知操作者",
  "Unknown error.": "未知错误。",
  "Unknown Fugue request error.": "未知的 Fugue 请求错误。",
  "Unknown image": "未知镜像",
  "Unknown owner": "未知归属者",
  "Unknown route": "未知路由",
  "Unverified": "未验证",
  "Use Google, GitHub, a password, or a verified email link.":
    "使用 Google、GitHub、密码或已验证的邮箱链接。",
  "Use Google, a password, or a verified email link.":
    "使用 Google、密码或已验证的邮箱链接。",
  "Use the same account email shown in Profile.": "使用个人资料中显示的同一个账号邮箱。",
  "Use the password saved from the profile page.": "使用你在个人资料页保存的密码。",
  "Users": "用户",
  "Users unavailable": "用户暂不可用",
  "Verify the public route, then continue to sign in.": "先确认公开路由，再继续登录。",
  "Verify the public route, then open the app.": "先确认公开路由，再打开应用。",
  "Verified": "已验证",
  "Waiting for first start": "等待首次启动",
  "Waiting for import": "等待导入",
  "Waiting in queue": "排队中",
  "Theme": "主题",
  "Watch": "关注",
  "We are converting the provider callback into a first-party session before opening the destination route.":
    "我们正在把提供方回调转换成第一方会话，然后再打开目标路由。",
  "We send one verification link. No password required.": "我们会发送一个验证链接。无需密码。",
  "We verify the email locally and open the session immediately.": "我们会在本地验证邮箱并立即打开会话。",
  "Working": "处理中",
  "Workspace": "工作区",
  "Workspace access": "工作区访问",
  "Workspace access · granted {time}": "工作区访问 · 授予于 {time}",
  "Workspace access · updated {time}": "工作区访问 · 更新于 {time}",
  "Workspace email": "工作区邮箱",
  "Workspace owners: {message}": "工作区归属者：{message}",
  "You have been signed out.": "你已退出登录。",
  "You can continue to the console.": "你可以继续前往控制台。",
  "{amount} allocatable": "{amount} 可分配",
  "{amount} capacity": "{amount} 容量",
  "{count} millicores": "{count} mCPU",
  "{count} pod": "{count} 个 Pod",
  "{count} pods": "{count} 个 Pod",
  "{email} can now deploy to this server.": "{email} 现在可以部署到此服务器。",
  "{label} no longer has deploy access.": "{label} 已不再拥有部署访问权限。",
  "{label} will no longer be able to deploy to this server.":
    "{label} 将不能再部署到此服务器。",
  "{name} ({phase})": "{name}（{phase}）",
  "{price}/mo": "{price}/月",
  "{price}/mo reference": "{price}/月参考价",
  "{signals} pressure reported.": "已报告 {signals} 压力。",
  "{value} CPU": "{value} CPU",
  "{value} GiB": "{value} GiB",
  "Access": "访问",
  "Access controls become available after the runtime finishes reporting.":
    "运行时完成上报后才会提供访问控制。",
  "Add workspace": "添加工作区",
  "Allocatable unknown": "可分配容量未知",
  "Allow the internal cluster to deploy here": "允许内部集群部署到这里",
  "Anyone can deploy here without paying you while this stays on.":
    "开启后，任何人都可以免费部署到这里。",
  "Any workspace can deploy here. {details}": "任意工作区都可部署到这里。{details}",
  "Any workspace can deploy directly here. Internal cluster scheduling stays separate.":
    "任意工作区都可以直接部署到这里。内部集群调度保持独立。",
  "Apps and services on this server.": "此服务器上的应用和服务。",
  "Attached server": "接入服务器",
  "Capacity unknown": "容量未知",
  "Choose who can deploy here": "选择谁可以在这里部署",
  "Cluster capacity": "集群容量",
  "Cluster enabled": "已启用集群",
  "Cluster nodes: {message}": "集群节点：{message}",
  "Control internal scheduling": "控制内部调度",
  "cores": "核",
  "Dedicated": "专用",
  "Dedicated only": "仅专用",
  "Discard changes": "放弃更改",
  "Discard pricing changes?": "放弃定价更改？",
  "Edit pricing": "编辑定价",
  "Enter a non-negative CPU value with up to three decimals.":
    "请输入非负 CPU 数值，最多保留三位小数。",
  "Enter a whole, non-negative disk size in GiB.":
    "请输入以 GiB 为单位的非负整数磁盘大小。",
  "Enter an email address.": "请输入邮箱地址。",
  "Expand a server for access, capacity, and placement.":
    "展开服务器以查看访问、容量和放置信息。",
  "Free": "免费",
  "Free for everyone": "所有人免费",
  "Free for all deployers.": "对所有部署者免费。",
  "Fugue could not load the server inventory right now.":
    "Fugue 当前无法加载服务器清单。",
  "Grant specific workspaces": "授予指定工作区",
  "Grant specific workspaces access without opening the server to everyone.":
    "无需对所有人开放服务器，也能授予指定工作区访问权限。",
  "Granted": "已授权",
  "Heartbeat": "心跳",
  "Heartbeat {time}": "心跳 {time}",
  "Internal": "内部",
  "Internal cluster access": "内部集群访问",
  "Internal cluster access is enabled. Node reconciliation will follow when the server is reachable.":
    "内部集群访问已启用。服务器可达后会继续节点收敛。",
  "Internal cluster access removed.": "内部集群访问已移除。",
  "Internal cluster access removed. Node reconciliation will follow when the server is reachable.":
    "内部集群访问已移除。服务器可达后会继续节点收敛。",
  "Internal cluster can also deploy here.": "内部集群也可以部署到这里。",
  "Internal cluster can now deploy to this server.":
    "内部集群现在可以部署到此服务器。",
  "Internal cluster capacity": "内部集群容量",
  "Internal cluster enabled": "已启用内部集群",
  "Joined": "加入时间",
  "Last saved {time}.": "上次保存于 {time}。",
  "Keep direct grants only if you need them": "仅在需要时保留定向授权",
  "Keep one resource free while charging for the rest.":
    "可以只让某一类资源免费，其余资源继续收费。",
  "Latest heartbeat": "最近心跳",
  "Loading access roster…": "正在加载访问列表…",
  "Location": "位置",
  "Machine": "机器",
  "Managed as shared capacity": "作为共享容量托管",
  "Managed centrally as shared system capacity.":
    "作为共享系统容量由平台集中管理。",
  "Manage access keys": "管理访问密钥",
  "Memory free": "内存免费",
  "Memory must be greater than 0 unless memory is free.":
    "除非内存免费，否则内存值必须大于 0。",
  "Monthly price": "月价格",
  "No active pods reported": "未上报活跃 Pod",
  "No additional workspace access yet.": "还没有额外的工作区访问权限。",
  "No apps or services are placed on this server.":
    "此服务器上还没有放置任何应用或服务。",
  "No direct workspace grants saved yet.": "尚未保存任何直接工作区授权。",
  "No public pricing saved yet.": "尚未保存公开定价。",
  "No signal reported": "尚未上报信号",
  "No servers visible yet": "还没有可见服务器",
  "No workloads on this server": "此服务器上没有工作负载",
  "Not configured yet": "尚未配置",
  "Only admins can allow the internal cluster to deploy here":
    "只有管理员可以允许内部集群部署到这里",
  "Only your workspace and direct grants can deploy here.":
    "只有你的工作区和直接授权的工作区可以部署到这里。",
  "Only region available": "唯一可用区域",
  "Open node keys": "打开节点密钥",
  "Optional free resources": "可选免费资源",
  "Optional. Keep grants only if you may switch back to private later.":
    "可选。如果你之后可能切回私有，再保留这些授权。",
  "Owner": "归属者",
  "Part of Fugue shared capacity.": "属于 Fugue 共享容量的一部分。",
  "Partial server data: {details}.": "服务器数据部分可用：{details}。",
  "Platform shared": "平台共享",
  "Public access is already open to every workspace. Direct grants stay useful if you later switch back to private.":
    "公开访问已对所有工作区开放。如果之后要切回私有，直接授权仍然有用。",
  "Pricing is configured after you switch this server to Public.":
    "切换到公开服务器后才能配置定价。",
  "Private": "私有",
  "Public": "公开",
  "Public + cluster": "公开 + 集群",
  "Public access enabled": "已启用公开访问",
  "Public by {label}": "由 {label} 公开",
  "Public by {label}. {details}": "由 {label} 公开。{details}",
  "Public machine": "公开机器",
  "Public pricing": "公开定价",
  "Public pricing saved.": "公开定价已保存。",
  "Public server": "公开服务器",
  "Public server by {label}": "{label} 的公开服务器",
  "Ready": "就绪",
  "Reference {bundle} at {price}.": "参考配置 {bundle}，价格 {price}。",
  "Reference CPU cores": "参考 CPU 核数",
  "Reference memory in GiB": "参考内存（GiB）",
  "Reference monthly price for that bundle": "该参考配置的月价格",
  "Reference persistent disk in GiB": "参考持久磁盘（GiB）",
  "Reference price not set": "参考价格未设置",
  "Reference pricing": "参考定价",
  "Reference pricing starts at {price}.": "参考定价起于 {price}。",
  "Remove": "移除",
  "Remove access": "移除访问",
  "Removing…": "移除中…",
  "Remove workspace access?": "移除工作区访问权限？",
  "Runtimes: {message}": "运行时：{message}",
  "Runtime state": "运行时状态",
  "Runtime visibility": "运行时可见性",
  "Save pricing": "保存定价",
  "Saved {time}": "保存于 {time}",
  "Server inventory": "服务器清单",
  "Server inventory unavailable": "服务器清单不可用",
  "Server summary": "服务器概览",
  "Set one reference bundle": "设置一个参考配置",
  "Set pricing": "设置定价",
  "Separate from public deploy access.": "与公开部署访问分开。",
  "Shared by {label}": "由 {label} 共享",
  "Shared by {label}.": "由 {label} 共享。",
  "Shared capacity · managed centrally": "共享容量 · 集中管理",
  "Shared machine": "共享机器",
  "Shared server": "共享服务器",
  "Shared with this workspace": "已与此工作区共享",
  "Shared with your workspace.": "已与你的工作区共享。",
  "Skip pricing and let anyone deploy here at no cost.":
    "跳过定价，让任何人都能免费部署到这里。",
  "System": "系统",
  "System access · internal cluster can deploy here":
    "系统访问 · 内部集群可部署到这里",
  "System access is not enabled": "系统访问未启用",
  "The recipient needs to sign in to Fugue and finish workspace setup first.":
    "接收方需要先登录 Fugue 并完成工作区设置。",
  "This server is now private again.": "此服务器现已恢复为私有。",
  "This server is now public to every workspace.":
    "此服务器现已对所有工作区公开。",
  "Use one representative bundle and monthly price. Fugue derives unit CPU, memory, and disk pricing from it.":
    "使用一个代表性的配置和月价格。Fugue 会据此推导 CPU、内存和磁盘的单价。",
  "Use shared capacity in this region.": "在此区域使用共享容量。",
  "Visibility": "可见性",
  "Waiting for complete node health telemetry.":
    "等待完整节点健康遥测。",
  "Waiting for first heartbeat": "等待首次心跳",
  "Waiting for workload details": "等待工作负载详情",
  "Your public pricing draft will be lost if you close this dialog now.":
    "如果现在关闭此对话框，公开定价草稿将丢失。",
  "Zone": "可用区",
  "Accept shared Fugue workloads from outside a tenant runtime.":
    "接受来自租户运行时之外的共享 Fugue 工作负载。",
  "Accept source builds on this machine.": "允许这台机器承接源码构建。",
  "Allow builds": "允许构建",
  "Allow shared pool apps": "允许共享池应用",
  "Apply policy": "应用策略",
  "Applying…": "正在应用…",
  "Build tier": "构建规格",
  "Build tier is stored as policy even if builds are currently off.":
    "即使当前关闭构建，也会将构建规格作为策略保存。",
  "Builds": "构建",
  "Candidate": "候选",
  "Conditions": "条件",
  "Connection": "连接",
  "Control plane role": "控制平面角色",
  "Desired capabilities and the live node state after reconciliation":
    "期望能力，以及节点在完成 reconcile 后的实时状态",
  "Desired policy": "期望策略",
  "Edit the policy Fugue will reconcile onto this machine.":
    "编辑 Fugue 将要 reconcile 到这台机器上的期望策略。",
  "Identity, reachability, and placement facts.":
    "节点标识、可达性与放置信息。",
  "Large": "大型",
  "Live policy": "实时策略",
  "Machine scope": "机器范围",
  "Medium": "中型",
  "Member": "成员",
  "Member is a desired target only. The live node becomes member only after real control-plane promotion outside the agent path.":
    "Member 只是期望目标。节点只有在 agent 路径之外完成真正的控制平面晋升后，实时状态才会变成 member。",
  "No live signals reported.": "当前没有上报实时信号。",
  "No summary available.": "暂无摘要。",
  "Node policy": "节点策略",
  "Node policy saved.": "节点策略已保存。",
  "Node policy updated.": "节点策略已更新。",
  "Node state": "节点状态",
  "Policy access unavailable": "策略访问不可用",
  "Policy saved, but live reconcile reported: {details}":
    "策略已保存，但实时 reconcile 回报：{details}",
  "Read only": "只读",
  "Reset draft": "重置草稿",
  "Shared pool": "共享池",
  "Small": "小型",
  "Tenant": "租户",
  "This node is visible, but it is not backed by a managed machine or runtime yet.":
    "这个节点当前可见，但它还没有挂接到受管机器或运行时。",
  "Unmanaged": "未托管",
  "Unsaved policy": "策略未保存",
  "{state} / {tier}": "{state} / {tier}",
  "CPU free": "CPU 免费",
  "CPU must be greater than 0 unless CPU is free.":
    "除非 CPU 免费，否则 CPU 值必须大于 0。",
  "Disk free": "磁盘免费",
  "Disk must be greater than 0 unless disk is free.":
    "除非磁盘免费，否则磁盘值必须大于 0。",
  "you@company.com": "you@company.com",
} satisfies MessageCatalog;

const zhTWMessages = {
  ...zhCNMessages,
  "{count} byte": "{count} 位元組",
  "{count} bytes": "{count} 位元組",
  "{count} version": "{count} 個版本",
  "{count} versions": "{count} 個版本",
  "Access keys": "存取金鑰",
  "Add service": "新增服務",
  "Adding…": "新增中…",
  "App name": "應用名稱",
  "Auth / Finalize": "認證 / 完成",
  "Auth / Sign in": "認證 / 登入",
  "Auth / Sign up": "認證 / 註冊",
  "Back to sign in": "返回登入",
  "Billing": "帳務",
  "Docs": "文件",
  "Blocked": "已封鎖",
  "Check your inbox for the verification link.": "請檢查收件匣中的驗證連結。",
  "Choose a sign-in method.": "選擇登入方式。",
  "Choose a sign-up method.": "選擇註冊方式。",
  "Completing sign-in. If the browser stays here, continue manually once.":
    "正在完成登入。如果瀏覽器一直停留在此，請手動繼續一次。",
  "Continue to the console": "繼續前往控制台",
  "Continue with email": "使用電子郵件繼續",
  "Create account": "建立帳號",
  "Create account now": "立即建立帳號",
  "Create an account.": "建立帳號。",
  "Create project": "建立專案",
  "Creating…": "建立中…",
  "Delete empty project?": "刪除空專案？",
  "Delete project": "刪除專案",
  "Delete queued.": "刪除已加入佇列。",
  "Delete service": "刪除服務",
  "Delete service?": "刪除服務？",
  "Deleting…": "刪除中…",
  "Disk": "磁碟",
  "Deploy from source, shared first": "原始碼部署 更快起步",
  "Deploy apps from source": "從原始碼部署應用",
  "Email": "電子郵件",
  "Email link": "電子郵件連結",
  "Email or password is incorrect.": "電子郵件或密碼不正確。",
  "Email verified. You can continue to the console.": "電子郵件已驗證。你可以繼續前往控制台。",
  "Environment changes queued.": "環境變數變更已加入佇列。",
  "Environment formats": "環境變數格式",
  "Environment variable names cannot be empty.": "環境變數名稱不能為空。",
  "Finalizing your access.": "正在完成你的存取。",
  "Force delete": "強制刪除",
  "Force delete queued.": "強制刪除已加入佇列。",
  "Fugue deploys GitHub repositories, Docker images, and local uploads on shared infrastructure first, then lets teams move the same app onto their own machine without losing the route.":
    "Fugue 支援 GitHub 儲存庫、Docker 映像和本地上傳，直接部署到託管共享環境，幫你更快上線，也省掉首輪機器和維運成本",
  "Get started": "開始使用",
  "Loading projects": "正在載入專案",
  "Loading console page": "正在載入控制台頁面",
  "Move cleanly.": "無需先備伺服器",
  "New variable": "新變數",
  "Not yet": "尚未",
  "Open menu": "開啟選單",
  "Auto": "自動",
  "Dark": "深色",
  "Interface language": "介面語言",
  "Light": "淺色",
  "Opening the console": "正在開啟控制台",
  "Or continue with email": "或使用電子郵件繼續",
  "Or use your account email": "或使用你的帳號電子郵件",
  "Password": "密碼",
  "Paste .env": "貼上 .env",
  "Paste a .env block to expand it into individual variables.":
    "貼上 .env 內容塊以展開成個別變數。",
  "Profile and security": "個人資料與安全",
  "Project": "專案",
  "Project deleted.": "專案已刪除。",
  "Project detail is not available yet.": "專案詳情暫時不可用。",
  "Project unavailable": "專案不可用",
  "This project no longer exists in the current workspace, or you do not have access to it.":
    "目前工作區中已不存在此專案，或你沒有存取權限。",
  "Project name": "專案名稱",
  "Project name is required when creating a new project.": "建立新專案時必須提供專案名稱。",
  "Projects": "專案",
  "Queued": "已排隊",
  "Redeploy": "重新部署",
  "Redeploy queued.": "重新部署已加入佇列。",
  "Redeploying…": "重新部署中…",
  "Request queued.": "請求已加入佇列。",
  "Save": "儲存",
  "Saving…": "儲存中…",
  "Service deleted.": "服務已刪除。",
  "Service import queued.": "服務匯入已加入佇列。",
  "Service name": "服務名稱",
  "Show password": "顯示密碼",
  "Sign in": "登入",
  "Sign in instead": "改為登入",
  "Sign in to the console.": "登入控制台。",
  "Sign in to upload": "登入以上傳",
  "Sign out": "登出",
  "Signed in.": "已登入。",
  "Something went wrong. Try again.": "發生問題，請再試一次。",
  "Start from a GitHub repository, a published Docker image, or a local upload on managed shared k3s first. The same app can move onto your own machine later without rebuilding the route or changing the workflow.":
    "支援 GitHub 儲存庫、Docker 映像和本地上傳，直接部署到 Fugue 託管環境，更快拿到公開位址，也省掉第一台伺服器和首輪維運成本",
  "Start shared.": "從原始碼直接上線",
  "Waiting in queue": "排隊中",
  "Theme": "主題",
  "Working": "處理中",
  "You have been signed out.": "你已登出。",
} satisfies MessageCatalog;

const zhCNExtraMessages = {
  "{count} permission": "{count} 项权限",
  "{count} permissions": "{count} 项权限",
  "Access key list refreshed.": "访问密钥列表已刷新。",
  "Access key replaced and secret copied. The previous secret no longer works.":
    "访问密钥已替换，并已复制新密钥。旧密钥已失效。",
  "Access key replaced. Copy the new secret now.":
    "访问密钥已替换。请立即复制新的密钥。",
  "Admin key": "管理员密钥",
  "Admin key replaced for this website copy and secret copied.":
    "此网站副本的管理员密钥已替换，并已复制新密钥。",
  "Admin key replaced for this website copy. Copy the new secret now.":
    "此网站副本的管理员密钥已替换。请立即复制新的密钥。",
  "Admin key unavailable": "管理员密钥不可用",
  "A fresh secret will be copied for this website copy without revoking other environments.":
    "会为此网站副本复制一份新的密钥，不会吊销其他环境中的密钥。",
  "Attached VPS": "已挂接 VPS",
  "Cannot join": "不可加入",
  "Changes apply immediately.": "更改会立即生效。",
  "Change the managed billing envelope and top up tenant balance.":
    "调整托管计费额度并为租户余额充值。",
  "Activity": "活动",
  "Based on the saved managed envelope.": "基于已保存的托管额度。",
  "Billing & capacity": "计费与容量",
  "Billing activity details": "计费活动详情",
  "Billing health details": "计费状态详情",
  "Billing needs a workspace": "计费需要工作区",
  "Billing snapshot unavailable": "计费快照不可用",
  "Capacity cap details": "容量上限详情",
  "Cluster join command copied with {label}.":
    "已使用 {label} 复制集群加入命令。",
  "Cluster join command is ready, but clipboard access failed.":
    "集群加入命令已生成，但剪贴板访问失败。",
  "Copy": "复制",
  "Copy secret": "复制密钥",
  "Copyable": "可复制",
  "Copy a join command for a VPS, or copy the raw secret if you need it.":
    "可复制用于 VPS 的加入命令；如果需要，也可以复制原始密钥。",
  "Create the workspace admin access first so Fugue can read and update tenant billing.":
    "请先创建工作区管理员访问，以便 Fugue 读取并更新租户计费。",
  "Create app metadata and desired specs.":
    "创建应用元数据和期望规格。",
  "Create node key": "创建节点密钥",
  "Create node keys and enroll external runtimes.":
    "创建节点密钥并注册外部运行时。",
  "Create one, then copy a join command.":
    "先创建一个，再复制加入命令。",
  "Create or edit runtime records.": "创建或编辑运行时记录。",
  "Create projects inside the current tenant.":
    "在当前租户内创建项目。",
  "Create the first node key when you are ready.":
    "准备好后再创建第一个节点密钥。",
  "Creating node key…": "正在创建节点密钥…",
  "Credential revocation": "凭证吊销",
  "Credential rotation": "凭证轮换",
  "Current key": "当前密钥",
  "Current CPU": "当前 CPU",
  "Current memory": "当前内存",
  "Current rate": "当前费率",
  "Current storage": "当前存储",
  "Current workspace": "当前工作区",
  "Custom scope.": "自定义权限。",
  "Credits and capacity stay aligned": "额度与容量保持同步",
  "Credits details": "额度详情",
  "Delete access key?": "删除访问密钥？",
  "Delete apps without broad write access.":
    "在不授予广泛写权限的情况下删除应用。",
  "Delete key": "删除密钥",
  "Disabling…": "正在禁用…",
  "disabled": "已禁用",
  "Deploy, rebuild, and restart apps.": "部署、重建并重启应用。",
  "Existing runtimes stay attached, but this secret can no longer enroll new nodes.":
    "现有运行时会继续保持挂接，但这个密钥不能再接入新的节点。",
  "Fugue could not load the billing snapshot right now.":
    "Fugue 当前无法加载计费快照。",
  "Identifier": "标识符",
  "Includes {storage} of retained images": "包含 {storage} 的保留镜像存储",
  "Keep at least one permission enabled.":
    "请至少保留一个已启用权限。",
  "Keep the workspace funded": "保持工作区额度充足",
  "Key disabled.": "密钥已禁用。",
  "Key deleted.": "密钥已删除。",
  "Key restored.": "密钥已恢复。",
  "Last used": "最近使用",
  "last used": "最近使用",
  "Live sync is still unavailable. Stored metadata remains visible.":
    "实时同步仍不可用，已保存的元数据仍会显示。",
  "Live sync is still unavailable. Stored node key metadata remains visible.":
    "实时同步仍不可用，已保存的节点密钥元数据仍会显示。",
  "Mint additional tenant access keys.":
    "生成额外的租户访问密钥。",
  "Move apps between runtimes.": "在运行时之间迁移应用。",
  "Never": "从未",
  "No keys yet": "尚无密钥",
  "No node key name changes.": "节点密钥名称没有变化。",
  "No node keys yet": "还没有节点密钥",
  "No permissions are currently available from the workspace key.":
    "当前工作区密钥没有可用权限。",
  "Node key": "节点密钥",
  "Node key created and secret copied.":
    "节点密钥已创建，并已复制密钥。",
  "Node key created.": "节点密钥已创建。",
  "Node key list refreshed.": "节点密钥列表已刷新。",
  "Node key name": "节点密钥名称",
  "Node key name is required.": "必须提供节点密钥名称。",
  "Node key name updated.": "节点密钥名称已更新。",
  "Node key revoked and removed from the list.":
    "节点密钥已吊销并已从列表中移除。",
  "Node keys": "节点密钥",
  "Open access setup": "打开访问设置",
  "Permissions": "权限",
  "Permissions updated.": "权限已更新。",
  "Preview based on unsaved capacity changes.":
    "基于未保存的容量变更预估。",
  "Prefix": "前缀",
  "Primary VPS key…": "主 VPS 密钥…",
  "Refresh keys": "刷新密钥",
  "Ready to cover the saved managed envelope.":
    "可用于覆盖已保存的托管额度。",
  "Rename": "重命名",
  "Rename node key": "重命名节点密钥",
  "Replace": "替换",
  "Replace admin key": "替换管理员密钥",
  "Replace admin key?": "替换管理员密钥？",
  "Replace access key?": "替换访问密钥？",
  "Replace key": "替换密钥",
  "Replacing…": "正在替换…",
  "Saved cap": "已保存额度",
  "Saved cap {cap}": "已保存额度 {cap}",
  "Secure checkout": "安全结账",
  "Set the managed capacity cap": "设置托管容量上限",
  "Restore": "恢复",
  "Restore the workspace to continue.":
    "请先恢复工作区再继续。",
  "Restoring…": "正在恢复…",
  "Revoked": "已吊销",
  "Revoke": "吊销",
  "Revoke key": "吊销密钥",
  "Revoke node key?": "吊销节点密钥？",
  "Revoking…": "正在吊销…",
  "Rotate": "轮换",
  "Rotating…": "正在轮换…",
  "Scale or disable apps.": "调整应用规模或禁用应用。",
  "Secret copied.": "密钥已复制。",
  "Secret hidden": "密钥已隐藏",
  "Secret is ready, but clipboard access failed.":
    "密钥已生成，但剪贴板访问失败。",
  "Showing stored metadata while live key sync is unavailable.":
    "实时密钥同步不可用，当前显示的是已保存的元数据。",
  "Showing stored node key metadata while live sync is unavailable.":
    "实时同步不可用，当前显示的是已保存的节点密钥元数据。",
  "Shown in this workspace only. Use a short label you can recognize later.":
    "仅在此工作区内显示。使用一个日后容易识别的短标签。",
  "The current secret stops working immediately and the new secret will be copied.":
    "当前密钥会立即失效，并复制新的密钥。",
  "This revokes the secret in Fugue immediately.":
    "这会立即在 Fugue 中吊销该密钥。",
  "Trigger failover onto a secondary runtime.":
    "触发切换到备用运行时的故障转移。",
  "Whole USD only · {min} to {max}":
    "仅支持整数美元 · {min} 到 {max}",
  "Update the display name used in this workspace. The key ID, secret, prefix, and attached VPS stay the same.":
    "更新此工作区中显示的名称。密钥 ID、密钥内容、前缀和已挂接的 VPS 都不会变化。",
  "VPS": "VPS",
  "{count} recent events": "{count} 条最近事件",
  "{count} recent events · {updated}": "{count} 条最近事件 · {updated}",
  "{label} details": "{label} 详情",
  "Access & deployment": "访问与部署",
  "Add directories or files that must survive redeploys.":
    "添加在重新部署后仍需保留的目录或文件。",
  "Advanced settings": "高级设置",
  "App name, startup command, build strategy, and optional source overrides.":
    "应用名称、启动命令、构建策略，以及可选的源码覆盖设置。",
  "App network mode": "应用网络模式",
  "Authorize GitHub in the browser, or paste a GitHub token. Fugue stores the resolved secret server-side for later rebuilds and syncs.":
    "可先在浏览器中授权 GitHub，或粘贴一个 GitHub Token。Fugue 会把解析后的密钥保存在服务端，供后续重建和同步使用。",
  "Authorize GitHub in the browser, or paste a token below.":
    "可先在浏览器中授权 GitHub，或在下方粘贴 Token。",
  "Authorized as @{login}.": "已授权为 @{login}。",
  "Auto detect": "自动检测",
  "Background workers skip the managed route, Kubernetes Service, and readiness port.":
    "后台工作进程不会创建托管路由、Kubernetes Service 和就绪探测端口。",
  "Internal service": "内部服务",
  "Internal services get a cluster-only Service and readiness checks, without a public route.":
    "内部服务会保留集群内 Service 和就绪检查，但不会暴露公网路由。",
  "Branch": "分支",
  "Branch {branch}": "分支 {branch}",
  "Branch, name, startup command, build strategy, and optional paths.":
    "分支、名称、启动命令、构建策略和可选路径。",
  "Build context": "构建上下文",
  "Build strategy": "构建策略",
  "Buildpacks": "Buildpacks",
  "Choose a folder, docker-compose.yml, Dockerfile, or source files to upload.":
    "请选择要上传的文件夹、docker-compose.yml、Dockerfile 或源码文件。",
  "Choose a folder, a .zip or .tgz archive, docker-compose.yml, Dockerfile, or source files to upload.":
    "请选择要上传的文件夹、.zip 或 .tgz 归档、docker-compose.yml、Dockerfile 或源码文件。",
  "Choose the machine region.": "选择机器所在区域。",
  "Choose whether Fugue reads this repository anonymously or through saved private access.":
    "选择让 Fugue 以匿名方式读取此仓库，还是通过已保存的私有访问凭据读取。",
  "Context {path}": "上下文 {path}",
  "Country unavailable": "国家不可用",
  "Custom build": "自定义构建",
  "Defaults to the archive root when omitted.": "留空时默认使用归档根目录。",
  "Defaults to the repo root when omitted.": "留空时默认使用仓库根目录。",
  "Deployment": "部署",
  "Deployment region": "部署区域",
  "Deployment target": "部署目标",
  "Deployment targets are unavailable. This import will use the default internal cluster.":
    "当前无法获取部署目标。此次导入将使用默认内部集群。",
  "Dockerfile": "Dockerfile",
  "Dockerfile {path}": "Dockerfile {path}",
  "Dockerfile path": "Dockerfile 路径",
  "Drag a folder, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import.":
    "拖入文件夹、docker-compose.yml、fugue.yaml、Dockerfile 或多个源码文件。Fugue 会在导入前先在服务端生成归档。",
  "Drag a folder, a .zip or .tgz archive, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import unless you upload an archive directly.":
    "拖入文件夹、.zip 或 .tgz 归档、docker-compose.yml、fugue.yaml、Dockerfile 或多个源码文件。除非直接上传归档，否则 Fugue 会在导入前先在服务端生成归档。",
  "Fixed": "固定",
  "GitHub token": "GitHub Token",
  "Image reference is required.": "必须提供镜像引用。",
  "Import source mode": "导入来源模式",
  "Leave auto on unless the upload needs a specific source or Dockerfile override.":
    "除非上传内容需要指定源码目录或 Dockerfile 覆盖，否则保持“自动检测”。",
  "Leave blank to create an empty file.": "留空则创建空文件。",
  "Leave blank to derive the app name from the image reference.":
    "留空则从镜像引用推导应用名称。",
  "Leave blank to derive the app name from the uploaded folder or file.":
    "留空则从上传的文件夹或文件推导应用名称。",
  "Leave blank to derive the app name from the uploaded folder, file, or archive.":
    "留空则从上传的文件夹、文件或归档推导应用名称。",
  "Leave blank to reuse the repository name.": "留空则复用仓库名称。",
  "Leave blank to use the default branch.": "留空则使用默认分支。",
  "Leave this on Any available region to let Fugue place the deployment.":
    "保持为“任意可用区域”，让 Fugue 自动选择部署位置。",
  "Local folder or files": "本地文件夹或文件",
  "Local folder, files, or archive": "本地文件夹、文件或归档",
  "Local archive": "本地归档",
  "Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose.":
    "当前启用了手动构建覆盖。如果你希望 Fugue 从 fugue.yaml 或 docker-compose 导入全部服务，请清空构建策略和路径覆盖。",
  "Manual persistent storage mounts stay in your draft, but Fugue skips them while this import preserves a whole topology. Switch back to a single-app deploy to reuse them.":
    "手动配置的持久化存储挂载会保留在草稿中，但当前导入会保留整套拓扑，因此 Fugue 会暂时跳过它们。切回单应用部署后即可复用。",
  "Marketing site": "营销站点",
  "Name {name}": "名称 {name}",
  "Network mode": "网络模式",
  "Nixpacks": "Nixpacks",
  "Not assigned": "未分配",
  "Only region available": "唯一可用区域",
  "Optional for first deploy": "首次部署可选",
  "Paste a GitHub token with repository read access. If GitHub web authorization is available, Fugue can use that instead and store the resolved secret server-side for later rebuilds and syncs.":
    "粘贴一个具备仓库读取权限的 GitHub Token。如果可用，也可以改用 GitHub 网页授权；Fugue 会把解析后的密钥保存在服务端，供后续重建和同步使用。",
  "Persistent files": "持久化文件",
  "Port {port}": "端口 {port}",
  "Private": "私有",
  "Private repo": "私有仓库",
  "Public": "公开",
  "Public repo": "公开仓库",
  "Public service": "公开服务",
  "Public services get a managed route and readiness checks.":
    "公开服务会获得托管路由和就绪检查。",
  "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so manual network mode is unavailable here.":
    "整套拓扑导入会沿用 fugue.yaml 或 docker-compose 中每个服务自己的网络配置，因此这里不能手动指定网络模式。",
  "Published image": "已发布镜像",
  "Repository link": "仓库链接",
  "Repository link is required.": "必须提供仓库链接。",
  "Required when the Dockerfile is outside the repo root.":
    "当 Dockerfile 不在仓库根目录下时必须填写。",
  "Required when the uploaded Dockerfile is outside the archive root.":
    "当上传的 Dockerfile 不在归档根目录下时必须填写。",
  "Saved GitHub access is available.": "已保存的 GitHub 访问可用。",
  "Saved GitHub access is ready as @{login}. Paste a token only to override it for this import.":
    "已保存的 GitHub 访问已就绪，当前账号为 @{login}。仅在需要覆盖此次导入时再粘贴 Token。",
  "Saved GitHub access is ready. Paste a token only to override it for this import.":
    "已保存的 GitHub 访问已就绪。仅在需要覆盖此次导入时再粘贴 Token。",
  "Service {service}. Leave blank to create an empty file on first deploy.":
    "服务 {service}。留空则在首次部署时创建空文件。",
  "Service name and optional startup command.":
    "服务名称和可选启动命令。",
  "Service port must be a positive integer.": "服务端口必须是正整数。",
  "Set this when the container listens on a known port.":
    "当容器监听固定端口时设置此项。",
  "Source {source}": "源码 {source}",
  "Source directory": "源码目录",
  "Source mode": "来源模式",
  "Startup command": "启动命令",
  "Static site": "静态站点",
  "This build strategy is reused for later syncs.":
    "后续同步会复用这个构建策略。",
  "This target uses one fixed region.": "此目标只使用一个固定区域。",
  "Upload {label}": "上传 {label}",
  "Use a public image reference such as ghcr.io/example/api:1.2.3. Fugue mirrors it into the internal registry before rollout.":
    "使用公开镜像引用，例如 ghcr.io/example/api:1.2.3。Fugue 会在发布前先将其同步到内部镜像仓库。",
  "Use https://github.com/owner/repo.":
    "使用 https://github.com/owner/repo。",
  "Use when the app lives below the repo root.":
    "当应用位于仓库根目录下的子目录时使用。",
  "Use when the uploaded app lives below the archive root.":
    "当上传的应用位于归档根目录下的子目录时使用。",
  "Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose.":
    "整套拓扑导入已就绪。请将构建策略保持为“自动检测”，并保持手动路径覆盖为空，以便从 fugue.yaml 或 docker-compose 导入全部服务。",
  "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so background worker mode is unavailable here.":
    "整套拓扑导入会保留 fugue.yaml 或 docker-compose 中各服务的网络配置，因此这里无法使用后台工作进程模式。",
  "{count} region": "{count} 个区域",
  "{count} regions": "{count} 个区域",
  "After sign-in, this page reopens in Local upload mode so you can drag the folder directly into the browser.":
    "登录后，此页面会以“本地上传”模式重新打开，你可以直接把文件夹拖进浏览器。",
  "Already have access?": "已有访问权限？",
  "Custom domain": "自定义域名",
  "Custom domain availability response was malformed.":
    "自定义域名可用性响应格式不正确。",
  "Custom domain response was malformed.": "自定义域名响应格式不正确。",
  "Custom domains": "自定义域名",
  "Back to top": "返回顶部",
  "Copied": "已复制",
  "Copy command": "复制命令",
  "Copy manually": "请手动复制",
  "Create an account": "创建账号",
  "Deleted": "已删除",
  "Docker image import also available": "也支持导入 Docker 镜像",
  "Envelope / Balance / Metering": "充值 / 余额 / 计量",
  "Finalize": "完成",
  "First party / HttpOnly cookie": "第一方 / HttpOnly Cookie",
  "Footer": "页脚",
  "Gallery / Services / Controls": "画廊 / 服务 / 控制",
  "GitHub import example": "GitHub 导入示例",
  "Google / Email / Verified identity": "Google / 邮箱 / 已验证身份",
  "Health / Heartbeat / Workloads": "健康 / 心跳 / 工作负载",
  "Loading": "正在加载",
  "Loading apps": "正在加载应用",
  "Loading profile settings": "正在加载个人资料设置",
  "Loading users": "正在加载用户",
  "Magic link / Resend / Callback": "魔法链接 / 重发 / 回调",
  "Managed shared runtime": "托管共享运行时",
  "Mobile": "移动端",
  "Nodes / Pressure / Workloads": "节点 / 压力 / 工作负载",
  "OAuth / Profile / Verified email": "OAuth / 个人资料 / 已验证邮箱",
  "OAuth / Verified email": "OAuth / 已验证邮箱",
  "OAuth / Verified email / Linked account": "OAuth / 已验证邮箱 / 已关联账号",
  "Operation": "操作",
  "Optional": "可选",
  "Post-auth": "认证后",
  "Primary": "主导航",
  "Private GitHub repositories require GitHub authorization or a GitHub token with repository read access.":
    "私有 GitHub 仓库需要 GitHub 授权，或提供具备仓库读取权限的 GitHub Token。",
  "Provider callback": "提供方回调",
  "Quickstart": "快速开始",
  "Repository / Image / Upload": "仓库 / 镜像 / 上传",
  "Repository import": "仓库导入",
  "Reset": "重置",
  "Route, sign-in, and the app already share one system.": "路由、登录和应用现在已经是同一个系统。",
  "Routes": "路径",
  "Routed": "已路由",
  "Service port": "服务端口",
  "shared": "共享",
  "Sign in without breaking the product flow.": "在不打断产品流程的情况下完成登录。",
  "Sign in with password": "使用密码登录",
  "Sign-in handoff": "登录切换",
  "Sign-in method": "登录方式",
  "Sign-in route": "登录路径",
  "Sign-up route": "注册路径",
  "Signing in": "正在登录",
  "source": "源码",
  "Stored secret / Current account email": "已保存密钥 / 当前账号邮箱",
  "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.":
    "通往公开 URL 的最快路径，不应该把应用困在一次性环境里。在 Fugue 中，路由保持稳定，运行时可以变化：先导入源码、在共享基础设施上上线，准备好后再迁移到你的机器。",
  "The provider identity is already verified. We are now finishing sign-in with a same-origin form POST so Safari can treat the session write like a regular first-party login redirect.":
    "提供方身份已经验证完成。我们现在通过同源表单 POST 完成登录，这样 Safari 会把会话写入视为一次普通的第一方登录跳转。",
  "The route is the product.": "路由本身就是产品。",
  "Unable to load the current custom domain right now.":
    "当前无法加载现有自定义域名。",
  "Unavailable": "不可用",
  "Use a public image reference to unlock the deploy form after sign-in.":
    "使用公开镜像引用，即可在登录后解锁部署表单。",
  "Use a hostname you control, like app.example.com or example.com.":
    "使用你可控制的主机名，例如 app.example.com 或 example.com。",
  "Validation / Failure / Retry": "校验 / 失败 / 重试",
  "Workspace / Project / App": "工作区 / 项目 / 应用",
  "A database transfer to {target} is already in progress.":
    "当前已有迁移到 {target} 的数据库迁移正在进行。",
  "Add another managed runtime before moving this database.":
    "请先添加另一个托管运行时，再迁移这个数据库。",
  "Add another managed runtime before moving this service.":
    "请先添加另一个托管运行时，再迁移这个服务。",
  "Add another managed runtime before turning on automatic failover.":
    "请先添加另一个托管运行时，再开启自动故障切换。",
  "Add another managed runtime before turning on database failover.":
    "请先添加另一个托管运行时，再开启数据库故障切换。",
  "Add another runtime before moving this service.":
    "请先添加另一个运行时，再迁移这个服务。",
  "After switchover": "切换后",
  "Another project already uses this name. Project names must be unique within the workspace.":
    "已有其他项目使用此名称。项目名称在当前工作区内必须唯一。",
  "Another project already uses “{name}”.": "已有其他项目使用“{name}”。",
  "Attached": "已挂接",
  "Authorize GitHub in the browser, or paste a replacement token below.":
    "可先在浏览器中授权 GitHub，或在下方粘贴一个替代 Token。",
  "Authorize GitHub or paste a new token first.":
    "请先授权 GitHub，或粘贴一个新的 Token。",
  "Auto sync": "自动同步",
  "Automatic failover": "自动故障切换",
  "Automatic failover already points to {target}.":
    "自动故障切换已经指向 {target}。",
  "Automatic failover disabled.": "自动故障切换已关闭。",
  "Automatic failover disabled. Standby database replica removed.":
    "自动故障切换已关闭，备用数据库副本已移除。",
  "Automatic failover is already off.": "自动故障切换已处于关闭状态。",
  "Automatic failover saved. Standby runtime: {target}.":
    "自动故障切换已保存。备用运行时：{target}。",
  "Available": "可用",
  "Available after first deploy.": "首次部署完成后可用。",
  "Blank = default branch.": "留空 = 使用默认分支。",
  "Blank = keep current access.": "留空 = 保持当前访问方式。",
  "Branch changes are unavailable.": "当前无法修改分支。",
  "Browse Live Files": "浏览实时文件",
  "Change the branch used for rebuilds.": "修改重建时使用的分支。",
  "Changes queue a deploy. File contents are only used when Fugue needs to create that file for the first time.":
    "这些更改会排入一次部署。只有在 Fugue 首次创建该文件时，文件内容才会被使用。",
  "Check failed": "检查失败",
  "Checking": "检查中",
  "Checking availability…": "正在检查可用性…",
  "Checking hostname availability…": "正在检查主机名可用性…",
  "Checking saved GitHub access…": "正在检查已保存的 GitHub 访问…",
  "Choose a destination.": "请选择目标位置。",
  "Choose a standby runtime.": "请选择备用运行时。",
  "Configured": "已配置",
  "Connect GitHub": "连接 GitHub",
  "Continuity": "连续性",
  "Create a file or folder from the explorer toolbar.":
    "可在资源管理器工具栏中创建文件或文件夹。",
  "Create parent folders when missing": "缺失时一并创建父文件夹",
  "Current group": "当前分组",
  "Current runtime": "当前运行时",
  "Current runtime unavailable": "当前运行时不可用",
  "DNS needed": "需要 DNS",
  "Database Move": "数据库迁移",
  "Database failover": "数据库故障切换",
  "Database failover already points to {target}.":
    "数据库故障切换已经指向 {target}。",
  "Database failover disabled.": "数据库故障切换已关闭。",
  "Database failover is already changing.": "数据库故障切换已在变更中。",
  "Database failover is already changing. Wait for the current step to finish.":
    "数据库故障切换已在变更中。请等待当前步骤完成。",
  "Database failover is already off.": "数据库故障切换已处于关闭状态。",
  "Database failover saved. Standby runtime: {target}.":
    "数据库故障切换已保存。备用运行时：{target}。",
  "Database one-click transfer": "数据库一键迁移",
  "Database stays where it is.": "数据库保持在当前所在位置。",
  "Database transfer queued to {target}.": "已将数据库迁移加入队列，目标为 {target}。",
  "Default branch": "默认分支",
  "Delete file": "删除文件",
  "Delete file?": "删除文件？",
  "Delete folder": "删除文件夹",
  "Delete folder?": "删除文件夹？",
  "Destination": "目标位置",
  "Destination unavailable": "目标位置不可用",
  "Directory": "目录",
  "Directory path is required.": "必须提供目录路径。",
  "Disable": "关闭",
  "Domains": "域名",
  "Draft editor for {path}": "{path} 的草稿编辑器",
  "Enable failover": "启用故障切换",
  "Failover is off and the standby is gone. {message}":
    "故障切换已关闭，备用实例已移除。{message}",
  "Fetching the current directory contents.": "正在获取当前目录内容。",
  "File": "文件",
  "File deleted.": "文件已删除。",
  "File editor for {path}": "{path} 的文件编辑器",
  "File mode": "文件模式",
  "File path is required.": "必须提供文件路径。",
  "File saved.": "文件已保存。",
  "File storage": "文件存储",
  "Files still live in the running container until persistent storage is configured.":
    "在配置持久化存储之前，文件仍保存在运行中的容器内。",
  "Filesystem actions": "文件系统操作",
  "Filesystem refreshed.": "文件系统已刷新。",
  "Filesystem scope": "文件系统范围",
  "Fixed source": "固定来源",
  "Folder created.": "文件夹已创建。",
  "Folder deleted.": "文件夹已删除。",
  "Folder mode": "文件夹模式",
  "Folders can only be created inside mounted persistent directories.":
    "只能在已挂载的持久化目录内创建文件夹。",
  "GitHub access": "GitHub 访问",
  "Hostname looks good. Save to attach it.":
    "主机名看起来可用。保存后即可挂接。",
  "Hostname looks good. Save to replace the current domain.":
    "主机名看起来可用。保存后将替换当前域名。",
  "Image": "镜像",
  "Image default": "镜像默认值",
  "Image reference": "镜像引用",
  "Image retention": "镜像保留",
  "Images": "镜像",
  "In progress": "进行中",
  "In use": "使用中",
  "Inventory unavailable": "清单不可用",
  "Keep one Fugue subdomain for {appName}, or attach a hostname you control.":
    "为 {appName} 保留一个 Fugue 子域名，或挂接你可控制的主机名。",
  "Large file preview is truncated. Save is disabled for safety.":
    "大文件预览已截断。为安全起见，已禁用保存。",
  "Leave blank to use saved GitHub access. Paste a token only to override it.":
    "留空即可使用已保存的 GitHub 访问。仅在需要覆盖时粘贴 Token。",
  "Leave it blank to follow the repository default branch.":
    "留空即可跟随仓库默认分支。",
  "Live container filesystem": "实时容器文件系统",
  "Live filesystem": "实时文件系统",
  "Loading folder": "正在加载文件夹",
  "Loading {name}": "正在加载 {name}",
  "Loading…": "正在加载…",
  "Manual": "手动",
  "Manual refresh": "手动刷新",
  "Mirrored image limit": "镜像保留上限",
  "Mirrored image limit is already {count}.":
    "镜像保留上限已经是 {count}。",
  "Mirrored image limit updated.": "镜像保留上限已更新。",
  "Mode must be a non-negative integer.": "模式必须是非负整数。",
  "Mount": "挂载",
  "Mounted items": "挂载项",
  "Mounted storage survives restarts, rebuilds, managed transfers, and failover.":
    "已挂载的存储会在重启、重建、托管迁移和故障切换后保留。",
  "Must stay unique within this workspace.": "在当前工作区内必须保持唯一。",
  "Needs GitHub repo read access.": "需要 GitHub 仓库读取权限。",
  "Needs attention": "需要关注",
  "New file": "新建文件",
  "New file path": "新文件路径",
  "New folder": "新建文件夹",
  "New folder path": "新文件夹路径",
  "No destination selected": "未选择目标位置",
  "No mounts attached": "未挂接任何挂载",
  "No project name changes.": "项目名称没有变化。",
  "No source branch changes.": "源码分支没有变化。",
  "No standby selected": "未选择备用运行时",
  "No target selected": "未选择目标位置",
  "Not configured": "未配置",
  "Not queued": "未排队",
  "Not ready": "未就绪",
  "Off": "关闭",
  "Old primary becomes the standby runtime.": "旧主节点会变成备用运行时。",
  "Older mirrored images are pruned automatically.": "较旧的镜像会自动清理。",
  "On": "开启",
  "One-Click Transfer": "一键迁移",
  "Only GitHub-backed services can change the tracked branch.":
    "只有 GitHub 来源的服务可以修改跟踪分支。",
  "Only private GitHub-backed services store a repository token.":
    "只有私有 GitHub 来源的服务会保存仓库 Token。",
  "Open Files": "打开文件",
  "Optional mode (420)": "可选模式（420）",
  "Optional mode (493)": "可选模式（493）",
  "Options": "选项",
  "Paste a token to override saved GitHub access":
    "粘贴 Token 以覆盖已保存的 GitHub 访问",
  "Path must be absolute.": "路径必须是绝对路径。",
  "Pause": "暂停",
  "Pause queued.": "已加入暂停队列。",
  "Pausing…": "正在暂停…",
  "Persistent storage": "持久化存储",
  "Persistent storage already matches the current release.":
    "持久化存储已与当前发布保持一致。",
  "Persistent storage cleared. Deploy queued.":
    "持久化存储已清空，部署已加入队列。",
  "Persistent storage is already cleared.":
    "持久化存储已经处于清空状态。",
  "Persistent storage is not configured yet.":
    "持久化存储尚未配置。",
  "Persistent storage refreshed.": "持久化存储已刷新。",
  "Persistent storage saved. Deploy queued.":
    "持久化存储已保存，部署已加入队列。",
  "Persistent storage sync runs before the move completes.":
    "在迁移完成前会先同步持久化存储。",
  "Persistent storage sync runs before the move completes. Database stays where it is.":
    "在迁移完成前会先同步持久化存储。数据库保持在原位。",
  "Persistent storage · {value}": "持久化存储 · {value}",
  "Platform default": "平台默认值",
  "Polling for new commits": "轮询新提交",
  "Primary runtime": "主运行时",
  "Primary runtime unavailable": "主运行时不可用",
  "Primary runtime unavailable.": "主运行时不可用。",
  "Project shell": "项目壳层",
  "Queued changes roll out in the next deploy operation.":
    "排队中的更改会在下一次部署中生效。",
  "Queueing…": "正在加入队列…",
  "Reconnect GitHub": "重新连接 GitHub",
  "Refresh on demand": "按需刷新",
  "Refreshing…": "正在刷新…",
  "Removing standby": "正在移除备用实例",
  "Replace token": "替换 Token",
  "Replica plan": "副本计划",
  "Repository": "仓库",
  "Repository access": "仓库访问",
  "Repository token updated. Rebuild queued.":
    "仓库 Token 已更新，重建已加入队列。",
  "Resume": "恢复",
  "Resume first.": "请先恢复。",
  "Resume queued.": "已加入恢复队列。",
  "Resume to poll new commits.": "恢复后将轮询新的提交。",
  "Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint.":
    "以 `sh -lc <command>` 运行。留空则使用镜像默认入口点。",
  "Runtime Move": "运行时迁移",
  "Runtime list unavailable.": "运行时列表不可用。",
  "Runtime unavailable": "运行时不可用",
  "Save and rebuild": "保存并重建",
  "Save command": "保存命令",
  "Save limit": "保存上限",
  "Save mode": "保存模式",
  "Save name": "保存名称",
  "Save route": "保存路由",
  "Save standby": "保存备用运行时",
  "Save storage": "保存存储",
  "Save to create this folder in the current scope.":
    "保存后会在当前范围内创建这个文件夹。",
  "Saved GitHub access applied. Rebuild queued.":
    "已应用保存的 GitHub 访问，重建已加入队列。",
  "Saved GitHub access is ready as @{login}.":
    "已保存的 GitHub 访问已就绪，当前账号为 @{login}。",
  "Saved GitHub access is ready.": "已保存的 GitHub 访问已就绪。",
  "Saved access": "已保存的访问",
  "Saved image limit": "已保存镜像上限",
  "Saved image limit is required.": "必须提供已保存镜像上限。",
  "Saved image limit · {value}": "已保存镜像上限 · {value}",
  "Select a destination…": "选择目标位置…",
  "Select a file before saving.": "请先选择一个文件再保存。",
  "Select a standby runtime…": "选择备用运行时…",
  "Serving now": "当前正在服务",
  "Settings": "设置",
  "Source": "来源",
  "Source package": "源码包",
  "Standby is ready. {message}": "备用实例已就绪。{message}",
  "Standby runtime": "备用运行时",
  "Start the service before moving it.": "请先启动服务再迁移。",
  "Start the service before opening Files.": "请先启动服务再打开“文件”。",
  "Still checking saved GitHub access. Try again in a moment or paste a token.":
    "仍在检查已保存的 GitHub 访问。请稍后重试，或直接粘贴 Token。",
  "Storage class": "存储类",
  "Stored token": "已存储 Token",
  "Subdomain": "子域名",
  "Taken": "已被占用",
  "This database cannot be configured from the console yet.":
    "这个数据库暂时还不能在控制台中配置。",
  "This database cannot be transferred from the console yet.":
    "这个数据库暂时还不能在控制台中迁移。",
  "This database is not attached to an application.":
    "这个数据库尚未挂接到应用。",
  "This file is shown as base64 because it is not valid utf-8 text.":
    "该文件因不是有效的 UTF-8 文本，因此以 base64 形式显示。",
  "This folder is empty": "此文件夹为空",
  "This preview was truncated at 1 MB. Save is disabled to avoid overwriting the file with partial content.":
    "此预览已在 1 MB 处截断。为避免用不完整内容覆盖文件，已禁用保存。",
  "Token updates are unavailable.": "当前无法更新 Token。",
  "Topology": "拓扑",
  "Tracked branch": "跟踪分支",
  "Tracked branch · {value}": "跟踪分支 · {value}",
  "Transfer Database Primary?": "迁移数据库主节点？",
  "Transfer Now": "立即迁移",
  "Transfer Service?": "迁移服务？",
  "Transfer queued to {target}.": "已将迁移加入队列，目标为 {target}。",
  "Unable to check availability right now.":
    "当前无法检查可用性。",
  "Unable to check hostname availability right now.":
    "当前无法检查主机名可用性。",
  "Unable to load persistent storage.": "无法加载持久化存储。",
  "Unable to load this file. Refresh the current scope to try again.":
    "无法加载此文件。请刷新当前范围后重试。",
  "Unable to load this filesystem root.": "无法加载当前文件系统根目录。",
  "Unable to load this folder. Try refreshing the current scope.":
    "无法加载此文件夹。请尝试刷新当前范围。",
  "Unassigned": "未分配",
  "Unassigned groups cannot be renamed yet.":
    "尚未分组的项目当前还不能重命名。",
  "Unlinked source": "未关联来源",
  "Update token and rebuild": "更新 Token 并重建",
  "Updates paused": "更新已暂停",
  "Upload": "上传",
  "Use a whole number.": "请输入整数。",
  "Use lowercase letters, numbers, and hyphens.":
    "请使用小写字母、数字和连字符。",
  "Use saved access and rebuild": "使用已保存的访问并重建",
  "Wait for the current release to finish before browsing files.":
    "请等待当前发布完成后再浏览文件。",
  "Wait for the current release to finish.":
    "请等待当前发布完成。",
  "inspect persistent storage": "检查持久化存储",
  "review persistent storage configuration": "查看持久化存储配置",
  "the current standby": "当前备用实例",
  "{appName} will move from {liveRuntimeLabel} to {selectedTargetLabel}.":
    "{appName} 将从 {liveRuntimeLabel} 迁移到 {selectedTargetLabel}。",
  "{count} saved image": "{count} 个已保存镜像",
  "{count} saved images": "{count} 个已保存镜像",
  "{hostname} is already attached to {appName}.":
    "{hostname} 已挂接到 {appName}。",
  "{hostname} is already attached to {appName}. Fugue is finishing setup now.":
    "{hostname} 已挂接到 {appName}。Fugue 正在完成设置。",
  "{hostname} is already attached to {appName}. {guidance}":
    "{hostname} 已挂接到 {appName}。{guidance}",
  "{hostname} is already serving {appName}.":
    "{hostname} 已在为 {appName} 提供服务。",
  "{hostname} is attached to {appName}, but setup still needs attention.":
    "{hostname} 已挂接到 {appName}，但设置仍需处理。",
  "{hostname} is attached to {appName}.":
    "{hostname} 已挂接到 {appName}。",
  "{hostname} is attached to {appName}. Fugue is finishing setup now.":
    "{hostname} 已挂接到 {appName}。Fugue 正在完成设置。",
  "{hostname} is attached to {appName}. {guidance}":
    "{hostname} 已挂接到 {appName}。{guidance}",
  "{hostname} is ready and now serving {appName}.":
    "{hostname} 已就绪，正在为 {appName} 提供服务。",
  "{path} and everything inside it will be removed from {appName}.":
    "{path} 及其中的所有内容都将从 {appName} 中移除。",
  "{path} will be removed from {appName}.":
    "{path} 将从 {appName} 中移除。",
  "{target} (applying)": "{target}（应用中）",
  "{target} (removing)": "{target}（移除中）",
  "<1 hour": "少于 1 小时",
  "Account email": "账号邮箱",
  "Actions": "操作",
  "Active methods": "当前启用方式",
  "Add a published Docker image to {projectName}. Adjust placement only if this service needs it.":
    "为 {projectName} 添加一个已发布的 Docker 镜像。只有这个服务确实需要时才调整部署位置。",
  "Add a stored password for faster return access. Registration still uses an email verification link.":
    "添加一个已保存密码以便更快返回访问。注册流程仍然使用邮箱验证链接。",
  "Add a stored password only if you want faster sign-in after the account is already created.":
    "只有在账号已经创建后，你确实想更快登录时，才需要添加保存密码。",
  "Add credits": "添加额度",
  "Add credits to your balance, then set a capacity cap. Fugue deducts credits from active resources, and stored images count toward disk usage.":
    "先为余额充值，再设置容量上限。Fugue 会从正在运行的资源中扣减额度，已保存镜像也会计入磁盘用量。",
  "Add or reconnect another sign-in method before removing the password from this account.":
    "在移除这个账号的密码前，请先添加或重新连接另一种登录方式。",
  "Add password": "添加密码",
  "Add variable": "添加变量",
  "Add {amount} credits": "添加 {amount} 额度",
  "Added": "已添加",
  "Added {amount} to the prepaid balance.": "已向预付余额添加 {amount}。",
  "Added {amount}. {note}": "已添加 {amount}。{note}",
  "Admin balance adjustment": "管理员余额调整",
  "Amount": "金额",
  "Archive the uploaded files and stage the first build on the server.":
    "将上传文件归档，并在服务器上准备第一次构建。",
  "At the current rate, your balance lasts about {duration}.":
    "按当前速率估算，你的余额大约还能支撑 {duration}。",
  "At the current rate, {amount} adds about {duration} of runway.":
    "按当前速率估算，{amount} 大约可增加 {duration} 的续航。",
  "Attach live workbench": "接入实时工作台",
  "Attached to": "挂接到",
  "Auto-detect after import": "导入后自动识别",
  "Available credits": "可用额度",
  "BYO VPS free": "自带 VPS 免费",
  "Back to projects": "返回项目",
  "Manage services, routes, logs, files, and project settings from one workspace.":
    "在一个工作台里管理服务、路由、日志、文件和项目设置。",
  "Balance adjusted": "余额已调整",
  "Balance adjustment": "余额调整",
  "Balance after": "调整后余额",
  "Balance top-up": "余额充值",
  "Billing activity": "计费活动",
  "Billing data is unavailable right now. Retry the request.":
    "当前无法获取计费数据。请重试。",
  "Billing event recorded.": "已记录计费事件。",
  "Billing health": "计费健康度",
  "Billing snapshot ready": "计费快照已就绪",
  "Billing snapshot refreshed with partial live data.":
    "计费快照已刷新，但实时数据仅部分更新。",
  "Billing snapshot refreshed.": "计费快照已刷新。",
  "Billing top-up status response was malformed.":
    "计费充值状态响应格式不正确。",
  "Billing update response was malformed.": "计费更新响应格式不正确。",
  "Build details": "构建详情",
  "Build logs, route controls, and environment panels replace this shell automatically.":
    "构建日志、路由控制和环境变量面板会自动替换这个壳层。",
  "Build queued": "构建已加入队列",
  "Charged at": "计费基准",
  "Charges follow the larger of your saved cap and any resources already committed.":
    "计费会以你保存的上限和当前已提交资源中较大的那个为准。",
  "Check payment status": "检查支付状态",
  "Checking…": "检查中…",
  "Checkout is still being confirmed. Credits appear here automatically after payment clears.":
    "结账结果仍在确认中。支付完成后，额度会自动出现在这里。",
  "Commit": "提交",
  "Confirm password": "确认密码",
  "Connect another sign-in method before turning off email link or removing the password.":
    "关闭邮箱链接或移除密码前，请先连接另一种登录方式。",
  "Connect is disabled here until the provider is configured.":
    "在配置提供方之前，这里暂时无法连接。",
  "Connect {provider}": "连接 {provider}",
  "Connected providers": "已连接提供方",
  "Connecting to live logs…": "正在连接实时日志…",
  "Connection dropped. Reconnecting to {streamLabel} output.":
    "连接已断开。正在重新连接 {streamLabel} 输出。",
  "Connection dropped. Reconnecting to {streamLabel} output. Showing the latest received output.":
    "连接已断开。正在重新连接 {streamLabel} 输出。当前显示最近一次收到的输出。",
  "Could not disable email link sign-in.": "无法禁用邮箱链接登录。",
  "Could not enable email link sign-in.": "无法启用邮箱链接登录。",
  "Could not remove the password.": "无法移除密码。",
  "Could not save the password.": "无法保存密码。",
  "Could not update the sign-in method.": "无法更新登录方式。",
  "Could not update your profile.": "无法更新你的个人资料。",
  "Couldn't queue the first service": "无法为首个服务加入队列",
  "Create a workspace first, then return to the console to import your first service.":
    "请先创建工作区，然后回到控制台导入第一个服务。",
  "Creating project": "正在创建项目",
  "Creating project and queueing the first deployment.":
    "正在创建项目，并把第一次部署加入队列。",
  "Credits": "额度",
  "Credits are deducted only while managed resources are active.":
    "只有在托管资源处于活动状态时才会扣减额度。",
  "Any active billable resource is billed against this saved envelope.":
    "只要有任何可计费资源处于活动状态，就会按这个已保存的容量包络计费。",
  "Once any billable resource is active, charges follow your saved cap.":
    "只要有任何可计费资源处于活动状态，就会按你保存的上限计费。",
  "Billing is inactive.": "当前未在计费。",
  "Credits ready to cover current managed usage.":
    "当前可用额度足以覆盖现有托管资源用量。",
  "Current cap": "当前上限",
  "Current password": "当前密码",
  "Current usage": "当前用量",
  "Delete": "删除",
  "Description": "说明",
  "Direct returning access": "直接返回访问",
  "Disable email link": "禁用邮箱链接",
  "Disable email link sign-in?": "要禁用邮箱链接登录吗？",
  "Disabled on this account.": "此账号上已禁用。",
  "Disconnect {method}": "断开 {method}",
  "Disconnect {method} sign-in?": "要断开 {method} 登录吗？",
  "Display name": "显示名称",
  "Display name and every sign-in path linked to this account.":
    "显示名称，以及与此账号关联的所有登录路径。",
  "Edit the name shown across the console. Email and sign-in methods are managed below.":
    "编辑在整个控制台中显示的名称。邮箱与登录方式在下方管理。",
  "Elapsed": "已耗时",
  "Email link sign-in disabled.": "邮箱链接登录已禁用。",
  "Email link sign-in enabled.": "邮箱链接登录已启用。",
  "Empty project": "空项目",
  "Empty projects stay visible so you can reuse the shell or delete it explicitly.":
    "空项目会继续显示，方便你复用这个壳层，或手动将其删除。",
  "Enable email link": "启用邮箱链接",
  "Enter a whole USD amount between {min} and {max}.":
    "请输入介于 {min} 到 {max} 之间的整数美元金额。",
  "Environment": "环境变量",
  "Estimated runway": "预计续航",
  "First service is queued": "首个服务已加入队列",
  "First service is syncing into the console": "首个服务正在同步到控制台",
  "Fugue could not load the profile settings right now.":
    "Fugue 当前无法加载个人资料设置。",
  "Fugue could not read the billing state for {workspaceName}.":
    "Fugue 当前无法读取 {workspaceName} 的计费状态。",
  "Fugue could not read the current tenant billing state.":
    "Fugue 当前无法读取当前租户的计费状态。",
  "GitHub could not be linked right now. Try again.":
    "当前无法关联 GitHub。请重试。",
  "GitHub sign-in is not configured in this environment.":
    "当前环境未配置 GitHub 登录。",
  "GitHub sign-in linked.": "GitHub 登录已关联。",
  "History": "历史",
  "How Fugue should address you": "Fugue 应如何称呼你",
  "Identity": "身份",
  "Import a new service": "导入新服务",
  "Import running": "导入进行中",
  "Keep credits and capacity in sync": "保持额度与容量同步",
  "Keep one method live": "至少保留一种可用方式",
  "Keep your workspace funded": "确保工作区有足够额度",
  "Last sign-in": "上次登录",
  "Linked providers": "已关联提供方",
  "Loading deployment targets…": "正在加载部署目标…",
  "Loading environment…": "正在加载环境变量…",
  "Manage password": "管理密码",
  "Managed billing paused.": "托管计费已暂停。",
  "Managed envelope updated.": "托管容量包络已更新。",
  "Memory": "内存",
  "Need more room? Add credits here first, then raise the capacity cap.":
    "需要更多空间？先在这里充值额度，再提高容量上限。",
  "New cap": "新上限",
  "New monthly spend": "新的月度支出",
  "New password": "新密码",
  "Next steps": "后续步骤",
  "No billing events yet": "还没有计费事件",
  "No charge": "无费用",
  "No saved envelope.": "未设置容量包络。",
  "Save the maximum managed CPU, memory, and disk for this workspace. Once any billable resource is active, Fugue charges against this saved envelope.":
    "为这个工作区保存托管 CPU、内存和磁盘上限。只要有任何可计费资源处于活动状态，Fugue 就会按这个已保存的容量包络计费。",
  "No live burn right now.": "当前没有实时消耗。",
  "No live stats": "暂无实时统计",
  "No services are attached to this project yet.":
    "这个项目还没有挂接任何服务。",
  "No workspace yet": "还没有工作区",
  "Not added": "未添加",
  "Not configured in this environment.": "当前环境未配置。",
  "Not enabled": "未启用",
  "One-time verification path": "一次性验证路径",
  "Open retry flow": "打开重试流程",
  "Over cap": "超出上限",
  "Package uploaded source": "打包上传源码",
  "Packaging the first build": "正在打包第一次构建",
  "Packaging uploaded files for the first build.":
    "正在为第一次构建打包上传文件。",
  "Password access": "密码访问",
  "Password added.": "密码已添加。",
  "Password removed.": "密码已移除。",
  "Password updated.": "密码已更新。",
  "Passwords do not match.": "两次输入的密码不一致。",
  "Paused until both CPU and memory are above zero.":
    "CPU 和内存都大于 0 之前，计费保持暂停。",
  "Payment completed. Billing balance refreshed.":
    "支付已完成，计费余额已刷新。",
  "Payment failed.": "支付失败。",
  "Prepare image rollout": "准备镜像发布",
  "Prepare repository build": "准备仓库构建",
  "Preparing checkout…": "正在准备结账…",
  "Preparing the first repository build": "正在准备第一次仓库构建",
  "Preparing the first repository build.":
    "正在准备第一次仓库构建。",
  "Preparing the first rollout": "正在准备第一次发布",
  "Profile settings unavailable": "个人资料设置不可用",
  "Profile updated.": "个人资料已更新。",
  "Project id": "项目 ID",
  "Project import queued.": "项目导入已加入队列。",
  "Project name, source reference, app naming, and handoff behavior":
    "项目名称、来源引用、应用命名和交接行为",
  "Queue failed": "入队失败",
  "Recent billing events": "最近计费事件",
  "Recovery anchor": "恢复锚点",
  "Refresh billing": "刷新计费",
  "Restart": "重启",
  "Restart queued.": "重启已加入队列。",
  "Restarting…": "重启中…",
  "Retry needed": "需要重试",
  "Review variables for {name}, or switch to Raw to paste a .env block. Saving queues a deploy.":
    "检查 {name} 的变量，或切换到“原始”粘贴 .env 块。保存后会将部署加入队列。",
  "Runway updates after live billing data is available.":
    "实时计费数据就绪后会更新续航估算。",
  "Save capacity cap": "保存容量上限",
  "Save higher cap": "保存更高上限",
  "Save profile": "保存个人资料",
  "Saving cap…": "正在保存上限…",
  "Services": "服务",
  "Set your capacity cap": "设置容量上限",
  "Show passwords": "显示密码",
  "Source files uploaded from this browser": "从当前浏览器上传的源码文件",
  "State": "状态",
  "Streaming response body is unavailable.":
    "流式响应正文不可用。",
  "Suggested top-up amounts": "建议充值金额",
  "Syncing": "同步中",
  "That GitHub account is already linked to another Fugue account.":
    "这个 GitHub 账号已经关联到另一个 Fugue 账号。",
  "That Google account is already linked to another Fugue account.":
    "这个 Google 账号已经关联到另一个 Fugue 账号。",
  "The first service did not queue.": "首个服务未能加入队列。",
  "The live workbench appears as soon as the app record becomes visible.":
    "应用记录可见后，实时工作台就会出现。",
  "The project exists and the first service slot is reserved.":
    "项目已经创建，首个服务槽位已保留。",
  "This account currently has one sign-in method left. Connect another method before removing it.":
    "这个账号目前只剩一种登录方式。请先连接另一种方式再移除它。",
  "This shell disappears automatically once the live workbench is ready.":
    "实时工作台准备好后，这个壳层会自动消失。",
  "Top up required": "需要充值",
  "Top-up amount": "充值金额",
  "Unable to load tenant billing": "无法加载租户计费",
  "Unable to load this project right now.":
    "当前无法加载这个项目。",
  "Update password": "更新密码",
  "Updated {time}": "更新于 {time}",
  "{amount} / hour": "{amount} / 小时",
  "{amount} / hour at the current live rate.":
    "按当前实时费率计算为 {amount} / 小时。",
  "{count} months": "{count} 个月",
  "{count} weeks": "{count} 周",
  "{duration} elapsed": "已耗时 {duration}",
  "{label} logs are not ready yet.": "{label} 日志尚未就绪。",
  "{label} stream closed.": "{label} 流已关闭。",
  "{label} stream closed. Showing latest snapshot.":
    "{label} 流已关闭。当前显示最新快照。",
  "{method} in use": "{method} 正在使用中",
  "{name} is empty and will be removed from the workspace.":
    "{name} 为空，会从工作区中移除。",
  "{name} will be queued for deletion from this project.":
    "{name} 将在这个项目中加入删除队列。",
  "app.example.com or example.com": "app.example.com 或 example.com",
  "25": "25",
  "Action": "操作",
  "Add credits before you raise capacity or start new managed resources.":
    "在提高容量或启动新的托管资源前，请先充值。",
  "Balance is empty. Add credits before you expand capacity or start new managed resources.":
    "余额为空。在扩容或启动新的托管资源前，请先充值。",
  "Billing checkout response was malformed.": "账单结账响应格式不正确。",
  "Building": "构建中",
  "CPU": "CPU",
  "Cancel": "取消",
  "Capacity": "容量",
  "Changes apply after you save.": "保存后生效。",
  "Connected": "已连接",
  "Copy logs": "复制日志",
  "Copying…": "正在复制…",
  "Created": "创建时间",
  "Credits are deducted when managed resources are active.":
    "托管资源运行时会扣减余额。",
  "Current usage is above your saved capacity cap. Save a higher cap to match what is already committed.":
    "当前用量已经高于你保存的容量上限。请保存一个更高的上限，以匹配已提交的资源。",
  "DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# comments are ignored":
    "DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# 注释会被忽略",
  "Deleting service": "正在删除服务",
  "Deploy aborted. Force delete queued.": "已中止部署，强制删除已加入队列。",
  "Deploying": "部署中",
  "Discard": "舍弃",
  "Disconnect": "解除关联",
  "Disconnecting": "解除关联中",
  "Drop a local folder or source files for {projectName}. Fugue packages them on the server before import.":
    "将本地文件夹或源码文件拖到 {projectName}。Fugue 会先在服务器端打包，再开始导入。",
  "Drop a local folder, archive, or source files for {projectName}. Fugue packages file uploads on the server before import.":
    "将本地文件夹、归档或源码文件拖到 {projectName}。Fugue 会先在服务器端打包文件上传内容，再开始导入。",
  "Duplicate env keys: {keys}.": "环境变量键重复：{keys}。",
  "Empty": "空",
  "Empty response.": "空响应。",
  "Enabling": "启用中",
  "Envelope updated": "容量包已更新",
  "Event": "事件",
  "Fugue is creating the project and packaging the uploaded files on the server before the first build starts.":
    "Fugue 正在创建项目，并在首次构建开始前于服务器端打包已上传的文件。",
  "Drag a folder, a .zip or .tgz archive, docker-compose.yml, fugue.yaml, Dockerfile, or source files into the browser":
    "将文件夹、.zip 或 .tgz 归档、docker-compose.yml、fugue.yaml、Dockerfile 或源码文件拖入浏览器",
  "Drop a local folder, archive, or source files. Fugue packages file uploads on the server, then imports the result through the upload path.":
    "拖入本地文件夹、归档或源码文件。Fugue 会先在服务器端打包文件上传内容，再通过上传链路导入结果。",
  "Fugue is creating the project and preparing the repository import before build logs can attach.":
    "Fugue 正在创建项目，并在构建日志接入前准备仓库导入。",
  "Fugue is creating the project, mirroring the image internally, and staging the first rollout.":
    "Fugue 正在创建项目、在内部镜像该镜像，并为首次发布做准备。",
  "GitHub import": "GitHub 导入",
  "Google could not be linked right now. Try again.":
    "当前无法关联 Google，请重试。",
  "Google sign-in is not configured in this environment.":
    "当前环境未配置 Google 登录。",
  "Google sign-in linked.": "Google 登录已关联。",
  "Handoff": "交接",
  "Inactive": "未启用",
  "Inspect the repository and prepare the build plan for the first service.":
    "检查仓库并为首个服务准备构建计划。",
  "Inspect {name} ({status})": "查看 {name}（{status}）",
  "Keep another sign-in method linked before removing email link access.":
    "移除邮箱链接访问前，请先关联另一种登录方式。",
  "Keep another sign-in method linked before removing the stored password.":
    "移除已保存密码前，请先关联另一种登录方式。",
  "Keep another sign-in method linked before removing this one.":
    "移除这一项前，请先关联另一种登录方式。",
  "Keep the account email as the recovery anchor. Email link remains the lowest-friction fallback; password is optional for faster return access.":
    "将账号邮箱保留为恢复锚点。邮箱链接仍是摩擦最低的兜底方式；密码仅用于更快返回访问。",
  "Keep this page open. Fugue will swap this shell for the live workbench as soon as the app record is visible.":
    "请保持此页面打开。应用记录一旦可见，Fugue 就会把这个壳层替换成实时工作台。",
  "Key": "键",
  "Line {line}: {message}": "第 {line} 行：{message}",
  "Linked": "已关联",
  "Live {streamLabel} output for {name}.":
    "{name} 的实时 {streamLabel} 输出。",
  "Local source": "本地源码",
  "Location": "位置",
  "Logs": "日志",
  "Manage how this account gets back into Fugue. Email stays the recovery anchor while GitHub and Google remain optional return paths.":
    "管理这个账号回到 Fugue 的方式。邮箱仍是恢复锚点，而 GitHub 和 Google 则是可选的返回路径。",
  "Managed billing is paused. Set both CPU and memory above zero to resume.":
    "托管计费已暂停。将 CPU 和内存都设为大于零即可恢复。",
  "Managed envelope automatically raised to {envelope}.":
    "托管容量包已自动提升到 {envelope}。",
  "Managed envelope changed.": "托管容量包已更改。",
  "Managed envelope set to {envelope}.":
    "托管容量包已设为 {envelope}。",
  "Managed envelope was raised automatically.":
    "托管容量包已自动提升。",
  "Maximum managed resources for this workspace.":
    "此工作区可使用的最大托管资源。",
  "Mirror the published image internally and stage the first rollout.":
    "在内部镜像该已发布镜像，并为首次发布做准备。",
  "Mirroring the image and preparing the first rollout.":
    "正在镜像该镜像并准备首次发布。",
  "Name": "名称",
  "No change": "无变更",
  "No environment variables yet. Add one manually or switch to Raw to paste a .env block.":
    "还没有环境变量。可手动添加一个，或切换到“原始”后粘贴 .env 内容块。",
  "No live estimate": "暂无实时估算",
  "Not available": "暂不可用",
  "Not linked yet.": "尚未关联。",
  "Opening live {streamLabel} output for {name}.":
    "正在为 {name} 打开实时 {streamLabel} 输出。",
  "Optional. Shown in the console header and account surfaces.":
    "可选。会显示在控制台头部和账号界面中。",
  "Panels": "面板",
  "Partial Fugue data: {details}.": "Fugue 数据部分可用：{details}。",
  "Paste a .env block for {name}. Comments, blank lines, and export prefixes are ignored.":
    "为 {name} 粘贴 .env 内容块。注释、空行和 export 前缀都会被忽略。",
  "Paste a GitHub repository link for {projectName}. Adjust access or placement only if this service needs it.":
    "为 {projectName} 粘贴 GitHub 仓库链接。仅在该服务确实需要时再调整访问权限或部署位置。",
  "Paused": "已暂停",
  "Platform admin adjusted the prepaid balance":
    "平台管理员调整了预付余额",
  "Profile": "个人资料",
  "Project 1": "项目 1",
  "Project created": "项目已创建",
  "Project created. The live workbench will replace this shell automatically.":
    "项目已创建。实时工作台就绪后会自动替换这个壳层。",
  "Project name already exists. Choose a different name or select the existing project.":
    "项目名称已存在。请选择其他名称，或直接选择现有项目。",
  "Projected monthly spend": "预计月度支出",
  "Published image reference": "已发布镜像引用",
  "Raw input is empty. Saving will keep the environment empty.":
    "原始输入为空。保存后环境变量将保持为空。",
  "Ready to connect when you want GitHub-based sign-in.":
    "需要 GitHub 登录时即可连接。",
  "Ready to connect when you want a Google-based return path.":
    "需要 Google 作为返回路径时即可连接。",
  "Ready to connect.": "随时可连接。",
  "Registration still uses an email verification link.":
    "注册仍通过邮箱验证链接完成。",
  "Release": "版本",
  "Remove": "移除",
  "Remove password": "移除密码",
  "Remove password sign-in?": "移除密码登录？",
  "Removing": "移除中",
  "Repeat the password once to confirm it.":
    "再次输入密码以确认。",
  "Request failed with status {status}.":
    "请求失败，状态码 {status}。",
  "Required before the password can be changed.":
    "修改密码前必须提供。",
  "Reserve the project and the first service slot.":
    "预留项目和首个服务槽位。",
  "Reset raw": "重置原始输入",
  "Restart the current release without rebuilding the image. Persistent storage is preserved when configured.":
    "在不重建镜像的情况下重启当前版本。若已配置持久化存储，则会保留。",
  "Restricted": "受限",
  "Retry": "重试",
  "Retry billing sync": "重试同步账单",
  "Return to the create flow and retry the import":
    "返回创建流程并重试导入",
  "Running": "运行中",
  "Runway updates after the latest live billing sync.":
    "续航估算会在最新实时账单同步后更新。",
  "Save the maximum managed CPU, memory, and disk for this workspace. Fugue charges against the larger of your saved cap and any resources already committed.":
    "保存这个工作区的最大托管 CPU、内存和磁盘。Fugue 会按你保存的上限与已提交资源中更大的那一个计费。",
  "Saved capacity exceeds the temporary 2 CPU / 4 GiB / 30 GiB UI cap. Save again to bring it back into range.":
    "已保存容量超出了当前临时的 2 CPU / 4 GiB / 30 GiB 界面上限。请再次保存，将它调回范围内。",
  "Saving": "保存中",
  "Send a one-time verification link to the account email on the sign-in page.":
    "在登录页向账号邮箱发送一次性验证链接。",
  "Send a secure sign-in link to the account email without storing a password.":
    "向账号邮箱发送安全登录链接，无需存储密码。",
  "Shown in the project list.": "会显示在项目列表中。",
  "Sign-in methods": "登录方式",
  "Some billing details could not be refreshed. Visible values may be incomplete.":
    "有些账单细节无法刷新。当前显示的数值可能不完整。",
  "Start": "启动",
  "Stream unavailable.": "流不可用。",
  "The current browser session stays open, but future sign-ins will need another linked method.":
    "当前浏览器会话会保持打开，但之后登录需要另一种已关联方式。",
  "The current browser session stays open, but the next sign-in will need another linked method.":
    "当前浏览器会话会保持打开，但下次登录需要另一种已关联方式。",
  "The destination runtime is still preparing. Runtime logs switch over once the transfer is live.":
    "目标运行时仍在准备中。迁移生效后，运行时日志会自动切换过去。",
  "The live workbench replaces this shell when logs and route controls are ready":
    "日志与路由控制就绪后，即时工作台会替换这个壳层",
  "The live {streamLabel} stream is delayed at the edge. Loading recent snapshots instead.":
    "边缘侧的实时 {streamLabel} 流暂时延迟，正在改为加载最近快照。",
  "The live {streamLabel} stream is delayed at the edge. Refreshing recent snapshots every 3 seconds.":
    "边缘侧的实时 {streamLabel} 流暂时延迟，正在每 3 秒刷新一次最近快照。",
  "The request stopped before build logs and route controls could attach.":
    "在构建日志和路由控制接入前，请求就已停止。",
  "This project still exists in Fugue, but it does not currently have any running services or attached backing services.":
    "这个项目仍然存在于 Fugue 中，但目前没有任何运行中的服务或挂接的后端服务。",
  "This session was opened with a password. Changing or removing it will not close the current browser session.":
    "当前会话是通过密码打开的。修改或移除密码不会关闭当前浏览器会话。",
  "Top up credits before you expand capacity. Credits are deducted while resources run, and stored images count toward disk usage.":
    "扩容前请先充值。资源运行时会扣减余额，已保存镜像也会计入磁盘用量。",
  "Top up now": "立即充值",
  "Top-ups, admin balance adjustments, and envelope changes will appear here.":
    "充值、管理员余额调整和容量包变更都会显示在这里。",
  "Top-ups, balance adjustments, and capacity changes appear here.":
    "充值、余额调整和容量变更都会显示在这里。",
  "Type": "输入",
  "URL": "URL",
  "Unable to open the log stream.": "无法打开日志流。",
  "Unable to open the {streamLabel} stream.":
    "无法打开 {streamLabel} 流。",
  "Undo": "撤销",
  "Update or remove the stored password. Email link stays the recovery anchor for this account.":
    "更新或移除已保存的密码。邮箱链接仍是这个账号的恢复锚点。",
  "Updating": "更新中",
  "Use GitHub as another return path into the console.":
    "使用 GitHub 作为返回控制台的另一条路径。",
  "Use a linked Google or Gmail identity to reopen the console.":
    "使用已关联的 Google 或 Gmail 身份重新打开控制台。",
  "Value": "值",
  "Variable name": "变量名",
  "Variable {count}": "变量 {count}",
  "Waiting": "等待中",
  "Waiting for checkout confirmation…": "正在等待结账确认…",
  "Waiting for log output…": "正在等待日志输出…",
  "We could not confirm payment status automatically. Check again in a few seconds.":
    "我们暂时无法自动确认支付状态。请几秒后再检查。",
  "We could not confirm payment status yet. Check again in a few seconds.":
    "我们暂时还无法确认支付状态。请几秒后再检查。",
  "Whole USD amounts only. Min {min}, max {max}.":
    "仅支持整美元金额。最小 {min}，最大 {max}。",
  "exactly to enable deletion.": "以启用删除。",
  "matches current environment": "与当前环境一致",
  "{actor} by {amount}.": "由 {actor} 调整 {amount}。",
  "{actor} by {amount}. {note}": "由 {actor} 调整 {amount}。{note}",
  "{label} logs are ready, but clipboard access failed.":
    "{label} 日志已就绪，但剪贴板访问失败。",
  "{label} logs for {name}": "{name} 的 {label} 日志",
  "{message} Showing the latest received output.":
    "{message} 当前显示最近收到的输出。",
  "{method} sign-in disconnected.":
    "{method} 登录方式已解除关联。",
  "{name} discard variable": "舍弃变量 {name}",
  "{name} is currently {phase}. {description}":
    "{name} 当前为 {phase}。{description}",
  "{name} key": "{name} 键",
  "{name} remove variable": "移除变量 {name}",
  "{name} undo removal": "撤销移除变量 {name}",
  "{name} value": "{name} 值",
  "{email} will be removed from Fugue.": "{email} 将从 Fugue 中移除。",
  "{email} will become an admin and their access will be restored.":
    "{email} 将成为管理员，并恢复其访问权限。",
  "{email} will gain workspace admin access.":
    "{email} 将获得工作区管理员权限。",
  "{label} / {usage} / {total}": "{label} / {usage} / {total}",
  "{label} usage {percent} ({usage})": "{label} 使用量 {percent}（{usage}）",
  "{limit} limit. Billed as {billed} until live storage shrinks.":
    "上限为 {limit}。在实时存储缩减前，将按 {billed} 计费。",
  "{name} resource usage": "{name} 资源使用情况",
  "{name} will be queued for deletion from the admin surface.":
    "{name} 将从管理员界面加入删除队列。",
  "{ready}/{desired} ready": "{ready}/{desired} 就绪",
  "{updated} updated / {available} available":
    "{updated} 已更新 / {available} 可用",
  "{value} / month": "{value} / 月",
  "{value}/mo": "{value}/月",
  "API and controller are healthy, but they currently advertise different deployed image tags.":
    "API 与控制器当前都健康，但它们正在报告不同的已部署镜像标签。",
  "API and controller report the same deployed image tag, with every replica updated and available.":
    "API 与控制器报告的是同一个已部署镜像标签，并且所有副本都已更新且可用。",
  "Admin": "管理员",
  "Admin access removed.": "管理员权限已移除。",
  "Admin summary": "管理员概览",
  "Admins": "管理员",
  "App identifier": "应用标识",
  "Apps": "应用",
  "Attention": "需关注",
  "Balance": "余额",
  "Balance {value}": "余额 {value}",
  "Balance updated.": "余额已更新。",
  "Billing unavailable": "计费不可用",
  "Block": "封禁",
  "Blocking…": "正在封禁…",
  "Close": "关闭",
  "Cluster node": "集群节点",
  "Cluster nodes": "集群节点",
  "Cluster apps unavailable": "集群应用暂不可用",
  "Cluster snapshot unavailable": "集群快照不可用",
  "Compute": "算力",
  "Control plane version unavailable": "控制平面版本不可用",
  "CPU / Memory / Storage / Monthly": "CPU / 内存 / 存储 / 月度",
  "CPU {value}": "CPU {value}",
  "CPU limit": "CPU 上限",
  "Delete app": "删除应用",
  "Delete app?": "删除应用？",
  "Delete user": "删除用户",
  "Delete user?": "删除用户？",
  "Disk {value}": "磁盘 {value}",
  "Edit billing": "编辑计费",
  "Enter a non-negative USD amount with up to two decimal places.":
    "请输入非负美元金额，最多两位小数。",
  "Fugue apps and backing services placed on this machine.":
    "放置在这台机器上的 Fugue 应用和后端服务。",
  "Hot": "过热",
  "Images {value}": "镜像 {value}",
  "Internal address": "内网地址",
  "Keep admin": "保留管理员",
  "Last login": "最后登录",
  "Last update": "最近更新",
  "Limit {value}": "上限 {value}",
  "Live CPU, memory, and disk usage.": "实时 CPU、内存和磁盘用量。",
  "Make admin": "设为管理员",
  "Managed limit": "托管上限",
  "Managed limit updated.": "托管上限已更新。",
  "Memory {value}": "内存 {value}",
  "Memory limit": "内存上限",
  "Mixed": "混合",
  "Mixed release": "混合版本",
  "Monthly": "月度",
  "Monthly {value}": "月度 {value}",
  "Monthly preview unavailable": "月度预估不可用",
  "Namespace": "命名空间",
  "No apps are currently visible from the bootstrap scope.":
    "当前引导范围内没有可见应用。",
  "No apps visible": "没有可见应用",
  "No balance": "无余额",
  "No billing": "无计费",
  "No cluster nodes are visible from the current bootstrap scope.":
    "当前引导范围内没有可见集群节点。",
  "No cluster nodes visible": "没有可见集群节点",
  "No estimate": "暂无估算",
  "No Fugue app or backing service is currently scheduled onto this node.":
    "当前没有 Fugue 应用或后端服务被调度到该节点上。",
  "No images": "没有镜像",
  "No product users have signed in yet.": "还没有产品用户登录。",
  "No tag": "无标签",
  "No users yet": "还没有用户",
  "No workloads on this node": "此节点上没有工作负载",
  "No workspace": "无工作区",
  "Nodes": "节点",
  "Not detected": "未检测到",
  "Observed": "观测时间",
  "One or more control plane deployments are missing or below the desired rollout state.":
    "一个或多个控制平面部署缺失，或尚未达到目标发布状态。",
  "Owned": "专有",
  "Phase": "阶段",
  "Prepaid / status": "预付 / 状态",
  "Pressure": "压力",
  "Privilege change": "权限变更",
  "Process": "进程",
  "Promote user to admin?": "将用户提升为管理员？",
  "Promoting…": "正在提升…",
  "Provider": "提供方",
  "Public address": "公网地址",
  "Ready and pressure signals.": "就绪与压力信号。",
  "Rebuild": "重建",
  "Rebuild queued.": "重建已加入队列。",
  "Rebuild requested.": "已请求重建。",
  "Rebuilding…": "正在重建…",
  "Release {value}": "版本 {value}",
  "Remove admin": "移除管理员",
  "Remove admin access?": "移除管理员权限？",
  "Replicas": "副本",
  "Role": "角色",
  "Rolling": "滚动中",
  "Rolling release": "滚动发布版本",
  "Rollout": "发布",
  "Route": "路由",
  "Save balance": "保存余额",
  "Server": "服务器",
  "Service usage": "服务用量",
  "Services {value}": "服务 {value}",
  "Services / CPU / Memory / Disk / Images":
    "服务 / CPU / 内存 / 磁盘 / 镜像",
  "Set balance": "设置余额",
  "Set CPU or memory to 0 to pause managed billing.":
    "将 CPU 或内存设为 0 可暂停托管计费。",
  "Signals": "信号",
  "Stack": "技术栈",
  "Status": "状态",
  "Status {value}": "状态 {value}",
  "Steady": "稳定",
  "Storage {value}": "存储 {value}",
  "Storage limit": "存储上限",
  "Shared": "共享",
  "Synced": "已同步",
  "The admin API could not resolve the current API and controller release.":
    "管理员 API 当前无法解析现有 API 与控制器版本。",
  "The saved limit is above the temporary control cap of 2 cpu / 4 GiB / 30 GiB storage. Save a new limit here to bring the user back inside the current range.":
    "已保存的上限超过当前临时控制上限 2 CPU / 4 GiB / 30 GiB 存储。请在这里保存新的上限，使用户回到当前范围内。",
  "This workspace": "此工作区",
  "Tenants": "租户",
  "Unknown namespace": "未知命名空间",
  "Unknown release": "未知发布实例",
  "Unblock": "解除封禁",
  "Unblocking…": "正在解除封禁…",
  "Unresolved deployment": "未解析的部署",
  "Updating…": "正在更新…",
  "Usage": "用量",
  "User": "用户",
  "User billing": "用户计费",
  "User blocked.": "用户已封禁。",
  "User deleted.": "用户已删除。",
  "User email": "用户邮箱",
  "User promoted to admin and restored.":
    "用户已提升为管理员并恢复访问。",
  "User promoted to admin.": "用户已提升为管理员。",
  "User unblocked.": "用户已解除封禁。",
  "Version unavailable": "版本不可用",
  "Watch": "留意",
  "Workloads": "工作负载",
} satisfies MessageCatalog;

const zhTWExtraMessages = {
  "Accept shared Fugue workloads from outside a tenant runtime.":
    "接受來自租戶執行環境之外的共享 Fugue 工作負載。",
  "Accept source builds on this machine.": "允許這台機器承接原始碼建置。",
  "Allow builds": "允許建置",
  "Allow shared pool apps": "允許共享池應用",
  "Apply policy": "套用策略",
  "Applying…": "套用中…",
  "Build tier": "建置規格",
  "Build tier is stored as policy even if builds are currently off.":
    "即使目前關閉建置，也會將建置規格作為策略儲存。",
  "Builds": "建置",
  "Candidate": "候選",
  "Conditions": "條件",
  "Connection": "連線",
  "Control plane": "控制平面",
  "Control plane role": "控制平面角色",
  "Desired capabilities and the live node state after reconciliation":
    "期望能力，以及節點在完成 reconcile 後的即時狀態",
  "Desired policy": "期望策略",
  "Edit the policy Fugue will reconcile onto this machine.":
    "編輯 Fugue 將要 reconcile 到這台機器上的期望策略。",
  "Identity, reachability, and placement facts.":
    "節點識別、可達性與放置資訊。",
  "Large": "大型",
  "Live policy": "即時策略",
  "Machine scope": "機器範圍",
  "Medium": "中型",
  "Member": "成員",
  "Member is a desired target only. The live node becomes member only after real control-plane promotion outside the agent path.":
    "Member 只是期望目標。節點只有在 agent 路徑之外完成真正的控制平面晉升後，即時狀態才會變成 member。",
  "No live signals reported.": "目前沒有回報即時訊號。",
  "No summary available.": "暫無摘要。",
  "Node policy": "節點策略",
  "Node policy saved.": "節點策略已儲存。",
  "Node policy updated.": "節點策略已更新。",
  "Node state": "節點狀態",
  "Policy access unavailable": "策略存取不可用",
  "Policy saved, but live reconcile reported: {details}":
    "策略已儲存，但即時 reconcile 回報：{details}",
  "Read only": "唯讀",
  "Reset draft": "重設草稿",
  "Shared pool": "共享池",
  "Small": "小型",
  "Tenant": "租戶",
  "This node is visible, but it is not backed by a managed machine or runtime yet.":
    "這個節點目前可見，但它還沒有掛接到受管機器或執行環境。",
  "Unmanaged": "未託管",
  "Unsaved policy": "策略未儲存",
  "{state} / {tier}": "{state} / {tier}",
  "{count} permission": "{count} 項權限",
  "{count} permissions": "{count} 項權限",
  "Access key list refreshed.": "存取金鑰清單已重新整理。",
  "Access key replaced and secret copied. The previous secret no longer works.":
    "存取金鑰已替換，並已複製新密鑰。舊密鑰已失效。",
  "Access key replaced. Copy the new secret now.":
    "存取金鑰已替換。請立即複製新的密鑰。",
  "Admin key": "管理員金鑰",
  "Admin key replaced for this website copy and secret copied.":
    "此網站副本的管理員金鑰已替換，並已複製新密鑰。",
  "Admin key replaced for this website copy. Copy the new secret now.":
    "此網站副本的管理員金鑰已替換。請立即複製新的密鑰。",
  "Admin key unavailable": "管理員金鑰不可用",
  "A fresh secret will be copied for this website copy without revoking other environments.":
    "會為此網站副本複製一份新的密鑰，不會吊銷其他環境中的密鑰。",
  "Attached VPS": "已掛接 VPS",
  "Cannot join": "不可加入",
  "Changes apply immediately.": "變更會立即生效。",
  "Change the managed billing envelope and top up tenant balance.":
    "調整託管計費額度並為租戶餘額儲值。",
  "Activity": "活動",
  "Based on the saved managed envelope.": "根據已儲存的託管額度。",
  "Billing & capacity": "帳務與容量",
  "Billing activity details": "帳務活動詳情",
  "Billing health details": "帳務狀態詳情",
  "Billing needs a workspace": "帳務需要工作區",
  "Billing snapshot unavailable": "帳務快照不可用",
  "Capacity cap details": "容量上限詳情",
  "Cluster join command copied with {label}.":
    "已使用 {label} 複製叢集加入命令。",
  "Cluster join command is ready, but clipboard access failed.":
    "叢集加入命令已產生，但剪貼簿存取失敗。",
  "Copy": "複製",
  "Copy secret": "複製密鑰",
  "Copyable": "可複製",
  "Copy a join command for a VPS, or copy the raw secret if you need it.":
    "可複製用於 VPS 的加入命令；如果需要，也可以複製原始密鑰。",
  "Create the workspace admin access first so Fugue can read and update tenant billing.":
    "請先建立工作區管理員存取，讓 Fugue 可以讀取並更新租戶帳務。",
  "Create app metadata and desired specs.":
    "建立應用中繼資料與目標規格。",
  "Create node key": "建立節點金鑰",
  "Create node keys and enroll external runtimes.":
    "建立節點金鑰並註冊外部執行環境。",
  "Create one, then copy a join command.":
    "先建立一個，再複製加入命令。",
  "Create or edit runtime records.": "建立或編輯執行環境記錄。",
  "Create projects inside the current tenant.":
    "在目前租戶內建立專案。",
  "Create the first node key when you are ready.":
    "準備好後再建立第一個節點金鑰。",
  "Creating node key…": "正在建立節點金鑰…",
  "Credential revocation": "憑證吊銷",
  "Credential rotation": "憑證輪換",
  "Current key": "目前金鑰",
  "Current CPU": "目前 CPU",
  "Current memory": "目前記憶體",
  "Current rate": "目前費率",
  "Current storage": "目前儲存",
  "Current workspace": "目前工作區",
  "Custom scope.": "自訂權限。",
  "Credits and capacity stay aligned": "額度與容量保持同步",
  "Credits details": "額度詳情",
  "Delete access key?": "刪除存取金鑰？",
  "Delete apps without broad write access.":
    "在不授予廣泛寫入權限的情況下刪除應用。",
  "Delete key": "刪除金鑰",
  "Disabling…": "停用中…",
  "disabled": "已停用",
  "Deploy, rebuild, and restart apps.": "部署、重建並重新啟動應用。",
  "Existing runtimes stay attached, but this secret can no longer enroll new nodes.":
    "現有執行環境會繼續保持掛接，但這個密鑰不能再接入新的節點。",
  "Fugue could not load the billing snapshot right now.":
    "Fugue 目前無法載入帳務快照。",
  "Identifier": "識別碼",
  "Includes {storage} of retained images": "包含 {storage} 的保留映像儲存",
  "Keep at least one permission enabled.":
    "請至少保留一個已啟用的權限。",
  "Keep the workspace funded": "讓工作區額度保持充足",
  "Key disabled.": "金鑰已停用。",
  "Key deleted.": "金鑰已刪除。",
  "Key restored.": "金鑰已恢復。",
  "Last used": "最近使用",
  "last used": "最近使用",
  "Live sync is still unavailable. Stored metadata remains visible.":
    "即時同步仍不可用，已儲存的中繼資料仍會顯示。",
  "Live sync is still unavailable. Stored node key metadata remains visible.":
    "即時同步仍不可用，已儲存的節點金鑰中繼資料仍會顯示。",
  "Mint additional tenant access keys.":
    "產生額外的租戶存取金鑰。",
  "Move apps between runtimes.": "在執行環境之間遷移應用。",
  "Never": "從未",
  "No keys yet": "尚無金鑰",
  "No node key name changes.": "節點金鑰名稱沒有變化。",
  "No node keys yet": "還沒有節點金鑰",
  "No permissions are currently available from the workspace key.":
    "目前工作區金鑰沒有可用權限。",
  "Node key": "節點金鑰",
  "Node key created and secret copied.":
    "節點金鑰已建立，並已複製密鑰。",
  "Node key created.": "節點金鑰已建立。",
  "Node key list refreshed.": "節點金鑰清單已重新整理。",
  "Node key name": "節點金鑰名稱",
  "Node key name is required.": "必須提供節點金鑰名稱。",
  "Node key name updated.": "節點金鑰名稱已更新。",
  "Node key revoked and removed from the list.":
    "節點金鑰已吊銷並已從清單中移除。",
  "Node keys": "節點金鑰",
  "Open access setup": "開啟存取設定",
  "Permissions": "權限",
  "Permissions updated.": "權限已更新。",
  "Preview based on unsaved capacity changes.":
    "根據尚未儲存的容量變更預估。",
  "Prefix": "前綴",
  "Primary VPS key…": "主 VPS 金鑰…",
  "Refresh keys": "重新整理金鑰",
  "Ready to cover the saved managed envelope.":
    "可用於覆蓋已儲存的託管額度。",
  "Rename": "重新命名",
  "Rename node key": "重新命名節點金鑰",
  "Replace": "替換",
  "Replace admin key": "替換管理員金鑰",
  "Replace admin key?": "替換管理員金鑰？",
  "Replace access key?": "替換存取金鑰？",
  "Replace key": "替換金鑰",
  "Replacing…": "替換中…",
  "Saved cap": "已儲存額度",
  "Saved cap {cap}": "已儲存額度 {cap}",
  "Secure checkout": "安全結帳",
  "Set the managed capacity cap": "設定託管容量上限",
  "Restore": "恢復",
  "Restore the workspace to continue.":
    "請先恢復工作區再繼續。",
  "Restoring…": "恢復中…",
  "Revoked": "已吊銷",
  "Revoke": "吊銷",
  "Revoke key": "吊銷金鑰",
  "Revoke node key?": "吊銷節點金鑰？",
  "Revoking…": "吊銷中…",
  "Rotate": "輪換",
  "Rotating…": "輪換中…",
  "Scale or disable apps.": "調整應用規模或停用應用。",
  "Secret copied.": "密鑰已複製。",
  "Secret hidden": "密鑰已隱藏",
  "Secret is ready, but clipboard access failed.":
    "密鑰已產生，但剪貼簿存取失敗。",
  "Showing stored metadata while live key sync is unavailable.":
    "即時金鑰同步不可用，目前顯示的是已儲存的中繼資料。",
  "Showing stored node key metadata while live sync is unavailable.":
    "即時同步不可用，目前顯示的是已儲存的節點金鑰中繼資料。",
  "Shown in this workspace only. Use a short label you can recognize later.":
    "僅在此工作區內顯示。請使用一個之後容易辨識的短標籤。",
  "The current secret stops working immediately and the new secret will be copied.":
    "目前密鑰會立即失效，並複製新的密鑰。",
  "This revokes the secret in Fugue immediately.":
    "這會立即在 Fugue 中吊銷該密鑰。",
  "Trigger failover onto a secondary runtime.":
    "觸發切換到備援執行環境的故障轉移。",
  "Whole USD only · {min} to {max}":
    "僅支援整數美元 · {min} 到 {max}",
  "Update the display name used in this workspace. The key ID, secret, prefix, and attached VPS stay the same.":
    "更新此工作區中顯示的名稱。金鑰 ID、密鑰內容、前綴與已掛接的 VPS 都不會變化。",
  "VPS": "VPS",
  "{count} recent events": "{count} 則近期事件",
  "{count} recent events · {updated}": "{count} 則近期事件 · {updated}",
  "{label} details": "{label} 詳情",
  "Access & deployment": "存取與部署",
  "Add directories or files that must survive redeploys.":
    "新增在重新部署後仍需保留的目錄或檔案。",
  "Advanced settings": "進階設定",
  "App name, startup command, build strategy, and optional source overrides.":
    "應用名稱、啟動命令、建置策略，以及可選的原始碼覆寫設定。",
  "App network mode": "應用網路模式",
  "Authorize GitHub in the browser, or paste a GitHub token. Fugue stores the resolved secret server-side for later rebuilds and syncs.":
    "可先在瀏覽器中授權 GitHub，或貼上一個 GitHub Token。Fugue 會將解析後的密鑰儲存在伺服器端，供後續重建與同步使用。",
  "Authorize GitHub in the browser, or paste a token below.":
    "可先在瀏覽器中授權 GitHub，或在下方貼上 Token。",
  "Authorized as @{login}.": "已授權為 @{login}。",
  "Auto detect": "自動偵測",
  "Background workers skip the managed route, Kubernetes Service, and readiness port.":
    "背景工作進程不會建立託管路由、Kubernetes Service 和就緒檢查埠。",
  "Internal service": "內部服務",
  "Internal services get a cluster-only Service and readiness checks, without a public route.":
    "內部服務會保留叢集內 Service 與就緒檢查，但不會暴露公開路由。",
  "Branch": "分支",
  "Branch {branch}": "分支 {branch}",
  "Branch, name, startup command, build strategy, and optional paths.":
    "分支、名稱、啟動命令、建置策略和可選路徑。",
  "Build context": "建置上下文",
  "Build strategy": "建置策略",
  "Buildpacks": "Buildpacks",
  "Choose a folder, docker-compose.yml, Dockerfile, or source files to upload.":
    "請選擇要上傳的資料夾、docker-compose.yml、Dockerfile 或原始碼檔案。",
  "Choose a folder, a .zip or .tgz archive, docker-compose.yml, Dockerfile, or source files to upload.":
    "請選擇要上傳的資料夾、.zip 或 .tgz 封存、docker-compose.yml、Dockerfile 或原始碼檔案。",
  "Choose the machine region.": "選擇機器所在區域。",
  "Choose whether Fugue reads this repository anonymously or through saved private access.":
    "選擇讓 Fugue 以匿名方式讀取此儲存庫，還是透過已儲存的私有存取憑證讀取。",
  "Context {path}": "上下文 {path}",
  "Country unavailable": "國家不可用",
  "Custom build": "自訂建置",
  "Defaults to the archive root when omitted.": "留空時預設使用封存根目錄。",
  "Defaults to the repo root when omitted.": "留空時預設使用儲存庫根目錄。",
  "Deployment": "部署",
  "Deployment region": "部署區域",
  "Deployment target": "部署目標",
  "Deployment targets are unavailable. This import will use the default internal cluster.":
    "目前無法取得部署目標。此次匯入將使用預設內部叢集。",
  "Dockerfile": "Dockerfile",
  "Dockerfile {path}": "Dockerfile {path}",
  "Dockerfile path": "Dockerfile 路徑",
  "Drag a folder, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import.":
    "拖入資料夾、docker-compose.yml、fugue.yaml、Dockerfile 或多個原始碼檔案。Fugue 會在匯入前先於伺服器端建立封存。",
  "Drag a folder, a .zip or .tgz archive, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import unless you upload an archive directly.":
    "拖入資料夾、.zip 或 .tgz 封存、docker-compose.yml、fugue.yaml、Dockerfile 或多個原始碼檔案。除非直接上傳封存，否則 Fugue 會在匯入前先於伺服器端建立封存。",
  "Fixed": "固定",
  "GitHub token": "GitHub Token",
  "Image reference is required.": "必須提供映像引用。",
  "Import source mode": "匯入來源模式",
  "Leave auto on unless the upload needs a specific source or Dockerfile override.":
    "除非上傳內容需要指定原始碼目錄或 Dockerfile 覆寫，否則請保持「自動偵測」。",
  "Leave blank to create an empty file.": "留空則建立空檔案。",
  "Leave blank to derive the app name from the image reference.":
    "留空則從映像引用推導應用名稱。",
  "Leave blank to derive the app name from the uploaded folder or file.":
    "留空則從上傳的資料夾或檔案推導應用名稱。",
  "Leave blank to derive the app name from the uploaded folder, file, or archive.":
    "留空則從上傳的資料夾、檔案或封存推導應用名稱。",
  "Leave blank to reuse the repository name.": "留空則重用儲存庫名稱。",
  "Leave blank to use the default branch.": "留空則使用預設分支。",
  "Leave this on Any available region to let Fugue place the deployment.":
    "保持為「任意可用區域」，讓 Fugue 自動選擇部署位置。",
  "Local folder or files": "本機資料夾或檔案",
  "Local folder, files, or archive": "本機資料夾、檔案或封存",
  "Local archive": "本機封存",
  "Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose.":
    "目前已啟用手動建置覆寫。如果你希望 Fugue 從 fugue.yaml 或 docker-compose 匯入全部服務，請清空建置策略與路徑覆寫。",
  "Manual persistent storage mounts stay in your draft, but Fugue skips them while this import preserves a whole topology. Switch back to a single-app deploy to reuse them.":
    "手動設定的持久化儲存掛載會保留在草稿中，但目前匯入會保留整套拓撲，因此 Fugue 會暫時略過它們。切回單應用部署後即可重複使用。",
  "Marketing site": "行銷網站",
  "Name {name}": "名稱 {name}",
  "Network mode": "網路模式",
  "Nixpacks": "Nixpacks",
  "Not assigned": "未指派",
  "Only region available": "唯一可用區域",
  "Optional for first deploy": "首次部署可選",
  "Paste a GitHub token with repository read access. If GitHub web authorization is available, Fugue can use that instead and store the resolved secret server-side for later rebuilds and syncs.":
    "貼上一個具備儲存庫讀取權限的 GitHub Token。如果可用，也可以改用 GitHub 網頁授權；Fugue 會將解析後的密鑰儲存在伺服器端，供後續重建與同步使用。",
  "Persistent files": "持久化檔案",
  "Port {port}": "埠 {port}",
  "Private": "私有",
  "Private repo": "私有儲存庫",
  "Public": "公開",
  "Public repo": "公開儲存庫",
  "Public service": "公開服務",
  "Public services get a managed route and readiness checks.":
    "公開服務會取得託管路由與就緒檢查。",
  "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so manual network mode is unavailable here.":
    "整套拓撲匯入會沿用 fugue.yaml 或 docker-compose 中各服務自己的網路設定，因此這裡不能手動指定網路模式。",
  "Published image": "已發佈映像",
  "Repository link": "儲存庫連結",
  "Repository link is required.": "必須提供儲存庫連結。",
  "Required when the Dockerfile is outside the repo root.":
    "當 Dockerfile 不在儲存庫根目錄下時必須填寫。",
  "Required when the uploaded Dockerfile is outside the archive root.":
    "當上傳的 Dockerfile 不在封存根目錄下時必須填寫。",
  "Saved GitHub access is available.": "已儲存的 GitHub 存取可用。",
  "Saved GitHub access is ready as @{login}. Paste a token only to override it for this import.":
    "已儲存的 GitHub 存取已就緒，目前帳號為 @{login}。僅在需要覆蓋此次匯入時再貼上 Token。",
  "Saved GitHub access is ready. Paste a token only to override it for this import.":
    "已儲存的 GitHub 存取已就緒。僅在需要覆蓋此次匯入時再貼上 Token。",
  "Service {service}. Leave blank to create an empty file on first deploy.":
    "服務 {service}。留空則在首次部署時建立空檔案。",
  "Service name and optional startup command.":
    "服務名稱與可選的啟動命令。",
  "Service port must be a positive integer.": "服務埠必須是正整數。",
  "Set this when the container listens on a known port.":
    "當容器監聽固定埠時設定此項。",
  "Source {source}": "原始碼 {source}",
  "Source directory": "原始碼目錄",
  "Source mode": "來源模式",
  "Startup command": "啟動命令",
  "Static site": "靜態網站",
  "This build strategy is reused for later syncs.":
    "後續同步會重用這個建置策略。",
  "This target uses one fixed region.": "此目標只使用一個固定區域。",
  "Upload {label}": "上傳 {label}",
  "Use a public image reference such as ghcr.io/example/api:1.2.3. Fugue mirrors it into the internal registry before rollout.":
    "使用公開映像引用，例如 ghcr.io/example/api:1.2.3。Fugue 會在發佈前先將其同步到內部映像倉庫。",
  "Use https://github.com/owner/repo.":
    "使用 https://github.com/owner/repo。",
  "Use when the app lives below the repo root.":
    "當應用位於儲存庫根目錄下的子目錄時使用。",
  "Use when the uploaded app lives below the archive root.":
    "當上傳的應用位於封存根目錄下的子目錄時使用。",
  "Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose.":
    "整套拓撲匯入已就緒。請將建置策略保持為「自動偵測」，並保持手動路徑覆寫為空，以便從 fugue.yaml 或 docker-compose 匯入全部服務。",
  "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so background worker mode is unavailable here.":
    "整套拓撲匯入會保留 fugue.yaml 或 docker-compose 中各服務的網路設定，因此這裡無法使用背景工作進程模式。",
  "{count} region": "{count} 個區域",
  "{count} regions": "{count} 個區域",
  "After sign-in, this page reopens in Local upload mode so you can drag the folder directly into the browser.":
    "登入後，此頁面會以「本機上傳」模式重新開啟，你可以直接把資料夾拖進瀏覽器。",
  "Already have access?": "已經有存取權限？",
  "Custom domain": "自訂網域",
  "Custom domain availability response was malformed.":
    "自訂網域可用性回應格式不正確。",
  "Custom domain response was malformed.": "自訂網域回應格式不正確。",
  "Custom domains": "自訂網域",
  "Back to top": "返回頂部",
  "Copied": "已複製",
  "Continue with {label}": "使用 {label} 繼續",
  "Copy command": "複製命令",
  "Copy manually": "請手動複製",
  "Core objects": "核心物件",
  "Create an account": "建立帳號",
  "Deleted": "已刪除",
  "Docker image import also available": "也支援匯入 Docker 映像",
  "Email route": "電子郵件路徑",
  "Envelope / Balance / Metering": "儲值 / 餘額 / 計量",
  "Finalize": "完成",
  "First party / HttpOnly cookie": "第一方 / HttpOnly Cookie",
  "Footer": "頁腳",
  "Gallery / Services / Controls": "畫廊 / 服務 / 控制",
  "GitHub provider": "GitHub 提供方",
  "Google is fastest. Email still uses a verification link. Password can be added after sign-up.":
    "Google 最快。電子郵件仍透過驗證連結完成。密碼可在註冊後再設定。",
  "Google is fastest. Password works if you already added one.":
    "Google 最快。如果你已經設定密碼，也可以直接使用密碼。",
  "GitHub import example": "GitHub 匯入範例",
  "Google / Email / Verified identity": "Google / 電子郵件 / 已驗證身分",
  "Google or GitHub are fastest. Password works if you already added one.":
    "Google 或 GitHub 最快。如果你已經設定密碼，也可以直接使用密碼。",
  "Google provider": "Google 提供方",
  "Health / Heartbeat / Workloads": "健康 / 心跳 / 工作負載",
  "Loading": "正在載入",
  "Loading apps": "正在載入應用",
  "Loading profile settings": "正在載入個人資料設定",
  "Loading users": "正在載入使用者",
  "Magic link / Resend / Callback": "魔法連結 / 重送 / 回呼",
  "Managed shared runtime": "託管共享執行環境",
  "Mobile": "行動端",
  "Need a fresh account boundary?": "需要新的帳號邊界？",
  "Nodes / Pressure / Workloads": "節點 / 壓力 / 工作負載",
  "OAuth / Profile / Verified email": "OAuth / 個人資料 / 已驗證電子郵件",
  "OAuth / Verified email": "OAuth / 已驗證電子郵件",
  "OAuth / Verified email / Linked account": "OAuth / 已驗證電子郵件 / 已連結帳號",
  "Operation": "操作",
  "Optional": "可選",
  "Password can be added later from Profile and security. Email link access stays available without a stored secret.":
    "密碼稍後可在「個人資料與安全」中新增。即使沒有儲存的密碼，仍可透過電子郵件連結存取。",
  "Password lane": "密碼路徑",
  "Post-auth": "驗證後",
  "Primary": "主導覽",
  "Private GitHub repositories require GitHub authorization or a GitHub token with repository read access.":
    "私有 GitHub 儲存庫需要 GitHub 授權，或提供具備儲存庫讀取權限的 GitHub Token。",
  "Provider callback": "提供者回呼",
  "Quickstart": "快速開始",
  "Registration stays on the verification flow. Workspace setup comes next.":
    "註冊會停留在驗證流程中，接下來才是工作區設定。",
  "Repository / Image / Upload": "儲存庫 / 映像 / 上傳",
  "Repository import": "儲存庫匯入",
  "Reset": "重設",
  "Route, sign-in, and the app already share one system.": "路由、登入與應用現在已經共用同一套系統。",
  "Routes": "路徑",
  "Routed": "已路由",
  "Service port": "服務埠",
  "shared": "共享",
  "Sign in without breaking the product flow.": "在不打斷產品流程的情況下登入。",
  "Sign in with password": "使用密碼登入",
  "Sign-in handoff": "登入切換",
  "Sign-in method": "登入方式",
  "Sign-in route": "登入路徑",
  "Sign-up route": "註冊路徑",
  "Signing in": "登入中",
  "source": "原始碼",
  "Stored secret / Current account email": "已儲存密鑰 / 目前帳號電子郵件",
  "Use the password saved from the profile page.":
    "使用你在個人資料頁儲存的密碼。",
  "Use the same account email shown in Profile.":
    "使用「個人資料」中顯示的同一個帳號電子郵件。",
  "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.":
    "通往公開 URL 的最快路徑，不該把應用困在一次性環境中。在 Fugue 裡，路由保持穩定，執行環境可以改變：先匯入原始碼、在共享基礎設施上線，準備好後再遷移到你的機器。",
  "The provider identity is already verified. We are now finishing sign-in with a same-origin form POST so Safari can treat the session write like a regular first-party login redirect.":
    "提供者身分已完成驗證。我們現在透過同源表單 POST 完成登入，讓 Safari 將這次會話寫入視為一般的第一方登入跳轉。",
  "The route is the product.": "路由本身就是產品。",
  "Unable to load the current custom domain right now.":
    "目前無法載入現有自訂網域。",
  "Unavailable": "不可用",
  "Use a public image reference to unlock the deploy form after sign-in.":
    "使用公開映像引用，即可在登入後解鎖部署表單。",
  "We send one verification link. No password required.":
    "我們會寄出一封驗證連結，不需要密碼。",
  "We verify the email locally and open the session immediately.":
    "我們會在本地驗證電子郵件，並立即開啟工作階段。",
  "Use Google, a password, or a verified email link.":
    "使用 Google、密碼或已驗證的電子郵件連結。",
  "Use Google, GitHub, a password, or a verified email link.":
    "使用 Google、GitHub、密碼或已驗證的電子郵件連結。",
  "Use a hostname you control, like app.example.com or example.com.":
    "使用你可控制的主機名稱，例如 app.example.com 或 example.com。",
  "Validation / Failure / Retry": "驗證 / 失敗 / 重試",
  "Workspace": "工作區",
  "Workspace / Project / App": "工作區 / 專案 / 應用",
  "App": "應用",
  "A database transfer to {target} is already in progress.":
    "目前已有一筆遷移到 {target} 的資料庫轉移正在進行。",
  "Add another managed runtime before moving this database.":
    "請先新增另一個託管執行環境，再遷移這個資料庫。",
  "Add another managed runtime before moving this service.":
    "請先新增另一個託管執行環境，再遷移這個服務。",
  "Add another managed runtime before turning on automatic failover.":
    "請先新增另一個託管執行環境，再開啟自動故障切換。",
  "Add another managed runtime before turning on database failover.":
    "請先新增另一個託管執行環境，再開啟資料庫故障切換。",
  "Add another runtime before moving this service.":
    "請先新增另一個執行環境，再遷移這個服務。",
  "After switchover": "切換後",
  "Another project already uses this name. Project names must be unique within the workspace.":
    "已有其他專案使用這個名稱。專案名稱在目前工作區內必須唯一。",
  "Another project already uses “{name}”.": "已有其他專案使用「{name}」。",
  "Attached": "已掛接",
  "Authorize GitHub in the browser, or paste a replacement token below.":
    "可先在瀏覽器中授權 GitHub，或在下方貼上一個替代 Token。",
  "Authorize GitHub or paste a new token first.":
    "請先授權 GitHub，或貼上一個新的 Token。",
  "Auto sync": "自動同步",
  "Automatic failover": "自動故障切換",
  "Automatic failover already points to {target}.":
    "自動故障切換已經指向 {target}。",
  "Automatic failover disabled.": "自動故障切換已關閉。",
  "Automatic failover disabled. Standby database replica removed.":
    "自動故障切換已關閉，備援資料庫副本已移除。",
  "Automatic failover is already off.": "自動故障切換已處於關閉狀態。",
  "Automatic failover saved. Standby runtime: {target}.":
    "自動故障切換已儲存。備援執行環境：{target}。",
  "Available": "可用",
  "Available after first deploy.": "首次部署完成後可用。",
  "Blank = default branch.": "留空 = 使用預設分支。",
  "Blank = keep current access.": "留空 = 保持目前存取方式。",
  "Branch changes are unavailable.": "目前無法修改分支。",
  "Browse Live Files": "瀏覽即時檔案",
  "Change the branch used for rebuilds.": "修改重建時使用的分支。",
  "Changes queue a deploy. File contents are only used when Fugue needs to create that file for the first time.":
    "這些變更會排入一次部署。只有在 Fugue 第一次建立該檔案時，檔案內容才會被使用。",
  "Check failed": "檢查失敗",
  "Checking": "檢查中",
  "Checking availability…": "正在檢查可用性…",
  "Checking hostname availability…": "正在檢查主機名稱可用性…",
  "Checking saved GitHub access…": "正在檢查已儲存的 GitHub 存取…",
  "Choose a destination.": "請選擇目的地。",
  "Choose a standby runtime.": "請選擇備援執行環境。",
  "Configured": "已設定",
  "Connect GitHub": "連接 GitHub",
  "Continuity": "連續性",
  "Create a file or folder from the explorer toolbar.":
    "可在檔案總管工具列中建立檔案或資料夾。",
  "Create parent folders when missing": "缺少時一併建立父資料夾",
  "Current group": "目前群組",
  "Current runtime": "目前執行環境",
  "Current runtime unavailable": "目前執行環境不可用",
  "DNS needed": "需要 DNS",
  "Database Move": "資料庫遷移",
  "Database failover": "資料庫故障切換",
  "Database failover already points to {target}.":
    "資料庫故障切換已經指向 {target}。",
  "Database failover disabled.": "資料庫故障切換已關閉。",
  "Database failover is already changing.": "資料庫故障切換已在變更中。",
  "Database failover is already changing. Wait for the current step to finish.":
    "資料庫故障切換已在變更中。請等待目前步驟完成。",
  "Database failover is already off.": "資料庫故障切換已處於關閉狀態。",
  "Database failover saved. Standby runtime: {target}.":
    "資料庫故障切換已儲存。備援執行環境：{target}。",
  "Database one-click transfer": "資料庫一鍵遷移",
  "Database stays where it is.": "資料庫保持在原本位置。",
  "Database transfer queued to {target}.": "已將資料庫遷移加入佇列，目標為 {target}。",
  "Default branch": "預設分支",
  "Delete file": "刪除檔案",
  "Delete file?": "刪除檔案？",
  "Delete folder": "刪除資料夾",
  "Delete folder?": "刪除資料夾？",
  "Destination": "目的地",
  "Destination unavailable": "目的地不可用",
  "Directory": "目錄",
  "Directory path is required.": "必須提供目錄路徑。",
  "Disable": "關閉",
  "Domains": "網域",
  "Draft editor for {path}": "{path} 的草稿編輯器",
  "Enable failover": "啟用故障切換",
  "Failover is off and the standby is gone. {message}":
    "故障切換已關閉，備援實例已移除。{message}",
  "Fetching the current directory contents.": "正在取得目前目錄內容。",
  "File": "檔案",
  "File deleted.": "檔案已刪除。",
  "File editor for {path}": "{path} 的檔案編輯器",
  "File mode": "檔案模式",
  "File path is required.": "必須提供檔案路徑。",
  "File saved.": "檔案已儲存。",
  "File storage": "檔案儲存",
  "Files still live in the running container until persistent storage is configured.":
    "在設定持久化儲存之前，檔案仍保留在執行中的容器內。",
  "Filesystem actions": "檔案系統操作",
  "Filesystem refreshed.": "檔案系統已重新整理。",
  "Filesystem scope": "檔案系統範圍",
  "Fixed source": "固定來源",
  "Folder created.": "資料夾已建立。",
  "Folder deleted.": "資料夾已刪除。",
  "Folder mode": "資料夾模式",
  "Folders can only be created inside mounted persistent directories.":
    "只能在已掛載的持久化目錄內建立資料夾。",
  "GitHub access": "GitHub 存取",
  "Hostname looks good. Save to attach it.":
    "主機名稱看起來可用。儲存後即可掛接。",
  "Hostname looks good. Save to replace the current domain.":
    "主機名稱看起來可用。儲存後將取代目前網域。",
  "Image": "映像",
  "Image default": "映像預設值",
  "Image reference": "映像引用",
  "Image retention": "映像保留",
  "Images": "映像",
  "In progress": "進行中",
  "In use": "使用中",
  "Inventory unavailable": "清單不可用",
  "Keep one Fugue subdomain for {appName}, or attach a hostname you control.":
    "為 {appName} 保留一個 Fugue 子網域，或掛接你可控制的主機名稱。",
  "Large file preview is truncated. Save is disabled for safety.":
    "大型檔案預覽已截斷。為了安全起見，已停用儲存。",
  "Leave blank to use saved GitHub access. Paste a token only to override it.":
    "留空即可使用已儲存的 GitHub 存取。只有在需要覆寫時才貼上 Token。",
  "Leave it blank to follow the repository default branch.":
    "留空即可跟隨儲存庫預設分支。",
  "Live container filesystem": "即時容器檔案系統",
  "Live filesystem": "即時檔案系統",
  "Loading folder": "正在載入資料夾",
  "Loading {name}": "正在載入 {name}",
  "Loading…": "載入中…",
  "Manual": "手動",
  "Manual refresh": "手動重新整理",
  "Mirrored image limit": "映像保留上限",
  "Mirrored image limit is already {count}.":
    "映像保留上限已經是 {count}。",
  "Mirrored image limit updated.": "映像保留上限已更新。",
  "Mode must be a non-negative integer.": "模式必須是非負整數。",
  "Mount": "掛載",
  "Mounted items": "掛載項目",
  "Mounted storage survives restarts, rebuilds, managed transfers, and failover.":
    "已掛載的儲存會在重新啟動、重建、託管遷移和故障切換後保留。",
  "Must stay unique within this workspace.": "在目前工作區內必須保持唯一。",
  "Needs GitHub repo read access.": "需要 GitHub 儲存庫讀取權限。",
  "Needs attention": "需要關注",
  "New file": "新增檔案",
  "New file path": "新檔案路徑",
  "New folder": "新增資料夾",
  "New folder path": "新資料夾路徑",
  "No destination selected": "未選擇目的地",
  "No mounts attached": "未掛接任何掛載",
  "No project name changes.": "專案名稱沒有變更。",
  "No source branch changes.": "來源分支沒有變更。",
  "No standby selected": "未選擇備援執行環境",
  "No target selected": "未選擇目標位置",
  "Not configured": "未設定",
  "Not queued": "未排隊",
  "Not ready": "未就緒",
  "Off": "關閉",
  "Old primary becomes the standby runtime.": "舊主節點會變成備援執行環境。",
  "Older mirrored images are pruned automatically.": "較舊的映像會自動清理。",
  "On": "開啟",
  "One-Click Transfer": "一鍵遷移",
  "Only GitHub-backed services can change the tracked branch.":
    "只有 GitHub 來源的服務可以修改追蹤分支。",
  "Only private GitHub-backed services store a repository token.":
    "只有私有 GitHub 來源的服務會儲存儲存庫 Token。",
  "Open Files": "開啟檔案",
  "Optional mode (420)": "可選模式（420）",
  "Optional mode (493)": "可選模式（493）",
  "Options": "選項",
  "Paste a token to override saved GitHub access":
    "貼上 Token 以覆寫已儲存的 GitHub 存取",
  "Path must be absolute.": "路徑必須是絕對路徑。",
  "Pause": "暫停",
  "Pause queued.": "已加入暫停佇列。",
  "Pausing…": "暫停中…",
  "Persistent storage": "持久化儲存",
  "Persistent storage already matches the current release.":
    "持久化儲存已與目前發佈一致。",
  "Persistent storage cleared. Deploy queued.":
    "持久化儲存已清空，部署已加入佇列。",
  "Persistent storage is already cleared.":
    "持久化儲存已經處於清空狀態。",
  "Persistent storage is not configured yet.":
    "持久化儲存尚未設定。",
  "Persistent storage refreshed.": "持久化儲存已重新整理。",
  "Persistent storage saved. Deploy queued.":
    "持久化儲存已儲存，部署已加入佇列。",
  "Persistent storage sync runs before the move completes.":
    "在遷移完成前會先同步持久化儲存。",
  "Persistent storage sync runs before the move completes. Database stays where it is.":
    "在遷移完成前會先同步持久化儲存。資料庫保持在原位。",
  "Persistent storage · {value}": "持久化儲存 · {value}",
  "Platform default": "平台預設值",
  "Polling for new commits": "輪詢新提交",
  "Primary runtime": "主執行環境",
  "Primary runtime unavailable": "主執行環境不可用",
  "Primary runtime unavailable.": "主執行環境不可用。",
  "Project shell": "專案殼層",
  "Queued changes roll out in the next deploy operation.":
    "排隊中的變更會在下一次部署中生效。",
  "Queueing…": "加入佇列中…",
  "Reconnect GitHub": "重新連接 GitHub",
  "Refresh on demand": "按需重新整理",
  "Refreshing…": "重新整理中…",
  "Removing standby": "正在移除備援實例",
  "Replace token": "替換 Token",
  "Replica plan": "副本計畫",
  "Repository": "儲存庫",
  "Repository access": "儲存庫存取",
  "Repository token updated. Rebuild queued.":
    "儲存庫 Token 已更新，重建已加入佇列。",
  "Resume": "恢復",
  "Resume first.": "請先恢復。",
  "Resume queued.": "已加入恢復佇列。",
  "Resume to poll new commits.": "恢復後將輪詢新的提交。",
  "Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint.":
    "以 `sh -lc <command>` 執行。留空則使用映像預設入口點。",
  "Runtime Move": "執行環境遷移",
  "Runtime list unavailable.": "執行環境列表不可用。",
  "Runtime unavailable": "執行環境不可用",
  "Save and rebuild": "儲存並重建",
  "Save command": "儲存命令",
  "Save limit": "儲存上限",
  "Save mode": "儲存模式",
  "Save name": "儲存名稱",
  "Save route": "儲存路由",
  "Save standby": "儲存備援執行環境",
  "Save storage": "儲存儲存設定",
  "Save to create this folder in the current scope.":
    "儲存後會在目前範圍內建立這個資料夾。",
  "Saved GitHub access applied. Rebuild queued.":
    "已套用儲存的 GitHub 存取，重建已加入佇列。",
  "Saved GitHub access is ready as @{login}.":
    "已儲存的 GitHub 存取已就緒，目前帳號為 @{login}。",
  "Saved GitHub access is ready.": "已儲存的 GitHub 存取已就緒。",
  "Saved access": "已儲存的存取",
  "Saved image limit": "已儲存映像上限",
  "Saved image limit is required.": "必須提供已儲存映像上限。",
  "Saved image limit · {value}": "已儲存映像上限 · {value}",
  "Select a destination…": "選擇目的地…",
  "Select a file before saving.": "請先選擇一個檔案再儲存。",
  "Select a standby runtime…": "選擇備援執行環境…",
  "Serving now": "目前正在服務",
  "Settings": "設定",
  "Source": "來源",
  "Source package": "原始碼套件",
  "Standby is ready. {message}": "備援實例已就緒。{message}",
  "Standby runtime": "備援執行環境",
  "Start the service before moving it.": "請先啟動服務再遷移。",
  "Start the service before opening Files.": "請先啟動服務再開啟「檔案」。",
  "Still checking saved GitHub access. Try again in a moment or paste a token.":
    "仍在檢查已儲存的 GitHub 存取。請稍後再試，或直接貼上 Token。",
  "Storage class": "儲存類別",
  "Stored token": "已儲存 Token",
  "Subdomain": "子網域",
  "Taken": "已被占用",
  "This database cannot be configured from the console yet.":
    "這個資料庫暫時還不能在控制台中設定。",
  "This database cannot be transferred from the console yet.":
    "這個資料庫暫時還不能在控制台中遷移。",
  "This database is not attached to an application.":
    "這個資料庫尚未掛接到應用。",
  "This file is shown as base64 because it is not valid utf-8 text.":
    "此檔案因不是有效的 UTF-8 文字，因此以 base64 形式顯示。",
  "This folder is empty": "此資料夾為空",
  "This preview was truncated at 1 MB. Save is disabled to avoid overwriting the file with partial content.":
    "此預覽已在 1 MB 處截斷。為避免用不完整內容覆寫檔案，已停用儲存。",
  "Token updates are unavailable.": "目前無法更新 Token。",
  "Topology": "拓樸",
  "Tracked branch": "追蹤分支",
  "Tracked branch · {value}": "追蹤分支 · {value}",
  "Transfer Database Primary?": "遷移資料庫主節點？",
  "Transfer Now": "立即遷移",
  "Transfer Service?": "遷移服務？",
  "Transfer queued to {target}.": "已將遷移加入佇列，目標為 {target}。",
  "Unable to check availability right now.":
    "目前無法檢查可用性。",
  "Unable to check hostname availability right now.":
    "目前無法檢查主機名稱可用性。",
  "Unable to load persistent storage.": "無法載入持久化儲存。",
  "Unable to load this file. Refresh the current scope to try again.":
    "無法載入此檔案。請重新整理目前範圍後再試一次。",
  "Unable to load this filesystem root.": "無法載入目前檔案系統根目錄。",
  "Unable to load this folder. Try refreshing the current scope.":
    "無法載入此資料夾。請嘗試重新整理目前範圍。",
  "Unassigned": "未分配",
  "Unassigned groups cannot be renamed yet.":
    "尚未分組的專案目前還不能重新命名。",
  "Unlinked source": "未連結來源",
  "Update token and rebuild": "更新 Token 並重建",
  "Updates paused": "更新已暫停",
  "Upload": "上傳",
  "Use a whole number.": "請輸入整數。",
  "Use lowercase letters, numbers, and hyphens.":
    "請使用小寫字母、數字與連字號。",
  "Use saved access and rebuild": "使用已儲存的存取並重建",
  "Wait for the current release to finish before browsing files.":
    "請等目前發佈完成後再瀏覽檔案。",
  "Wait for the current release to finish.": "請等待目前發佈完成。",
  "inspect persistent storage": "檢查持久化儲存",
  "review persistent storage configuration": "查看持久化儲存設定",
  "the current standby": "目前備援實例",
  "{appName} will move from {liveRuntimeLabel} to {selectedTargetLabel}.":
    "{appName} 將從 {liveRuntimeLabel} 遷移到 {selectedTargetLabel}。",
  "{count} saved image": "{count} 個已儲存映像",
  "{count} saved images": "{count} 個已儲存映像",
  "{hostname} is already attached to {appName}.":
    "{hostname} 已掛接到 {appName}。",
  "{hostname} is already attached to {appName}. Fugue is finishing setup now.":
    "{hostname} 已掛接到 {appName}。Fugue 正在完成設定。",
  "{hostname} is already attached to {appName}. {guidance}":
    "{hostname} 已掛接到 {appName}。{guidance}",
  "{hostname} is already serving {appName}.":
    "{hostname} 已在為 {appName} 提供服務。",
  "{hostname} is attached to {appName}, but setup still needs attention.":
    "{hostname} 已掛接到 {appName}，但設定仍需處理。",
  "{hostname} is attached to {appName}.":
    "{hostname} 已掛接到 {appName}。",
  "{hostname} is attached to {appName}. Fugue is finishing setup now.":
    "{hostname} 已掛接到 {appName}。Fugue 正在完成設定。",
  "{hostname} is attached to {appName}. {guidance}":
    "{hostname} 已掛接到 {appName}。{guidance}",
  "{hostname} is ready and now serving {appName}.":
    "{hostname} 已就緒，正在為 {appName} 提供服務。",
  "{path} and everything inside it will be removed from {appName}.":
    "{path} 及其中所有內容都將從 {appName} 中移除。",
  "{path} will be removed from {appName}.":
    "{path} 將從 {appName} 中移除。",
  "{target} (applying)": "{target}（套用中）",
  "{target} (removing)": "{target}（移除中）",
  "<1 hour": "少於 1 小時",
  "Account email": "帳號電子郵件",
  "Actions": "操作",
  "Active methods": "目前啟用方式",
  "Add a published Docker image to {projectName}. Adjust placement only if this service needs it.":
    "為 {projectName} 新增一個已發布的 Docker 映像。只有這個服務確實需要時才調整部署位置。",
  "Add a stored password for faster return access. Registration still uses an email verification link.":
    "新增已儲存密碼可更快返回存取。註冊流程仍然使用電子郵件驗證連結。",
  "Add a stored password only if you want faster sign-in after the account is already created.":
    "只有在帳號建立後你確實想更快登入時，才需要新增已儲存密碼。",
  "Add credits": "新增額度",
  "Add credits to your balance, then set a capacity cap. Fugue deducts credits from active resources, and stored images count toward disk usage.":
    "先為餘額儲值，再設定容量上限。Fugue 會從正在執行的資源中扣減額度，已儲存映像也會計入磁碟用量。",
  "Add or reconnect another sign-in method before removing the password from this account.":
    "移除此帳號的密碼前，請先新增或重新連結另一種登入方式。",
  "Add password": "新增密碼",
  "Add variable": "新增變數",
  "Add {amount} credits": "新增 {amount} 額度",
  "Added": "已新增",
  "Added {amount} to the prepaid balance.": "已向預付餘額新增 {amount}。",
  "Added {amount}. {note}": "已新增 {amount}。{note}",
  "Admin balance adjustment": "管理員餘額調整",
  "Amount": "金額",
  "Archive the uploaded files and stage the first build on the server.":
    "將上傳檔案封存，並在伺服器上準備第一次建置。",
  "At the current rate, your balance lasts about {duration}.":
    "依目前速率估算，你的餘額大約還能支撐 {duration}。",
  "At the current rate, {amount} adds about {duration} of runway.":
    "依目前速率估算，{amount} 大約可增加 {duration} 的續航。",
  "Attach live workbench": "接入即時工作台",
  "Attached to": "掛接到",
  "Auto-detect after import": "匯入後自動判斷",
  "Available credits": "可用額度",
  "BYO VPS free": "自備 VPS 免費",
  "Back to projects": "返回專案",
  "Manage services, routes, logs, files, and project settings from one workspace.":
    "在同一個工作台中管理服務、路由、日誌、檔案與專案設定。",
  "Balance adjusted": "餘額已調整",
  "Balance adjustment": "餘額調整",
  "Balance after": "調整後餘額",
  "Balance top-up": "餘額儲值",
  "Billing activity": "帳務活動",
  "Billing data is unavailable right now. Retry the request.":
    "目前無法取得帳務資料。請重試。",
  "Billing event recorded.": "已記錄帳務事件。",
  "Billing health": "帳務健康度",
  "Billing snapshot ready": "帳務快照已就緒",
  "Billing snapshot refreshed with partial live data.":
    "帳務快照已刷新，但即時資料僅部分更新。",
  "Billing snapshot refreshed.": "帳務快照已刷新。",
  "Billing top-up status response was malformed.":
    "帳務儲值狀態回應格式不正確。",
  "Billing update response was malformed.": "帳務更新回應格式不正確。",
  "Build details": "建置詳情",
  "Build logs, route controls, and environment panels replace this shell automatically.":
    "建置日誌、路由控制與環境面板會自動取代這個殼層。",
  "Build queued": "建置已加入佇列",
  "Charged at": "計費基準",
  "Charges follow the larger of your saved cap and any resources already committed.":
    "計費會以你儲存的上限與目前已提交資源中較大的那個為準。",
  "Check payment status": "檢查付款狀態",
  "Checking…": "檢查中…",
  "Checkout is still being confirmed. Credits appear here automatically after payment clears.":
    "結帳結果仍在確認中。付款完成後，額度會自動顯示在這裡。",
  "Commit": "提交",
  "Confirm password": "確認密碼",
  "Connect another sign-in method before turning off email link or removing the password.":
    "關閉電子郵件連結或移除密碼前，請先連結另一種登入方式。",
  "Connect is disabled here until the provider is configured.":
    "在設定提供者之前，這裡暫時無法連結。",
  "Connect {provider}": "連結 {provider}",
  "Connected providers": "已連結提供者",
  "Connecting to live logs…": "正在連接即時日誌…",
  "Connection dropped. Reconnecting to {streamLabel} output.":
    "連線已中斷。正在重新連接 {streamLabel} 輸出。",
  "Connection dropped. Reconnecting to {streamLabel} output. Showing the latest received output.":
    "連線已中斷。正在重新連接 {streamLabel} 輸出。目前顯示最近一次收到的輸出。",
  "Could not disable email link sign-in.": "無法停用電子郵件連結登入。",
  "Could not enable email link sign-in.": "無法啟用電子郵件連結登入。",
  "Could not remove the password.": "無法移除密碼。",
  "Could not save the password.": "無法儲存密碼。",
  "Could not update the sign-in method.": "無法更新登入方式。",
  "Could not update your profile.": "無法更新你的個人資料。",
  "Couldn't queue the first service": "無法為第一個服務加入佇列",
  "Create a workspace first, then return to the console to import your first service.":
    "請先建立工作區，再回到控制台匯入第一個服務。",
  "Creating project": "正在建立專案",
  "Creating project and queueing the first deployment.":
    "正在建立專案，並把第一次部署加入佇列。",
  "Credits": "額度",
  "Credits are deducted only while managed resources are active.":
    "只有在託管資源處於活動狀態時才會扣減額度。",
  "Any active billable resource is billed against this saved envelope.":
    "只要有任何可計費資源處於活動狀態，就會按這個已保存的容量包絡計費。",
  "Once any billable resource is active, charges follow your saved cap.":
    "只要有任何可計費資源處於活動狀態，就會按你保存的上限計費。",
  "Billing is inactive.": "目前未在計費。",
  "Credits ready to cover current managed usage.":
    "目前可用額度足以覆蓋現有託管資源用量。",
  "Current cap": "目前上限",
  "Current password": "目前密碼",
  "Current usage": "目前用量",
  "Delete": "刪除",
  "Description": "說明",
  "Direct returning access": "直接返回存取",
  "Disable email link": "停用電子郵件連結",
  "Disable email link sign-in?": "要停用電子郵件連結登入嗎？",
  "Disabled on this account.": "此帳號已停用。",
  "Disconnect {method}": "斷開 {method}",
  "Disconnect {method} sign-in?": "要斷開 {method} 登入嗎？",
  "Display name": "顯示名稱",
  "Display name and every sign-in path linked to this account.":
    "顯示名稱，以及與此帳號關聯的所有登入路徑。",
  "Edit the name shown across the console. Email and sign-in methods are managed below.":
    "編輯在整個控制台中顯示的名稱。電子郵件與登入方式在下方管理。",
  "Elapsed": "已耗時",
  "Email link sign-in disabled.": "電子郵件連結登入已停用。",
  "Email link sign-in enabled.": "電子郵件連結登入已啟用。",
  "Empty project": "空專案",
  "Empty projects stay visible so you can reuse the shell or delete it explicitly.":
    "空專案會繼續顯示，方便你重用這個殼層，或手動刪除它。",
  "Enable email link": "啟用電子郵件連結",
  "Enter a whole USD amount between {min} and {max}.":
    "請輸入介於 {min} 到 {max} 之間的整數美元金額。",
  "Environment": "環境變數",
  "Estimated runway": "預估續航",
  "First service is queued": "第一個服務已加入佇列",
  "First service is syncing into the console": "第一個服務正在同步到控制台",
  "Fugue could not load the profile settings right now.":
    "Fugue 目前無法載入個人資料設定。",
  "Fugue could not read the billing state for {workspaceName}.":
    "Fugue 目前無法讀取 {workspaceName} 的帳務狀態。",
  "Fugue could not read the current tenant billing state.":
    "Fugue 目前無法讀取目前租戶的帳務狀態。",
  "GitHub could not be linked right now. Try again.":
    "目前無法連結 GitHub。請再試一次。",
  "GitHub sign-in is not configured in this environment.":
    "目前環境尚未設定 GitHub 登入。",
  "GitHub sign-in linked.": "GitHub 登入已連結。",
  "History": "歷史",
  "How Fugue should address you": "Fugue 應如何稱呼你",
  "Identity": "身分",
  "Import a new service": "匯入新服務",
  "Import running": "匯入進行中",
  "Keep credits and capacity in sync": "保持額度與容量同步",
  "Keep one method live": "至少保留一種可用方式",
  "Keep your workspace funded": "確保工作區有足夠額度",
  "Last sign-in": "上次登入",
  "Linked providers": "已連結提供者",
  "Loading deployment targets…": "正在載入部署目標…",
  "Loading environment…": "正在載入環境變數…",
  "Manage password": "管理密碼",
  "Managed billing paused.": "託管帳務已暫停。",
  "Managed envelope updated.": "託管容量包絡已更新。",
  "Memory": "記憶體",
  "Need more room? Add credits here first, then raise the capacity cap.":
    "需要更多空間？先在這裡儲值額度，再提高容量上限。",
  "New cap": "新上限",
  "New monthly spend": "新的每月支出",
  "New password": "新密碼",
  "Next steps": "下一步",
  "No billing events yet": "尚無帳務事件",
  "No charge": "無費用",
  "No saved envelope.": "尚未設定容量包絡。",
  "Save the maximum managed CPU, memory, and disk for this workspace. Once any billable resource is active, Fugue charges against this saved envelope.":
    "為這個工作區保存託管 CPU、記憶體和磁碟上限。只要有任何可計費資源處於活動狀態，Fugue 就會按這個已保存的容量包絡計費。",
  "No live burn right now.": "目前沒有即時消耗。",
  "No live stats": "尚無即時統計",
  "No services are attached to this project yet.":
    "這個專案尚未掛接任何服務。",
  "No workspace yet": "尚無工作區",
  "Not added": "尚未新增",
  "Not configured in this environment.": "目前環境尚未設定。",
  "Not enabled": "未啟用",
  "One-time verification path": "一次性驗證路徑",
  "Open retry flow": "開啟重試流程",
  "Over cap": "超出上限",
  "Package uploaded source": "封裝上傳原始碼",
  "Packaging the first build": "正在封裝第一次建置",
  "Packaging uploaded files for the first build.":
    "正在為第一次建置封裝上傳檔案。",
  "Password access": "密碼存取",
  "Password added.": "密碼已新增。",
  "Password removed.": "密碼已移除。",
  "Password updated.": "密碼已更新。",
  "Passwords do not match.": "兩次輸入的密碼不一致。",
  "Paused until both CPU and memory are above zero.":
    "CPU 與記憶體都大於 0 之前，帳務會保持暫停。",
  "Payment completed. Billing balance refreshed.":
    "付款已完成，帳務餘額已刷新。",
  "Payment failed.": "付款失敗。",
  "Prepare image rollout": "準備映像發布",
  "Prepare repository build": "準備儲存庫建置",
  "Preparing checkout…": "正在準備結帳…",
  "Preparing the first repository build": "正在準備第一次儲存庫建置",
  "Preparing the first repository build.":
    "正在準備第一次儲存庫建置。",
  "Preparing the first rollout": "正在準備第一次發布",
  "Profile settings unavailable": "個人資料設定不可用",
  "Profile updated.": "個人資料已更新。",
  "Project id": "專案 ID",
  "Project import queued.": "專案匯入已加入佇列。",
  "Project name, source reference, app naming, and handoff behavior":
    "專案名稱、來源引用、應用命名與交接行為",
  "Queue failed": "排入佇列失敗",
  "Recent billing events": "最近帳務事件",
  "Recovery anchor": "恢復錨點",
  "Refresh billing": "刷新帳務",
  "Restart": "重新啟動",
  "Restart queued.": "重新啟動已加入佇列。",
  "Restarting…": "重新啟動中…",
  "Retry needed": "需要重試",
  "Review variables for {name}, or switch to Raw to paste a .env block. Saving queues a deploy.":
    "檢查 {name} 的變數，或切換到「原始」貼上 .env 區塊。儲存後會將部署加入佇列。",
  "Runway updates after live billing data is available.":
    "即時帳務資料就緒後會更新續航估算。",
  "Save capacity cap": "儲存容量上限",
  "Save higher cap": "儲存更高上限",
  "Save profile": "儲存個人資料",
  "Saving cap…": "正在儲存上限…",
  "Services": "服務",
  "Set your capacity cap": "設定容量上限",
  "Show passwords": "顯示密碼",
  "Source files uploaded from this browser": "從目前瀏覽器上傳的原始碼檔案",
  "State": "狀態",
  "Streaming response body is unavailable.":
    "串流回應本文不可用。",
  "Suggested top-up amounts": "建議儲值金額",
  "Syncing": "同步中",
  "That GitHub account is already linked to another Fugue account.":
    "這個 GitHub 帳號已連結到另一個 Fugue 帳號。",
  "That Google account is already linked to another Fugue account.":
    "這個 Google 帳號已連結到另一個 Fugue 帳號。",
  "The first service did not queue.": "第一個服務未能加入佇列。",
  "The live workbench appears as soon as the app record becomes visible.":
    "應用記錄一旦可見，即時工作台就會出現。",
  "The project exists and the first service slot is reserved.":
    "專案已建立，第一個服務槽位已保留。",
  "This account currently has one sign-in method left. Connect another method before removing it.":
    "這個帳號目前只剩一種登入方式。請先連結另一種方式再移除它。",
  "This shell disappears automatically once the live workbench is ready.":
    "即時工作台準備好後，這個殼層會自動消失。",
  "Top up required": "需要儲值",
  "Top-up amount": "儲值金額",
  "Unable to load tenant billing": "無法載入租戶帳務",
  "Unable to load this project right now.":
    "目前無法載入這個專案。",
  "Update password": "更新密碼",
  "Updated {time}": "更新於 {time}",
  "{amount} / hour": "{amount} / 小時",
  "{amount} / hour at the current live rate.":
    "依目前即時費率為 {amount} / 小時。",
  "{count} months": "{count} 個月",
  "{count} weeks": "{count} 週",
  "{duration} elapsed": "已耗時 {duration}",
  "{label} logs are not ready yet.": "{label} 日誌尚未就緒。",
  "{label} stream closed.": "{label} 串流已關閉。",
  "{label} stream closed. Showing latest snapshot.":
    "{label} 串流已關閉。目前顯示最新快照。",
  "{method} in use": "{method} 使用中",
  "{name} is empty and will be removed from the workspace.":
    "{name} 為空，會從工作區中移除。",
  "{name} will be queued for deletion from this project.":
    "{name} 會在此專案中加入刪除佇列。",
  "app.example.com or example.com": "app.example.com 或 example.com",
  "25": "25",
  "Action": "操作",
  "Add credits before you raise capacity or start new managed resources.":
    "在提高容量或啟動新的託管資源前，請先儲值。",
  "Balance is empty. Add credits before you expand capacity or start new managed resources.":
    "餘額為空。在擴充容量或啟動新的託管資源前，請先儲值。",
  "Billing checkout response was malformed.": "帳務結帳回應格式不正確。",
  "Building": "構建中",
  "CPU": "CPU",
  "Cancel": "取消",
  "Capacity": "容量",
  "Changes apply after you save.": "儲存後生效。",
  "Connected": "已連接",
  "Copy logs": "複製日誌",
  "Copying…": "複製中…",
  "Created": "建立時間",
  "Credits are deducted when managed resources are active.":
    "託管資源運作時會扣減餘額。",
  "Current usage is above your saved capacity cap. Save a higher cap to match what is already committed.":
    "目前用量已經高於你儲存的容量上限。請儲存更高的上限，以匹配已提交的資源。",
  "DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# comments are ignored":
    "DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# 註解會被忽略",
  "Deleting service": "正在刪除服務",
  "Deploy aborted. Force delete queued.": "已中止部署，強制刪除已加入佇列。",
  "Deploying": "部署中",
  "Discard": "捨棄",
  "Disconnect": "解除連結",
  "Disconnecting": "解除連結中",
  "Drop a local folder or source files for {projectName}. Fugue packages them on the server before import.":
    "將本機資料夾或原始碼檔案拖到 {projectName}。Fugue 會先在伺服器端打包，再開始匯入。",
  "Drop a local folder, archive, or source files for {projectName}. Fugue packages file uploads on the server before import.":
    "將本機資料夾、封存或原始碼檔案拖到 {projectName}。Fugue 會先在伺服器端打包檔案上傳內容，再開始匯入。",
  "Duplicate env keys: {keys}.": "環境變數鍵重複：{keys}。",
  "Empty": "空",
  "Empty response.": "空回應。",
  "Enabling": "啟用中",
  "Envelope updated": "容量包已更新",
  "Event": "事件",
  "Fugue is creating the project and packaging the uploaded files on the server before the first build starts.":
    "Fugue 正在建立專案，並在第一次構建開始前於伺服器端打包已上傳的檔案。",
  "Drag a folder, a .zip or .tgz archive, docker-compose.yml, fugue.yaml, Dockerfile, or source files into the browser":
    "將資料夾、.zip 或 .tgz 封存、docker-compose.yml、fugue.yaml、Dockerfile 或原始碼檔案拖入瀏覽器",
  "Drop a local folder, archive, or source files. Fugue packages file uploads on the server, then imports the result through the upload path.":
    "拖入本機資料夾、封存或原始碼檔案。Fugue 會先在伺服器端打包檔案上傳內容，再透過上傳路徑匯入結果。",
  "Fugue is creating the project and preparing the repository import before build logs can attach.":
    "Fugue 正在建立專案，並在構建日誌接入前準備儲存庫匯入。",
  "Fugue is creating the project, mirroring the image internally, and staging the first rollout.":
    "Fugue 正在建立專案、在內部鏡像該映像，並為第一次發佈做準備。",
  "GitHub import": "GitHub 匯入",
  "Google could not be linked right now. Try again.":
    "目前無法連結 Google，請再試一次。",
  "Google sign-in is not configured in this environment.":
    "目前環境尚未設定 Google 登入。",
  "Google sign-in linked.": "Google 登入已連結。",
  "Handoff": "交接",
  "Inactive": "未啟用",
  "Inspect the repository and prepare the build plan for the first service.":
    "檢查儲存庫並為第一個服務準備構建計畫。",
  "Inspect {name} ({status})": "查看 {name}（{status}）",
  "Keep another sign-in method linked before removing email link access.":
    "移除電子郵件連結存取前，請先連結另一種登入方式。",
  "Keep another sign-in method linked before removing the stored password.":
    "移除已儲存密碼前，請先連結另一種登入方式。",
  "Keep another sign-in method linked before removing this one.":
    "移除這一項前，請先連結另一種登入方式。",
  "Keep the account email as the recovery anchor. Email link remains the lowest-friction fallback; password is optional for faster return access.":
    "請將帳號電子郵件保留為恢復錨點。電子郵件連結仍是摩擦最低的備援方式；密碼僅用於更快返回存取。",
  "Keep this page open. Fugue will swap this shell for the live workbench as soon as the app record is visible.":
    "請保持此頁面開啟。應用記錄一旦可見，Fugue 就會把這個殼層替換成即時工作台。",
  "Key": "鍵",
  "Line {line}: {message}": "第 {line} 行：{message}",
  "Linked": "已連結",
  "Live {streamLabel} output for {name}.":
    "{name} 的即時 {streamLabel} 輸出。",
  "Local source": "本機原始碼",
  "Location": "位置",
  "Logs": "日誌",
  "Manage how this account gets back into Fugue. Email stays the recovery anchor while GitHub and Google remain optional return paths.":
    "管理這個帳號回到 Fugue 的方式。電子郵件仍是恢復錨點，而 GitHub 和 Google 則是可選的返回路徑。",
  "Managed billing is paused. Set both CPU and memory above zero to resume.":
    "託管帳務已暫停。將 CPU 和記憶體都設為大於零即可恢復。",
  "Managed envelope automatically raised to {envelope}.":
    "託管容量包已自動提高到 {envelope}。",
  "Managed envelope changed.": "託管容量包已變更。",
  "Managed envelope set to {envelope}.":
    "託管容量包已設為 {envelope}。",
  "Managed envelope was raised automatically.":
    "託管容量包已自動提高。",
  "Maximum managed resources for this workspace.":
    "此工作區可使用的最大託管資源。",
  "Mirror the published image internally and stage the first rollout.":
    "在內部鏡像該已發佈映像，並為第一次發佈做準備。",
  "Mirroring the image and preparing the first rollout.":
    "正在鏡像該映像並準備第一次發佈。",
  "Name": "名稱",
  "No change": "無變更",
  "No environment variables yet. Add one manually or switch to Raw to paste a .env block.":
    "目前還沒有環境變數。可手動新增一個，或切換到「原始」後貼上 .env 區塊。",
  "No live estimate": "暫無即時估算",
  "Not available": "暫不可用",
  "Not linked yet.": "尚未連結。",
  "Opening live {streamLabel} output for {name}.":
    "正在為 {name} 開啟即時 {streamLabel} 輸出。",
  "Optional. Shown in the console header and account surfaces.":
    "可選。會顯示在控制台頁首與帳號介面中。",
  "Panels": "面板",
  "Partial Fugue data: {details}.": "Fugue 資料部分可用：{details}。",
  "Paste a .env block for {name}. Comments, blank lines, and export prefixes are ignored.":
    "為 {name} 貼上 .env 區塊。註解、空行和 export 前綴都會被忽略。",
  "Paste a GitHub repository link for {projectName}. Adjust access or placement only if this service needs it.":
    "為 {projectName} 貼上 GitHub 儲存庫連結。僅在這個服務確實需要時再調整存取權或部署位置。",
  "Paused": "已暫停",
  "Platform admin adjusted the prepaid balance":
    "平台管理員調整了預付餘額",
  "Profile": "個人資料",
  "Project 1": "專案 1",
  "Project created": "專案已建立",
  "Project created. The live workbench will replace this shell automatically.":
    "專案已建立。即時工作台就緒後會自動取代這個殼層。",
  "Project name already exists. Choose a different name or select the existing project.":
    "專案名稱已存在。請選擇其他名稱，或直接選取現有專案。",
  "Projected monthly spend": "預估每月支出",
  "Published image reference": "已發佈映像引用",
  "Raw input is empty. Saving will keep the environment empty.":
    "原始輸入為空。儲存後環境變數會保持為空。",
  "Ready to connect when you want GitHub-based sign-in.":
    "需要 GitHub 登入時即可連接。",
  "Ready to connect when you want a Google-based return path.":
    "需要 Google 作為返回路徑時即可連接。",
  "Ready to connect.": "隨時可連接。",
  "Registration still uses an email verification link.":
    "註冊仍透過電子郵件驗證連結完成。",
  "Release": "版本",
  "Remove": "移除",
  "Remove password": "移除密碼",
  "Remove password sign-in?": "移除密碼登入？",
  "Removing": "移除中",
  "Repeat the password once to confirm it.":
    "再次輸入密碼以確認。",
  "Request failed with status {status}.":
    "請求失敗，狀態碼 {status}。",
  "Required before the password can be changed.":
    "變更密碼前必須提供。",
  "Reserve the project and the first service slot.":
    "預留專案與第一個服務槽位。",
  "Reset raw": "重設原始輸入",
  "Restart the current release without rebuilding the image. Persistent storage is preserved when configured.":
    "在不重建映像的情況下重新啟動目前版本。若已設定持久化儲存，則會保留。",
  "Restricted": "受限",
  "Retry": "重試",
  "Retry billing sync": "重試同步帳務",
  "Return to the create flow and retry the import":
    "返回建立流程並重試匯入",
  "Running": "執行中",
  "Runway updates after the latest live billing sync.":
    "續航估算會在最新即時帳務同步後更新。",
  "Save the maximum managed CPU, memory, and disk for this workspace. Fugue charges against the larger of your saved cap and any resources already committed.":
    "儲存這個工作區的最大託管 CPU、記憶體與磁碟。Fugue 會依你儲存的上限與已提交資源中較大的那一個計費。",
  "Saved capacity exceeds the temporary 2 CPU / 4 GiB / 30 GiB UI cap. Save again to bring it back into range.":
    "已儲存容量超出目前臨時的 2 CPU / 4 GiB / 30 GiB 介面上限。請再次儲存，將它調回範圍內。",
  "Saving": "儲存中",
  "Send a one-time verification link to the account email on the sign-in page.":
    "在登入頁向帳號電子郵件傳送一次性驗證連結。",
  "Send a secure sign-in link to the account email without storing a password.":
    "向帳號電子郵件傳送安全登入連結，無需儲存密碼。",
  "Shown in the project list.": "會顯示在專案列表中。",
  "Sign-in methods": "登入方式",
  "Some billing details could not be refreshed. Visible values may be incomplete.":
    "有些帳務細節無法重新整理。目前顯示的數值可能不完整。",
  "Start": "啟動",
  "Stream unavailable.": "串流不可用。",
  "The current browser session stays open, but future sign-ins will need another linked method.":
    "目前瀏覽器工作階段會保持開啟，但之後登入需要另一種已連結方式。",
  "The current browser session stays open, but the next sign-in will need another linked method.":
    "目前瀏覽器工作階段會保持開啟，但下次登入需要另一種已連結方式。",
  "The destination runtime is still preparing. Runtime logs switch over once the transfer is live.":
    "目標執行環境仍在準備中。遷移生效後，執行環境日誌會自動切換過去。",
  "The live workbench replaces this shell when logs and route controls are ready":
    "日誌與路由控制就緒後，即時工作台會取代這個殼層",
  "The live {streamLabel} stream is delayed at the edge. Loading recent snapshots instead.":
    "邊緣側的即時 {streamLabel} 串流暫時延遲，正在改為載入最近快照。",
  "The live {streamLabel} stream is delayed at the edge. Refreshing recent snapshots every 3 seconds.":
    "邊緣側的即時 {streamLabel} 串流暫時延遲，正在每 3 秒重新整理一次最近快照。",
  "The request stopped before build logs and route controls could attach.":
    "在構建日誌與路由控制接入前，請求就已停止。",
  "This project still exists in Fugue, but it does not currently have any running services or attached backing services.":
    "這個專案仍然存在於 Fugue 中，但目前沒有任何執行中的服務或掛接的後端服務。",
  "This session was opened with a password. Changing or removing it will not close the current browser session.":
    "目前工作階段是透過密碼開啟的。變更或移除密碼不會關閉目前瀏覽器工作階段。",
  "Top up credits before you expand capacity. Credits are deducted while resources run, and stored images count toward disk usage.":
    "擴充容量前請先儲值。資源運作時會扣減餘額，已儲存映像也會計入磁碟用量。",
  "Top up now": "立即儲值",
  "Top-ups, admin balance adjustments, and envelope changes will appear here.":
    "儲值、管理員餘額調整與容量包變更都會顯示在這裡。",
  "Top-ups, balance adjustments, and capacity changes appear here.":
    "儲值、餘額調整與容量變更都會顯示在這裡。",
  "Type": "輸入",
  "URL": "URL",
  "Unable to open the log stream.": "無法開啟日誌串流。",
  "Unable to open the {streamLabel} stream.":
    "無法開啟 {streamLabel} 串流。",
  "Undo": "還原",
  "Update or remove the stored password. Email link stays the recovery anchor for this account.":
    "更新或移除已儲存的密碼。電子郵件連結仍是這個帳號的恢復錨點。",
  "Updating": "更新中",
  "Use GitHub as another return path into the console.":
    "使用 GitHub 作為返回控制台的另一條路徑。",
  "Use a linked Google or Gmail identity to reopen the console.":
    "使用已連結的 Google 或 Gmail 身分重新開啟控制台。",
  "Value": "值",
  "Variable name": "變數名稱",
  "Variable {count}": "變數 {count}",
  "Waiting": "等待中",
  "Waiting for checkout confirmation…": "正在等待結帳確認…",
  "Waiting for log output…": "正在等待日誌輸出…",
  "We could not confirm payment status automatically. Check again in a few seconds.":
    "我們暫時無法自動確認付款狀態。請幾秒後再檢查。",
  "We could not confirm payment status yet. Check again in a few seconds.":
    "我們暫時還無法確認付款狀態。請幾秒後再檢查。",
  "Whole USD amounts only. Min {min}, max {max}.":
    "僅支援整美元金額。最小 {min}，最大 {max}。",
  "exactly to enable deletion.": "以啟用刪除。",
  "matches current environment": "與目前環境一致",
  "{actor} by {amount}.": "由 {actor} 調整 {amount}。",
  "{actor} by {amount}. {note}": "由 {actor} 調整 {amount}。{note}",
  "{label} logs are ready, but clipboard access failed.":
    "{label} 日誌已就緒，但剪貼簿存取失敗。",
  "{label} logs for {name}": "{name} 的 {label} 日誌",
  "{message} Showing the latest received output.":
    "{message} 目前顯示最近收到的輸出。",
  "{method} sign-in disconnected.":
    "{method} 登入方式已解除連結。",
  "{name} discard variable": "捨棄變數 {name}",
  "{name} is currently {phase}. {description}":
    "{name} 目前為 {phase}。{description}",
  "{name} key": "{name} 鍵",
  "{name} remove variable": "移除變數 {name}",
  "{name} undo removal": "還原移除變數 {name}",
  "{name} value": "{name} 值",
  "{email} will be removed from Fugue.": "{email} 會從 Fugue 中移除。",
  "{email} will become an admin and their access will be restored.":
    "{email} 將成為管理員，並恢復其存取權限。",
  "{email} will gain workspace admin access.":
    "{email} 將取得工作區管理員權限。",
  "{label} / {usage} / {total}": "{label} / {usage} / {total}",
  "{label} usage {percent} ({usage})": "{label} 使用量 {percent}（{usage}）",
  "{limit} limit. Billed as {billed} until live storage shrinks.":
    "上限為 {limit}。在即時儲存縮減前，將按 {billed} 計費。",
  "{name} resource usage": "{name} 資源使用情況",
  "{name} will be queued for deletion from the admin surface.":
    "{name} 會從管理員介面加入刪除佇列。",
  "{ready}/{desired} ready": "{ready}/{desired} 就緒",
  "{updated} updated / {available} available":
    "{updated} 已更新 / {available} 可用",
  "{value} / month": "{value} / 月",
  "{value}/mo": "{value}/月",
  "API and controller are healthy, but they currently advertise different deployed image tags.":
    "API 與控制器目前都健康，但它們正在回報不同的已部署映像標籤。",
  "API and controller report the same deployed image tag, with every replica updated and available.":
    "API 與控制器回報的是同一個已部署映像標籤，且所有副本都已更新並可用。",
  "Admin": "管理員",
  "Admin access removed.": "管理員權限已移除。",
  "Admin summary": "管理員摘要",
  "Admins": "管理員",
  "App identifier": "應用識別碼",
  "Apps": "應用",
  "Attention": "需注意",
  "Balance": "餘額",
  "Balance {value}": "餘額 {value}",
  "Balance updated.": "餘額已更新。",
  "Billing unavailable": "帳務不可用",
  "Block": "封鎖",
  "Blocking…": "封鎖中…",
  "Close": "關閉",
  "Cluster node": "叢集節點",
  "Cluster nodes": "叢集節點",
  "Cluster": "叢集",
  "Cluster apps unavailable": "叢集應用暫不可用",
  "Cluster snapshot unavailable": "叢集快照不可用",
  "Compute": "算力",
  "Control plane version unavailable": "控制平面版本不可用",
  "CPU / Memory / Storage / Monthly": "CPU / 記憶體 / 儲存 / 每月",
  "CPU {value}": "CPU {value}",
  "CPU limit": "CPU 上限",
  "Delete app": "刪除應用",
  "Delete app?": "刪除應用？",
  "Delete is already queued.": "刪除已在佇列中。",
  "Delete user": "刪除使用者",
  "Delete user?": "刪除使用者？",
  "Disk {value}": "磁碟 {value}",
  "Edit billing": "編輯帳務",
  "Enter a non-negative USD amount with up to two decimal places.":
    "請輸入非負美元金額，最多兩位小數。",
  "Fugue apps and backing services placed on this machine.":
    "放置在這台機器上的 Fugue 應用與後端服務。",
  "Hot": "過熱",
  "Images {value}": "映像 {value}",
  "Internal address": "內部位址",
  "Keep admin": "保留管理員",
  "Last login": "上次登入",
  "Last update": "最近更新",
  "Limit {value}": "上限 {value}",
  "Live CPU, memory, and disk usage.": "即時 CPU、記憶體與磁碟用量。",
  "Make admin": "設為管理員",
  "Managed limit": "託管上限",
  "Managed limit updated.": "託管上限已更新。",
  "Memory {value}": "記憶體 {value}",
  "Memory limit": "記憶體上限",
  "Mixed": "混合",
  "Mixed release": "混合版本",
  "Monthly": "每月",
  "Monthly {value}": "每月 {value}",
  "Monthly preview unavailable": "每月預估不可用",
  "Namespace": "命名空間",
  "No apps are currently visible from the bootstrap scope.":
    "目前引導範圍內沒有可見的應用。",
  "No apps visible": "沒有可見的應用",
  "No balance": "無餘額",
  "No billing": "無帳務",
  "No cluster nodes are visible from the current bootstrap scope.":
    "目前引導範圍內沒有可見的叢集節點。",
  "No cluster nodes visible": "沒有可見的叢集節點",
  "No estimate": "暫無估算",
  "No Fugue app or backing service is currently scheduled onto this node.":
    "目前沒有 Fugue 應用或後端服務被排程到此節點上。",
  "No images": "沒有映像",
  "No product users have signed in yet.": "尚無產品使用者登入。",
  "No tag": "無標籤",
  "No users yet": "尚無使用者",
  "No workloads on this node": "此節點上沒有工作負載",
  "No workspace": "無工作區",
  "Nodes": "節點",
  "Not detected": "未偵測到",
  "Observed": "觀測時間",
  "Partial admin data: {details}.": "管理員資料部分可用：{details}。",
  "One or more control plane deployments are missing or below the desired rollout state.":
    "一個或多個控制平面部署缺失，或尚未達到目標發布狀態。",
  "Owned": "自有",
  "Phase": "階段",
  "Prepaid / status": "預付 / 狀態",
  "Pressure": "壓力",
  "Privilege change": "權限變更",
  "Process": "程序",
  "Promote user to admin?": "將使用者提升為管理員？",
  "Promoting…": "提升中…",
  "Provider": "提供者",
  "Public address": "公開位址",
  "Ready and pressure signals.": "就緒與壓力訊號。",
  "Rebuild": "重建",
  "Rebuild queued.": "重建已加入佇列。",
  "Rebuild requested.": "已請求重建。",
  "Rebuilding…": "重建中…",
  "Release {value}": "版本 {value}",
  "Remove admin": "移除管理員",
  "Remove admin access?": "移除管理員權限？",
  "Replicas": "副本",
  "Role": "角色",
  "Rolling": "滾動中",
  "Rolling release": "滾動發布版本",
  "Rollout": "發布",
  "Route": "路由",
  "Save balance": "儲存餘額",
  "Server": "伺服器",
  "Service usage": "服務用量",
  "Services {value}": "服務 {value}",
  "Services / CPU / Memory / Disk / Images":
    "服務 / CPU / 記憶體 / 磁碟 / 映像",
  "Set balance": "設定餘額",
  "Set CPU or memory to 0 to pause managed billing.":
    "將 CPU 或記憶體設為 0 可暫停託管帳務。",
  "Signals": "訊號",
  "Stack": "技術棧",
  "Status": "狀態",
  "Status {value}": "狀態 {value}",
  "Steady": "穩定",
  "Storage {value}": "儲存 {value}",
  "Storage limit": "儲存上限",
  "Shared": "共享",
  "Synced": "已同步",
  "The admin API could not resolve the current API and controller release.":
    "管理員 API 目前無法解析現有 API 與控制器版本。",
  "The saved limit is above the temporary control cap of 2 cpu / 4 GiB / 30 GiB storage. Save a new limit here to bring the user back inside the current range.":
    "已儲存的上限超過目前臨時控制上限 2 CPU / 4 GiB / 30 GiB 儲存。請在這裡儲存新的上限，讓使用者回到目前範圍內。",
  "Tenants": "租戶",
  "Unknown namespace": "未知命名空間",
  "Unknown release": "未知發布實例",
  "Unblock": "解除封鎖",
  "Unblocking…": "解除封鎖中…",
  "Unresolved deployment": "未解析的部署",
  "Updating…": "更新中…",
  "Usage": "用量",
  "User": "使用者",
  "User billing": "使用者帳務",
  "User blocked.": "使用者已封鎖。",
  "User deleted.": "使用者已刪除。",
  "User email": "使用者電子郵件",
  "User promoted to admin and restored.":
    "使用者已提升為管理員並恢復存取。",
  "User promoted to admin.": "使用者已提升為管理員。",
  "User unblocked.": "使用者已解除封鎖。",
  "Version unavailable": "版本不可用",
  "Watch": "留意",
  "Workloads": "工作負載",
  "Workspace access": "工作區存取",
  "Workspace access · granted {time}": "工作區存取 · 授予於 {time}",
  "Workspace access · updated {time}": "工作區存取 · 更新於 {time}",
  "Workspace email": "工作區電子郵件",
  "Workspace owners: {message}": "工作區擁有者：{message}",
  "{amount} allocatable": "{amount} 可分配",
  "{amount} capacity": "{amount} 容量",
  "{count} millicores": "{count} mCPU",
  "{count} pod": "{count} 個 Pod",
  "{count} pods": "{count} 個 Pod",
  "{email} can now deploy to this server.": "{email} 現在可以部署到此伺服器。",
  "{label} no longer has deploy access.": "{label} 已不再擁有部署存取權。",
  "{label} will no longer be able to deploy to this server.":
    "{label} 將不能再部署到此伺服器。",
  "{name} ({phase})": "{name}（{phase}）",
  "{price}/mo": "{price}/月",
  "{price}/mo reference": "{price}/月參考價",
  "{signals} pressure reported.": "已回報 {signals} 壓力。",
  "{value} CPU": "{value} CPU",
  "{value} GiB": "{value} GiB",
  "Access": "存取",
  "Access controls become available after the runtime finishes reporting.":
    "執行環境完成回報後才會提供存取控制。",
  "Add workspace": "新增工作區",
  "Allocatable unknown": "可分配容量未知",
  "Allow the internal cluster to deploy here": "允許內部叢集部署到這裡",
  "Anyone can deploy here without paying you while this stays on.":
    "開啟後，任何人都可以免費部署到這裡。",
  "Any workspace can deploy here. {details}": "任何工作區都可部署到這裡。{details}",
  "Any workspace can deploy directly here. Internal cluster scheduling stays separate.":
    "任何工作區都可以直接部署到這裡。內部叢集排程維持獨立。",
  "Apps and services on this server.": "此伺服器上的應用與服務。",
  "Attached server": "接入伺服器",
  "Capacity unknown": "容量未知",
  "Choose who can deploy here": "選擇誰可以在這裡部署",
  "Cluster capacity": "叢集容量",
  "Cluster enabled": "已啟用叢集",
  "Cluster nodes: {message}": "叢集節點：{message}",
  "Control internal scheduling": "控制內部排程",
  "cores": "核心",
  "Dedicated": "專用",
  "Dedicated only": "僅專用",
  "Discard changes": "放棄變更",
  "Discard pricing changes?": "放棄定價變更？",
  "Edit pricing": "編輯定價",
  "Enter a non-negative CPU value with up to three decimals.":
    "請輸入非負 CPU 數值，最多保留三位小數。",
  "Enter a whole, non-negative disk size in GiB.":
    "請輸入以 GiB 為單位的非負整數磁碟大小。",
  "Enter an email address.": "請輸入電子郵件地址。",
  "Expand a server for access, capacity, and placement.":
    "展開伺服器以查看存取、容量與放置資訊。",
  "Free": "免費",
  "Free for everyone": "所有人免費",
  "Free for all deployers.": "對所有部署者免費。",
  "Fugue could not load the server inventory right now.":
    "Fugue 目前無法載入伺服器清單。",
  "Grant specific workspaces": "授予指定工作區",
  "Grant specific workspaces access without opening the server to everyone.":
    "無需對所有人開放伺服器，也能授予指定工作區存取權。",
  "Granted": "已授權",
  "Heartbeat": "心跳",
  "Heartbeat {time}": "心跳 {time}",
  "Internal": "內部",
  "Internal cluster access": "內部叢集存取",
  "Internal cluster access is enabled. Node reconciliation will follow when the server is reachable.":
    "內部叢集存取已啟用。伺服器可達後會繼續節點收斂。",
  "Internal cluster access removed.": "內部叢集存取已移除。",
  "Internal cluster access removed. Node reconciliation will follow when the server is reachable.":
    "內部叢集存取已移除。伺服器可達後會繼續節點收斂。",
  "Internal cluster can also deploy here.": "內部叢集也可以部署到這裡。",
  "Internal cluster can now deploy to this server.":
    "內部叢集現在可以部署到此伺服器。",
  "Internal cluster capacity": "內部叢集容量",
  "Internal cluster enabled": "已啟用內部叢集",
  "Joined": "加入時間",
  "Last saved {time}.": "上次儲存於 {time}。",
  "Keep direct grants only if you need them": "僅在需要時保留定向授權",
  "Keep one resource free while charging for the rest.":
    "可以只讓某一類資源免費，其餘資源繼續收費。",
  "Latest heartbeat": "最近心跳",
  "Loading access roster…": "正在載入存取名單…",
  "Machine": "機器",
  "Managed as shared capacity": "作為共享容量管理",
  "Managed centrally as shared system capacity.":
    "作為共享系統容量由平台集中管理。",
  "Manage access keys": "管理存取金鑰",
  "Memory free": "記憶體免費",
  "Memory must be greater than 0 unless memory is free.":
    "除非記憶體免費，否則記憶體值必須大於 0。",
  "Monthly price": "月價格",
  "No active pods reported": "未回報活躍 Pod",
  "No additional workspace access yet.": "還沒有額外的工作區存取權限。",
  "No apps or services are placed on this server.":
    "此伺服器上還沒有放置任何應用或服務。",
  "No direct workspace grants saved yet.": "尚未儲存任何直接工作區授權。",
  "No public pricing saved yet.": "尚未儲存公開定價。",
  "No signal reported": "尚未回報訊號",
  "No servers visible yet": "還沒有可見的伺服器",
  "No workloads on this server": "此伺服器上沒有工作負載",
  "Not configured yet": "尚未設定",
  "Only admins can allow the internal cluster to deploy here":
    "只有管理員可以允許內部叢集部署到這裡",
  "Only your workspace and direct grants can deploy here.":
    "只有你的工作區和直接授權的工作區可以部署到這裡。",
  "Open node keys": "開啟節點金鑰",
  "Optional free resources": "可選免費資源",
  "Optional. Keep grants only if you may switch back to private later.":
    "可選。如果你之後可能切回私有，再保留這些授權。",
  "Owner": "擁有者",
  "Part of Fugue shared capacity.": "屬於 Fugue 共享容量的一部分。",
  "Partial server data: {details}.": "伺服器資料部分可用：{details}。",
  "Platform shared": "平台共享",
  "Public access is already open to every workspace. Direct grants stay useful if you later switch back to private.":
    "公開存取已對所有工作區開放。如果之後要切回私有，直接授權仍然有用。",
  "Pricing is configured after you switch this server to Public.":
    "切換為公開伺服器後才能設定定價。",
  "Public + cluster": "公開 + 叢集",
  "Public access enabled": "已啟用公開存取",
  "Public by {label}": "由 {label} 公開",
  "Public by {label}. {details}": "由 {label} 公開。{details}",
  "Public machine": "公開機器",
  "Public pricing": "公開定價",
  "Public pricing saved.": "公開定價已儲存。",
  "Public server": "公開伺服器",
  "Public server by {label}": "{label} 的公開伺服器",
  "Ready": "就緒",
  "Reference {bundle} at {price}.": "參考配置 {bundle}，價格 {price}。",
  "Reference CPU cores": "參考 CPU 核心數",
  "Reference memory in GiB": "參考記憶體（GiB）",
  "Reference monthly price for that bundle": "該參考配置的月價格",
  "Reference persistent disk in GiB": "參考持久磁碟（GiB）",
  "Reference price not set": "參考價格尚未設定",
  "Reference pricing": "參考定價",
  "Reference pricing starts at {price}.": "參考定價起於 {price}。",
  "Remove access": "移除存取",
  "Removing…": "移除中…",
  "Remove workspace access?": "移除工作區存取權限？",
  "Runtimes: {message}": "執行環境：{message}",
  "Runtime": "執行環境",
  "Runtime state": "執行環境狀態",
  "Runtime visibility": "執行環境可見性",
  "Save pricing": "儲存定價",
  "Saved {time}": "儲存於 {time}",
  "Server inventory": "伺服器清單",
  "Server inventory unavailable": "伺服器清單不可用",
  "Server summary": "伺服器摘要",
  "Service": "服務",
  "Set one reference bundle": "設定一個參考配置",
  "Set pricing": "設定定價",
  "Separate from public deploy access.": "與公開部署存取分開。",
  "Shared by {label}": "由 {label} 共享",
  "Shared by {label}.": "由 {label} 共享。",
  "Shared capacity · managed centrally": "共享容量 · 集中管理",
  "Shared machine": "共享機器",
  "Shared server": "共享伺服器",
  "Shared with this workspace": "已與此工作區共享",
  "Shared with your workspace.": "已與你的工作區共享。",
  "Skip pricing and let anyone deploy here at no cost.":
    "略過定價，讓任何人都能免費部署到這裡。",
  "System": "系統",
  "System access · internal cluster can deploy here":
    "系統存取 · 內部叢集可部署到這裡",
  "System access is not enabled": "系統存取未啟用",
  "The recipient needs to sign in to Fugue and finish workspace setup first.":
    "接收方需要先登入 Fugue 並完成工作區設定。",
  "This server is now private again.": "此伺服器現已恢復為私有。",
  "This server is now public to every workspace.":
    "此伺服器現已對所有工作區公開。",
  "Use one representative bundle and monthly price. Fugue derives unit CPU, memory, and disk pricing from it.":
    "使用一個代表性的配置和月價格。Fugue 會據此推導 CPU、記憶體與磁碟的單價。",
  "Use shared capacity in this region.": "在此區域使用共享容量。",
  "Visibility": "可見性",
  "Waiting for complete node health telemetry.":
    "等待完整節點健康遙測。",
  "Waiting for first heartbeat": "等待首次心跳",
  "Waiting for workload details": "等待工作負載詳情",
  "Your public pricing draft will be lost if you close this dialog now.":
    "如果現在關閉此對話框，公開定價草稿將遺失。",
  "Zone": "可用區",
  "CPU free": "CPU 免費",
  "CPU must be greater than 0 unless CPU is free.":
    "除非 CPU 免費，否則 CPU 值必須大於 0。",
  "Disk free": "磁碟免費",
  "Disk must be greater than 0 unless disk is free.":
    "除非磁碟免費，否則磁碟值必須大於 0。",
} satisfies MessageCatalog;

const catalogs: Record<Locale, MessageCatalog> = {
  en: {
    ...enMessages,
  },
  "zh-CN": {
    ...zhCNMessages,
    ...zhCNExtraMessages,
  },
  "zh-TW": {
    ...zhTWMessages,
    ...zhTWExtraMessages,
  },
};

function interpolateMessage(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function normalizeLanguageTag(value: string) {
  return value
    .trim()
    .replace(/_/g, "-")
    .split("-")
    .filter(Boolean);
}

export function resolveLocale(value?: string | null): Locale {
  const fallback: Locale = "en";

  if (!value) {
    return fallback;
  }

  try {
    const normalized = new Intl.Locale(value);
    const language = normalized.language.toLowerCase();

    if (language !== "zh") {
      return "en";
    }

    const script = normalized.script?.toUpperCase() ?? null;
    const region = normalized.region?.toUpperCase() ?? null;

    if ((script && TRADITIONAL_SCRIPTS.has(script)) || (region && TRADITIONAL_REGIONS.has(region))) {
      return "zh-TW";
    }

    return "zh-CN";
  } catch {
    const [language, scriptOrRegion, region] = normalizeLanguageTag(value);

    if (!language || language.toLowerCase() !== "zh") {
      return "en";
    }

    const upperScriptOrRegion = scriptOrRegion?.toUpperCase() ?? null;
    const upperRegion = region?.toUpperCase() ?? null;

    if (
      (upperScriptOrRegion && (TRADITIONAL_SCRIPTS.has(upperScriptOrRegion) || TRADITIONAL_REGIONS.has(upperScriptOrRegion))) ||
      (upperRegion && TRADITIONAL_REGIONS.has(upperRegion))
    ) {
      return "zh-TW";
    }

    return "zh-CN";
  }
}

export function negotiateLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) {
    return "en";
  }

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const score = quality ? Number.parseFloat(quality.trim().slice(2)) : 1;

      return {
        score: Number.isFinite(score) ? score : 0,
        tag: tag.trim(),
      };
    })
    .filter((candidate) => candidate.tag.length > 0)
    .sort((left, right) => right.score - left.score);

  for (const candidate of candidates) {
    const locale = resolveLocale(candidate.tag);

    if (locale) {
      return locale;
    }
  }

  return "en";
}

export function translate(locale: Locale, key: string, values?: TranslationValues) {
  const catalog = catalogs[locale];
  const template = catalog[key] ?? key;
  return interpolateMessage(template, values);
}

export function createTranslator(locale: Locale) {
  return (key: string, values?: TranslationValues) => translate(locale, key, values);
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTime(
  locale: Locale,
  value?: string | number | Date | null,
  options?: {
    justNowText?: string;
    notYetText?: string;
  },
) {
  if (value === null || value === undefined) {
    return options?.notYetText ?? translate(locale, "Not yet");
  }

  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return options?.notYetText ?? translate(locale, "Not yet");
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.trunc(valueForUnit), unit);
    }

    valueForUnit /= amount;
  }

  return options?.justNowText ?? translate(locale, "Just now");
}

export function formatDateTime(
  locale: Locale,
  value?: string | number | Date | null,
  options?: {
    emptyText?: string;
    formatOptions?: Intl.DateTimeFormatOptions;
  },
) {
  if (value === null || value === undefined) {
    return options?.emptyText ?? translate(locale, "Not yet");
  }

  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return options?.emptyText ?? translate(locale, "Not yet");
  }

  return new Intl.DateTimeFormat(locale, options?.formatOptions ?? { dateStyle: "medium", timeStyle: "short" }).format(
    timestamp,
  );
}

export function readRegionDisplayName(locale: Locale, code: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? null;
  } catch {
    return null;
  }
}

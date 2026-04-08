export const SUPPORTED_LOCALES = ["en", "zh-CN", "zh-TW"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationValues = Record<string, string | number>;

type MessageCatalog = Partial<Record<string, string>>;

const TRADITIONAL_REGIONS = new Set(["HK", "MO", "TW"]);
const TRADITIONAL_SCRIPTS = new Set(["HANT"]);

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
  "Deploy apps from source": "从源码部署应用",
  "Deploy completes only after the new Kubernetes rollout is ready.":
    "只有新的 Kubernetes 发布就绪后，部署才会完成。",
  "Deploy completes only after the new Kubernetes rollout is ready and old replicas have drained.":
    "只有新的 Kubernetes 发布就绪且旧副本全部退出后，部署才会完成。",
  "Deploy from source, shared first": "从源码部署，先用共享环境",
  "Deploy onto a machine shared with this workspace.": "部署到此工作区共享的机器上。",
  "Deploy onto a machine.": "部署到机器上。",
  "Deploy onto the internal cluster.": "部署到内部集群。",
  "Deploy onto this machine.": "部署到这台机器上。",
  "Deploy onto this machine. It also contributes to the internal cluster.":
    "部署到这台机器上。它也会为内部集群提供容量。",
  "Docker image": "Docker 镜像",
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
    "Fugue 先在共享基础设施上部署 GitHub 仓库、Docker 镜像和本地上传内容，然后让团队在不丢失路由的前提下把同一个应用迁移到自有机器。",
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
  "Move cleanly.": "平滑迁移。",
  "Move to your own machine without changing the route.": "迁移到你的机器上，同时保持路由不变。",
  "Need a fresh account boundary?": "需要新的账号边界？",
  "New variable": "新变量",
  "Next release": "下一个版本",
  "No current status message.": "当前没有状态消息。",
  "No environment changes.": "环境变量没有变化。",
  "No log lines were received before the stream closed.": "流关闭前没有收到任何日志。",
  "No logs available.": "没有可用日志。",
  "No stats": "没有统计数据",
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
    "先从 GitHub 仓库、已发布的 Docker 镜像或本地上传开始，运行在托管共享 k3s 上。之后同一个应用可以迁移到你的自有机器，而无需重建路由或更改工作流。",
  "Start from a repository, Docker image, or uploaded bundle.":
    "从仓库、Docker 镜像或上传的包开始。",
  "Start queued at 1 replica.": "已加入启动队列，副本数为 1。",
  "Start shared.": "先在共享环境启动。",
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
  "Watch": "关注",
  "We are converting the provider callback into a first-party session before opening the destination route.":
    "我们正在把提供方回调转换成第一方会话，然后再打开目标路由。",
  "We send one verification link. No password required.": "我们会发送一个验证链接。无需密码。",
  "We verify the email locally and open the session immediately.": "我们会在本地验证邮箱并立即打开会话。",
  "Working": "处理中",
  "Workspace": "工作区",
  "You have been signed out.": "你已退出登录。",
  "You can continue to the console.": "你可以继续前往控制台。",
  "you@company.com": "you@company.com",
} satisfies MessageCatalog;

const zhTWMessages = {
  ...zhCNMessages,
  "{count} byte": "{count} 位元組",
  "{count} bytes": "{count} 位元組",
  "Access keys": "存取金鑰",
  "Add service": "新增服務",
  "Adding…": "新增中…",
  "App name": "應用名稱",
  "Auth / Finalize": "認證 / 完成",
  "Auth / Sign in": "認證 / 登入",
  "Auth / Sign up": "認證 / 註冊",
  "Back to sign in": "返回登入",
  "Billing": "帳務",
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
  "Get started": "開始使用",
  "Loading projects": "正在載入專案",
  "Loading console page": "正在載入控制台頁面",
  "Move cleanly.": "平順遷移。",
  "New variable": "新變數",
  "Not yet": "尚未",
  "Open menu": "開啟選單",
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
  "Waiting in queue": "排隊中",
  "Working": "處理中",
  "You have been signed out.": "你已登出。",
} satisfies MessageCatalog;

const zhCNExtraMessages = {
  "After sign-in, this page reopens in Local upload mode so you can drag the folder directly into the browser.":
    "登录后，此页面会以“本地上传”模式重新打开，你可以直接把文件夹拖进浏览器。",
  "Already have access?": "已有访问权限？",
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
  "Route, sign-in, and the app already share one system.": "路由、登录和应用现在已经是同一个系统。",
  "Routes": "路径",
  "Routed": "已路由",
  "Service port": "服务端口",
  "shared": "共享",
  "Sign in without breaking the product flow.": "在不打断产品流程的情况下完成登录。",
  "Sign-in handoff": "登录切换",
  "Sign-in method": "登录方式",
  "Sign-in route": "登录路径",
  "Sign-up route": "注册路径",
  "source": "源码",
  "Stored secret / Current account email": "已保存密钥 / 当前账号邮箱",
  "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.":
    "通往公开 URL 的最快路径，不应该把应用困在一次性环境里。在 Fugue 中，路由保持稳定，运行时可以变化：先导入源码、在共享基础设施上上线，准备好后再迁移到你的机器。",
  "The provider identity is already verified. We are now finishing sign-in with a same-origin form POST so Safari can treat the session write like a regular first-party login redirect.":
    "提供方身份已经验证完成。我们现在通过同源表单 POST 完成登录，这样 Safari 会把会话写入视为一次普通的第一方登录跳转。",
  "The route is the product.": "路由本身就是产品。",
  "Use a public image reference to unlock the deploy form after sign-in.":
    "使用公开镜像引用，即可在登录后解锁部署表单。",
  "Validation / Failure / Retry": "校验 / 失败 / 重试",
  "Workspace / Project / App": "工作区 / 项目 / 应用",
} satisfies MessageCatalog;

const zhTWExtraMessages = {
  "After sign-in, this page reopens in Local upload mode so you can drag the folder directly into the browser.":
    "登入後，此頁面會以「本機上傳」模式重新開啟，你可以直接把資料夾拖進瀏覽器。",
  "Already have access?": "已經有存取權限？",
  "Back to top": "返回頂部",
  "Copied": "已複製",
  "Copy command": "複製命令",
  "Copy manually": "請手動複製",
  "Create an account": "建立帳號",
  "Deleted": "已刪除",
  "Docker image import also available": "也支援匯入 Docker 映像",
  "Envelope / Balance / Metering": "儲值 / 餘額 / 計量",
  "Finalize": "完成",
  "First party / HttpOnly cookie": "第一方 / HttpOnly Cookie",
  "Footer": "頁腳",
  "Gallery / Services / Controls": "畫廊 / 服務 / 控制",
  "GitHub import example": "GitHub 匯入範例",
  "Google / Email / Verified identity": "Google / 電子郵件 / 已驗證身分",
  "Health / Heartbeat / Workloads": "健康 / 心跳 / 工作負載",
  "Loading apps": "正在載入應用",
  "Loading profile settings": "正在載入個人資料設定",
  "Loading users": "正在載入使用者",
  "Magic link / Resend / Callback": "魔法連結 / 重送 / 回呼",
  "Managed shared runtime": "託管共享執行環境",
  "Mobile": "行動端",
  "Nodes / Pressure / Workloads": "節點 / 壓力 / 工作負載",
  "OAuth / Profile / Verified email": "OAuth / 個人資料 / 已驗證電子郵件",
  "OAuth / Verified email": "OAuth / 已驗證電子郵件",
  "OAuth / Verified email / Linked account": "OAuth / 已驗證電子郵件 / 已連結帳號",
  "Operation": "操作",
  "Optional": "可選",
  "Post-auth": "驗證後",
  "Primary": "主導覽",
  "Private GitHub repositories require GitHub authorization or a GitHub token with repository read access.":
    "私有 GitHub 儲存庫需要 GitHub 授權，或提供具備儲存庫讀取權限的 GitHub Token。",
  "Provider callback": "提供者回呼",
  "Quickstart": "快速開始",
  "Repository / Image / Upload": "儲存庫 / 映像 / 上傳",
  "Repository import": "儲存庫匯入",
  "Route, sign-in, and the app already share one system.": "路由、登入與應用現在已經共用同一套系統。",
  "Routes": "路徑",
  "Routed": "已路由",
  "Service port": "服務埠",
  "shared": "共享",
  "Sign in without breaking the product flow.": "在不打斷產品流程的情況下登入。",
  "Sign-in handoff": "登入切換",
  "Sign-in method": "登入方式",
  "Sign-in route": "登入路徑",
  "Sign-up route": "註冊路徑",
  "source": "原始碼",
  "Stored secret / Current account email": "已儲存密鑰 / 目前帳號電子郵件",
  "The fastest path to a public URL should not trap the app in a throwaway setup. In Fugue, the route stays stable while the runtime changes: import the source, go live on shared infrastructure, then migrate onto your own machine when you are ready.":
    "通往公開 URL 的最快路徑，不該把應用困在一次性環境中。在 Fugue 裡，路由保持穩定，執行環境可以改變：先匯入原始碼、在共享基礎設施上線，準備好後再遷移到你的機器。",
  "The provider identity is already verified. We are now finishing sign-in with a same-origin form POST so Safari can treat the session write like a regular first-party login redirect.":
    "提供者身分已完成驗證。我們現在透過同源表單 POST 完成登入，讓 Safari 將這次會話寫入視為一般的第一方登入跳轉。",
  "The route is the product.": "路由本身就是產品。",
  "Use a public image reference to unlock the deploy form after sign-in.":
    "使用公開映像引用，即可在登入後解鎖部署表單。",
  "Validation / Failure / Retry": "驗證 / 失敗 / 重試",
  "Workspace / Project / App": "工作區 / 專案 / 應用",
} satisfies MessageCatalog;

const catalogs: Record<Locale, MessageCatalog> = {
  en: {},
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

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
  "Duplicate env keys: {keys}.": "环境变量键重复：{keys}。",
  "Empty": "空",
  "Empty response.": "空响应。",
  "Enabling": "启用中",
  "Envelope updated": "容量包已更新",
  "Event": "事件",
  "Fugue is creating the project and packaging the uploaded files on the server before the first build starts.":
    "Fugue 正在创建项目，并在首次构建开始前于服务器端打包已上传的文件。",
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
} satisfies MessageCatalog;

const zhTWExtraMessages = {
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
  "Loading": "正在載入",
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
  "Reset": "重設",
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
  "Unable to load the current custom domain right now.":
    "目前無法載入現有自訂網域。",
  "Unavailable": "不可用",
  "Use a public image reference to unlock the deploy form after sign-in.":
    "使用公開映像引用，即可在登入後解鎖部署表單。",
  "Use a hostname you control, like app.example.com or example.com.":
    "使用你可控制的主機名稱，例如 app.example.com 或 example.com。",
  "Validation / Failure / Retry": "驗證 / 失敗 / 重試",
  "Workspace / Project / App": "工作區 / 專案 / 應用",
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
  "Duplicate env keys: {keys}.": "環境變數鍵重複：{keys}。",
  "Empty": "空",
  "Empty response.": "空回應。",
  "Enabling": "啟用中",
  "Envelope updated": "容量包已更新",
  "Event": "事件",
  "Fugue is creating the project and packaging the uploaded files on the server before the first build starts.":
    "Fugue 正在建立專案，並在第一次構建開始前於伺服器端打包已上傳的檔案。",
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

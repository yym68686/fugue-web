const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "第三方登录已取消。",
  oauth_failed: "第三方登录失败，请重试。",
  "invalid-credentials": "邮箱或密码不正确。",
  "invalid-token": "登录链接无效或已过期，请重新获取。",
  "session-open-failed": "无法打开会话，请重试。",
  "handoff-failed": "登录未能完成，请重试。",
  "auth-required": "请先登录以继续。",
  "account-blocked": "该账号已被封禁。",
  "account-deleted": "该账号已被删除。",
};

export function readAuthErrorMessage(
  error?: string | string[],
): string | undefined {
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) return undefined;
  return ERROR_MESSAGES[code] ?? "登录时发生错误，请重试。";
}

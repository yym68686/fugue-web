import { getAuthEnv } from "@/lib/auth/env";
import { escapeHtmlAttribute, escapeHtmlText } from "@/lib/auth/html";

type SendVerificationEmailArgs = {
  email: string;
  verifyUrl: string;
  mode: "signin" | "signup";
  name?: string;
};

function buildSubject(mode: "signin" | "signup") {
  return mode === "signup" ? "Verify your Fugue account" : "Sign in to Fugue";
}

function buildHtml({ verifyUrl, mode, name }: SendVerificationEmailArgs) {
  const action = mode === "signup" ? "verify your email" : "finish signing in";
  const actionTitle = mode === "signup" ? "Verify your email" : "Finish signing in";
  const greeting = name ? `Hi ${escapeHtmlText(name)},` : "Hi,";
  const safeVerifyUrl = escapeHtmlAttribute(verifyUrl);

  return `
    <div style="background:#f6f7f8;padding:32px 20px;color:#17191c;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:540px;margin:0 auto;border:1px solid #d8dde3;border-radius:8px;background:#ffffff;overflow:hidden;box-shadow:0 1px 2px rgba(23,25,28,0.06);">
        <div style="padding:28px 28px 0;">
          <p style="margin:0 0 12px;color:#646b73;font-size:12px;letter-spacing:0.04em;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">Fugue / Auth</p>
          <h1 style="margin:0;font-size:28px;line-height:1.2;letter-spacing:-0.025em;">${actionTitle}</h1>
        </div>
        <div style="padding:20px 28px 28px;color:#646b73;font-size:16px;line-height:1.65;">
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 20px;">Use the secure link below to ${action}. This link expires in 15 minutes.</p>
          <p style="margin:0 0 24px;">
            <a href="${safeVerifyUrl}" style="display:inline-block;padding:11px 16px;border:1px solid #1463ff;border-radius:6px;background:#1463ff;color:#ffffff;font-weight:700;text-decoration:none;">
              Continue
            </a>
          </p>
          <p style="margin:0;color:#8b929a;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  `;
}

function buildText({ verifyUrl, mode, name }: SendVerificationEmailArgs) {
  const action = mode === "signup" ? "verify your email" : "finish signing in";
  const greeting = name ? `Hi ${name},` : "Hi,";

  return `${greeting}

Use the link below to ${action} with Fugue:

${verifyUrl}

This link expires in 15 minutes. If you did not request this, you can ignore this email.
`;
}

export async function sendVerificationEmail(args: SendVerificationEmailArgs) {
  const authEnv = getAuthEnv();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authEnv.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: authEnv.resendFromEmail,
      to: [args.email],
      subject: buildSubject(args.mode),
      html: buildHtml(args),
      text: buildText(args),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send verification email: ${payload}`);
  }
}

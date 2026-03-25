import { getAuthEnv } from "@/lib/auth/env";

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
  const greeting = name ? `Hi ${name},` : "Hi,";

  return `
    <div style="background:#040506;padding:32px 20px;color:#f4efe7;font-family:Manrope,system-ui,sans-serif;">
      <div style="max-width:540px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:24px;background:linear-gradient(145deg,rgba(16,22,29,0.98),rgba(7,10,14,0.96));overflow:hidden;">
        <div style="padding:28px 28px 0;">
          <p style="margin:0 0 12px;color:#a5bfdc;font-size:12px;letter-spacing:0.1em;font-family:'IBM Plex Mono',ui-monospace,monospace;">fugue / auth</p>
          <h1 style="margin:0;font-family:Syne,system-ui,sans-serif;font-size:40px;line-height:0.95;letter-spacing:-0.06em;">${action}</h1>
        </div>
        <div style="padding:20px 28px 28px;color:#c9c1b4;font-size:16px;line-height:1.7;">
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 20px;">Use the secure link below to ${action}. This link expires in 15 minutes.</p>
          <p style="margin:0 0 24px;">
            <a href="${verifyUrl}" style="display:inline-flex;align-items:center;gap:10px;padding:14px 16px 14px 20px;border:1px solid rgba(255,255,255,0.14);border-radius:999px;background:linear-gradient(145deg,rgba(244,239,231,0.98),rgba(224,215,202,0.94));color:#050608;font-weight:700;text-decoration:none;">
              Continue
            </a>
          </p>
          <p style="margin:0;color:#8f8a82;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
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

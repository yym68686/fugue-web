"use client";

import { useEffect, useRef, useState } from "react";

export function FinalizePanel() {
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const value = window.location.hash.replace(/^#/, "").trim();
    setToken(value);
    // Auto-complete as soon as a token is present.
    if (value) {
      setSubmitting(true);
      // Defer to allow the hidden input value to render.
      requestAnimationFrame(() => formRef.current?.submit());
    }
  }, []);

  const missing = token === "";

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1>正在完成登录</h1>
        <p>正在安全地建立你的会话，请稍候…</p>
      </div>

      {missing ? (
        <div className="auth-alert" role="alert" style={{ marginBottom: 14 }}>
          未找到登录令牌。请重新发起登录。
        </div>
      ) : (
        <div className="auth-alert ok" style={{ marginBottom: 14 }}>
          {submitting ? "正在建立会话…" : "登录令牌已就绪。"}
        </div>
      )}

      <form
        ref={formRef}
        action="/auth/finalize/complete"
        method="post"
        className="auth-form"
        onSubmit={() => setSubmitting(true)}
      >
        <input name="token" readOnly type="hidden" value={token ?? ""} />
        <button
          type="submit"
          className="btn primary block"
          disabled={!token || submitting}
        >
          {submitting ? "处理中…" : "完成登录"}
        </button>
      </form>

      <div className="auth-foot">
        遇到问题？<a href="/auth/sign-in">重新登录</a>
      </div>
    </div>
  );
}

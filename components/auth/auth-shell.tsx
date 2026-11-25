import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap auth-single">
      <header className="auth-home">
        <a className="auth-brand" href="/">
          <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14M8 13 H24M2 18 H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <b>Fugue</b>
        </a>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { Button, ButtonAnchor } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useI18n } from "@/components/providers/i18n-provider";

type AuthFinalizePanelProps = {
  returnTo: string;
};

const MANUAL_RETRY_READY_MS = 2500;

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function readHandoffTokenFromHash() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const token = rawHash.trim();

  if (!token) {
    return null;
  }

  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return token;
}

export function AuthFinalizePanel({ returnTo }: AuthFinalizePanelProps) {
  const { t } = useI18n();
  const autoStartRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }

      mountedRef.current = false;
    };
  }, []);

  function armRetryFallback() {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setBusy(false);
    }, MANUAL_RETRY_READY_MS);
  }

  useEffect(() => {
    const handoffToken = readHandoffTokenFromHash();

    if (!handoffToken) {
      setBusy(false);
      setError(t("This sign-in handoff is missing or expired. Start again from the sign-in page."));
      return;
    }

    setToken(handoffToken);
  }, []);

  async function submitSessionHandoff() {
    if (!mountedRef.current || !token || !formRef.current) {
      if (mountedRef.current && !token) {
        setBusy(false);
      }

      return;
    }

    setBusy(true);
    setError(null);
    armRetryFallback();
    await wait(80);
    formRef.current.requestSubmit();
  }

  useEffect(() => {
    if (autoStartRef.current || !token) {
      return;
    }

    autoStartRef.current = true;
    void submitSessionHandoff();
  }, [token]);

  return (
    <Panel>
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">{t("Session handoff")}</p>
        <PanelTitle>{t("Opening the console with a first-party session.")}</PanelTitle>
        <PanelCopy>
          {t(
            "The provider identity is already verified. We are now finishing sign-in with a same-origin form POST so Safari can treat the session write like a regular first-party login redirect.",
          )}
        </PanelCopy>
      </PanelSection>

      <PanelSection>
        <InlineAlert variant={error ? "error" : "info"}>
          {error ?? t("Completing sign-in. If the browser stays here, continue manually once.")}
        </InlineAlert>
        <div style={{ height: "1rem" }} aria-hidden="true" />
        <form
          action="/auth/finalize/complete"
          method="post"
          onSubmit={() => {
            setBusy(true);
            setError(null);
            armRetryFallback();
          }}
          ref={formRef}
        >
          <input name="token" type="hidden" value={token} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <div className="fg-provider-stack">
            <Button
              disabled={!token}
              loading={busy}
              loadingLabel={t("Opening the console")}
              type="button"
              onClick={() => {
                void submitSessionHandoff();
              }}
              variant="secondary"
            >
              {t("Continue to the console")}
            </Button>
          </div>
        </form>
        <div style={{ height: "0.85rem" }} aria-hidden="true" />
        <div className="fg-provider-stack">
          <ButtonAnchor href="/auth/sign-in" variant="ghost">
            {t("Back to sign in")}
          </ButtonAnchor>
        </div>
      </PanelSection>
    </Panel>
  );
}

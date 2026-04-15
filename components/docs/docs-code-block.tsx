"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { ProofShell, ProofShellRibbon } from "@/components/ui/proof-shell";
import { copyText } from "@/lib/ui/clipboard";
import {
  ensurePrismLanguage,
  highlightCode,
  isPrismLanguageReady,
  type PrismCodeLanguage,
} from "@/lib/ui/prism";
import { cx } from "@/lib/ui/cx";

export function DocsCodeBlock({
  caption,
  className,
  code,
  copyLabel,
  copiedLabel,
  filename,
  language,
  title,
}: {
  caption?: string;
  className?: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  filename?: string;
  language: PrismCodeLanguage;
  title: string;
}) {
  const deferredCode = useDeferredValue(code);
  const [copied, setCopied] = useState(false);
  const [readyLanguage, setReadyLanguage] = useState<PrismCodeLanguage>(() =>
    isPrismLanguageReady(language) ? language : "plain",
  );

  useEffect(() => {
    let cancelled = false;

    if (isPrismLanguageReady(language)) {
      setReadyLanguage(language);
      return () => {
        cancelled = true;
      };
    }

    setReadyLanguage("plain");

    if (language === "plain") {
      return () => {
        cancelled = true;
      };
    }

    void ensurePrismLanguage(language)
      .then(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setReadyLanguage(isPrismLanguageReady(language) ? language : "plain");
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setReadyLanguage("plain");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const highlightedMarkup = useMemo(() => {
    const tail =
      deferredCode.length === 0 ? " " : deferredCode.endsWith("\n") ? "\n" : "";

    return highlightCode(deferredCode, readyLanguage) + tail;
  }, [deferredCode, readyLanguage]);

  return (
    <ProofShell className={cx("fg-docs-code-block", className)}>
      <ProofShellRibbon className="fg-docs-code-block__ribbon">
        <div className="fg-docs-code-block__head">
          <div className="fg-docs-code-block__meta">
            <strong>{title}</strong>
            {caption ? <p>{caption}</p> : null}
          </div>

          <div className="fg-docs-code-block__actions">
            {filename ? (
              <span className="fg-docs-code-block__filename">{filename}</span>
            ) : null}
            <Button
              className="fg-docs-code-block__copy"
              onClick={() => {
                void copyText(code).then((success) => {
                  if (success) {
                    setCopied(true);
                  }
                });
              }}
              size="compact"
              type="button"
              variant="secondary"
            >
              {copied ? copiedLabel : copyLabel}
            </Button>
          </div>
        </div>
      </ProofShellRibbon>

      <pre className="fg-docs-code-block__pre">
        <code
          className={cx("language-" + readyLanguage)}
          dangerouslySetInnerHTML={{ __html: highlightedMarkup }}
        />
      </pre>
    </ProofShell>
  );
}

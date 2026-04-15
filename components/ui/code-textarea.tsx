"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ensurePrismLanguage,
  highlightCode,
  inferPrismLanguage,
  isPrismLanguageReady,
  type PrismCodeLanguage,
} from "@/lib/ui/prism";
import { cx } from "@/lib/ui/cx";

export type CodeTextareaLanguage = PrismCodeLanguage;

type CodeTextareaProps = {
  ariaLabel: string;
  className?: string;
  id?: string;
  language?: CodeTextareaLanguage;
  onChange?: (value: string) => void;
  path?: string | null;
  readOnly?: boolean;
  spellCheck?: boolean;
  value: string;
};

function syncHighlightScroll(
  textarea: HTMLTextAreaElement | null,
  highlight: HTMLPreElement | null,
) {
  if (!textarea || !highlight) {
    return;
  }

  highlight.scrollLeft = textarea.scrollLeft;
  highlight.scrollTop = textarea.scrollTop;
}

export function CodeTextarea({
  ariaLabel,
  className,
  id,
  language,
  onChange,
  path,
  readOnly = false,
  spellCheck = false,
  value,
}: CodeTextareaProps) {
  const inferredLanguage = language ?? inferPrismLanguage(path);
  const deferredValue = useDeferredValue(value);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [readyLanguage, setReadyLanguage] = useState<CodeTextareaLanguage>(
    () => (isPrismLanguageReady(inferredLanguage) ? inferredLanguage : "plain"),
  );

  useEffect(() => {
    let cancelled = false;

    if (isPrismLanguageReady(inferredLanguage)) {
      setReadyLanguage(inferredLanguage);
      return () => {
        cancelled = true;
      };
    }

    setReadyLanguage("plain");

    if (inferredLanguage === "plain") {
      return () => {
        cancelled = true;
      };
    }

    void ensurePrismLanguage(inferredLanguage)
      .then(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setReadyLanguage(
            isPrismLanguageReady(inferredLanguage) ? inferredLanguage : "plain",
          );
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
  }, [inferredLanguage]);

  const highlightedMarkup = useMemo(() => {
    const tail =
      deferredValue.length === 0 ? " " : deferredValue.endsWith("\n") ? "\n" : "";

    return highlightCode(deferredValue, readyLanguage) + tail;
  }, [deferredValue, readyLanguage]);

  useEffect(() => {
    syncHighlightScroll(textareaRef.current, highlightRef.current);
  }, [highlightedMarkup]);

  return (
    <div
      className="fg-code-textarea"
      data-language={readyLanguage}
      data-read-only={readOnly ? "true" : "false"}
    >
      <pre
        aria-hidden="true"
        className={cx(className, "fg-code-textarea__highlight")}
        ref={highlightRef}
      >
        <code dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />
      </pre>
      <textarea
        aria-label={ariaLabel}
        className={cx(className, "fg-code-textarea__input")}
        id={id}
        onChange={
          onChange
            ? (event) => {
                onChange(event.target.value);
              }
            : undefined
        }
        onScroll={() => {
          syncHighlightScroll(textareaRef.current, highlightRef.current);
        }}
        readOnly={readOnly || !onChange}
        ref={textareaRef}
        spellCheck={spellCheck}
        value={value}
        wrap="off"
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { PillNav, PillNavAnchor } from "@/components/ui/pill-nav";
import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import { cx } from "@/lib/ui/cx";

export type DocsSectionNavItem = {
  id: string;
  index: string;
  label: string;
  title: string;
};

function readCurrentHash() {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash.replace(/^#/, "").trim();
  return hash || null;
}

function pickInitialSection(items: DocsSectionNavItem[]) {
  const hash = readCurrentHash();

  if (hash && items.some((item) => item.id === hash)) {
    return hash;
  }

  return items[0]?.id ?? null;
}

export function DocsSectionNav({
  ariaLabel,
  className,
  sections,
  variant,
}: {
  ariaLabel: string;
  className?: string;
  sections: DocsSectionNavItem[];
  variant: "pill" | "rail";
}) {
  const [activeId, setActiveId] = useState<string | null>(() =>
    pickInitialSection(sections),
  );

  const watchKey = useMemo(
    () => `${variant}:${sections.map((section) => section.id).join("|")}:${activeId ?? ""}`,
    [activeId, sections, variant],
  );

  useEffect(() => {
    const defaultId = sections[0]?.id ?? null;

    function syncFromHash() {
      const hash = readCurrentHash();

      if (hash && sections.some((section) => section.id === hash)) {
        setActiveId(hash);
        return;
      }

      setActiveId(defaultId);
    }

    syncFromHash();

    if (!("IntersectionObserver" in window) || sections.length === 0) {
      window.addEventListener("hashchange", syncFromHash);

      return () => {
        window.removeEventListener("hashchange", syncFromHash);
      };
    }

    const observedElements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);

    if (observedElements.length === 0) {
      window.addEventListener("hashchange", syncFromHash);

      return () => {
        window.removeEventListener("hashchange", syncFromHash);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((entryA, entryB) => {
            if (entryB.intersectionRatio !== entryA.intersectionRatio) {
              return entryB.intersectionRatio - entryA.intersectionRatio;
            }

            return entryA.boundingClientRect.top - entryB.boundingClientRect.top;
          });

        if (visibleEntries[0]?.target instanceof HTMLElement) {
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -56% 0px",
        threshold: [0.08, 0.2, 0.4, 0.6, 0.8],
      },
    );

    observedElements.forEach((element) => {
      observer.observe(element);
    });

    window.addEventListener("hashchange", syncFromHash);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [sections]);

  if (variant === "pill") {
    return (
      <ScrollableControlStrip
        activeSelector='[aria-current="page"]'
        className={cx("fg-docs-section-strip__shell", className)}
        variant="pill"
        watchKey={watchKey}
      >
        <PillNav ariaLabel={ariaLabel} className="fg-docs-section-strip__nav">
          {sections.map((section) => (
            <PillNavAnchor
              active={activeId === section.id}
              className="fg-docs-section-strip__link"
              href={`#${section.id}`}
              key={section.id}
            >
              <span className="fg-docs-section-strip__label">{section.label}</span>
            </PillNavAnchor>
          ))}
        </PillNav>
      </ScrollableControlStrip>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cx("fg-docs-section-map", className)}
    >
      {sections.map((section) => (
        <a
          aria-current={activeId === section.id ? "page" : undefined}
          className="fg-docs-section-map__link"
          href={`#${section.id}`}
          key={section.id}
        >
          <span className="fg-docs-section-map__index">{section.index}</span>
          <span className="fg-docs-section-map__body">
            <strong>{section.label}</strong>
            <span>{section.title}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}

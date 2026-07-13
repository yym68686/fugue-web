"use client";

import { useEffect, useState } from "react";

type DocsTocItem = {
  id: string;
  label: string;
};

export function DocsToc({
  items,
  label,
  summary,
}: {
  items: DocsTocItem[];
  label: string;
  summary: string;
}) {
  const [currentId, setCurrentId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const updateFromHash = () => {
      const nextId = window.location.hash.slice(1);
      if (items.some((item) => item.id === nextId)) {
        setCurrentId(nextId);
        // App Router can stream the document shell before the target section
        // exists. Re-run native fragment positioning after hydration so an
        // initial deep link, history back, and history forward all land on the
        // same visible section across engines.
        window.requestAnimationFrame(() => {
          document.getElementById(nextId)?.scrollIntoView({ block: "start" });
        });
      }
    };

    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
    return () => window.removeEventListener("hashchange", updateFromHash);
  }, [items]);

  return (
    <details className="coss-docs-directory" open>
      <summary>{summary}</summary>
      <nav aria-label={label}>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                aria-current={currentId === item.id ? "location" : undefined}
                className="coss-sidebar__link"
                href={`#${item.id}`}
                onClick={() => setCurrentId(item.id)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { useConsoleRouteTransition } from "@/components/console/console-route-transition";
import { PlatformIcon } from "@/components/platform/platform-icon";
import type { ConsoleNavGroup } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

type ConsoleCommandSearchLabels = {
  close: string;
  dialog: string;
  empty: string;
  placeholder: string;
  trigger: string;
};

type CommandItem = {
  groupLabel: string;
  href: string;
  icon: ConsoleNavGroup["items"][number]["icon"];
  label: string;
  meta: string;
  searchText: string;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function ConsoleCommandSearch({
  enableShortcut = true,
  groups,
  labels,
}: {
  enableShortcut?: boolean;
  groups: ConsoleNavGroup[];
  labels: ConsoleCommandSearchLabels;
}) {
  const router = useRouter();
  const { beginRouteTransition } = useConsoleRouteTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();
  const listId = useId();

  const commands = useMemo<CommandItem[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          groupLabel: group.label,
          href: item.href,
          icon: item.icon,
          label: item.label,
          meta: item.meta,
          searchText: normalizeSearch(
            `${group.label} ${item.label} ${item.meta} ${item.description ?? ""} ${item.href}`,
          ),
        })),
      ),
    [groups],
  );

  const visibleCommands = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return commands;
    }

    return commands.filter((command) =>
      command.searchText.includes(normalizedQuery),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!visibleCommands.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((index) =>
      Math.min(Math.max(index, 0), visibleCommands.length - 1),
    );
  }, [visibleCommands.length]);

  useEffect(() => {
    if (!enableShortcut) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      const key = event.key.toLocaleLowerCase();
      const commandShortcut = (event.metaKey || event.ctrlKey) && key === "k";
      const slashShortcut = event.key === "/" && !event.metaKey && !event.ctrlKey;

      if (!commandShortcut && !slashShortcut) {
        return;
      }

      if (slashShortcut && isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [enableShortcut]);

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

  function runCommand(command: CommandItem) {
    closeSearch();
    beginRouteTransition(command.href, command.label);
    router.push(command.href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (!visibleCommands.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleCommands.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + visibleCommands.length) % visibleCommands.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(visibleCommands[activeIndex]);
    }
  }

  return (
    <>
      <button
        aria-controls={open ? dialogId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fp-command"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlatformIcon name="search" />
        <span>{labels.trigger}</span>
        <kbd className="fp-command__kbd">/</kbd>
      </button>
      {open ? (
        <div className="fp-command-search">
          <button
            aria-label={labels.close}
            className="fp-command-search__backdrop"
            onClick={closeSearch}
            type="button"
          />
          <section
            aria-labelledby={`${dialogId}-title`}
            aria-modal="true"
            className="fp-command-search__dialog"
            id={dialogId}
            role="dialog"
          >
            <h2 className="fg-visually-hidden" id={`${dialogId}-title`}>
              {labels.dialog}
            </h2>
            <div className="fp-command-search__field">
              <PlatformIcon name="search" />
              <input
                aria-activedescendant={
                  visibleCommands[activeIndex]
                    ? `${listId}-${activeIndex}`
                    : undefined
                }
                aria-controls={listId}
                aria-label={labels.dialog}
                autoComplete="off"
                className="fp-command-search__input"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={labels.placeholder}
                ref={inputRef}
                type="search"
                value={query}
              />
              <kbd className="fp-command-search__kbd">Esc</kbd>
            </div>
            <div className="fp-command-search__list" id={listId} role="listbox">
              {visibleCommands.length ? (
                visibleCommands.map((command, index) => (
                  <Link
                    aria-selected={index === activeIndex}
                    className={cx(
                      "fp-command-search__item",
                      index === activeIndex && "is-active",
                    )}
                    href={command.href}
                    id={`${listId}-${index}`}
                    key={command.href}
                    onClick={closeSearch}
                    onMouseEnter={() => setActiveIndex(index)}
                    onNavigate={() => {
                      beginRouteTransition(command.href, command.label);
                    }}
                    prefetch={false}
                    role="option"
                  >
                    <PlatformIcon
                      className="fp-command-search__item-icon"
                      name={command.icon}
                    />
                    <span className="fp-command-search__item-copy">
                      <strong>{command.label}</strong>
                      <span>
                        {command.groupLabel} / {command.meta}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="fp-command-search__empty">{labels.empty}</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

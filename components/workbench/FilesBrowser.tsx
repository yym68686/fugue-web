"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ConsoleAppDetail,
  FilesystemEntry,
  FilesystemFile,
  FilesystemTree,
} from "@/lib/fugue/console";
import { fmtBytes, fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";

import {
  ConfirmDialog,
  EmptyState,
  RefreshButton,
  TabError,
  callConsole,
} from "./shared";

const MAX_EDIT_BYTES = 262144; // matches the backend read cap (max_bytes)

/** Shape of a successfully-loaded directory level. */
type DirNode = {
  entries: FilesystemEntry[];
  loading: boolean;
  error: string | null;
};

function isDir(kind: FilesystemEntry["kind"]): boolean {
  return kind === "dir";
}

/** Depth of a path for indentation ("/" = 0, "/etc" = 1, "/etc/x" = 2). */
function pathDepth(p: string): number {
  const trimmed = p.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? 0 : trimmed.split("/").length;
}

/** GET a console filesystem endpoint, unwrapping { ok, result }. */
async function fsGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return (body?.result ?? body) as T;
}

/** Skeleton sized for a pane, without the bordered panel TabLoading draws. */
function PaneLoading() {
  return (
    <div className="fs-load">
      <div className="sk sk-line" />
      <div className="sk sk-line" style={{ width: "72%" }} />
      <div className="sk sk-line" style={{ width: "54%" }} />
    </div>
  );
}

export default function FilesBrowser({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;

  // Pin one pod for the whole browse/edit session so reads stay consistent
  // across replicas. Learned from the first (root) tree response.
  const [pod, setPod] = useState<string | null>(null);
  const [root, setRoot] = useState<FilesystemTree | null>(null);
  const [rootLoading, setRootLoading] = useState(true);
  const [rootError, setRootError] = useState<string | null>(null);

  // Per-directory-path children, expansion state, and the selected file.
  const [dirs, setDirs] = useState<Record<string, DirNode>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const reqId = useRef(0);

  const treeUrl = useCallback(
    (path: string) => {
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      if (pod) params.set("pod", pod);
      const qs = params.toString();
      return `${base}/filesystem/tree${qs ? `?${qs}` : ""}`;
    },
    [base, pod],
  );

  // Load the root level (path=""). Also captures the pod to pin the session.
  const loadRoot = useCallback(() => {
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setRootLoading(true);
    setRootError(null);
    fsGet<FilesystemTree>(`${base}/filesystem/tree`, ctrl.signal)
      .then((data) => {
        if (id !== reqId.current) return;
        setRoot(data);
        if (data.pod) setPod(data.pod);
        setRootLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || id !== reqId.current) return;
        setRootError(err instanceof Error ? err.message : t("Failed to load."));
        setRootLoading(false);
      });
    return () => ctrl.abort();
  }, [base, t]);

  useEffect(() => loadRoot(), [loadRoot]);

  // Fetch (or refetch) one directory's children.
  const loadDir = useCallback(
    async (path: string) => {
      setDirs((prev) => ({
        ...prev,
        [path]: { entries: prev[path]?.entries ?? [], loading: true, error: null },
      }));
      try {
        const data = await fsGet<FilesystemTree>(treeUrl(path));
        setDirs((prev) => ({
          ...prev,
          [path]: { entries: data.entries ?? [], loading: false, error: null },
        }));
      } catch (err) {
        setDirs((prev) => ({
          ...prev,
          [path]: {
            entries: [],
            loading: false,
            error: err instanceof Error ? err.message : t("Failed to load."),
          },
        }));
      }
    },
    [treeUrl, t],
  );

  const toggleDir = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          // Lazy-load the first time a directory is opened.
          if (!dirs[path]) void loadDir(path);
        }
        return next;
      });
    },
    [dirs, loadDir],
  );

  const refreshAll = useCallback(() => {
    setDirs({});
    setExpanded(new Set());
    setSelected(null);
    loadRoot();
  }, [loadRoot]);

  // Flatten the lazily-loaded tree into ordered, indented rows for rendering.
  const rows = useMemo(
    () => (root ? flattenTree(root.entries, dirs, expanded) : []),
    [root, dirs, expanded],
  );

  return (
    <div className="fs-frame">
      <div className="fs-frame-h">
        <h3>{t("Files")}</h3>
        {root?.pod && (
          <span className="chip fs-pod" title={root.pod}>
            {root.pod}
          </span>
        )}
        {root?.workspace_root && <span className="fs-root">{root.workspace_root}</span>}
        <div className="tail">
          <RefreshButton onClick={refreshAll} />
        </div>
      </div>

      {rootLoading && <PaneLoading />}
      {rootError && (
        <div style={{ padding: 14 }}>
          <TabError message={rootError} />
        </div>
      )}

      {!rootLoading && !rootError && root && (
        <div className="fs-split">
          <div className="fs-side">
            {rows.length === 0 ? (
              <EmptyState message={t("No files")} />
            ) : (
              <div role="tree">
                {rows.map((r) => (
                  <FileRow
                    key={r.entry.path}
                    entry={r.entry}
                    depth={r.depth}
                    expanded={expanded.has(r.entry.path)}
                    loading={dirs[r.entry.path]?.loading ?? false}
                    selected={selected === r.entry.path}
                    onToggle={toggleDir}
                    onSelect={setSelected}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="fs-main">
            {selected ? (
              <FileViewer
                key={selected}
                base={base}
                path={selected}
                pod={pod}
                onClose={() => setSelected(null)}
                t={t}
              />
            ) : (
              <div className="fs-blank">{t("Select a file to view its contents")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type FlatRow = { entry: FilesystemEntry; depth: number };

/**
 * Depth-first flatten of the lazily-loaded tree: a directory's children are
 * spliced in right after it when it is expanded and its level has loaded.
 */
function flattenTree(
  entries: FilesystemEntry[],
  dirs: Record<string, DirNode>,
  expanded: Set<string>,
): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (list: FilesystemEntry[]) => {
    for (const entry of list) {
      out.push({ entry, depth: pathDepth(entry.path) });
      if (isDir(entry.kind) && expanded.has(entry.path)) {
        const child = dirs[entry.path];
        if (child && !child.error) walk(child.entries);
      }
    }
  };
  walk(entries);
  return out;
}

function FileRow({
  entry,
  depth,
  expanded,
  loading,
  selected,
  onToggle,
  onSelect,
  t,
}: {
  entry: FilesystemEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  selected: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  t: TranslateFn;
}) {
  const dir = isDir(entry.kind);
  const symlink = entry.kind === "symlink";
  const activate = () => (dir ? onToggle(entry.path) : onSelect(entry.path));

  // The rail shows size only; the full detail rides along as a tooltip.
  const kindLabel = dir ? t("Directory") : symlink ? t("Symlink") : fmtBytes(entry.size ?? 0);
  const title = entry.modified_at
    ? `${entry.path} — ${kindLabel} · ${fmtDate(entry.modified_at)}`
    : `${entry.path} — ${kindLabel}`;

  return (
    <div
      className={`fs-row${selected ? " selected" : ""}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      role="treeitem"
      aria-expanded={dir ? expanded : undefined}
      aria-selected={selected}
      tabIndex={0}
      title={title}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      <span className="fs-caret">
        {dir ? (
          loading ? (
            <span className="fs-spin" aria-hidden />
          ) : (
            <span className={`caret${expanded ? " down" : ""}`}>▶</span>
          )
        ) : null}
      </span>
      <span className={`fs-icon ${dir ? "dir" : symlink ? "link" : "file"}`} aria-hidden>
        {dir ? "▮" : symlink ? "↳" : "▫"}
      </span>
      <span className="fs-name mono">{entry.name}</span>
      <span className="fs-size">{dir || symlink ? "" : fmtBytes(entry.size ?? 0)}</span>
    </div>
  );
}

function FileViewer({
  base,
  path,
  pod,
  onClose,
  t,
}: {
  base: string;
  path: string;
  pod: string | null;
  onClose: () => void;
  t: TranslateFn;
}) {
  const [file, setFile] = useState<FilesystemFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fileUrl = useMemo(() => {
    const params = new URLSearchParams({ path });
    if (pod) params.set("pod", pod);
    return `${base}/filesystem/file?${params.toString()}`;
  }, [base, path, pod]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setDirty(false);
    fsGet<FilesystemFile>(fileUrl, ctrl.signal)
      .then((data) => {
        setFile(data);
        setDraft(data.encoding === "base64" ? "" : data.content ?? "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : t("Failed to load."));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [fileUrl, t]);

  const isBinary = file?.encoding === "base64";
  const isTruncated = Boolean(file?.truncated);
  // Editing is only safe for whole, text files. A truncated buffer would drop
  // the file's tail on save; binary content cannot round-trip through the
  // utf-8 textarea. Both disable Save.
  const canEdit = !loading && !error && !isBinary && !isTruncated;

  async function save() {
    await callConsole(`${base.replace("/api/console", "")}/filesystem/file`, {
      method: "PUT",
      body: { path, content: draft, ...(pod ? { pod } : {}) },
    });
    setConfirming(false);
    setDirty(false);
    // Reflect the saved content as the new baseline.
    setFile((prev) => (prev ? { ...prev, content: draft } : prev));
  }

  return (
    <>
      <div className="fs-filebar">
        <span className="fs-filebar-path mono" title={path}>
          {path}
        </span>
        {file && (
          <span className="fs-filebar-meta">
            {fmtBytes(file.size ?? 0)}
            {file.modified_at ? ` · ${fmtDate(file.modified_at)}` : ""}
          </span>
        )}
        <div className="fs-filebar-actions">
          {canEdit && (
            <button
              type="button"
              className="btn primary sm"
              disabled={!dirty}
              onClick={() => setConfirming(true)}
            >
              {t("Save")}
            </button>
          )}
          <button type="button" className="btn ghost sm" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      </div>

      <div className="fs-pane">
        {loading && <PaneLoading />}
        {error && (
          <div style={{ padding: 14 }}>
            <TabError message={error} />
          </div>
        )}

        {!loading && !error && file && (
          <>
            {isBinary ? (
              <div className="fs-blank">{t("Binary file — preview not available.")}</div>
            ) : (
              <>
                {isTruncated && (
                  <div style={{ padding: "12px 12px 0" }}>
                    <div className="wb-alert err">
                      {t(
                        "File is too large; showing the first {size} only. Editing is disabled to avoid data loss.",
                        { size: fmtBytes(MAX_EDIT_BYTES) },
                      )}
                    </div>
                  </div>
                )}
                <textarea
                  className="fs-code mono"
                  value={draft}
                  spellCheck={false}
                  readOnly={!canEdit}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDirty(true);
                  }}
                />
              </>
            )}
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={t("Save file")}
          body={
            <p>
              {t('Write changes to "{path}" in the live container? This overwrites the current file.', {
                path,
              })}
            </p>
          }
          confirmLabel={t("Save")}
          onConfirm={save}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
} from "react";

import { Button } from "@/components/ui/button";
import {
  createLocalUploadState,
  inspectLocalUploadState,
  normalizeLocalUploadItems,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import { cx } from "@/lib/ui/cx";

type LocalUploadSourceFieldProps = {
  idPrefix: string;
  onChange: (next: LocalUploadState) => void;
  value: LocalUploadState;
};

type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

const FOLDER_INPUT_ATTRIBUTES = {
  webkitdirectory: "",
} as InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string };

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function readInputFiles(files: FileList | null) {
  return Array.from(files ?? []).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}

function readFileEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

async function readAllDirectoryEntries(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];

  while (true) {
    const batch = await readDirectoryEntries(reader);

    if (!batch.length) {
      return entries;
    }

    entries.push(...batch);
  }
}

async function collectEntryFiles(
  entry: FileSystemEntry,
): Promise<Array<{ file: File; path: string }>> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);

    return [
      {
        file,
        path:
          entry.fullPath.replace(/^\/+/, "") ||
          file.webkitRelativePath ||
          file.name,
      },
    ];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const children = await readAllDirectoryEntries(
    entry as FileSystemDirectoryEntry,
  );
  const nested = await Promise.all(
    children.map((child) => collectEntryFiles(child)),
  );
  return nested.flat();
}

async function collectDroppedFiles(dataTransfer: DataTransfer) {
  const items = Array.from(
    dataTransfer.items ?? [],
  ) as WebkitDataTransferItem[];
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length > 0) {
    const collected = await Promise.all(
      entries.map((entry) => collectEntryFiles(entry)),
    );
    return collected.flat();
  }

  return readInputFiles(dataTransfer.files);
}

export function LocalUploadSourceField({
  idPrefix,
  onChange,
  value,
}: LocalUploadSourceFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inspection = inspectLocalUploadState(value);

  async function applyEntries(entries: Array<{ file: File; path: string }>) {
    onChange(normalizeLocalUploadItems(entries));
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const entries = readInputFiles(event.target.files);
    void applyEntries(entries);
    event.target.value = "";
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);

    const entries = await collectDroppedFiles(event.dataTransfer);

    if (entries.length === 0) {
      return;
    }

    void applyEntries(entries);
  }

  return (
    <div className="fg-upload-source">
      <input
        className="fg-upload-source__input"
        id={`${idPrefix}-upload-files`}
        multiple
        onChange={handleFilesChange}
        ref={fileInputRef}
        type="file"
      />
      <input
        {...FOLDER_INPUT_ATTRIBUTES}
        className="fg-upload-source__input"
        id={`${idPrefix}-upload-folder`}
        multiple
        onChange={handleFilesChange}
        ref={folderInputRef}
        type="file"
      />

      <div
        className={cx(
          "fg-upload-source__dropzone",
          isDragActive && "is-drag-active",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }

          setIsDragActive(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragActive(true);
        }}
        onDrop={(event) => {
          void handleDrop(event);
        }}
      >
        <div className="fg-upload-source__head">
          <div>
            <p className="fg-upload-source__eyebrow">Local upload</p>
            <strong className="fg-upload-source__title">
              {inspection.itemCount > 0
                ? value.label || "Upload ready"
                : "Drop a folder or source files"}
            </strong>
          </div>
          <span className="fg-upload-source__meter">
            {inspection.itemCount > 0
              ? `${inspection.itemCount} file${inspection.itemCount === 1 ? "" : "s"} · ${formatBytes(inspection.totalBytes)}`
              : "Folder / compose / Dockerfile"}
          </span>
        </div>

        <p className="fg-upload-source__copy">
          {inspection.itemCount > 0
            ? "Fugue will package these files on the server, then import them through the same upload route used by local deploys."
            : "Drag a local folder, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Folder drop works when the browser exposes directory entries."}
        </p>

        <div className="fg-upload-source__chips">
          {inspection.hasCompose ? (
            <span className="fg-upload-source__chip">Compose detected</span>
          ) : null}
          {inspection.hasFugueManifest ? (
            <span className="fg-upload-source__chip">fugue.yaml detected</span>
          ) : null}
          {inspection.hasDockerfile ? (
            <span className="fg-upload-source__chip">Dockerfile detected</span>
          ) : null}
          {inspection.itemCount === 0 ? (
            <>
              <span className="fg-upload-source__chip">Folder drag</span>
              <span className="fg-upload-source__chip">Single file import</span>
              <span className="fg-upload-source__chip">
                Multi-service ready
              </span>
            </>
          ) : null}
        </div>

        {inspection.previewPaths.length > 0 ? (
          <ul className="fg-upload-source__list">
            {inspection.previewPaths.map((path) => (
              <li key={path}>{path}</li>
            ))}
            {inspection.itemCount > inspection.previewPaths.length ? (
              <li>
                +{inspection.itemCount - inspection.previewPaths.length} more
                file
                {inspection.itemCount - inspection.previewPaths.length === 1
                  ? ""
                  : "s"}
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className="fg-upload-source__actions">
          <Button
            onClick={() => folderInputRef.current?.click()}
            size="compact"
            variant="secondary"
          >
            Choose folder
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="compact"
            variant="ghost"
          >
            Choose files
          </Button>
          {inspection.itemCount > 0 ? (
            <Button
              onClick={() => onChange(createLocalUploadState())}
              size="compact"
              variant="ghost"
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

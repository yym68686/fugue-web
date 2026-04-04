import "server-only";

import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { isObject } from "@/lib/fugue/product-route";
import { slugifyProjectName } from "@/lib/workspace/projects";

const gzipAsync = promisify(gzip);
const TAR_BLOCK_BYTES = 512;
const MAX_UPLOAD_ARCHIVE_BYTES = 128 << 20;

export type LocalUploadRouteFile = {
  file: File;
  path: string;
};

export type LocalUploadMultipartRequest = {
  files: LocalUploadRouteFile[];
  label: string | null;
  payload: Record<string, unknown>;
};

function isFormFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function normalizeArchivePath(path: string) {
  const sanitized = path.replace(/\\/g, "/").trim();

  if (!sanitized) {
    return "";
  }

  const segments = sanitized
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");

  return segments.join("/");
}

function readCommonTopLevelFolder(paths: string[]) {
  if (!paths.length) {
    return null;
  }

  const [firstPath] = paths;
  const [firstSegment] = firstPath.split("/");

  if (!firstSegment) {
    return null;
  }

  if (
    paths.some((path) => {
      const segments = path.split("/");
      return segments.length < 2 || segments[0] !== firstSegment;
    })
  ) {
    return null;
  }

  return firstSegment;
}

function stripCommonArchiveRoot(files: LocalUploadRouteFile[]) {
  const commonRoot = readCommonTopLevelFolder(files.map((file) => file.path));

  if (!commonRoot) {
    return files;
  }

  return files.map((file) => ({
    ...file,
    path: file.path.slice(commonRoot.length + 1),
  }));
}

function readPathBaseName(path: string) {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function stripArchiveExtension(value: string) {
  return value
    .replace(/\.tar\.gz$/i, "")
    .replace(/\.tgz$/i, "")
    .replace(/\.[^.]+$/u, "");
}

function resolveArchiveBaseName(
  preferredName?: string | null,
  label?: string | null,
  files: LocalUploadRouteFile[] = [],
) {
  const candidate =
    preferredName?.trim() ||
    label?.trim() ||
    stripArchiveExtension(readPathBaseName(files[0]?.path ?? "upload"));

  return slugifyProjectName(candidate || "upload");
}

function splitTarPath(path: string) {
  if (Buffer.byteLength(path) <= 100) {
    return { name: path, prefix: "" };
  }

  const segments = path.split("/");

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const prefix = segments.slice(0, index).join("/");
    const name = segments.slice(index).join("/");

    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }

  throw new Error(`Uploaded path is too long for tar packaging: ${path}`);
}

function writeTarString(buffer: Buffer, offset: number, length: number, value: string) {
  const encoded = Buffer.from(value, "utf8");
  encoded.copy(buffer, offset, 0, Math.min(encoded.length, length));
}

function writeTarOctal(buffer: Buffer, offset: number, length: number, value: number) {
  const encoded = Buffer.from(
    value.toString(8).padStart(length - 1, "0").slice(-(length - 1)) + "\0",
    "ascii",
  );
  encoded.copy(buffer, offset);
}

function createTarHeader(path: string, size: number, modifiedAt: number) {
  const header = Buffer.alloc(TAR_BLOCK_BYTES, 0);
  const { name, prefix } = splitTarPath(path);

  writeTarString(header, 0, 100, name);
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, modifiedAt);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");
  writeTarString(header, 345, 155, prefix);

  const checksum = header.reduce((total, byte) => total + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, "0");
  writeTarString(header, 148, 6, checksumText);
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

export async function readLocalUploadMultipartRequest(request: Request) {
  const formData = await request.formData();
  const rawPayload = formData.get("payload");

  if (typeof rawPayload !== "string" || !rawPayload.trim()) {
    throw new Error("Multipart field payload is required.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new Error("Multipart field payload must be valid JSON.");
  }

  if (!isObject(payload)) {
    throw new Error("Multipart field payload must be a JSON object.");
  }

  const fileValues = formData.getAll("files");
  const pathValues = formData.getAll("paths");

  if (!fileValues.length) {
    throw new Error("Choose a folder, docker-compose.yml, Dockerfile, or source files to upload.");
  }

  if (fileValues.length !== pathValues.length) {
    throw new Error("Uploaded files are missing path metadata.");
  }

  const files: LocalUploadRouteFile[] = fileValues.map((value, index) => {
    if (!isFormFile(value)) {
      throw new Error("Each uploaded file must be sent as multipart file data.");
    }

    const path = pathValues[index];

    if (typeof path !== "string") {
      throw new Error("Each uploaded file must include a relative path.");
    }

    const normalizedPath = normalizeArchivePath(path);

    if (!normalizedPath) {
      throw new Error("Uploaded file paths must stay within the selected folder.");
    }

    return {
      file: value,
      path: normalizedPath,
    };
  });

  const labelValue = formData.get("label");

  return {
    files,
    label: typeof labelValue === "string" && labelValue.trim() ? labelValue.trim() : null,
    payload,
  } satisfies LocalUploadMultipartRequest;
}

export async function createLocalUploadArchive(
  files: LocalUploadRouteFile[],
  options?: {
    archiveBaseName?: string | null;
    label?: string | null;
  },
) {
  const normalizedFiles = stripCommonArchiveRoot(
    files
      .map((file) => ({
        ...file,
        path: normalizeArchivePath(file.path),
      }))
      .filter((file) => file.path),
  );

  if (!normalizedFiles.length) {
    throw new Error("Uploaded files must stay within the selected folder.");
  }

  const chunks: Buffer[] = [];
  const modifiedAt = Math.floor(Date.now() / 1000);

  for (const file of normalizedFiles) {
    const data = Buffer.from(await file.file.arrayBuffer());
    chunks.push(createTarHeader(file.path, data.byteLength, modifiedAt));
    chunks.push(data);

    const padding = (TAR_BLOCK_BYTES - (data.byteLength % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;

    if (padding > 0) {
      chunks.push(Buffer.alloc(padding, 0));
    }
  }

  chunks.push(Buffer.alloc(TAR_BLOCK_BYTES * 2, 0));
  const tarBuffer = Buffer.concat(chunks);
  const gzipBuffer = await gzipAsync(tarBuffer);

  if (gzipBuffer.byteLength > MAX_UPLOAD_ARCHIVE_BYTES) {
    throw new Error(`Archive exceeds ${MAX_UPLOAD_ARCHIVE_BYTES} bytes.`);
  }

  return {
    archiveBytes: new Uint8Array(gzipBuffer),
    archiveName: `${resolveArchiveBaseName(options?.archiveBaseName, options?.label, normalizedFiles)}.tgz`,
    files: normalizedFiles,
  };
}

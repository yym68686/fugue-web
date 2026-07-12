import "server-only";

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import { chmod, type FileHandle, mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip, createInflateRaw } from "node:zlib";

import {
  resolveDeployAppName,
  stripDeployArchiveExtension,
} from "@/lib/deploy/app-name";

const TAR_BLOCK_BYTES = 512;
const MULTIPART_READ_CHUNK_BYTES = 64 << 10;
const TEMP_DIRECTORY_PREFIX = "fugue-web-upload-";

export const DEFAULT_LOCAL_UPLOAD_LIMITS = Object.freeze({
  maxArchiveBytes: 128 << 20,
  maxConcurrentRequests: 2,
  maxDurationMilliseconds: 5 * 60 * 1_000,
  maxFieldBytes: 1 << 20,
  maxFileBytes: 128 << 20,
  maxFiles: 1_024,
  maxHeaderBytes: 16 << 10,
  maxLabelBytes: 256,
  maxPathBytes: 255,
  maxPathDepth: 32,
  maxRequestBytes: 130 << 20,
  maxSourceBytes: 128 << 20,
} as const);

export type LocalUploadLimitOverrides = Partial<{
  [Key in keyof typeof DEFAULT_LOCAL_UPLOAD_LIMITS]: number;
}>;

type ResolvedLocalUploadLimits = {
  [Key in keyof typeof DEFAULT_LOCAL_UPLOAD_LIMITS]: number;
};

export class LocalUploadRequestError extends Error {
  readonly status: 400 | 408 | 413 | 415 | 429;

  constructor(status: 400 | 408 | 413 | 415 | 429, message: string) {
    super(message);
    this.name = "LocalUploadRequestError";
    this.status = status;
  }
}

export function readLocalUploadErrorStatus(error: unknown) {
  return error instanceof LocalUploadRequestError ? error.status : 500;
}

export type LocalUploadRouteFile = {
  path: string;
  size: number;
  temporaryPath: string;
};

export type LocalUploadRouteArchive = {
  contentType: string;
  name: string;
  size: number;
  temporaryPath: string;
};

type LocalUploadRequestResources = {
  cleanup: () => Promise<void>;
  limits: ResolvedLocalUploadLimits;
  signal: AbortSignal;
  temporaryDirectory: string;
};

export type LocalUploadMultipartRequest = LocalUploadRequestResources &
  (
    | {
        kind: "archive";
        archive: LocalUploadRouteArchive;
        label: string | null;
        payload: Record<string, unknown>;
      }
    | {
        kind: "files";
        files: LocalUploadRouteFile[];
        label: string | null;
        payload: Record<string, unknown>;
      }
  );

const DIRECT_UPLOAD_ARCHIVE_ERROR =
  "Choose a folder, a .zip or .tgz archive, docker-compose.yml, Dockerfile, or source files to upload.";

let activeUploadRequests = 0;

type LocalUploadObservationSummary = {
  archiveBytes: number;
  fileCount: number;
  requestBytes: number;
  sourceBytes: number;
};

type LocalUploadObservation = {
  finish: (input: {
    cleanup: "failed" | "not-created" | "succeeded";
    error?: unknown;
    outcome: "completed" | "rejected";
  }) => void;
  reject: (status: number, error: unknown) => void;
  summary: LocalUploadObservationSummary;
};

const localUploadObservations = new WeakMap<object, LocalUploadObservation>();

function readLocalUploadRejectionReason(error: unknown, status: number) {
  if (!(error instanceof Error)) {
    return "internal_error";
  }

  const message = error.message.toLowerCase();

  if (status === 429) {
    return "concurrency_limit";
  }

  if (status === 415) {
    return "unsupported_media";
  }

  if (status === 408) {
    return "upload_timeout";
  }

  if (message.includes("interrupted") || message.includes("abort")) {
    return "client_abort";
  }

  if (message.includes("request exceeds")) {
    return "request_too_large";
  }

  if (message.includes("archive exceeds") || message.includes("expands beyond")) {
    return "archive_too_large";
  }

  if (message.includes("too many") || message.includes("exceeds 1024")) {
    return "item_limit";
  }

  if (
    message.includes("path") ||
    message.includes("link") ||
    message.includes("special file")
  ) {
    return "unsafe_archive_entry";
  }

  if (status === 413) {
    return "size_limit";
  }

  return "invalid_upload";
}

function createLocalUploadObservation(): LocalUploadObservation {
  const startedAt = process.hrtime.bigint();
  const rssAtStart = process.memoryUsage.rss();
  let peakRssBytes = rssAtStart;
  let finished = false;
  let rejection: { reason: string; status: number } | null = null;
  const summary: LocalUploadObservationSummary = {
    archiveBytes: 0,
    fileCount: 0,
    requestBytes: 0,
    sourceBytes: 0,
  };
  const sampleRss = () => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss());
  };
  const sampler = setInterval(sampleRss, 100);
  sampler.unref();

  return {
    finish(input) {
      if (finished) {
        return;
      }

      finished = true;
      clearInterval(sampler);
      sampleRss();
      const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const errorStatus =
        input.error instanceof LocalUploadRequestError ? input.error.status : 500;
      const effectiveRejection = input.error
        ? {
            reason: readLocalUploadRejectionReason(input.error, errorStatus),
            status: errorStatus,
          }
        : rejection;

      console.info(
        JSON.stringify({
          archive_bytes: summary.archiveBytes,
          cleanup: input.cleanup,
          duration_ms: Math.round(durationMilliseconds),
          event: "fugue_web_local_upload",
          file_count: summary.fileCount,
          outcome: effectiveRejection ? "rejected" : input.outcome,
          peak_rss_bytes: peakRssBytes,
          request_bytes: summary.requestBytes,
          ...(effectiveRejection
            ? {
                rejection_reason: effectiveRejection.reason,
                status: effectiveRejection.status,
              }
            : {}),
          rss_delta_bytes: Math.max(0, peakRssBytes - rssAtStart),
          source_bytes: summary.sourceBytes,
        }),
      );
    },
    reject(status, error) {
      if (finished || rejection) {
        return;
      }

      rejection = {
        reason: readLocalUploadRejectionReason(error, status),
        status,
      };
    },
    summary,
  };
}

export function recordLocalUploadRejection(
  upload: LocalUploadMultipartRequest,
  status: number,
  error: unknown,
) {
  localUploadObservations.get(upload)?.reject(status, error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasAsciiControlCharacter(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function resolvePositiveLimit(value: number | undefined, maximum: number) {
  if (value === undefined) {
    return maximum;
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("Local upload limits must be positive integers.");
  }

  // Callers may tighten a limit for a specific deployment or test, but may not
  // raise it above the limits verified against the Fugue upload contract.
  return Math.min(value, maximum);
}

function resolveLocalUploadLimits(
  overrides: LocalUploadLimitOverrides = {},
): ResolvedLocalUploadLimits {
  return Object.fromEntries(
    Object.entries(DEFAULT_LOCAL_UPLOAD_LIMITS).map(([key, maximum]) => [
      key,
      resolvePositiveLimit(overrides[key as keyof LocalUploadLimitOverrides], maximum),
    ]),
  ) as ResolvedLocalUploadLimits;
}

function acquireUploadRequestSlot(maxConcurrentRequests: number) {
  if (activeUploadRequests >= maxConcurrentRequests) {
    throw new LocalUploadRequestError(
      429,
      "Too many uploads are already being processed. Try again shortly.",
    );
  }

  activeUploadRequests += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeUploadRequests = Math.max(0, activeUploadRequests - 1);
  };
}

function createUploadAbortBoundary(
  requestSignal: AbortSignal,
  maxDurationMilliseconds: number,
) {
  const controller = new AbortController();
  const abortFromRequest = () => {
    controller.abort(
      requestSignal.reason ??
        new LocalUploadRequestError(400, "Upload was interrupted."),
    );
  };

  if (requestSignal.aborted) {
    abortFromRequest();
  } else {
    requestSignal.addEventListener("abort", abortFromRequest, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort(
      new LocalUploadRequestError(
        408,
        `Upload did not finish within ${maxDurationMilliseconds} milliseconds.`,
      ),
    );
  }, maxDurationMilliseconds);
  timeout.unref();

  return {
    cleanup() {
      clearTimeout(timeout);
      requestSignal.removeEventListener("abort", abortFromRequest);
    },
    signal: controller.signal,
  };
}

async function waitForUploadRead<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) {
    throw signal.reason ?? new LocalUploadRequestError(400, "Upload was interrupted.");
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(
        signal.reason ?? new LocalUploadRequestError(400, "Upload was interrupted."),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function validateMultipartRequestHeaders(
  request: Request,
  limits: ResolvedLocalUploadLimits,
) {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();

  if (mediaType !== "multipart/form-data") {
    throw new LocalUploadRequestError(
      415,
      "Local uploads require multipart/form-data.",
    );
  }

  const boundaryMatch = contentType.match(
    /(?:^|;)\s*boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i,
  );
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? "").trim();

  if (
    !boundary ||
    boundary.length > 70 ||
    !/^[0-9A-Za-z'()+_,\-./:=?]+$/.test(boundary)
  ) {
    throw new LocalUploadRequestError(400, "Multipart boundary is missing or invalid.");
  }

  const contentLength = request.headers.get("content-length")?.trim() ?? "";

  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      throw new LocalUploadRequestError(400, "Content-Length is invalid.");
    }

    const parsedLength = Number(contentLength);

    if (!Number.isSafeInteger(parsedLength) || parsedLength <= 0) {
      throw new LocalUploadRequestError(400, "Content-Length is invalid.");
    }

    if (parsedLength > limits.maxRequestBytes) {
      throw new LocalUploadRequestError(
        413,
        `Upload request exceeds ${limits.maxRequestBytes} bytes.`,
      );
    }
  }

  if (!request.body) {
    throw new LocalUploadRequestError(400, "Multipart request body is empty.");
  }

  return boundary;
}

function decodeUtf8(value: Buffer, fieldName: string) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw new LocalUploadRequestError(
      400,
      `Multipart field ${fieldName} must contain valid UTF-8.`,
    );
  }
}

function readDispositionParameter(value: string, parameter: string) {
  const expression = new RegExp(
    `(?:^|;)\\s*${parameter}\\s*=\\s*(?:"((?:\\\\.|[^"])*)"|([^;\\s]+))`,
    "i",
  );
  const match = value.match(expression);

  if (!match) {
    return null;
  }

  return (match[1] ?? match[2] ?? "").replace(/\\(.)/g, "$1");
}

type MultipartPartHeaders = {
  contentType: string;
  fieldName: string;
  filename: string | null;
};

function parseMultipartPartHeaders(rawHeaders: Buffer): MultipartPartHeaders {
  const headerText = decodeUtf8(rawHeaders, "headers");

  if (
    headerText.includes("\0") ||
    headerText.includes(String.fromCharCode(0x0b)) ||
    headerText.includes(String.fromCharCode(0x0c))
  ) {
    throw new LocalUploadRequestError(400, "Multipart headers are invalid.");
  }

  const headers = new Map<string, string>();

  for (const line of headerText.split("\r\n")) {
    if (/[\r\n]/.test(line)) {
      throw new LocalUploadRequestError(400, "Multipart headers are invalid.");
    }

    const separator = line.indexOf(":");

    if (separator <= 0) {
      throw new LocalUploadRequestError(400, "Multipart headers are invalid.");
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (!/^[a-z0-9-]+$/.test(name) || !value || headers.has(name)) {
      throw new LocalUploadRequestError(400, "Multipart headers are invalid.");
    }

    headers.set(name, value);
  }

  const disposition = headers.get("content-disposition") ?? "";

  if (!/^form-data(?:;|$)/i.test(disposition)) {
    throw new LocalUploadRequestError(
      400,
      "Each multipart part must use form-data content disposition.",
    );
  }

  const fieldName = readDispositionParameter(disposition, "name") ?? "";
  const filename = readDispositionParameter(disposition, "filename");

  if (!fieldName || /[\0\r\n]/.test(fieldName)) {
    throw new LocalUploadRequestError(
      400,
      "Each multipart part must include a valid field name.",
    );
  }

  const contentType = headers.get("content-type")?.trim() ?? "";

  if (/[^\u0020-\u007e]/.test(contentType)) {
    throw new LocalUploadRequestError(400, "Multipart Content-Type is invalid.");
  }

  return { contentType, fieldName, filename };
}

class MultipartByteReader {
  private buffer: Buffer = Buffer.alloc(0);
  private currentChunk: Uint8Array | null = null;
  private currentChunkOffset = 0;
  private done = false;
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private totalBytes = 0;

  constructor(
    body: ReadableStream<Uint8Array>,
    private readonly maxBytes: number,
    private readonly signal: AbortSignal,
  ) {
    this.reader = body.getReader();
  }

  bytesRead() {
    return this.totalBytes;
  }

  private async appendChunk() {
    if (this.done) {
      return false;
    }

    if (!this.currentChunk || this.currentChunkOffset >= this.currentChunk.byteLength) {
      const result = await waitForUploadRead(this.reader.read(), this.signal);

      if (result.done) {
        this.done = true;
        this.currentChunk = null;
        return false;
      }

      this.currentChunk = result.value;
      this.currentChunkOffset = 0;
    }

    const currentChunk = this.currentChunk;

    if (!currentChunk) {
      return false;
    }

    const sliceLength = Math.min(
      MULTIPART_READ_CHUNK_BYTES,
      currentChunk.byteLength - this.currentChunkOffset,
    );
    const slice = Buffer.from(
      currentChunk.buffer,
      currentChunk.byteOffset + this.currentChunkOffset,
      sliceLength,
    );
    this.currentChunkOffset += sliceLength;
    this.totalBytes += sliceLength;

    if (this.totalBytes > this.maxBytes) {
      throw new LocalUploadRequestError(
        413,
        `Upload request exceeds ${this.maxBytes} bytes.`,
      );
    }

    this.buffer = this.buffer.length
      ? Buffer.concat([this.buffer, slice], this.buffer.length + slice.length)
      : slice;
    return true;
  }

  private async ensureBytes(length: number) {
    while (this.buffer.length < length) {
      if (!(await this.appendChunk())) {
        return false;
      }
    }

    return true;
  }

  private takeBytes(length: number) {
    const value = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return value;
  }

  async expectInitialBoundary(boundary: Buffer) {
    if (!(await this.ensureBytes(boundary.length))) {
      throw new LocalUploadRequestError(400, "Multipart body is incomplete.");
    }

    const received = this.takeBytes(boundary.length);

    if (!received.equals(boundary)) {
      throw new LocalUploadRequestError(400, "Multipart body is malformed.");
    }
  }

  async readUntil(delimiter: Buffer, maximumBytes: number) {
    while (true) {
      const delimiterIndex = this.buffer.indexOf(delimiter);

      if (delimiterIndex >= 0) {
        if (delimiterIndex > maximumBytes) {
          throw new LocalUploadRequestError(
            400,
            "Multipart part headers are too large.",
          );
        }

        const value = this.takeBytes(delimiterIndex);
        this.takeBytes(delimiter.length);
        return value;
      }

      if (this.buffer.length > maximumBytes + delimiter.length) {
        throw new LocalUploadRequestError(400, "Multipart part headers are too large.");
      }

      if (!(await this.appendChunk())) {
        throw new LocalUploadRequestError(400, "Multipart body is incomplete.");
      }
    }
  }

  async consumePart(boundaryMarker: Buffer, consume: (chunk: Buffer) => Promise<void>) {
    const retainedTailBytes = boundaryMarker.length + 2;

    while (true) {
      const boundaryIndex = this.buffer.indexOf(boundaryMarker);

      if (boundaryIndex >= 0) {
        const requiredBytes = boundaryIndex + boundaryMarker.length + 2;

        if (!(await this.ensureBytes(requiredBytes))) {
          throw new LocalUploadRequestError(400, "Multipart body is incomplete.");
        }

        const suffixOffset = boundaryIndex + boundaryMarker.length;
        const firstSuffixByte = this.buffer[suffixOffset];
        const secondSuffixByte = this.buffer[suffixOffset + 1];
        const isNextPart = firstSuffixByte === 0x0d && secondSuffixByte === 0x0a;
        const isFinalPart = firstSuffixByte === 0x2d && secondSuffixByte === 0x2d;

        if (isNextPart || isFinalPart) {
          await consume(this.buffer.subarray(0, boundaryIndex));
          this.buffer = this.buffer.subarray(requiredBytes);
          return isFinalPart;
        }

        // A boundary-shaped byte sequence inside file content is data unless it
        // has a valid multipart delimiter suffix. Consume one byte so scanning
        // can continue without retaining an attacker-controlled prefix.
        await consume(this.buffer.subarray(0, boundaryIndex + 1));
        this.buffer = this.buffer.subarray(boundaryIndex + 1);
        continue;
      }

      if (this.buffer.length > retainedTailBytes) {
        const consumableBytes = this.buffer.length - retainedTailBytes;
        await consume(this.buffer.subarray(0, consumableBytes));
        this.buffer = this.buffer.subarray(consumableBytes);
      }

      if (!(await this.appendChunk())) {
        throw new LocalUploadRequestError(400, "Multipart body is incomplete.");
      }
    }
  }

  async expectEnd() {
    let epilogueIndex = 0;

    while (true) {
      if (this.buffer.length) {
        const bytes = this.takeBytes(this.buffer.length);

        for (const byte of bytes) {
          const expectedByte = epilogueIndex === 0 ? 0x0d : 0x0a;

          if (epilogueIndex >= 2 || byte !== expectedByte) {
            throw new LocalUploadRequestError(
              400,
              "Multipart body has an invalid epilogue.",
            );
          }

          epilogueIndex += 1;
        }
      }

      if (!(await this.appendChunk())) {
        if (epilogueIndex === 1) {
          throw new LocalUploadRequestError(
            400,
            "Multipart body has an invalid epilogue.",
          );
        }

        return;
      }
    }
  }

  async cancel(reason: unknown) {
    if (!this.done) {
      await this.reader.cancel(reason).catch(() => undefined);
      this.done = true;
    }
  }
}

async function writeFileChunk(file: FileHandle, chunk: Buffer) {
  let offset = 0;

  while (offset < chunk.length) {
    const result = await file.write(chunk, offset, chunk.length - offset, null);

    if (result.bytesWritten <= 0) {
      throw new Error("Unable to write uploaded file to temporary storage.");
    }

    offset += result.bytesWritten;
  }
}

function validateMultipartFilename(filename: string) {
  const normalized = filename.normalize("NFC").trim();

  if (
    !normalized ||
    Buffer.byteLength(normalized) > 255 ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    hasAsciiControlCharacter(normalized)
  ) {
    throw new LocalUploadRequestError(
      400,
      "Uploaded files must include a safe filename.",
    );
  }

  return normalized;
}

function normalizeArchivePath(path: string, limits: ResolvedLocalUploadLimits) {
  const normalized = path.normalize("NFC").trim();

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes("\\") ||
    hasAsciiControlCharacter(normalized)
  ) {
    throw new LocalUploadRequestError(
      400,
      "Uploaded file paths must be safe relative paths.",
    );
  }

  const segments = normalized.split("/");

  if (
    segments.length > limits.maxPathDepth ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        Buffer.byteLength(segment) > 100,
    ) ||
    Buffer.byteLength(normalized) > limits.maxPathBytes
  ) {
    throw new LocalUploadRequestError(
      400,
      "Uploaded file paths exceed the allowed depth or length.",
    );
  }

  return segments.join("/");
}

function readCommonTopLevelFolder(paths: string[]) {
  if (!paths.length) {
    return null;
  }

  const [firstPath] = paths;

  if (firstPath === undefined) {
    return null;
  }

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

function isSupportedUploadArchiveName(name: string) {
  const normalized = name.trim().toLowerCase();

  return (
    normalized.endsWith(".zip") ||
    normalized.endsWith(".tgz") ||
    normalized.endsWith(".tar.gz")
  );
}

function inferUploadArchiveContentType(name: string, contentType: string) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.endsWith(".zip")) {
    return "application/zip";
  }

  if (normalizedName.endsWith(".tgz") || normalizedName.endsWith(".tar.gz")) {
    return "application/gzip";
  }

  return contentType.trim() || "application/octet-stream";
}

function resolveArchiveBaseName(
  preferredName?: string | null,
  label?: string | null,
  files: LocalUploadRouteFile[] = [],
) {
  const fileBaseName = stripDeployArchiveExtension(
    readPathBaseName(files[0]?.path ?? "upload"),
  );

  return resolveDeployAppName([preferredName, label, fileBaseName], {
    fallbackSeeds: [preferredName, label, fileBaseName, files[0]?.path],
  });
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

  throw new LocalUploadRequestError(
    400,
    `Uploaded path is too long for tar packaging: ${path}`,
  );
}

function writeTarString(buffer: Buffer, offset: number, length: number, value: string) {
  const encoded = Buffer.from(value, "utf8");
  encoded.copy(buffer, offset, 0, Math.min(encoded.length, length));
}

function writeTarOctal(buffer: Buffer, offset: number, length: number, value: number) {
  const encoded = Buffer.from(
    `${value
      .toString(8)
      .padStart(length - 1, "0")
      .slice(-(length - 1))}\0`,
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

function createArchiveByteLimit(maximumBytes: number) {
  let totalBytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > maximumBytes) {
        callback(
          new LocalUploadRequestError(413, `Archive exceeds ${maximumBytes} bytes.`),
        );
        return;
      }

      callback(null, chunk);
    },
  });
}

async function* createTarChunks(files: LocalUploadRouteFile[], signal: AbortSignal) {
  const modifiedAt = Math.floor(Date.now() / 1000);

  for (const file of files) {
    if (signal.aborted) {
      throw signal.reason ?? new Error("Upload was interrupted.");
    }

    yield createTarHeader(file.path, file.size, modifiedAt);

    const input = createReadStream(file.temporaryPath, {
      highWaterMark: MULTIPART_READ_CHUNK_BYTES,
    });

    for await (const chunk of input) {
      if (signal.aborted) {
        input.destroy();
        throw signal.reason ?? new Error("Upload was interrupted.");
      }

      yield chunk as Buffer;
    }

    const padding = (TAR_BLOCK_BYTES - (file.size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;

    if (padding > 0) {
      yield Buffer.alloc(padding, 0);
    }
  }

  yield Buffer.alloc(TAR_BLOCK_BYTES * 2, 0);
}

function isAbortError(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

type ArchiveValidationState = {
  entryCount: number;
  fileCount: number;
  limits: ResolvedLocalUploadLimits;
  paths: Set<string>;
  totalFileBytes: number;
};

function createArchiveValidationState(limits: ResolvedLocalUploadLimits) {
  return {
    entryCount: 0,
    fileCount: 0,
    limits,
    paths: new Set<string>(),
    totalFileBytes: 0,
  } satisfies ArchiveValidationState;
}

function normalizeDirectArchivePath(
  value: string,
  isDirectory: boolean,
  limits: ResolvedLocalUploadLimits,
) {
  let path = value.normalize("NFC").trim();

  while (path.startsWith("./")) {
    path = path.slice(2);
  }

  if (isDirectory) {
    path = path.replace(/\/+$/g, "");
  }

  if (!path || path === ".") {
    return null;
  }

  return normalizeArchivePath(path, limits);
}

function validateDirectArchiveEntry(
  state: ArchiveValidationState,
  input: {
    isDirectory: boolean;
    path: string;
    size: number;
  },
) {
  state.entryCount += 1;

  if (state.entryCount > state.limits.maxFiles) {
    throw new LocalUploadRequestError(
      413,
      `Archive exceeds ${state.limits.maxFiles} entries.`,
    );
  }

  const normalizedPath = normalizeDirectArchivePath(
    input.path,
    input.isDirectory,
    state.limits,
  );

  if (!normalizedPath) {
    return;
  }

  if (state.paths.has(normalizedPath)) {
    throw new LocalUploadRequestError(
      400,
      `Archive entry path is duplicated: ${normalizedPath}`,
    );
  }

  state.paths.add(normalizedPath);

  if (input.isDirectory) {
    if (input.size !== 0) {
      throw new LocalUploadRequestError(
        400,
        `Archive directory entry has unexpected content: ${normalizedPath}`,
      );
    }

    return;
  }

  if (!Number.isSafeInteger(input.size) || input.size < 0) {
    throw new LocalUploadRequestError(400, "Archive entry size is invalid.");
  }

  state.fileCount += 1;

  if (input.size > state.limits.maxFileBytes) {
    throw new LocalUploadRequestError(
      413,
      `An archived file exceeds ${state.limits.maxFileBytes} bytes.`,
    );
  }

  state.totalFileBytes += input.size;

  if (state.totalFileBytes > state.limits.maxSourceBytes) {
    throw new LocalUploadRequestError(
      413,
      `Archived files exceed ${state.limits.maxSourceBytes} bytes in total.`,
    );
  }
}

class ArchiveStreamReader {
  private currentChunk: Buffer = Buffer.alloc(0);
  private currentOffset = 0;
  private readonly iterator: AsyncIterator<Buffer | string>;
  private totalBytes = 0;

  constructor(
    stream: Readable,
    private readonly maxBytes: number,
  ) {
    this.iterator = stream[Symbol.asyncIterator]();
  }

  private async readNextChunk() {
    const result = await this.iterator.next();

    if (result.done) {
      this.currentChunk = Buffer.alloc(0);
      this.currentOffset = 0;
      return false;
    }

    this.currentChunk = Buffer.isBuffer(result.value)
      ? result.value
      : Buffer.from(result.value);
    this.currentOffset = 0;
    this.totalBytes += this.currentChunk.length;

    if (this.totalBytes > this.maxBytes) {
      throw new LocalUploadRequestError(
        413,
        "Archive expands beyond the allowed uncompressed size.",
      );
    }

    return true;
  }

  async readExactly(length: number, allowEnd = false) {
    const output = Buffer.alloc(length);
    let outputOffset = 0;

    while (outputOffset < length) {
      if (this.currentOffset >= this.currentChunk.length) {
        if (!(await this.readNextChunk())) {
          if (allowEnd && outputOffset === 0) {
            return null;
          }

          throw new LocalUploadRequestError(400, "Archive is truncated.");
        }
      }

      const available = this.currentChunk.length - this.currentOffset;
      const copyLength = Math.min(available, length - outputOffset);
      this.currentChunk.copy(
        output,
        outputOffset,
        this.currentOffset,
        this.currentOffset + copyLength,
      );
      this.currentOffset += copyLength;
      outputOffset += copyLength;
    }

    return output;
  }

  async skip(length: number) {
    let remaining = length;

    while (remaining > 0) {
      if (this.currentOffset >= this.currentChunk.length) {
        if (!(await this.readNextChunk())) {
          throw new LocalUploadRequestError(400, "Archive is truncated.");
        }
      }

      const available = this.currentChunk.length - this.currentOffset;
      const consumed = Math.min(available, remaining);
      this.currentOffset += consumed;
      remaining -= consumed;
    }
  }
}

function isZeroTarBlock(block: Buffer) {
  return block.every((byte) => byte === 0);
}

function readTarString(block: Buffer, start: number, end: number) {
  const field = block.subarray(start, end);
  const nullIndex = field.indexOf(0);
  return decodeUtf8(
    nullIndex >= 0 ? field.subarray(0, nullIndex) : field,
    "archive path",
  ).trim();
}

function readTarNumber(block: Buffer, start: number, end: number) {
  const field = block.subarray(start, end);

  if ((field[0] ?? 0) & 0x80) {
    throw new LocalUploadRequestError(
      400,
      "Archive uses an unsupported numeric encoding.",
    );
  }

  const value = field.toString("ascii").replace(/\0.*$/s, "").trim();

  if (!value) {
    return 0;
  }

  if (!/^[0-7]+$/.test(value)) {
    throw new LocalUploadRequestError(400, "Archive header is invalid.");
  }

  const parsed = Number.parseInt(value, 8);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new LocalUploadRequestError(400, "Archive entry size is invalid.");
  }

  return parsed;
}

function validateTarChecksum(header: Buffer) {
  const expected = readTarNumber(header, 148, 156);
  let actual = 0;

  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0);
  }

  if (actual !== expected) {
    throw new LocalUploadRequestError(400, "Archive header checksum is invalid.");
  }
}

function parsePaxAttributes(value: Buffer) {
  const attributes = new Map<string, string>();
  let offset = 0;

  while (offset < value.length) {
    const spaceIndex = value.indexOf(0x20, offset);

    if (spaceIndex <= offset) {
      throw new LocalUploadRequestError(400, "Archive PAX metadata is invalid.");
    }

    const lengthText = value.subarray(offset, spaceIndex).toString("ascii");

    if (!/^\d+$/.test(lengthText)) {
      throw new LocalUploadRequestError(400, "Archive PAX metadata is invalid.");
    }

    const recordLength = Number(lengthText);
    const recordEnd = offset + recordLength;

    if (
      !Number.isSafeInteger(recordLength) ||
      recordLength <= spaceIndex - offset + 2 ||
      recordEnd > value.length ||
      value[recordEnd - 1] !== 0x0a
    ) {
      throw new LocalUploadRequestError(400, "Archive PAX metadata is invalid.");
    }

    const record = decodeUtf8(
      value.subarray(spaceIndex + 1, recordEnd - 1),
      "PAX metadata",
    );
    const separator = record.indexOf("=");

    if (separator <= 0) {
      throw new LocalUploadRequestError(400, "Archive PAX metadata is invalid.");
    }

    attributes.set(record.slice(0, separator), record.slice(separator + 1));
    offset = recordEnd;
  }

  return attributes;
}

function readPaxSize(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new LocalUploadRequestError(400, "Archive PAX size is invalid.");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new LocalUploadRequestError(400, "Archive PAX size is invalid.");
  }

  return parsed;
}

async function validateTarGzipArchive(
  archive: LocalUploadRouteArchive,
  limits: ResolvedLocalUploadLimits,
) {
  const input = createReadStream(archive.temporaryPath, {
    highWaterMark: MULTIPART_READ_CHUNK_BYTES,
  });
  const gunzip = createGunzip();
  input.pipe(gunzip);
  const maximumDecodedBytes =
    limits.maxSourceBytes +
    limits.maxFiles * TAR_BLOCK_BYTES * 2 +
    limits.maxFieldBytes;
  const reader = new ArchiveStreamReader(gunzip, maximumDecodedBytes);
  const validation = createArchiveValidationState(limits);
  let nextPath: string | null = null;
  let nextSize: number | null = null;
  let headerCount = 0;
  let zeroBlockCount = 0;

  try {
    while (true) {
      const header = await reader.readExactly(TAR_BLOCK_BYTES, true);

      if (!header) {
        if (zeroBlockCount >= 2) {
          break;
        }

        throw new LocalUploadRequestError(400, "Archive is missing its trailer.");
      }

      if (isZeroTarBlock(header)) {
        zeroBlockCount += 1;

        if (zeroBlockCount >= 2) {
          break;
        }

        continue;
      }

      if (zeroBlockCount > 0) {
        throw new LocalUploadRequestError(400, "Archive trailer is invalid.");
      }

      headerCount += 1;

      if (headerCount > limits.maxFiles * 2 + 16) {
        throw new LocalUploadRequestError(413, "Archive has too many headers.");
      }

      validateTarChecksum(header);
      const headerSize = readTarNumber(header, 124, 136);
      const type = header[156] ?? 0;
      const name = readTarString(header, 0, 100);
      const prefix = readTarString(header, 345, 500);
      const headerPath = prefix ? `${prefix}/${name}` : name;

      if (type === 0x78 || type === 0x67) {
        if (headerSize > limits.maxFieldBytes) {
          throw new LocalUploadRequestError(413, "Archive metadata is too large.");
        }

        const metadata = await reader.readExactly(headerSize);

        if (!metadata) {
          throw new LocalUploadRequestError(400, "Archive is truncated.");
        }

        if (type === 0x78) {
          const attributes = parsePaxAttributes(metadata);
          nextPath = attributes.get("path") ?? null;
          nextSize = readPaxSize(attributes.get("size"));
        }

        const padding =
          (TAR_BLOCK_BYTES - (headerSize % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
        await reader.skip(padding);
        continue;
      }

      if (type === 0x4c) {
        if (headerSize > limits.maxPathBytes + 1) {
          throw new LocalUploadRequestError(400, "Archive path is too long.");
        }

        const longName = await reader.readExactly(headerSize);

        if (!longName) {
          throw new LocalUploadRequestError(400, "Archive is truncated.");
        }

        nextPath = decodeUtf8(longName, "archive path").replace(/\0+$/g, "");
        const padding =
          (TAR_BLOCK_BYTES - (headerSize % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
        await reader.skip(padding);
        continue;
      }

      const entryPath = nextPath ?? headerPath;
      const entrySize = nextSize ?? headerSize;
      nextPath = null;
      nextSize = null;

      if (type === 0 || type === 0x30) {
        validateDirectArchiveEntry(validation, {
          isDirectory: false,
          path: entryPath,
          size: entrySize,
        });
      } else if (type === 0x35) {
        validateDirectArchiveEntry(validation, {
          isDirectory: true,
          path: entryPath,
          size: entrySize,
        });
      } else {
        throw new LocalUploadRequestError(
          400,
          "Archive links and special files are not allowed.",
        );
      }

      await reader.skip(entrySize);
      const padding =
        (TAR_BLOCK_BYTES - (entrySize % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
      await reader.skip(padding);
    }

    if (validation.fileCount === 0) {
      throw new LocalUploadRequestError(400, "Archive does not contain any files.");
    }
  } catch (error) {
    if (error instanceof LocalUploadRequestError) {
      throw error;
    }

    throw new LocalUploadRequestError(400, "Archive gzip data is invalid.");
  } finally {
    input.destroy();
    gunzip.destroy();
  }
}

async function readFileRange(handle: FileHandle, offset: number, length: number) {
  const output = Buffer.alloc(length);
  let outputOffset = 0;

  while (outputOffset < length) {
    const result = await handle.read(
      output,
      outputOffset,
      length - outputOffset,
      offset + outputOffset,
    );

    if (result.bytesRead <= 0) {
      throw new LocalUploadRequestError(400, "Archive is truncated.");
    }

    outputOffset += result.bytesRead;
  }

  return output;
}

function decodeZipPath(value: Buffer, isUtf8: boolean) {
  if (!isUtf8 && value.some((byte) => byte > 0x7f)) {
    throw new LocalUploadRequestError(
      400,
      "Archive paths must use UTF-8 or ASCII encoding.",
    );
  }

  return decodeUtf8(value, "archive path");
}

async function validateZipEntryContents(
  archive: LocalUploadRouteArchive,
  input: {
    compressedSize: number;
    compression: number;
    dataOffset: number;
    uncompressedSize: number;
  },
) {
  if (input.compression === 0) {
    if (input.compressedSize !== input.uncompressedSize) {
      throw new LocalUploadRequestError(
        400,
        "Stored ZIP entry size does not match its directory metadata.",
      );
    }

    return;
  }

  if (input.compressedSize === 0) {
    throw new LocalUploadRequestError(400, "Archive ZIP entry is truncated.");
  }

  const compressed = createReadStream(archive.temporaryPath, {
    end: input.dataOffset + input.compressedSize - 1,
    highWaterMark: MULTIPART_READ_CHUNK_BYTES,
    start: input.dataOffset,
  });
  const inflated = createInflateRaw();
  compressed.pipe(inflated);
  let decodedBytes = 0;

  try {
    for await (const chunk of inflated) {
      decodedBytes += Buffer.byteLength(chunk as Buffer);

      if (decodedBytes > input.uncompressedSize) {
        throw new LocalUploadRequestError(
          413,
          "Archive ZIP entry expands beyond its declared size.",
        );
      }
    }
  } catch (error) {
    if (error instanceof LocalUploadRequestError) {
      throw error;
    }

    throw new LocalUploadRequestError(400, "Archive ZIP data is invalid.");
  } finally {
    compressed.destroy();
    inflated.destroy();
  }

  if (decodedBytes !== input.uncompressedSize) {
    throw new LocalUploadRequestError(
      400,
      "Archive ZIP entry size does not match its directory metadata.",
    );
  }
}

async function validateZipArchive(
  archive: LocalUploadRouteArchive,
  limits: ResolvedLocalUploadLimits,
) {
  const handle = await open(archive.temporaryPath, "r");

  try {
    const tailLength = Math.min(archive.size, 65_557);
    const tailOffset = archive.size - tailLength;
    const tail = await readFileRange(handle, tailOffset, tailLength);
    let endOffset = -1;

    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) !== 0x06054b50) {
        continue;
      }

      const commentLength = tail.readUInt16LE(index + 20);

      if (index + 22 + commentLength === tail.length) {
        endOffset = index;
        break;
      }
    }

    if (endOffset < 0) {
      throw new LocalUploadRequestError(400, "Archive ZIP trailer is invalid.");
    }

    const diskNumber = tail.readUInt16LE(endOffset + 4);
    const centralDisk = tail.readUInt16LE(endOffset + 6);
    const diskEntries = tail.readUInt16LE(endOffset + 8);
    const totalEntries = tail.readUInt16LE(endOffset + 10);
    const centralSize = tail.readUInt32LE(endOffset + 12);
    const centralOffset = tail.readUInt32LE(endOffset + 16);
    const absoluteEndOffset = tailOffset + endOffset;

    if (
      diskNumber !== 0 ||
      centralDisk !== 0 ||
      diskEntries !== totalEntries ||
      totalEntries === 0xffff ||
      centralSize === 0xffffffff ||
      centralOffset === 0xffffffff
    ) {
      throw new LocalUploadRequestError(
        400,
        "Multi-disk and ZIP64 archives are not supported.",
      );
    }

    if (totalEntries === 0) {
      throw new LocalUploadRequestError(400, "Archive does not contain any files.");
    }

    if (totalEntries > limits.maxFiles) {
      throw new LocalUploadRequestError(
        413,
        `Archive exceeds ${limits.maxFiles} entries.`,
      );
    }

    if (
      centralOffset + centralSize > absoluteEndOffset ||
      centralOffset + centralSize > archive.size
    ) {
      throw new LocalUploadRequestError(400, "Archive ZIP directory is invalid.");
    }

    const validation = createArchiveValidationState(limits);
    let offset = centralOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      const header = await readFileRange(handle, offset, 46);

      if (header.readUInt32LE(0) !== 0x02014b50) {
        throw new LocalUploadRequestError(400, "Archive ZIP entry is invalid.");
      }

      const versionMadeBy = header.readUInt16LE(4);
      const flags = header.readUInt16LE(8);
      const compression = header.readUInt16LE(10);
      const compressedSize = header.readUInt32LE(20);
      const uncompressedSize = header.readUInt32LE(24);
      const nameLength = header.readUInt16LE(28);
      const extraLength = header.readUInt16LE(30);
      const commentLength = header.readUInt16LE(32);
      const diskStart = header.readUInt16LE(34);
      const externalAttributes = header.readUInt32LE(38);
      const localHeaderOffset = header.readUInt32LE(42);

      if (
        diskStart !== 0 ||
        compressedSize === 0xffffffff ||
        uncompressedSize === 0xffffffff ||
        localHeaderOffset === 0xffffffff
      ) {
        throw new LocalUploadRequestError(
          400,
          "Multi-disk and ZIP64 archives are not supported.",
        );
      }

      if ((flags & 0x1) !== 0) {
        throw new LocalUploadRequestError(400, "Encrypted archives are not supported.");
      }

      if (compression !== 0 && compression !== 8) {
        throw new LocalUploadRequestError(
          400,
          "Archive uses an unsupported compression method.",
        );
      }

      if (nameLength === 0 || nameLength > limits.maxPathBytes + 2) {
        throw new LocalUploadRequestError(400, "Archive path is too long.");
      }

      const entryEnd = offset + 46 + nameLength + extraLength + commentLength;

      if (entryEnd > centralOffset + centralSize) {
        throw new LocalUploadRequestError(400, "Archive ZIP entry is truncated.");
      }

      const rawPath = await readFileRange(handle, offset + 46, nameLength);
      const path = decodeZipPath(rawPath, (flags & 0x800) !== 0);
      const madeByPlatform = versionMadeBy >>> 8;
      const unixMode = madeByPlatform === 3 ? externalAttributes >>> 16 : 0;
      const unixType = unixMode & 0xf000;
      const isDirectory =
        path.endsWith("/") || (externalAttributes & 0x10) !== 0 || unixType === 0x4000;

      if (
        madeByPlatform === 3 &&
        unixType !== 0 &&
        unixType !== 0x4000 &&
        unixType !== 0x8000
      ) {
        throw new LocalUploadRequestError(
          400,
          "Archive links and special files are not allowed.",
        );
      }

      if (compressedSize > archive.size || localHeaderOffset >= centralOffset) {
        throw new LocalUploadRequestError(400, "Archive ZIP entry is invalid.");
      }

      const localHeader = await readFileRange(handle, localHeaderOffset, 30);

      if (
        localHeader.readUInt32LE(0) !== 0x04034b50 ||
        localHeader.readUInt16LE(6) !== flags ||
        localHeader.readUInt16LE(8) !== compression
      ) {
        throw new LocalUploadRequestError(400, "Archive ZIP entry is invalid.");
      }

      const localNameLength = localHeader.readUInt16LE(26);
      const localExtraLength = localHeader.readUInt16LE(28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;

      if (dataOffset + compressedSize > centralOffset) {
        throw new LocalUploadRequestError(400, "Archive ZIP entry is truncated.");
      }

      const localRawPath = await readFileRange(
        handle,
        localHeaderOffset + 30,
        localNameLength,
      );
      const localPath = decodeZipPath(localRawPath, (flags & 0x800) !== 0);

      if (localPath !== path) {
        throw new LocalUploadRequestError(
          400,
          "Archive ZIP local and directory paths do not match.",
        );
      }

      validateDirectArchiveEntry(validation, {
        isDirectory,
        path,
        size: uncompressedSize,
      });
      await validateZipEntryContents(archive, {
        compressedSize,
        compression,
        dataOffset,
        uncompressedSize,
      });
      offset = entryEnd;
    }

    if (offset !== centralOffset + centralSize) {
      throw new LocalUploadRequestError(400, "Archive ZIP directory is invalid.");
    }

    if (validation.fileCount === 0) {
      throw new LocalUploadRequestError(400, "Archive does not contain any files.");
    }
  } finally {
    await handle.close();
  }
}

async function validateDirectArchive(
  archive: LocalUploadRouteArchive,
  limits: ResolvedLocalUploadLimits,
) {
  const handle = await open(archive.temporaryPath, "r");
  let isGzip = false;
  let isZip = false;

  try {
    const signature = Buffer.alloc(4);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    const normalizedName = archive.name.toLowerCase();
    isGzip = signature[0] === 0x1f && signature[1] === 0x8b;
    isZip =
      bytesRead >= 4 &&
      signature[0] === 0x50 &&
      signature[1] === 0x4b &&
      ((signature[2] === 0x03 && signature[3] === 0x04) ||
        (signature[2] === 0x05 && signature[3] === 0x06) ||
        (signature[2] === 0x07 && signature[3] === 0x08));

    if (
      ((normalizedName.endsWith(".tgz") || normalizedName.endsWith(".tar.gz")) &&
        !isGzip) ||
      (normalizedName.endsWith(".zip") && !isZip)
    ) {
      throw new LocalUploadRequestError(
        415,
        "Uploaded archive content does not match its filename extension.",
      );
    }
  } finally {
    await handle.close();
  }

  if (isGzip) {
    await validateTarGzipArchive(archive, limits);
  } else if (isZip) {
    await validateZipArchive(archive, limits);
  }
}

async function parseMultipartBody(
  request: Request,
  boundary: string,
  temporaryDirectory: string,
  limits: ResolvedLocalUploadLimits,
  signal: AbortSignal,
) {
  if (!request.body) {
    throw new LocalUploadRequestError(400, "Multipart request body is empty.");
  }

  const reader = new MultipartByteReader(request.body, limits.maxRequestBytes, signal);
  const initialBoundary = Buffer.from(`--${boundary}\r\n`, "utf8");
  const boundaryMarker = Buffer.from(`\r\n--${boundary}`, "utf8");
  const headerDelimiter = Buffer.from("\r\n\r\n", "ascii");
  const fields = new Map<string, string[]>();
  const fileParts: Array<{
    contentType: string;
    fieldName: string;
    filename: string;
    size: number;
    temporaryPath: string;
  }> = [];
  let archivePartCount = 0;
  let sourceFilePartCount = 0;
  let totalSourceFileBytes = 0;
  let partCount = 0;

  try {
    await reader.expectInitialBoundary(initialBoundary);
    let finalPart = false;

    while (!finalPart) {
      partCount += 1;

      if (partCount > limits.maxFiles * 2 + 4) {
        throw new LocalUploadRequestError(413, "Upload has too many multipart parts.");
      }

      const rawHeaders = await reader.readUntil(headerDelimiter, limits.maxHeaderBytes);
      const headers = parseMultipartPartHeaders(rawHeaders);

      if (headers.filename !== null) {
        if (headers.fieldName !== "archive" && headers.fieldName !== "files") {
          throw new LocalUploadRequestError(
            400,
            `Unsupported multipart file field: ${headers.fieldName}.`,
          );
        }

        if (headers.fieldName === "archive" && archivePartCount > 0) {
          throw new LocalUploadRequestError(400, "Only one archive may be uploaded.");
        }

        if (headers.fieldName === "files" && sourceFilePartCount >= limits.maxFiles) {
          throw new LocalUploadRequestError(
            413,
            `Upload exceeds ${limits.maxFiles} files.`,
          );
        }

        const filename = validateMultipartFilename(headers.filename);
        const temporaryPath = join(
          temporaryDirectory,
          `${String(fileParts.length).padStart(4, "0")}-${randomUUID()}`,
        );
        const output = await open(temporaryPath, "wx", 0o600);
        let fileBytes = 0;

        try {
          finalPart = await reader.consumePart(boundaryMarker, async (chunk) => {
            if (!chunk.length) {
              return;
            }

            fileBytes += chunk.length;

            if (headers.fieldName === "archive") {
              if (fileBytes > limits.maxArchiveBytes) {
                throw new LocalUploadRequestError(
                  413,
                  `Archive exceeds ${limits.maxArchiveBytes} bytes.`,
                );
              }
            } else {
              totalSourceFileBytes += chunk.length;

              if (fileBytes > limits.maxFileBytes) {
                throw new LocalUploadRequestError(
                  413,
                  `A file exceeds ${limits.maxFileBytes} bytes.`,
                );
              }

              if (totalSourceFileBytes > limits.maxSourceBytes) {
                throw new LocalUploadRequestError(
                  413,
                  `Uploaded files exceed ${limits.maxSourceBytes} bytes in total.`,
                );
              }
            }

            await writeFileChunk(output, chunk);
          });
        } finally {
          await output.close();
        }

        fileParts.push({
          contentType: headers.contentType,
          fieldName: headers.fieldName,
          filename,
          size: fileBytes,
          temporaryPath,
        });

        if (headers.fieldName === "archive") {
          archivePartCount += 1;
        } else {
          sourceFilePartCount += 1;
        }

        continue;
      }

      if (
        headers.fieldName !== "payload" &&
        headers.fieldName !== "label" &&
        headers.fieldName !== "paths"
      ) {
        throw new LocalUploadRequestError(
          400,
          `Unsupported multipart field: ${headers.fieldName}.`,
        );
      }

      const fieldLimit =
        headers.fieldName === "label"
          ? limits.maxLabelBytes
          : headers.fieldName === "paths"
            ? limits.maxPathBytes
            : limits.maxFieldBytes;
      const chunks: Buffer[] = [];
      let fieldBytes = 0;

      finalPart = await reader.consumePart(boundaryMarker, async (chunk) => {
        fieldBytes += chunk.length;

        if (fieldBytes > fieldLimit) {
          throw new LocalUploadRequestError(
            413,
            `Multipart field ${headers.fieldName} exceeds ${fieldLimit} bytes.`,
          );
        }

        if (chunk.length) {
          chunks.push(Buffer.from(chunk));
        }
      });

      const values = fields.get(headers.fieldName) ?? [];

      if (headers.fieldName !== "paths" && values.length > 0) {
        throw new LocalUploadRequestError(
          400,
          `Multipart field ${headers.fieldName} may only be sent once.`,
        );
      }

      if (headers.fieldName === "paths" && values.length >= limits.maxFiles) {
        throw new LocalUploadRequestError(
          413,
          `Upload exceeds ${limits.maxFiles} paths.`,
        );
      }

      values.push(decodeUtf8(Buffer.concat(chunks, fieldBytes), headers.fieldName));
      fields.set(headers.fieldName, values);
    }

    await reader.expectEnd();
  } catch (error) {
    await reader.cancel(error);
    throw error;
  }

  const rawPayload = fields.get("payload")?.[0] ?? "";

  if (!rawPayload.trim()) {
    throw new LocalUploadRequestError(400, "Multipart field payload is required.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new LocalUploadRequestError(
      400,
      "Multipart field payload must be valid JSON.",
    );
  }

  if (!isObject(payload)) {
    throw new LocalUploadRequestError(
      400,
      "Multipart field payload must be a JSON object.",
    );
  }

  const labelValue = fields.get("label")?.[0]?.trim() ?? "";
  const archiveParts = fileParts.filter((part) => part.fieldName === "archive");
  const sourceFileParts = fileParts.filter((part) => part.fieldName === "files");
  const pathValues = fields.get("paths") ?? [];

  if (archiveParts.length > 0) {
    if (sourceFileParts.length > 0 || pathValues.length > 0) {
      throw new LocalUploadRequestError(
        400,
        "Upload either a source archive or source files, not both.",
      );
    }

    const [archivePart] = archiveParts;

    if (!archivePart || !isSupportedUploadArchiveName(archivePart.filename)) {
      throw new LocalUploadRequestError(
        400,
        "The uploaded archive must end with .zip, .tgz, or .tar.gz.",
      );
    }

    if (archivePart.size === 0) {
      throw new LocalUploadRequestError(400, "The uploaded archive is empty.");
    }

    return {
      kind: "archive" as const,
      archive: {
        contentType: inferUploadArchiveContentType(
          archivePart.filename,
          archivePart.contentType,
        ),
        name: archivePart.filename,
        size: archivePart.size,
        temporaryPath: archivePart.temporaryPath,
      },
      label: labelValue || stripDeployArchiveExtension(archivePart.filename) || null,
      payload,
      requestBytes: reader.bytesRead(),
    };
  }

  if (!sourceFileParts.length) {
    throw new LocalUploadRequestError(400, DIRECT_UPLOAD_ARCHIVE_ERROR);
  }

  if (sourceFileParts.length !== pathValues.length) {
    throw new LocalUploadRequestError(400, "Uploaded files are missing path metadata.");
  }

  const seenPaths = new Set<string>();
  const files = sourceFileParts.map((part, index) => {
    const path = pathValues[index];

    if (typeof path !== "string") {
      throw new LocalUploadRequestError(
        400,
        "Each uploaded file must include a relative path.",
      );
    }

    const normalizedPath = normalizeArchivePath(path, limits);

    if (seenPaths.has(normalizedPath)) {
      throw new LocalUploadRequestError(
        400,
        `Uploaded file path is duplicated: ${normalizedPath}`,
      );
    }

    seenPaths.add(normalizedPath);
    return {
      path: normalizedPath,
      size: part.size,
      temporaryPath: part.temporaryPath,
    };
  });

  return {
    kind: "files" as const,
    files,
    label: labelValue || null,
    payload,
    requestBytes: reader.bytesRead(),
  };
}

export async function readLocalUploadMultipartRequest(
  request: Request,
  limitOverrides: LocalUploadLimitOverrides = {},
) {
  const observation = createLocalUploadObservation();
  let releaseSlot: (() => void) | null = null;
  let abortBoundary: ReturnType<typeof createUploadAbortBoundary> | null = null;
  let temporaryDirectory = "";

  try {
    const limits = resolveLocalUploadLimits(limitOverrides);
    const boundary = validateMultipartRequestHeaders(request, limits);
    releaseSlot = acquireUploadRequestSlot(limits.maxConcurrentRequests);
    abortBoundary = createUploadAbortBoundary(
      request.signal,
      limits.maxDurationMilliseconds,
    );
    temporaryDirectory = await mkdtemp(join(tmpdir(), TEMP_DIRECTORY_PREFIX));
    await chmod(temporaryDirectory, 0o700);
    const { requestBytes, ...parsed } = await parseMultipartBody(
      request,
      boundary,
      temporaryDirectory,
      limits,
      abortBoundary.signal,
    );
    observation.summary.requestBytes = requestBytes;
    observation.summary.fileCount = parsed.kind === "archive" ? 1 : parsed.files.length;
    observation.summary.sourceBytes =
      parsed.kind === "archive"
        ? parsed.archive.size
        : parsed.files.reduce((total, file) => total + file.size, 0);
    let cleaned = false;
    const upload = {
      ...parsed,
      cleanup: async () => {
        if (cleaned) {
          return;
        }

        cleaned = true;
        let cleanup: "failed" | "succeeded" = "succeeded";

        try {
          await rm(temporaryDirectory, {
            force: true,
            maxRetries: 3,
            recursive: true,
            retryDelay: 50,
          });
        } catch {
          cleanup = "failed";
          console.error("Failed to clean a local upload temporary directory.");
        } finally {
          abortBoundary?.cleanup();
          releaseSlot?.();
          observation.finish({ cleanup, outcome: "completed" });
        }
      },
      limits,
      signal: abortBoundary.signal,
      temporaryDirectory,
    } satisfies LocalUploadMultipartRequest;
    localUploadObservations.set(upload, observation);
    return upload;
  } catch (error) {
    let cleanup: "failed" | "not-created" | "succeeded" = temporaryDirectory
      ? "succeeded"
      : "not-created";

    if (temporaryDirectory) {
      try {
        await rm(temporaryDirectory, {
          force: true,
          maxRetries: 3,
          recursive: true,
          retryDelay: 50,
        });
      } catch {
        cleanup = "failed";
      }
    }

    abortBoundary?.cleanup();
    releaseSlot?.();
    observation.finish({ cleanup, error, outcome: "rejected" });
    throw error;
  }
}

export async function createLocalUploadArchive(
  upload: Extract<LocalUploadMultipartRequest, { kind: "files" }>,
  options?: {
    archiveBaseName?: string | null;
    label?: string | null;
  },
) {
  const normalizedFiles = stripCommonArchiveRoot(upload.files);

  if (!normalizedFiles.length || normalizedFiles.some((file) => !file.path)) {
    throw new LocalUploadRequestError(
      400,
      "Uploaded files must stay within the selected folder.",
    );
  }

  const outputPath = join(upload.temporaryDirectory, `archive-${randomUUID()}.tgz`);

  try {
    await pipeline(
      Readable.from(createTarChunks(normalizedFiles, upload.signal)),
      createGzip(),
      createArchiveByteLimit(upload.limits.maxArchiveBytes),
      createWriteStream(outputPath, { flags: "wx", mode: 0o600 }),
      { signal: upload.signal },
    );
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined);

    if (isAbortError(error) || upload.signal.aborted) {
      const interruptedError = new LocalUploadRequestError(
        400,
        "Upload was interrupted.",
      );
      recordLocalUploadRejection(upload, interruptedError.status, interruptedError);
      throw interruptedError;
    }

    recordLocalUploadRejection(upload, readLocalUploadErrorStatus(error), error);
    throw error;
  }

  const archiveStats = await stat(outputPath);
  const observation = localUploadObservations.get(upload);

  if (observation) {
    observation.summary.archiveBytes = archiveStats.size;
  }

  if (archiveStats.size <= 0) {
    const error = new Error("Generated upload archive is empty.");
    recordLocalUploadRejection(upload, 500, error);
    throw error;
  }

  if (archiveStats.size > upload.limits.maxArchiveBytes) {
    const error = new LocalUploadRequestError(
      413,
      `Archive exceeds ${upload.limits.maxArchiveBytes} bytes.`,
    );
    recordLocalUploadRejection(upload, error.status, error);
    throw error;
  }

  const resolvedAppName = resolveArchiveBaseName(
    options?.archiveBaseName,
    options?.label,
    normalizedFiles,
  );

  return {
    archiveBody: await openAsBlob(outputPath, { type: "application/gzip" }),
    archiveContentType: "application/gzip",
    archiveName: `${resolvedAppName}.tgz`,
    archiveSize: archiveStats.size,
    files: normalizedFiles,
    resolvedAppName,
  };
}

export async function prepareLocalUploadArchive(
  upload: LocalUploadMultipartRequest,
  options?: {
    archiveBaseName?: string | null;
    label?: string | null;
  },
) {
  if (upload.kind === "archive") {
    try {
      await validateDirectArchive(upload.archive, upload.limits);
    } catch (error) {
      recordLocalUploadRejection(upload, readLocalUploadErrorStatus(error), error);
      throw error;
    }
    const observation = localUploadObservations.get(upload);

    if (observation) {
      observation.summary.archiveBytes = upload.archive.size;
    }

    return {
      archiveBody: await openAsBlob(upload.archive.temporaryPath, {
        type: upload.archive.contentType,
      }),
      archiveContentType: upload.archive.contentType,
      archiveName: upload.archive.name,
      archiveSize: upload.archive.size,
      resolvedAppName: resolveDeployAppName(
        [
          options?.archiveBaseName,
          options?.label,
          stripDeployArchiveExtension(upload.archive.name),
        ],
        {
          fallbackSeeds: [
            options?.archiveBaseName,
            options?.label,
            upload.archive.name,
          ],
        },
      ),
    };
  }

  return createLocalUploadArchive(upload, options);
}

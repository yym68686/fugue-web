import { mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLocalUploadArchive,
  readLocalUploadMultipartRequest,
} from "../lib/fugue/local-upload-server";

const TEMP_DIRECTORY_PREFIX = "fugue-web-upload-";
const CONCURRENT_UPLOADS = 2;
const SOURCE_BYTES_PER_UPLOAD = 16 << 20;
const RSS_DELTA_BUDGET_BYTES = 96 << 20;
const EVENT_LOOP_GAP_BUDGET_MILLISECONDS = 250;
const BODY_CHUNK_BYTES = 64 << 10;
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function multipartField(boundary: string, name: string, value: string) {
  return Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    "utf8",
  );
}

async function* createMultipartChunks(boundary: string, uploadIndex: number) {
  yield multipartField(
    boundary,
    "payload",
    JSON.stringify({ name: `stress-${uploadIndex}`, sourceMode: "local-upload" }),
  );
  yield Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="payload.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    "utf8",
  );

  const chunk = Buffer.alloc(BODY_CHUNK_BYTES, uploadIndex + 1);
  let remaining = SOURCE_BYTES_PER_UPLOAD;

  while (remaining > 0) {
    const length = Math.min(remaining, chunk.length);
    yield chunk.subarray(0, length);
    remaining -= length;
    await new Promise<void>((resolveChunk) => setImmediate(resolveChunk));
  }

  yield Buffer.from("\r\n", "ascii");
  yield multipartField(boundary, "paths", `stress-${uploadIndex}/payload.bin`);
  yield Buffer.from(`--${boundary}--\r\n`, "ascii");
}

function createUploadRequest(uploadIndex: number) {
  const boundary = `fugue-stress-${uploadIndex}`;
  const iterator = createMultipartChunks(boundary, uploadIndex);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();

      if (next.done) {
        controller.close();
        return;
      }

      controller.enqueue(next.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Request("http://localhost/api/fugue/upload-stress", {
    body,
    duplex: "half",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    method: "POST",
  } as RequestInit & { duplex: "half" });
}

async function listTemporaryDirectories() {
  return new Set(
    (await readdir(tmpdir())).filter((name) => name.startsWith(TEMP_DIRECTORY_PREFIX)),
  );
}

async function runUpload(uploadIndex: number) {
  const upload = await readLocalUploadMultipartRequest(
    createUploadRequest(uploadIndex),
    {
      maxArchiveBytes: SOURCE_BYTES_PER_UPLOAD,
      maxConcurrentRequests: CONCURRENT_UPLOADS,
      maxFileBytes: SOURCE_BYTES_PER_UPLOAD,
      maxRequestBytes: SOURCE_BYTES_PER_UPLOAD + (1 << 20),
      maxSourceBytes: SOURCE_BYTES_PER_UPLOAD,
    },
  );

  try {
    if (upload.kind !== "files") {
      throw new Error("Stress fixture unexpectedly parsed as a direct archive.");
    }

    const archive = await createLocalUploadArchive(upload, {
      archiveBaseName: `stress-${uploadIndex}`,
    });

    if (
      archive.files.length !== 1 ||
      archive.files[0]?.size !== SOURCE_BYTES_PER_UPLOAD
    ) {
      throw new Error("Stress archive did not preserve the uploaded file size.");
    }
  } finally {
    await upload.cleanup();
  }
}

const temporaryDirectoriesBefore = await listTemporaryDirectories();
const rssAtStart = process.memoryUsage.rss();
let peakRssBytes = rssAtStart;
let lastTickAt = performance.now();
let maximumEventLoopGapMilliseconds = 0;
let healthTicks = 0;
const monitor = setInterval(() => {
  const now = performance.now();
  maximumEventLoopGapMilliseconds = Math.max(
    maximumEventLoopGapMilliseconds,
    now - lastTickAt,
  );
  lastTickAt = now;
  healthTicks += 1;
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss());
}, 10);
const startedAt = performance.now();

try {
  await Promise.all(
    Array.from({ length: CONCURRENT_UPLOADS }, (_, index) => runUpload(index)),
  );
} finally {
  clearInterval(monitor);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss());
}

const durationMilliseconds = performance.now() - startedAt;
const temporaryDirectoriesAfter = await listTemporaryDirectories();
const leakedTemporaryDirectories = [...temporaryDirectoriesAfter].filter(
  (name) => !temporaryDirectoriesBefore.has(name),
);
const rssDeltaBytes = Math.max(0, peakRssBytes - rssAtStart);
const totalSourceBytes = SOURCE_BYTES_PER_UPLOAD * CONCURRENT_UPLOADS;
const report = {
  concurrent_uploads: CONCURRENT_UPLOADS,
  duration_ms: Math.round(durationMilliseconds),
  event_loop_gap_budget_ms: EVENT_LOOP_GAP_BUDGET_MILLISECONDS,
  health_ticks: healthTicks,
  max_event_loop_gap_ms: Math.round(maximumEventLoopGapMilliseconds * 100) / 100,
  peak_rss_bytes: peakRssBytes,
  rss_at_start_bytes: rssAtStart,
  rss_delta_budget_bytes: RSS_DELTA_BUDGET_BYTES,
  rss_delta_bytes: rssDeltaBytes,
  source_bytes_per_upload: SOURCE_BYTES_PER_UPLOAD,
  temporary_directories_cleaned: leakedTemporaryDirectories.length === 0,
  throughput_bytes_per_second: Math.round(
    totalSourceBytes / (durationMilliseconds / 1_000),
  ),
  total_source_bytes: totalSourceBytes,
};
const reportPath = resolve(
  workspaceRoot,
  readArgument("--report") ??
    process.env.UPLOAD_STRESS_REPORT ??
    "artifacts/upload-stress.json",
);

await mkdir(dirname(reportPath), { recursive: true });
await Bun.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.info(JSON.stringify({ event: "fugue_web_upload_stress", ...report }));

if (rssDeltaBytes > RSS_DELTA_BUDGET_BYTES) {
  throw new Error(
    `Upload stress RSS delta ${rssDeltaBytes} exceeded ${RSS_DELTA_BUDGET_BYTES} bytes.`,
  );
}

if (maximumEventLoopGapMilliseconds > EVENT_LOOP_GAP_BUDGET_MILLISECONDS) {
  throw new Error(
    `Upload stress event-loop gap ${maximumEventLoopGapMilliseconds.toFixed(2)}ms exceeded ${EVENT_LOOP_GAP_BUDGET_MILLISECONDS}ms.`,
  );
}

if (healthTicks === 0) {
  throw new Error("Upload stress blocked the event loop health ticker.");
}

if (leakedTemporaryDirectories.length > 0) {
  throw new Error("Upload stress leaked request-scoped temporary directories.");
}

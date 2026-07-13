import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";
import { deflateRawSync, gunzip, gzipSync } from "node:zlib";

import {
  DEFAULT_LOCAL_UPLOAD_LIMITS,
  type LocalUploadLimitOverrides,
  LocalUploadRequestError,
  prepareLocalUploadArchive,
  readLocalUploadMultipartRequest,
} from "../../lib/fugue/local-upload-server";

const gunzipAsync = promisify(gunzip);
const TEMP_DIRECTORY_PREFIX = "fugue-web-upload-";

type RequestInitWithDuplex = RequestInit & { duplex?: "half" };

function createFilesForm(
  entries: Array<{ content: BlobPart; name: string; path: string }>,
) {
  const form = new FormData();
  form.set("payload", JSON.stringify({ sourceMode: "local-upload" }));

  for (const entry of entries) {
    form.append("files", new File([entry.content], entry.name));
    form.append("paths", entry.path);
  }

  return form;
}

function createFormRequest(form: FormData) {
  return new Request("http://localhost/api/upload", {
    body: form,
    method: "POST",
  });
}

function writeTarString(header: Buffer, offset: number, length: number, value: string) {
  Buffer.from(value, "utf8").copy(header, offset, 0, length);
}

function writeTarOctal(header: Buffer, offset: number, length: number, value: number) {
  writeTarString(
    header,
    offset,
    length,
    `${value.toString(8).padStart(length - 1, "0")}\0`,
  );
}

function createTarArchive(
  entries: Array<{
    content?: string;
    path: string;
    size?: number;
    type?: string;
  }>,
) {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? "", "utf8");
    const size = entry.size ?? content.length;
    const header = Buffer.alloc(512, 0);
    writeTarString(header, 0, 100, entry.path);
    writeTarOctal(header, 100, 8, 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, size);
    writeTarOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? "0").charCodeAt(0);
    writeTarString(header, 257, 6, "ustar");
    writeTarString(header, 263, 2, "00");
    const checksum = header.reduce((total, byte) => total + byte, 0);
    writeTarString(header, 148, 6, checksum.toString(8).padStart(6, "0"));
    header[154] = 0;
    header[155] = 0x20;
    chunks.push(header, content);

    const padding = (512 - (content.length % 512)) % 512;

    if (padding > 0) {
      chunks.push(Buffer.alloc(padding));
    }
  }

  chunks.push(Buffer.alloc(1_024));
  return gzipSync(Buffer.concat(chunks));
}

function createStoredZipArchive(
  entries: Array<{
    compression?: 0 | 8;
    content?: string;
    externalAttributes?: number;
    path: string;
    uncompressedSize?: number;
  }>,
) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const path = Buffer.from(entry.path, "utf8");
    const content = Buffer.from(entry.content ?? "", "utf8");
    const compression = entry.compression ?? 0;
    const encodedContent = compression === 8 ? deflateRawSync(content) : content;
    const uncompressedSize = entry.uncompressedSize ?? content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(compression, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(encodedContent.length, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(path.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, path, encodedContent);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(compression, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(encodedContent.length, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(entry.externalAttributes ?? (0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, path);
    localOffset += local.length + path.length + encodedContent.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function createArchiveForm(bytes: Buffer, name: string) {
  const form = new FormData();
  form.set("payload", JSON.stringify({ sourceMode: "local-upload" }));
  form.set("archive", new File([new Uint8Array(bytes)], name));
  return form;
}

async function createChunkedRequest(form: FormData, chunkBytes = 7) {
  const encodedRequest = createFormRequest(form);
  const contentType = encodedRequest.headers.get("content-type");
  const encodedBody = new Uint8Array(await encodedRequest.arrayBuffer());
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= encodedBody.byteLength) {
        controller.close();
        return;
      }

      const end = Math.min(offset + chunkBytes, encodedBody.byteLength);
      controller.enqueue(encodedBody.subarray(offset, end));
      offset = end;
    },
  });

  return new Request("http://localhost/api/upload", {
    body,
    duplex: "half",
    headers: { "content-type": contentType ?? "" },
    method: "POST",
  } as RequestInitWithDuplex);
}

async function listUploadTemporaryDirectories() {
  return (await readdir(tmpdir()))
    .filter((name) => name.startsWith(TEMP_DIRECTORY_PREFIX))
    .sort();
}

function expectUploadError(status: LocalUploadRequestError["status"]) {
  return (error: unknown) => {
    assert.ok(error instanceof LocalUploadRequestError);
    assert.equal(error.status, status);
    return true;
  };
}

test("streams chunked multipart files to private temporary storage and packages them", async () => {
  const request = await createChunkedRequest(
    createFilesForm([
      { content: "hello", name: "hello.txt", path: "demo/hello.txt" },
      { content: "world", name: "world.txt", path: "demo/nested/world.txt" },
    ]),
  );
  assert.equal(request.headers.has("content-length"), false);

  const upload = await readLocalUploadMultipartRequest(request);

  try {
    assert.equal(upload.kind, "files");
    assert.equal(upload.files.length, 2);
    assert.equal((await stat(upload.temporaryDirectory)).mode & 0o777, 0o700);
    const [firstFile] = upload.files;
    assert.ok(firstFile);
    assert.equal((await stat(firstFile.temporaryPath)).mode & 0o777, 0o600);

    const archive = await prepareLocalUploadArchive(upload, {
      archiveBaseName: "streamed-demo",
    });
    const tar = await gunzipAsync(Buffer.from(await archive.archiveBody.arrayBuffer()));
    const firstName = tar.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const firstSize = Number.parseInt(
      tar.subarray(124, 136).toString("ascii").replace(/\0.*$/s, "").trim(),
      8,
    );

    assert.equal(firstName, "hello.txt");
    assert.equal(tar.subarray(512, 512 + firstSize).toString("utf8"), "hello");
    assert.equal(archive.archiveName, "streamed-demo.tgz");
  } finally {
    const temporaryDirectory = upload.temporaryDirectory;
    await upload.cleanup();
    await assert.rejects(access(temporaryDirectory, fsConstants.F_OK));
  }
});

test("rejects an oversized Content-Length before consuming the body", async () => {
  let bodyReads = 0;
  const request = {
    get body() {
      bodyReads += 1;
      throw new Error("body must not be read");
    },
    headers: new Headers({
      "content-length": String(DEFAULT_LOCAL_UPLOAD_LIMITS.maxRequestBytes + 1),
      "content-type": "multipart/form-data; boundary=bounded-test",
    }),
    signal: new AbortController().signal,
  } as unknown as Request;

  await assert.rejects(
    readLocalUploadMultipartRequest(request),
    expectUploadError(413),
  );
  assert.equal(bodyReads, 0);
});

test("enforces the streamed request limit when Content-Length is missing", async () => {
  const request = await createChunkedRequest(
    createFilesForm([{ content: "small", name: "small", path: "small" }]),
  );

  await assert.rejects(
    readLocalUploadMultipartRequest(request, { maxRequestBytes: 100 }),
    expectUploadError(413),
  );
});

test("times out a stalled upload and removes its temporary directory", async () => {
  const boundary = "stalled-upload";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n`,
        ),
      );
    },
  });
  const request = new Request("http://localhost/api/upload", {
    body,
    duplex: "half",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    method: "POST",
  } as RequestInitWithDuplex);
  const before = await listUploadTemporaryDirectories();

  await assert.rejects(
    readLocalUploadMultipartRequest(request, { maxDurationMilliseconds: 20 }),
    expectUploadError(408),
  );
  assert.deepEqual(await listUploadTemporaryDirectories(), before);
});

test("enforces single-file, total-file and file-count limits while streaming", async () => {
  const cases: Array<{
    entries: Array<{ content: BlobPart; name: string; path: string }>;
    limits: LocalUploadLimitOverrides;
  }> = [
    {
      entries: [{ content: "1234", name: "one.txt", path: "one.txt" }],
      limits: { maxFileBytes: 3 },
    },
    {
      entries: [
        { content: "123", name: "one.txt", path: "one.txt" },
        { content: "456", name: "two.txt", path: "two.txt" },
      ],
      limits: { maxFileBytes: 4, maxSourceBytes: 5 },
    },
    {
      entries: [
        { content: "1", name: "one.txt", path: "one.txt" },
        { content: "2", name: "two.txt", path: "two.txt" },
      ],
      limits: { maxFiles: 1 },
    },
  ];

  for (const entry of cases) {
    const before = await listUploadTemporaryDirectories();
    await assert.rejects(
      readLocalUploadMultipartRequest(
        await createChunkedRequest(createFilesForm(entry.entries)),
        entry.limits,
      ),
      expectUploadError(413),
    );
    assert.deepEqual(await listUploadTemporaryDirectories(), before);
  }
});

test("rejects traversal, ambiguous, duplicate, deep and overlong paths", async () => {
  const pathCases: Array<{
    entries: Array<{ content: BlobPart; name: string; path: string }>;
    limits?: LocalUploadLimitOverrides;
    status?: LocalUploadRequestError["status"];
  }> = [
    { entries: [{ content: "x", name: "a", path: "../escape" }] },
    { entries: [{ content: "x", name: "a", path: "folder\\escape" }] },
    { entries: [{ content: "x", name: "a", path: "/absolute" }] },
    {
      entries: [
        { content: "x", name: "a", path: "same" },
        { content: "y", name: "b", path: "same" },
      ],
    },
    {
      entries: [{ content: "x", name: "a", path: "a/b/c" }],
      limits: { maxPathDepth: 2 },
    },
    {
      entries: [{ content: "x", name: "a", path: "long-name" }],
      limits: { maxPathBytes: 8 },
      status: 413,
    },
  ];

  for (const entry of pathCases) {
    await assert.rejects(
      readLocalUploadMultipartRequest(
        createFormRequest(createFilesForm(entry.entries)),
        entry.limits,
      ),
      expectUploadError(entry.status ?? 400),
    );
  }
});

test("rejects concurrent uploads and releases the slot after cleanup", async () => {
  const limits = { maxConcurrentRequests: 1 } satisfies LocalUploadLimitOverrides;
  const first = await readLocalUploadMultipartRequest(
    createFormRequest(createFilesForm([{ content: "one", name: "one", path: "one" }])),
    limits,
  );

  try {
    await assert.rejects(
      readLocalUploadMultipartRequest(
        createFormRequest(
          createFilesForm([{ content: "two", name: "two", path: "two" }]),
        ),
        limits,
      ),
      expectUploadError(429),
    );
  } finally {
    await first.cleanup();
  }

  const next = await readLocalUploadMultipartRequest(
    createFormRequest(
      createFilesForm([{ content: "next", name: "next", path: "next" }]),
    ),
    limits,
  );
  await next.cleanup();
});

test("aborts archive generation and removes temporary files after disconnect", async () => {
  const controller = new AbortController();
  const form = createFilesForm([{ content: "source", name: "source", path: "source" }]);
  const request = new Request("http://localhost/api/upload", {
    body: form,
    method: "POST",
    signal: controller.signal,
  });
  const upload = await readLocalUploadMultipartRequest(request);
  const temporaryDirectory = upload.temporaryDirectory;
  controller.abort();

  try {
    await assert.rejects(prepareLocalUploadArchive(upload), expectUploadError(400));
  } finally {
    await upload.cleanup();
  }

  await assert.rejects(access(temporaryDirectory, fsConstants.F_OK));
});

test("rejects a direct archive whose bytes do not match its extension", async () => {
  const form = new FormData();
  form.set("payload", JSON.stringify({ sourceMode: "local-upload" }));
  form.set("archive", new File(["not-a-gzip"], "source.tgz"));
  const upload = await readLocalUploadMultipartRequest(createFormRequest(form));

  try {
    await assert.rejects(prepareLocalUploadArchive(upload), expectUploadError(415));
  } finally {
    await upload.cleanup();
  }
});

test("inspects tar.gz entries before forwarding a direct archive", async () => {
  const validUpload = await readLocalUploadMultipartRequest(
    createFormRequest(
      createArchiveForm(
        createTarArchive([{ content: "hello", path: "src/hello.txt" }]),
        "source.tgz",
      ),
    ),
  );

  try {
    const prepared = await prepareLocalUploadArchive(validUpload);
    assert.equal(prepared.archiveName, "source.tgz");
    assert.ok(prepared.archiveSize > 0);
  } finally {
    await validUpload.cleanup();
  }

  const cases: Array<{
    entries: Parameters<typeof createTarArchive>[0];
    limits?: LocalUploadLimitOverrides;
    status: LocalUploadRequestError["status"];
  }> = [
    {
      entries: [{ content: "x", path: "../escape" }],
      status: 400,
    },
    {
      entries: [{ path: "link", type: "2" }],
      status: 400,
    },
    {
      entries: [
        { content: "one", path: "duplicate" },
        { content: "two", path: "duplicate" },
      ],
      status: 400,
    },
    {
      entries: [{ content: "1234", path: "large" }],
      limits: { maxFileBytes: 3 },
      status: 413,
    },
    {
      entries: [
        { content: "123", path: "one" },
        { content: "456", path: "two" },
      ],
      limits: { maxSourceBytes: 5 },
      status: 413,
    },
    {
      entries: [
        { content: "1", path: "one" },
        { content: "2", path: "two" },
      ],
      limits: { maxFiles: 1 },
      status: 413,
    },
  ];

  for (const entry of cases) {
    const upload = await readLocalUploadMultipartRequest(
      createFormRequest(
        createArchiveForm(createTarArchive(entry.entries), "source.tgz"),
      ),
      entry.limits,
    );

    try {
      await assert.rejects(
        prepareLocalUploadArchive(upload),
        expectUploadError(entry.status),
      );
    } finally {
      await upload.cleanup();
    }
  }
});

test("rejects unsafe and oversized ZIP metadata before forwarding", async () => {
  const validCompressedUpload = await readLocalUploadMultipartRequest(
    createFormRequest(
      createArchiveForm(
        createStoredZipArchive([
          { compression: 8, content: "compressed source", path: "src/main.txt" },
        ]),
        "source.zip",
      ),
    ),
  );

  try {
    const prepared = await prepareLocalUploadArchive(validCompressedUpload);
    assert.equal(prepared.archiveName, "source.zip");
  } finally {
    await validCompressedUpload.cleanup();
  }

  const cases: Array<{
    entries: Parameters<typeof createStoredZipArchive>[0];
    limits?: LocalUploadLimitOverrides;
    status: LocalUploadRequestError["status"];
  }> = [
    {
      entries: [{ content: "x", path: "../escape" }],
      status: 400,
    },
    {
      entries: [
        {
          content: "target",
          externalAttributes: (0o120777 << 16) >>> 0,
          path: "link",
        },
      ],
      status: 400,
    },
    {
      entries: [
        { content: "one", path: "duplicate" },
        { content: "two", path: "duplicate" },
      ],
      status: 400,
    },
    {
      entries: [{ content: "x", path: "bomb", uncompressedSize: 10 }],
      limits: { maxFileBytes: 4, maxSourceBytes: 4 },
      status: 413,
    },
    {
      entries: [
        {
          compression: 8,
          content: "x".repeat(1_024),
          path: "forged-size",
          uncompressedSize: 1,
        },
      ],
      limits: { maxFileBytes: 2, maxSourceBytes: 2 },
      status: 413,
    },
  ];

  for (const entry of cases) {
    const upload = await readLocalUploadMultipartRequest(
      createFormRequest(
        createArchiveForm(createStoredZipArchive(entry.entries), "source.zip"),
      ),
      entry.limits,
    );

    try {
      await assert.rejects(
        prepareLocalUploadArchive(upload),
        expectUploadError(entry.status),
      );
    } finally {
      await upload.cleanup();
    }
  }
});

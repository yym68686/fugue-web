import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    check: false,
    source: null,
    target: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--check") {
      args.check = true;
      continue;
    }

    if (value === "--source") {
      args.source = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === "--target") {
      args.target = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

async function readNormalizedFile(filePath) {
  const contents = await readFile(filePath, "utf8");
  return contents.replace(/\r\n/g, "\n").replace(/\s*$/, "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();
  const sourcePath = path.resolve(
    workspaceRoot,
    args.source ?? process.env.FUGUE_OPENAPI_SOURCE ?? "../fugue/openapi/openapi.yaml",
  );
  const targetPath = path.resolve(workspaceRoot, args.target ?? "openapi/fugue.yaml");
  const sourceContents = await readNormalizedFile(sourcePath);

  if (args.check) {
    const targetContents = await readNormalizedFile(targetPath);

    if (targetContents !== sourceContents) {
      throw new Error(
        `OpenAPI snapshot drift detected.\nSource: ${sourcePath}\nTarget: ${targetPath}\nRun: npm run openapi:refresh`,
      );
    }

    process.stdout.write(`OpenAPI snapshot is current: ${targetPath}\n`);
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, sourceContents, "utf8");
  process.stdout.write(`Synced OpenAPI snapshot to ${targetPath}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

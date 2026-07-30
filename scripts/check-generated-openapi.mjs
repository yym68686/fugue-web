import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function normalized(contents) {
  return contents.replace(/\r\n/g, "\n").replace(/\s*$/, "\n");
}

async function main() {
  const workspaceRoot = process.cwd();
  const schemaPath = path.resolve(workspaceRoot, "openapi/fugue.yaml");
  const generatedPath = path.resolve(workspaceRoot, "lib/fugue/openapi.generated.ts");
  const cliPath = path.resolve(
    workspaceRoot,
    "node_modules/openapi-typescript/bin/cli.js",
  );
  const { stdout } = await execFileAsync(process.execPath, [cliPath, schemaPath], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const committed = await readFile(generatedPath, "utf8");

  if (normalized(stdout) !== normalized(committed)) {
    throw new Error(
      `Generated OpenAPI types drift detected.\nRun: npm run openapi:generate`,
    );
  }
  process.stdout.write(`Generated OpenAPI types are current: ${generatedPath}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

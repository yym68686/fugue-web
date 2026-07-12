import { access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const serverOnlyModule = "data:text/javascript,export%20{}";

async function resolveTypeScriptCandidate(url) {
  if (url.protocol !== "file:") {
    return null;
  }

  const path = fileURLToPath(url);
  const candidates = [
    `${path}.ts`,
    `${path}.tsx`,
    join(path, "index.ts"),
    join(path, "index.tsx"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return pathToFileURL(candidate).href;
    } catch {
      // Try the next TypeScript resolution candidate.
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: serverOnlyModule };
  }

  if (specifier.startsWith("@/")) {
    const candidateUrl = pathToFileURL(join(projectRoot, specifier.slice(2)));
    const resolved = await resolveTypeScriptCandidate(candidateUrl);

    if (resolved) {
      return { shortCircuit: true, url: resolved };
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      (!specifier.startsWith(".") && !specifier.startsWith("/"))
    ) {
      throw error;
    }

    const candidateUrl = new URL(specifier, context.parentURL);
    const resolved = await resolveTypeScriptCandidate(candidateUrl);

    if (!resolved) {
      throw error;
    }

    return { shortCircuit: true, url: resolved };
  }
}

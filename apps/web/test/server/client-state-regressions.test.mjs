import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("endpoint state retries and rejects aborted or superseded responses", async () => {
  const source = await readRepositoryFile(
    "components/fugue-coss/project-workbench-shared.ts",
  );

  assert.match(source, /const \[refreshKey, setRefreshKey\] = useState\(0\)/);
  assert.match(source, /\}, \[initialData, url, refreshKey\]\);/);
  assert.match(source, /return \(\) => controller\.abort\(\)/);
  assert.match(source, /requestIdentityRef\.current !== requestIdentity/);
  assert.match(source, /state\.endpoint === url/);
});

test("DNS timestamps use the server-negotiated locale instead of host defaults", async () => {
  const page = await readRepositoryFile("app/app/dns/page.tsx");
  const consoleSource = await readRepositoryFile(
    "components/fugue-coss/dns-console.tsx",
  );

  assert.match(page, /const \{ locale, t \} = await getRequestI18n\(\)/);
  assert.match(page, /title=\{t\("Hosted DNS"\)\}/);
  assert.match(
    page,
    /<DNSConsole locale=\{locale\} messages=\{createDnsStateMessages\(t\)\} \/>/,
  );
  assert.match(consoleSource, /new Intl\.DateTimeFormat\(locale,/);
  assert.doesNotMatch(consoleSource, /new Intl\.DateTimeFormat\(undefined,/);
});

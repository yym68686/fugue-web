import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fonts } from "@/registry/registry-fonts";
import { styles } from "@/registry/registry-styles";

type TokenMap = Record<string, string>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.resolve(appRoot, "../../packages/ui");

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readBlock(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex < 0) {
    throw new Error(`Missing CSS block: ${selector}`);
  }

  const openingBrace = source.indexOf("{", selectorIndex + selector.length);
  if (openingBrace < 0) {
    throw new Error(`Missing opening brace for CSS block: ${selector}`);
  }

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }

  throw new Error(`Missing closing brace for CSS block: ${selector}`);
}

function declarations(block: string) {
  return new Map<string, string>(
    [...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(
      (match): [string, string] => {
        const [, name, value] = match;
        if (!name || value === undefined) {
          throw new Error(`Invalid CSS custom property declaration: ${match[0]}`);
        }
        return [name, normalize(value)];
      },
    ),
  );
}

function splitLightDark(value: string): [string, string] {
  if (!value.startsWith("light-dark(") || !value.endsWith(")")) {
    return [value, value];
  }

  const inner = value.slice("light-dark(".length, -1);
  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      return [normalize(inner.slice(0, index)), normalize(inner.slice(index + 1))];
    }
  }

  throw new Error(`Could not split light-dark value: ${value}`);
}

function sorted(values: Iterable<string>) {
  return [...values].sort();
}

function compareSets(label: string, left: Iterable<string>, right: Iterable<string>) {
  const expected = sorted(left);
  const actual = sorted(right);
  return JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : [`${label}: expected ${expected.join(", ")}; received ${actual.join(", ")}`];
}

export async function validateThemeParity() {
  const errors: string[] = [];
  const [globals, fontExports, packageManifestSource] = await Promise.all([
    readFile(path.join(packageRoot, "src/styles/globals.css"), "utf8"),
    readFile(path.join(packageRoot, "src/fonts/index.ts"), "utf8"),
    readFile(path.join(packageRoot, "package.json"), "utf8"),
  ]);
  const packageManifest = JSON.parse(packageManifestSource) as {
    dependencies?: Record<string, string>;
    exports?: Record<string, string>;
  };
  const style = styles.find((item) => item.name === "style");
  const neutral = styles.find((item) => item.name === "colors-neutral");
  if (!style?.cssVars || !neutral?.cssVars) {
    return { errors: ["Registry style and colors-neutral metadata are required."] };
  }

  const light = style.cssVars.light as TokenMap;
  const dark = style.cssVars.dark as TokenMap;
  const theme = style.cssVars.theme as TokenMap;
  const neutralLight = neutral.cssVars.light as TokenMap;
  const neutralDark = neutral.cssVars.dark as TokenMap;
  const lightTokenKeys = Object.keys(light).filter((key) => key !== "radius");
  const darkTokenKeys = Object.keys(dark);
  errors.push(
    ...compareSets(
      "Registry light/dark semantic token keys",
      lightTokenKeys,
      darkTokenKeys,
    ),
  );

  for (const [key, value] of Object.entries(neutralLight)) {
    if (normalize(light[key] ?? "") !== normalize(value)) {
      errors.push(`colors-neutral light ${key} differs from style metadata.`);
    }
  }
  for (const [key, value] of Object.entries(neutralDark)) {
    if (normalize(dark[key] ?? "") !== normalize(value)) {
      errors.push(`colors-neutral dark ${key} differs from style metadata.`);
    }
  }

  const runtimeRoot = declarations(readBlock(globals, ":root"));
  const runtimeTokenKeys = [...runtimeRoot.keys()].filter((key) => key !== "radius");
  errors.push(
    ...compareSets(
      "Registry/runtime semantic token keys",
      lightTokenKeys,
      runtimeTokenKeys,
    ),
  );

  for (const key of lightTokenKeys) {
    const runtimeValue = runtimeRoot.get(key);
    if (!runtimeValue) continue;
    const [runtimeLight, runtimeDark] = splitLightDark(runtimeValue);
    if (normalize(light[key] ?? "") !== runtimeLight) {
      errors.push(`Runtime light --${key} differs from registry style metadata.`);
    }
    if (normalize(dark[key] ?? "") !== runtimeDark) {
      errors.push(`Runtime dark --${key} differs from registry style metadata.`);
    }
  }

  if (normalize(light.radius ?? "") !== normalize(runtimeRoot.get("radius") ?? "")) {
    errors.push("Runtime --radius differs from registry style metadata.");
  }

  const runtimeTheme = declarations(readBlock(globals, "@theme inline"));
  for (const key of lightTokenKeys) {
    if (runtimeTheme.get(`color-${key}`) !== `var(--${key})`) {
      errors.push(`@theme inline must map --color-${key} to var(--${key}).`);
    }
  }
  for (const key of Object.keys(theme)) {
    if (normalize(runtimeTheme.get(key) ?? "") !== `var(--${key})`) {
      errors.push(`Runtime --${key} must resolve through the root next/font variable.`);
    }
  }

  const fontVariables = fonts
    .filter((item) => item.type === "registry:font")
    .map((item) => item.font?.variable)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^--/, ""));
  errors.push(
    ...compareSets("Registry font variables", Object.keys(theme), fontVariables),
  );

  for (const item of fonts.filter((entry) => entry.type === "registry:font")) {
    const dependency = item.font?.dependency;
    if (!dependency) {
      errors.push(`${item.name} has no font dependency.`);
      continue;
    }
    if (!packageManifest.dependencies?.[dependency]) {
      errors.push(`${item.name} dependency ${dependency} is absent from @fugue/ui.`);
    }
  }

  if (packageManifest.exports?.["./fonts"] !== "./src/fonts/index.ts") {
    errors.push("@fugue/ui must export ./fonts from ./src/fonts/index.ts.");
  }
  if (!fontExports.includes('from "next/font/local"')) {
    errors.push("@fugue/ui fonts must use the COSS next/font/local runtime boundary.");
  }
  for (const variable of ["--font-sans", "--font-heading", "--font-mono"]) {
    if (!fontExports.includes(`variable: "${variable}"`)) {
      errors.push(`@fugue/ui fonts must expose ${variable} through next/font/local.`);
    }
  }
  for (const dependency of ["@fontsource-variable/inter", "geist/dist/fonts"]) {
    if (!fontExports.includes(dependency)) {
      errors.push(`@fugue/ui runtime fonts must source ${dependency}.`);
    }
  }
  if (globals.includes('@import "@fontsource-variable/inter"')) {
    errors.push(
      "globals.css must not bypass the shared next/font runtime with a Fontsource CSS import.",
    );
  }

  return {
    errors,
    fontCount: fontVariables.length,
    semanticTokenCount: lightTokenKeys.length,
  };
}

if (import.meta.main) {
  const result = await validateThemeParity();
  if (result.errors.length > 0) {
    throw new Error(
      `Theme parity failed:\n${result.errors.map((error) => `  - ${error}`).join("\n")}`,
    );
  }
  console.log(
    `Theme parity passed for ${result.semanticTokenCount} semantic tokens and ${result.fontCount} fonts.`,
  );
}

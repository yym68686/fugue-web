import Prism from "prismjs";

export type PrismCodeLanguage =
  | "plain"
  | "markup"
  | "css"
  | "javascript"
  | "jsx"
  | "typescript"
  | "tsx"
  | "json"
  | "yaml"
  | "bash"
  | "docker"
  | "python"
  | "markdown"
  | "toml"
  | "diff"
  | "sql"
  | "go"
  | "rust"
  | "java"
  | "ruby"
  | "php"
  | "c"
  | "cpp"
  | "csharp"
  | "ini"
  | "makefile";

type HighlightableLanguage = Exclude<PrismCodeLanguage, "plain">;

const CODE_HIGHLIGHT_MAX_LENGTH = 250_000;

const PRISM_LANGUAGE_KEYS: Record<PrismCodeLanguage, string | null> = {
  bash: "bash",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  css: "css",
  diff: "diff",
  docker: "docker",
  go: "go",
  ini: "ini",
  java: "java",
  javascript: "javascript",
  json: "json",
  jsx: "jsx",
  makefile: "makefile",
  markdown: "markdown",
  markup: "markup",
  php: "php",
  plain: null,
  python: "python",
  ruby: "ruby",
  rust: "rust",
  sql: "sql",
  toml: "toml",
  tsx: "tsx",
  typescript: "typescript",
  yaml: "yaml",
};

const PRISM_LANGUAGE_LOADERS: Record<HighlightableLanguage, () => Promise<void>> =
  {
    bash: async () => {
      await import("prismjs/components/prism-bash");
    },
    c: async () => {
      await import("prismjs/components/prism-clike");
      await import("prismjs/components/prism-c");
    },
    cpp: async () => {
      await import("prismjs/components/prism-clike");
      await import("prismjs/components/prism-c");
      await import("prismjs/components/prism-cpp");
    },
    csharp: async () => {
      await import("prismjs/components/prism-clike");
      await import("prismjs/components/prism-csharp");
    },
    css: async () => {
      await import("prismjs/components/prism-markup");
      await import("prismjs/components/prism-css");
    },
    diff: async () => {
      await import("prismjs/components/prism-diff");
    },
    docker: async () => {
      await import("prismjs/components/prism-docker");
    },
    go: async () => {
      await import("prismjs/components/prism-go");
    },
    ini: async () => {
      await import("prismjs/components/prism-ini");
    },
    java: async () => {
      await import("prismjs/components/prism-clike");
      await import("prismjs/components/prism-java");
    },
    javascript: async () => {
      await import("prismjs/components/prism-javascript");
    },
    json: async () => {
      await import("prismjs/components/prism-json");
    },
    jsx: async () => {
      await import("prismjs/components/prism-markup");
      await import("prismjs/components/prism-javascript");
      await import("prismjs/components/prism-jsx");
    },
    makefile: async () => {
      await import("prismjs/components/prism-makefile");
    },
    markdown: async () => {
      await import("prismjs/components/prism-markup");
      await import("prismjs/components/prism-markdown");
    },
    markup: async () => {
      await import("prismjs/components/prism-markup");
    },
    php: async () => {
      await import("prismjs/components/prism-markup");
      await import("prismjs/components/prism-markup-templating");
      await import("prismjs/components/prism-php");
    },
    python: async () => {
      await import("prismjs/components/prism-python");
    },
    ruby: async () => {
      await import("prismjs/components/prism-ruby");
    },
    rust: async () => {
      await import("prismjs/components/prism-rust");
    },
    sql: async () => {
      await import("prismjs/components/prism-sql");
    },
    toml: async () => {
      await import("prismjs/components/prism-toml");
    },
    tsx: async () => {
      await import("prismjs/components/prism-markup");
      await import("prismjs/components/prism-javascript");
      await import("prismjs/components/prism-jsx");
      await import("prismjs/components/prism-typescript");
      await import("prismjs/components/prism-tsx");
    },
    typescript: async () => {
      await import("prismjs/components/prism-javascript");
      await import("prismjs/components/prism-typescript");
    },
    yaml: async () => {
      await import("prismjs/components/prism-yaml");
    },
  };

const prismLanguageRequests = new Map<HighlightableLanguage, Promise<void>>();

function readBasename(path: string) {
  const cleanPath = path.trim().replace(/\/+$/, "");

  if (!cleanPath) {
    return "";
  }

  const parts = cleanPath.split("/");
  return parts[parts.length - 1] ?? cleanPath;
}

export function inferPrismLanguage(path?: string | null) {
  const filename = readBasename(path ?? "").toLowerCase();

  if (!filename) {
    return "plain" as const;
  }

  if (filename === "dockerfile") {
    return "docker" as const;
  }

  if (filename === "makefile" || filename === "justfile") {
    return "makefile" as const;
  }

  if (filename === ".editorconfig" || filename === ".npmrc") {
    return "ini" as const;
  }

  if (filename.startsWith(".env")) {
    return "ini" as const;
  }

  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".") + 1)
    : "";

  switch (extension) {
    case "bash":
    case "env":
    case "sh":
    case "zsh":
      return "bash";
    case "c":
    case "h":
      return "c";
    case "cc":
    case "cpp":
    case "cxx":
    case "hh":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "css":
      return "css";
    case "diff":
    case "patch":
      return "diff";
    case "go":
      return "go";
    case "htm":
    case "html":
    case "svg":
    case "xml":
      return "markup";
    case "ini":
    case "conf":
      return "ini";
    case "java":
      return "java";
    case "js":
    case "cjs":
    case "mjs":
      return "javascript";
    case "json":
    case "jsonc":
    case "webmanifest":
      return "json";
    case "jsx":
      return "jsx";
    case "md":
    case "mdx":
      return "markdown";
    case "php":
      return "php";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "rs":
      return "rust";
    case "sql":
      return "sql";
    case "toml":
      return "toml";
    case "ts":
    case "cts":
    case "mts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plain";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function isPrismLanguageReady(language: PrismCodeLanguage) {
  const grammarKey = PRISM_LANGUAGE_KEYS[language];

  if (!grammarKey) {
    return true;
  }

  return Boolean(Prism.languages[grammarKey]);
}

export async function ensurePrismLanguage(language: HighlightableLanguage) {
  if (isPrismLanguageReady(language)) {
    return;
  }

  const pending = prismLanguageRequests.get(language);

  if (pending) {
    await pending;
    return;
  }

  const request = PRISM_LANGUAGE_LOADERS[language]()
    .catch((error) => {
      prismLanguageRequests.delete(language);
      throw error;
    })
    .then(() => {
      prismLanguageRequests.delete(language);
    });

  prismLanguageRequests.set(language, request);
  await request;
}

export function highlightCode(value: string, language: PrismCodeLanguage) {
  if (!value) {
    return " ";
  }

  if (value.length > CODE_HIGHLIGHT_MAX_LENGTH) {
    return escapeHtml(value);
  }

  const grammarKey = PRISM_LANGUAGE_KEYS[language];

  if (!grammarKey) {
    return escapeHtml(value);
  }

  const grammar = Prism.languages[grammarKey];

  if (!grammar) {
    return escapeHtml(value);
  }

  try {
    return Prism.highlight(value, grammar, grammarKey);
  } catch {
    return escapeHtml(value);
  }
}

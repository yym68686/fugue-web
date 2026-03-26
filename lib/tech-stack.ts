export type TechStackBadgeKind =
  | "buildpacks"
  | "dotnet"
  | "docker"
  | "go"
  | "github"
  | "java"
  | "nextjs"
  | "nixpacks"
  | "node"
  | "postgres"
  | "php"
  | "python"
  | "react"
  | "runtime"
  | "ruby"
  | "rust"
  | "static";

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function readTechnologyLabel(value?: string | null) {
  switch (normalize(value)) {
    case "next":
    case "nextjs":
      return "Next.js";
    case "react":
      return "React";
    case "node":
    case "nodejs":
      return "Node.js";
    case "python":
      return "Python";
    case "go":
      return "Go";
    case "java":
      return "Java";
    case "ruby":
      return "Ruby";
    case "php":
      return "PHP";
    case "dotnet":
      return ".NET";
    case "rust":
      return "Rust";
    default:
      return null;
  }
}

export function readLanguageBadgeKind(value?: string | null): TechStackBadgeKind | null {
  switch (normalize(value)) {
    case "next":
    case "nextjs":
      return "nextjs";
    case "react":
      return "react";
    case "node":
    case "nodejs":
      return "node";
    case "python":
      return "python";
    case "go":
      return "go";
    case "java":
      return "java";
    case "ruby":
      return "ruby";
    case "php":
      return "php";
    case "dotnet":
      return "dotnet";
    case "rust":
      return "rust";
    default:
      return null;
  }
}

export function readBuildBadgeKind(value?: string | null): TechStackBadgeKind | null {
  switch (normalize(value)) {
    case "dockerfile":
      return "docker";
    case "buildpacks":
      return "buildpacks";
    case "nixpacks":
      return "nixpacks";
    case "static-site":
      return "static";
    default:
      return null;
  }
}

export function readTechStackBadgeKind(
  kind?: string | null,
  slug?: string | null,
): TechStackBadgeKind | null {
  const normalizedKind = normalize(kind) || "stack";
  const normalizedSlug = normalize(slug);

  if (!normalizedSlug) {
    return null;
  }

  if (normalizedKind === "build") {
    return readBuildBadgeKind(normalizedSlug) ?? "runtime";
  }

  if (normalizedKind === "service") {
    return normalizedSlug === "postgres" ? "postgres" : "runtime";
  }

  if (normalizedKind === "language" || normalizedKind === "stack") {
    return readLanguageBadgeKind(normalizedSlug) ?? "runtime";
  }

  return readLanguageBadgeKind(normalizedSlug);
}

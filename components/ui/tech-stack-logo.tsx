import type { TechStackBadgeKind } from "@/lib/tech-stack";

const IMAGE_LOGOS: Partial<Record<TechStackBadgeKind, string>> = {
  docker: "/tech-stack-logos/docker.png",
  dotnet: "/tech-stack-logos/dotnet.png",
  github: "/tech-stack-logos/github.png",
  go: "/tech-stack-logos/go.png",
  java: "/tech-stack-logos/java.png",
  nextjs: "/tech-stack-logos/nextjs.png",
  node: "/tech-stack-logos/node.png",
  php: "/tech-stack-logos/php.png",
  postgres: "/tech-stack-logos/postgres.png",
  python: "/tech-stack-logos/python.png",
  react: "/tech-stack-logos/react.png",
  ruby: "/tech-stack-logos/ruby.png",
  rust: "/tech-stack-logos/rust.png",
};

export function TechStackLogo({ kind }: { kind: TechStackBadgeKind }) {
  const imageSrc = IMAGE_LOGOS[kind];

  if (imageSrc) {
    return (
      <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--image" data-kind={kind}>
        <img
          alt=""
          className="fg-tech-stack-logo__image"
          decoding="async"
          draggable="false"
          height={96}
          src={imageSrc}
          width={96}
        />
      </span>
    );
  }

  switch (kind) {
    case "nextjs":
      return (
        <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--glyph" data-kind={kind}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" fill="none" r="8.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M8.1 16.7V7.3h1.46l5.26 6.92V7.3h1.2v9.4h-1.36L9.3 9.58v7.12H8.1Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "buildpacks":
      return (
        <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--glyph" data-kind={kind}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M4 6.5 9.5 3 15 6.5 9.5 10 4 6.5Zm5.5 4.5L15 7.5 20.5 11 15 14.5 9.5 11Zm-5.5 5L9.5 12.5 15 16 9.5 19.5 4 16Zm11 0 5.5-3.5V18L15 21.5V16Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "nixpacks":
      return (
        <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--glyph" data-kind={kind}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="m12 2.5 8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4L12 2.5Zm0 3.05L6.5 8.7v6.6l5.5 3.15 5.5-3.15V8.7L12 5.55Zm0 2.2 3.3 1.9v3.8L12 15.35l-3.3-1.9v-3.8L12 7.75Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "static":
      return (
        <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--glyph" data-kind={kind}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Zm0 2V17h16V7.5H4Zm2.2 2.1h5.3v1.9H6.2V9.6Zm0 3.3h8.8v1.9H6.2v-1.9Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
    case "runtime":
      return (
        <span aria-hidden="true" className="fg-tech-stack-logo fg-tech-stack-logo--glyph" data-kind={kind}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Zm0 2v7h16v-7H4Zm2 1.75h6v1.5H6v-1.5Zm0 3h9.5v1.5H6v-1.5Zm10.8-2.88a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"
              fill="currentColor"
            />
          </svg>
        </span>
      );
  }

  return null;
}
